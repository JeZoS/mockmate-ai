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
- Start by asking what role they are practicing for.- If the user provides all three details in a single message (role, focus/stack, and level), immediately output the final JSON block (as shown below) and stop — do NOT ask follow-up questions.- Once you have all three pieces of information clearly, you MUST output a final JSON block strictly in this format and stop:
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
    maxOutputTokens: 1024,
    language,
    systemInstruction: `You are an expert Career Coach and Interview Coordinator.
The user has already had their resume analyzed. You have been provided with a structured analysis of their resume.
Your job now is to help them select ONE specific interview role and focus area from the suggested options.

Instructions:
- Keep responses BRIEF and CONVERSATIONAL (under 100 words).
- If the user picks a role, confirm it and ask for any specific focus or level adjustments.
- Once they confirm a specific Role, Focus Area, and Level, output:
\`\`\`json
{ "READY": true, "role": "...", "focusArea": "...", "level": "..." }
\`\`\`
`
  });
};

// Format the structured resume analysis into a conversational message
export const formatResumeAnalysis = (analysis) => {
  const { greeting, strengthsSummary, suggestedRoles, suggestion } = analysis;
  
  let message = `${greeting} ${strengthsSummary}\n\n`;
  message += `Based on your background, I suggest we practice for one of these roles:\n\n`;
  
  suggestedRoles.forEach((role, index) => {
    message += `**${index + 1}. ${role.role}**: ${role.reason} *(Focus: ${role.focusArea})*\n\n`;
  });
  
  message += `${suggestion}`;
  
  return message;
};

// Analyze resume using structured function calling
export const analyzeResumeStructured = async (fileBase64, mimeType, language = 'English') => {
  const analysis = await api.analyzeResume(fileBase64, mimeType, language);
  return analysis;
};

// Legacy function - now uses structured analysis
export const sendResumeToChat = async (chat, fileBase64, mimeType, language = 'English') => {
  try {
    // Use the new structured analysis endpoint
    const analysis = await analyzeResumeStructured(fileBase64, mimeType, language);
    
    // Format the analysis into a nice conversational message
    const formattedMessage = formatResumeAnalysis(analysis);
    
    // Store the analysis in the chat session for later use
    chat.resumeAnalysis = analysis;
    
    // Add to chat history so the coordinator knows the context
    chat.history.push({
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        { text: "Here is my resume. Please analyze it." }
      ]
    });
    
    chat.history.push({
      role: 'model',
      parts: [{ text: formattedMessage }]
    });
    
    return { text: formattedMessage, analysis };
  } catch (error) {
    console.error("Error in structured resume analysis:", error);
    // Fallback to old streaming method if structured analysis fails
    let fullText = "";
    
    const messagePart = {
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        { text: "Here is my resume. Please analyze it briefly, identify my top 2-3 strengths, and suggest 2-3 interview roles I could practice for. Keep it concise." }
      ]
    };

    await sendMessageStream(chat, messagePart, (chunk) => {
      fullText += chunk;
    });

    return { text: fullText, analysis: null };
  }
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
    
  const totalQuestions = context.totalQuestions || 10;

  const systemInstruction = `You are an expert Professional Interviewer conducting a mock interview.
${systemContext}
${resumeInstruction}

Your Responsibilities:
1. Conduct a professional, realistic interview tailored to the specific role and level.
2. YOUR FIRST QUESTION MUST ALWAYS BE: "Tell me about yourself" or "Please introduce yourself". This is mandatory.
3. After the introduction, if a resume is provided, prioritize asking about specific projects, metrics, and experiences mentioned in it.
4. If the role is technical, ask coding or system design questions. If non-technical (Sales, HR, etc.), ask situational, behavioral, or strategic questions.
5. Ask ONE question at a time. Wait for the user's response.
6. YOU MUST ASK EXACTLY ${totalQuestions} QUESTIONS IN TOTAL (including the "introduce yourself" question). Keep track of how many questions you have asked.
7. After the user answers the ${totalQuestions}th question, honestly evaluate the answer, and then clearly state: "That concludes our interview. Thank you." DO NOT ask any more questions.
8. Start by introducing yourself briefly (name and role only) and then ask "Tell me about yourself".
9. Keep your responses concise enough to be spoken (approx 2-4 sentences is ideal for conversation).
10. If the user's answer is correct/good, briefly acknowledge it and move to a harder or related question.
11. If the user's answer is incorrect or vague, gently dig deeper or clarify.
12. Maintain a professional yet neutral tone.

IMPORTANT: You will receive audio input from the user. Respond with clear, spoken-style text. Do NOT output any JSON or code blocks during the interview.
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
  
  IMPORTANT: Address the candidate DIRECTLY using "you/your" language (e.g., "You demonstrated excellent understanding..." NOT "The candidate demonstrated...").
  
  Transcript:
  ${conversationText}
  
  Provide output in the following JSON schema:
  {
    "overallScore": number (0-100),
    "communicationScore": number (0-100),
    "technicalScore": number (0-100),
    "problemSolvingScore": number (0-100),
    "domainKnowledgeScore": number (0-100),
    "strengths": string[] (3-5 bullet points, written addressing the candidate directly with "you/your"),
    "weaknesses": string[] (3-5 bullet points, written addressing the candidate directly with "you/your"),
    "suggestion": string (A paragraph of constructive advice addressing the candidate directly with "you/your" language)
  }
  
  Note: All text in strengths, weaknesses, and suggestion MUST use second person ("you", "your") to address the candidate directly.`;

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

// --- AI Setup Verifier ---
// Given a single user message, ask the coordinator model to parse it and return a
// compact JSON object: { READY: bool, role: string|null, focusArea: string|null, level: string|null }
export const verifySetupWithAI = async (inputText, language = 'English') => {
  let fullResponse = "";
  const systemInstruction = `You are a strict JSON extractor.
Given the user's single message intended to set up an interview (role, focus/stack, experience level),
extract those three fields and output ONLY a JSON object. Use these keys exactly: READY (true if enough info to start), role, focusArea, level.
If you are uncertain about any field, set it to null and set READY to false. Do not include any explanation text.`;

  await api.chatStream([], inputText, {
    systemInstruction,
    modelName: 'mockmate-coordinator',
    language,
    maxOutputTokens: 256
  }, (chunk) => { fullResponse += chunk; });

  return fullResponse;
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

let currentAudioContext = null;
let currentAudioSource = null;

export const playAudioBuffer = (buffer) => {
  stopAudio();
  
  currentAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  currentAudioSource = currentAudioContext.createBufferSource();
  currentAudioSource.buffer = buffer;
  currentAudioSource.connect(currentAudioContext.destination);
  currentAudioSource.start();
  
  currentAudioSource.onended = () => {
    currentAudioSource = null;
  };
};

export const stopAudio = () => {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {
      // Audio may have already stopped
    }
    currentAudioSource = null;
  }
  if (currentAudioContext) {
    try {
      currentAudioContext.close();
    } catch (e) {
      // Context may have already been closed
    }
    currentAudioContext = null;
  }
};