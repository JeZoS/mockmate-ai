import { api } from "./api";

// Convert Backend History to Frontend Messages
export const convertHistoryToMessages = (history) => {
  const messages = [];
  history.forEach((turn, index) => {
    if(turn.role === 'model' || turn.role === 'user') {
      
      const hasInlineData = turn.parts.some(p => p.inlineData);
      const textPart = turn.parts.find(p => p.text);
      let textToShow = textPart ? textPart.text : "";

      if (turn.role === 'user') {
          if (hasInlineData) {
              const mimeType = turn.parts.find(p => p.inlineData)?.inlineData?.mimeType || "";
              if (mimeType.startsWith('audio/')) {
                  textToShow = "🎤 Audio Answer Submitted";
              } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
                  if (textToShow?.includes("Here is my resume")) {
                      textToShow = "📄 Resume Uploaded";
                  }
              }
          }
      }

      if(textToShow) {
        messages.push({
          id: `hist-${index}`,
          role: turn.role,
          text: textToShow || "",
          timestamp: new Date(), 
          isThinking: false,
          isAudio: turn.role === 'user' && hasInlineData && textToShow === "🎤 Audio Answer Submitted"
        });
      }
    }
  });
  return messages;
};

// --- Backend Chat Session Abstraction ---
export class BackendChatSession {
  constructor(model, config, initialHistory = []) {
    this.modelName = model;
    this.systemInstruction = config.systemInstruction || '';
    this.maxOutputTokens = config.maxOutputTokens || 1024;
    this.language = config.language || 'English';
    this.history = initialHistory;
    this.interviewId = config.interviewId || null;
  }
}

// --- Coordinator (Manual Role) ---
export const createCoordinatorChat = (language = 'English') => {
  return new BackendChatSession('mockmate-coordinator', {
    language,
    systemInstruction: `You are a friendly and efficient Interview Coordinator AI. 
Your goal is to gather three specific pieces of information from the user to set up a mock interview.
This interview can be for ANY role (Tech, Sales, Marketing, HR, etc.).

1. The Target Role (e.g., Frontend Dev, Sales Representative, Project Manager).
2. The Focus Area, Tech Stack, or Industry (e.g., React/Node, B2B SaaS, Agile methodologies).
3. The Experience Level (e.g., Junior, Senior, Staff, VP).

Instructions:
- Ask ONE question at a time. Do not overwhelm the user.
- Start by asking what role they are practicing for.
- Once you have all three pieces of information clearly, you MUST output a final JSON block strictly in this format and stop:
  \`\`\`json
  { "READY": true, "role": "...", "focusArea": "...", "level": "..." }
  \`\`\`
- Until you have all info, just chat normally and ask the next relevant question.
`
  });
};

// --- Coordinator (Resume Based) ---
export const createResumeCoordinatorChat = (language = 'English') => {
  return new BackendChatSession('mockmate-coordinator', {
    maxOutputTokens: 2048,
    language,
    systemInstruction: `You are an expert Career Coach and Interview Coordinator.
The user has uploaded their resume. Your goal is to:
1. Analyze the resume to identify their strongest skills and potential job roles.
2. Propose 2-3 specific interview scenarios or roles they could practice for (e.g., "Based on your experience with React and AWS, we could do a Senior Frontend or a Full Stack interview. Which do you prefer?").
3. Discuss with the user to select ONE specific path.
4. Determine the experience level if not obvious from the resume.

Once the user confirms the specific Role and Focus Area they want to practice, you MUST output a final JSON block strictly in this format and stop:
\`\`\`json
{ "READY": true, "role": "...", "focusArea": "...", "level": "..." }
\`\`\`
`
  });
};

export const sendResumeToChat = async (chat, fileBase64, mimeType) => {
  let fullText = "";
  
  const messagePart = {
    parts: [
      { inlineData: { mimeType, data: fileBase64 } },
      { text: "Here is my resume. Please analyze it, tell me what roles I am best suited for, and let's choose one for a mock interview." }
    ]
  };

  await sendMessageStream(chat, messagePart, (chunk) => {
    fullText += chunk;
  });

  return fullText;
};

