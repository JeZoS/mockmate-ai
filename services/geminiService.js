import { api } from "./api";

const extractDisplayText = (text) => {
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (parsed.response) return parsed.response;
    if (parsed.message) return parsed.message;
    return text;
  } catch (e) {
    return text;
  }
};

export const convertHistoryToMessages = (history) => {
  const messages = [];
  history.forEach((turn, index) => {
    if (turn.role === "model" || turn.role === "user") {
      const hasInlineData = turn.parts.some((p) => p.inlineData);
      const textPart = turn.parts.find((p) => p.text);
      let textToShow = textPart ? textPart.text : "";

      if (turn.role === "user") {
        if (hasInlineData) {
          const mimeType =
            turn.parts.find((p) => p.inlineData)?.inlineData?.mimeType || "";
          if (mimeType.startsWith("audio/")) {
            textToShow = "🎤 Audio Answer Submitted";
          } else if (
            mimeType === "application/pdf" ||
            mimeType.startsWith("image/")
          ) {
            if (textToShow?.includes("Here is my resume")) {
              textToShow = "📄 Resume Uploaded";
            }
          }
        }
      } else if (turn.role === "model") {
        textToShow = extractDisplayText(textToShow);
      }

      if (textToShow) {
        messages.push({
          id: `hist-${index}`,
          role: turn.role,
          text: textToShow || "",
          timestamp: new Date(),
          isThinking: false,
          isAudio:
            turn.role === "user" &&
            hasInlineData &&
            textToShow === "🎤 Audio Answer Submitted",
        });
      }
    }
  });
  return messages;
};

export class BackendChatSession {
  constructor(model, config, initialHistory = []) {
    this.modelName = model;
    this.instructionType = config.instructionType || null; // 'coordinator', 'resumeCoordinator', 'interviewer', 'setupVerifier'
    this.interviewContext = config.interviewContext || null; // { role, focusArea, level, jd, hasResume, totalQuestions }
    this.maxOutputTokens = config.maxOutputTokens || 1024;
    this.language = config.language || "English";
    this.history = initialHistory;
    this.interviewId = config.interviewId || null;
  }
}

export const createCoordinatorChat = (language = "English") => {
  return new BackendChatSession("mockmate-coordinator", {
    language,
    instructionType: "coordinator", // Backend handles the actual system instruction
  });
};

export const createResumeCoordinatorChat = (language = "English") => {
  return new BackendChatSession("mockmate-coordinator", {
    maxOutputTokens: 1024,
    language,
    instructionType: "resumeCoordinator", // Backend handles the actual system instruction
  });
};

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

export const analyzeResumeStructured = async (
  fileBase64,
  mimeType,
  language = "English",
) => {
  const analysis = await api.analyzeResume(fileBase64, mimeType, language);
  return analysis;
};

export const sendResumeToChat = async (
  chat,
  fileBase64,
  mimeType,
  language = "English",
) => {
  try {
    const analysis = await analyzeResumeStructured(
      fileBase64,
      mimeType,
      language,
    );

    const formattedMessage = formatResumeAnalysis(analysis);

    chat.resumeAnalysis = analysis;

    chat.history.push({
      role: "user",
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        { text: "Here is my resume. Please analyze it." },
      ],
    });

    chat.history.push({
      role: "model",
      parts: [{ text: formattedMessage }],
    });

    return { text: formattedMessage, analysis };
  } catch (error) {
    console.error("Error in structured resume analysis:", error);
    let fullText = "";

    const messagePart = {
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        {
          text: "Here is my resume. Please analyze it briefly, identify my top 2-3 strengths, and suggest 2-3 interview roles I could practice for. Keep it concise.",
        },
      ],
    };

    await sendMessageStream(chat, messagePart, (chunk) => {
      fullText += chunk;
    });

    return { text: fullText, analysis: null };
  }
};