// --- Interviewer ---
export const createInterviewerChat = (context, existingHistory = [], interviewId = null) => {
  
  let systemContext = "";
  if (context.jd) {
    systemContext = `The user has provided the following Job Description (JD):\n"""\n${context.jd}\n"""\nBase your interview questions and evaluation criteria strictly on this JD.`;
  } else {
    systemContext = `The user is practicing for a ${context.role} position.\nFocus Area/Skills: ${context.focusArea}\nExperience Level: ${context.level}`;
  }
  
  const resumeInstruction = context.resumeData 
    ? "A resume has been provided. You MUST ask at least 2 specific questions about the projects, experience, and skills listed in the user's resume. Verify their details and ask for deep dives into their past work." 
    : "No resume provided. Ask standard questions for the role.";

  const systemInstruction = `You are an expert Professional Interviewer conducting a mock interview.
${systemContext}
${resumeInstruction}

Your Responsibilities:
1. Conduct a professional, realistic interview tailored to the specific role and level.
2. If a resume is provided, prioritize asking about specific projects, metrics, and experiences mentioned in it.
3. If the role is technical, ask coding or system design questions. If non-technical (Sales, HR, etc.), ask situational, behavioral, or strategic questions.
4. Ask ONE question at a time. Wait for the user's response.
5. Start by introducing yourself and asking the first question.
6. Keep your responses concise enough to be spoken (approx 2-4 sentences is ideal for conversation).
7. If the user's answer is correct/good, briefly acknowledge it and move to a harder or related question.
8. If the user's answer is incorrect or vague, gently dig deeper or clarify.
9. Maintain a professional yet neutral tone.

IMPORTANT: You will receive audio input from the user. Respond with clear, spoken-style text.
`;

  let history = existingHistory.length > 0 ? existingHistory : [];
  
  if (history.length === 0 && context.resumeData) {
     history = [
      {
        role: 'user',
        parts: [
          { inlineData: { data: context.resumeData.base64, mimeType: context.resumeData.mimeType } },
          { text: "Here is my resume. Please use it to tailor the interview questions, specifically asking about my projects and past experience." }
        ]
      },
      {
        role: 'model',
        parts: [{ text: "I have reviewed your resume. I will now conduct the interview focusing on your specific experiences and the target role." }]
      }
    ];
  }

  return new BackendChatSession('mockmate-interviewer', { 
    systemInstruction, 
    language: context.language,
    interviewId: interviewId 
  }, history);
};

// --- Feedback Generation ---
export const generateFeedback = async (history, language = 'English') => {
  const conversationText = history
    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  const prompt = `Analyze the following interview transcript and provide detailed feedback.
  
  Transcript:
  ${conversationText}
  
  Provide output in the following JSON schema:
  {
    "overallScore": number (0-100),
    "communicationScore": number (0-100),
    "technicalScore": number (0-100) (Note: use 'technicalScore' for Domain Knowledge if non-tech),
    "strengths": string[] (3-5 bullet points),
    "weaknesses": string[] (3-5 bullet points),
    "suggestion": string (A paragraph of constructive advice)
  }`;

  try {
    return await api.generateFeedback(prompt, language);
  } catch (error) {
    console.error("Error generating feedback:", error);
    return {
      overallScore: 0,
      communicationScore: 0,
      technicalScore: 0,
      strengths: ["Could not generate feedback"],
      weaknesses: ["Backend Error"],
      suggestion: "Please try again."
    };
  }
};

// --- Text Messaging ---
export const sendMessageStream = async (chat, messageInput, onChunk) => {
  let fullText = "";
  
  const chatSession = chat;
  
  let userContent;
  if (typeof messageInput === 'string') {
      userContent = { role: 'user', parts: [{ text: messageInput }] };
  } else if (messageInput.parts) {
      userContent = { role: 'user', parts: messageInput.parts };
  } else {
      userContent = { role: 'user', parts: [{ text: JSON.stringify(messageInput) }] };
  }

  try {
    const config = { 
        systemInstruction: chatSession.systemInstruction, 
        modelName: chatSession.modelName,
        maxOutputTokens: chatSession.maxOutputTokens,
        language: chatSession.language,
        interviewId: chatSession.interviewId // Pass ID here
    };
    
    await api.chatStream(
        chatSession.history, 
        messageInput, 
        config,
        (chunk) => {
            fullText += chunk;
            onChunk(fullText);
        }
    );

    // Update local history for UI consistency
    chatSession.history.push(userContent);
    chatSession.history.push({ role: 'model', parts: [{ text: fullText }] });

  } catch (error) {
    console.error("Error in chat stream:", error);
    onChunk("Error communicating with AI service.");
  }
  
  return fullText;
};

export const sendAudioMessage = async (chat, audioBase64, mimeType) => {
  
  const message = {
    parts: [
      {
        inlineData: {
          mimeType: mimeType,
          data: audioBase64
        }
      },
      {
        text: "Please evaluate my answer and ask the next question."
      }
    ]
  };

  let fullText = "";
  await sendMessageStream(chat, message, (chunk) => {
      fullText += chunk;
  });
  return fullText;
};

// --- TTS ---
export const generateSpeech = async (text) => {
  try {
    const data = await api.generateSpeech(text);
    if (!data.audio) return null;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(
      decode(data.audio),
      audioContext,
      24000,
      1
    );
    return audioBuffer;

  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

// --- Audio Utils ---
function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const playAudioBuffer = (buffer) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
};