export const createInterviewerChat = (
  context,
  existingHistory = [],
  interviewId = null,
) => {
  const interviewContext = {
    role: context.role || null,
    focusArea: context.focusArea || null,
    level: context.level || null,
    jd: context.jd || null,
    hasResume: !!context.resumeData,
    totalQuestions: context.totalQuestions || 10,
  };

  let history = existingHistory.length > 0 ? existingHistory : [];

  if (history.length === 0 && context.resumeData) {
    history = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: context.resumeData.base64,
              mimeType: context.resumeData.mimeType,
            },
          },
          {
            text: "Here is my resume. Please use it to tailor the interview questions, specifically asking about my projects and past experience.",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "I have reviewed your resume. I will now conduct the interview focusing on your specific experiences and the target role.",
          },
        ],
      },
    ];
  }

  return new BackendChatSession(
    "mockmate-interviewer",
    {
      instructionType: "interviewer",
      interviewContext, // Pass context params to backend
      language: context.language,
      interviewId: interviewId,
    },
    history,
  );
};

export const generateFeedback = async (
  history,
  language = "English",
  interviewId = null,
) => {
  const transcript = history
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  try {
    return await api.generateFeedback(transcript, language, interviewId);
  } catch (error) {
    console.error("Error generating feedback:", error);
    return {
      overallScore: 0,
      communicationScore: 0,
      technicalScore: 0,
      strengths: ["Could not generate feedback"],
      weaknesses: ["Backend Error"],
      suggestion: "Please try again.",
    };
  }
};

export const sendMessageStream = async (chat, messageInput, onChunk) => {
  let fullText = "";

  const chatSession = chat;

  let userContent;
  if (typeof messageInput === "string") {
    userContent = { role: "user", parts: [{ text: messageInput }] };
  } else if (messageInput.parts) {
    userContent = { role: "user", parts: messageInput.parts };
  } else {
    userContent = {
      role: "user",
      parts: [{ text: JSON.stringify(messageInput) }],
    };
  }

  try {
    const useStructuredOutput =
      chatSession.modelName === "mockmate-coordinator" ||
      chatSession.modelName === "mockmate-interviewer";

    const config = {
      instructionType: chatSession.instructionType,
      interviewContext: chatSession.interviewContext,
      modelName: chatSession.modelName,
      maxOutputTokens: chatSession.maxOutputTokens,
      language: chatSession.language,
      interviewId: chatSession.interviewId,
      useStructuredOutput,
    };

    let previousLength = 0;

    await api.chatStream(chatSession.history, messageInput, config, (chunk) => {
      if (
        useStructuredOutput &&
        fullText.length > 0 &&
        chunk.startsWith(fullText)
      ) {
        const newPart = chunk.slice(fullText.length);
        fullText = chunk;
        if (newPart) onChunk(newPart);
      } else if (
        useStructuredOutput &&
        chunk.length > fullText.length &&
        fullText.length > 0 &&
        chunk.includes(fullText.slice(0, Math.min(50, fullText.length)))
      ) {
        fullText = chunk;
        onChunk(chunk);
      } else {
        fullText += chunk;
        onChunk(chunk);
      }
    });

    chatSession.history.push(userContent);

    if (useStructuredOutput) {
      try {
        const parsed = JSON.parse(fullText);
        const displayText = parsed.message || parsed.response || fullText;
        chatSession.history.push({
          role: "model",
          parts: [{ text: displayText }],
        });
        chatSession.lastStructuredResponse = parsed;
        return parsed;
      } catch (e) {
        chatSession.history.push({
          role: "model",
          parts: [{ text: fullText }],
        });
      }
    } else {
      chatSession.history.push({ role: "model", parts: [{ text: fullText }] });
    }
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
          data: audioBase64,
        },
      },
      {
        text: "Please evaluate my answer and ask the next question.",
      },
    ],
  };

  let fullText = "";
  const structuredResponse = await sendMessageStream(chat, message, (chunk) => {
    fullText += chunk;
  });

  if (structuredResponse && typeof structuredResponse === "object") {
    return structuredResponse;
  }

  try {
    return JSON.parse(fullText);
  } catch (e) {
    return fullText;
  }
};

export const verifySetupWithAI = async (inputText, language = "English") => {
  let fullResponse = "";

  await api.chatStream(
    [],
    inputText,
    {
      instructionType: "setupVerifier",
      modelName: "mockmate-coordinator",
      language,
      maxOutputTokens: 256,
    },
    (chunk) => {
      fullResponse += chunk;
    },
  );

  return fullResponse;
};

// ─── TTS Player (re-exported from ttsPlayer.js for backward compatibility) ────
export { speak as generateSpeech, stop as stopAudio } from "./ttsPlayer";
