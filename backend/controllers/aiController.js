const { GoogleGenAI, Type, Modality } = require("@google/genai");
const Interview = require("../models/Interview");

if (!process.env.GOOGLE_API_KEY) {
  console.error(
    "FATAL: GOOGLE_API_KEY not set in environment variables. Backend will not function.",
  );
  console.error(
    "Set GOOGLE_API_KEY in your .env file before starting the server.",
  );
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

const MODEL_MAP = {
  "mockmate-coordinator": "gemini-3-flash-preview",
  "mockmate-interviewer": "gemini-3-flash-preview",
  "mockmate-tts": "gemini-2.5-flash-preview-tts",
};

const MODEL_PRICING = {
  "gemini-3-flash-preview": { input: 0.075, output: 0.3 },
  "gemini-2.5-flash-preview-tts": { input: 0.075, output: 0.3 },
};

const getActualModel = (prefixedName) => {
  return MODEL_MAP[prefixedName] || "gemini-3-flash-preview";
};

const calculateCost = (model, inputTokens, outputTokens) => {
  const pricing =
    MODEL_PRICING[model] || MODEL_PRICING["gemini-3-flash-preview"];
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
};

const updateTokenUsage = async (
  interviewId,
  operation,
  model,
  inputTokens,
  outputTokens,
) => {
  if (!interviewId) return;

  try {
    const cost = calculateCost(model, inputTokens, outputTokens);

    await Interview.findByIdAndUpdate(interviewId, {
      $inc: {
        "tokenUsage.totalInputTokens": inputTokens,
        "tokenUsage.totalOutputTokens": outputTokens,
        "tokenUsage.totalTokens": inputTokens + outputTokens,
        "tokenUsage.estimatedCost": cost,
      },
      $push: {
        "tokenUsage.breakdown": {
          timestamp: new Date(),
          operation,
          model,
          inputTokens,
          outputTokens,
          cost,
        },
      },
    });
  } catch (err) {
    console.error("Failed to update token usage:", err);
  }
};

const SYSTEM_INSTRUCTIONS = {
  // Coordinator for manual role selection
  coordinator: `You are a friendly and efficient Interview Coordinator AI. 
Your goal is to gather three specific pieces of information from the user to set up a mock interview.
This interview can be for ANY role (Tech, Sales, Marketing, HR, etc.).

1. The Target Role (e.g., Frontend Dev, Sales Representative, Project Manager).
2. The Focus Area, Tech Stack, or Industry (e.g., React/Node, B2B SaaS, Agile methodologies).
3. The Experience Level (e.g., Junior, Senior, Staff, VP).

Instructions:
- Keep your conversational response brief and friendly in the 'message' field.
- Ask ONE question at a time in your message. Do not overwhelm the user.
- Start by asking what role they are practicing for.
- Set READY to false until you have all three pieces of information.
- Once you have all three pieces of information clearly (role, focusArea, and level), set READY to true and populate all fields.
- Your message should always be conversational and helpful, never output raw JSON in the message field.
`,

  // Coordinator for resume-based role selection
  resumeCoordinator: `You are an expert Career Coach and Interview Coordinator.
The user has already had their resume analyzed. You have been provided with a structured analysis of their resume.
Your job now is to help them select ONE specific interview role and focus area from the suggested options.

Instructions:
- Keep your conversational response in the 'message' field BRIEF and CONVERSATIONAL (under 100 words).
- Set READY to false while gathering information.
- If the user picks a role, confirm it and ask for any specific focus or level adjustments in your message.
- Once they confirm a specific Role, Focus Area, and Level, set READY to true and populate all fields.
- Your message should always be conversational, never output raw JSON in the message field.
`,

  // Setup verifier for extracting interview details
  setupVerifier: `You are a strict JSON extractor.
Given the user's single message intended to set up an interview (role, focus/stack, experience level),
extract those three fields and output ONLY a JSON object. Use these keys exactly: READY (true if enough info to start), role, focusArea, level.
If you are uncertain about any field, set it to null and set READY to false. Do not include any explanation text.`,
};

const generateInterviewerInstruction = (context) => {
  let systemContext = "";
  if (context.jd) {
    systemContext = `The user has provided the following Job Description (JD):\n"""\n${context.jd}\n"""\nBase your interview questions and evaluation criteria strictly on this JD.`;
  } else {
    systemContext = `The user is practicing for a ${context.role || "General"} position.\nFocus Area/Skills: ${context.focusArea || "General"}\nExperience Level: ${context.level || "Mid-Level"}`;
  }

  const resumeInstruction = context.hasResume
    ? "A resume has been provided. You MUST ask at least 2 specific questions about the projects, experience, and skills listed in the user's resume. Verify their details and ask for deep dives into their past work."
    : "No resume provided. Ask standard questions for the role.";

  const totalQuestions = context.totalQuestions || 10;

  return `You are an expert Professional Interviewer conducting a mock interview.
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
};

const generateFeedbackPrompt = (transcript) => {
  return `Analyze the following interview transcript and provide detailed feedback.
  
IMPORTANT: Address the candidate DIRECTLY using "you/your" language (e.g., "You demonstrated excellent understanding..." NOT "The candidate demonstrated...").
  
Transcript:
${transcript}
  
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
};

exports.analyzeResume = async (req, res) => {
  const { base64, mimeType, language } = req.body;

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: "Missing base64 or mimeType" });
  }

  try {
    const actualModel = getActualModel("mockmate-coordinator");

    let languageInstruction = "";
    if (language && language !== "English") {
      languageInstruction = `\n\nIMPORTANT: Provide the analysis text fields (greeting, strengthsSummary, suggestion) in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: `Analyze this resume and extract structured information about the candidate. Identify their core strengths, suggest 2-3 interview roles they would be well-suited for, and provide a brief professional assessment.${languageInstruction}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidateName: {
              type: Type.STRING,
              description: "Full name of the candidate",
            },
            currentRole: {
              type: Type.STRING,
              description: "Current or most recent job title",
            },
            experienceLevel: {
              type: Type.STRING,
              enum: [
                "fresher",
                "junior",
                "mid-level",
                "senior",
                "lead",
                "manager",
                "executive",
              ],
              description:
                "Experience level based on years and role progression",
            },
            yearsOfExperience: {
              type: Type.NUMBER,
              description: "Estimated total years of professional experience",
            },
            coreStrengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Top 3-5 core technical or professional strengths",
            },
            keyTechnologies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Primary technologies, tools, or skills the candidate is proficient in",
            },
            suggestedRoles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: {
                    type: Type.STRING,
                    description: "Suggested interview role title",
                  },
                  focusArea: {
                    type: Type.STRING,
                    description: "Key focus areas for this role",
                  },
                  reason: {
                    type: Type.STRING,
                    description:
                      "Brief reason why this role fits the candidate",
                  },
                },
                required: ["role", "focusArea", "reason"],
              },
              description: "2-3 suggested interview roles based on the resume",
            },
            greeting: {
              type: Type.STRING,
              description:
                "A brief personalized greeting addressing the candidate by name (1 sentence)",
            },
            strengthsSummary: {
              type: Type.STRING,
              description:
                "A concise summary of the candidate's core strengths (1-2 sentences)",
            },
            suggestion: {
              type: Type.STRING,
              description:
                "A brief suggestion asking them to choose a role for practice (1 sentence)",
            },
            roleType: {
              type: Type.STRING,
              enum: ["tech", "non-tech", "hybrid"],
              description:
                "Whether the candidate is primarily technical, non-technical, or hybrid",
            },
          },
          required: [
            "candidateName",
            "currentRole",
            "experienceLevel",
            "coreStrengths",
            "keyTechnologies",
            "suggestedRoles",
            "greeting",
            "strengthsSummary",
            "suggestion",
            "roleType",
          ],
        },
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    if (response.text) {
      const analysisData = JSON.parse(response.text);
      res.json(analysisData);
    } else {
      throw new Error("No analysis generated");
    }
  } catch (error) {
    console.error("Resume Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.chatStream = async (req, res) => {
  const {
    history,
    message,
    interviewId,
    modelName,
    maxOutputTokens,
    language,
    useStructuredOutput,
    instructionType, // 'coordinator', 'resumeCoordinator', 'interviewer', 'setupVerifier'
    interviewContext, // { role, focusArea, level, jd, hasResume, totalQuestions }
  } = req.body;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const actualModel = getActualModel(modelName);
    let finalSystemInstruction = "";

    if (instructionType === "coordinator") {
      finalSystemInstruction = SYSTEM_INSTRUCTIONS.coordinator;
    } else if (instructionType === "resumeCoordinator") {
      finalSystemInstruction = SYSTEM_INSTRUCTIONS.resumeCoordinator;
    } else if (instructionType === "interviewer" && interviewContext) {
      finalSystemInstruction = generateInterviewerInstruction(interviewContext);
    } else if (instructionType === "setupVerifier") {
      finalSystemInstruction = SYSTEM_INSTRUCTIONS.setupVerifier;
    }

    if (language && language !== "English") {
      finalSystemInstruction += `\n\nIMPORTANT: You must conduct this entire interview/conversation in ${language}. Ensure all your responses are in ${language}.`;
    }

    let contents = [];
    let interviewDoc = null;

    if (interviewId) {
      interviewDoc = await Interview.findById(interviewId);
      if (interviewDoc) {
        // Use history from DB
        // We need to convert Mongoose array to plain object for Gemini SDK if necessary,
        // but typically the structure matches.
        contents = interviewDoc.history.map((h) => ({
          role: h.role,
          parts: h.parts.map((p) => {
            const part = {};
            if (p.text) {
              part.text = p.text;
            } else if (p.inlineData) {
              part.inlineData = p.inlineData;
            }
            return part;
          }),
        }));

        let userParts = [];
        if (typeof message === "string") {
          userParts = [{ text: message }];
        } else if (message.parts) {
          userParts = message.parts;
        }

        interviewDoc.history.push({ role: "user", parts: userParts });
        await interviewDoc.save();

        contents.push({ role: "user", parts: userParts });
      }
    } else {
      contents = [...(history || [])];
      if (typeof message === "string") {
        contents.push({ role: "user", parts: [{ text: message }] });
      } else if (message.parts) {
        contents.push({ role: "user", parts: message.parts });
      }
    }

    const genConfig = {
      systemInstruction: finalSystemInstruction,
      maxOutputTokens: maxOutputTokens || 1024,
      temperature: 0.7,
    };

    if (useStructuredOutput) {
      genConfig.responseMimeType = "application/json";

      if (modelName === "mockmate-coordinator") {
        // Coordinator schema for setup
        genConfig.responseSchema = {
          type: Type.OBJECT,
          properties: {
            READY: {
              type: Type.BOOLEAN,
              description:
                "True if enough information is collected to start the interview",
            },
            role: {
              type: Type.STRING,
              description: "The target job role for the interview",
            },
            focusArea: {
              type: Type.STRING,
              description: "The focus area, tech stack, or industry",
            },
            level: {
              type: Type.STRING,
              description: "Experience level (Junior, Mid-level, Senior, etc.)",
            },
            message: {
              type: Type.STRING,
              description: "Conversational response to the user",
            },
          },
          required: ["READY", "message"],
        };
      } else if (modelName === "mockmate-interviewer") {
        // Interviewer schema for interview responses
        genConfig.responseSchema = {
          type: Type.OBJECT,
          properties: {
            response: {
              type: Type.STRING,
              description:
                "Your spoken response to the candidate - evaluation of their answer and/or your next question. Keep it conversational and natural.",
            },
            questionNumber: {
              type: Type.NUMBER,
              description:
                "The current question number you are asking (1-based). Increment after each question you ask.",
            },
            isInterviewComplete: {
              type: Type.BOOLEAN,
              description:
                "Set to true only after the candidate has answered the final question and you have given closing remarks.",
            },
            answerQuality: {
              type: Type.STRING,
              enum: [
                "excellent",
                "good",
                "average",
                "needs_improvement",
                "not_applicable",
              ],
              description:
                "Quick assessment of the candidate's last answer quality. Use not_applicable for the first interaction.",
            },
          },
          required: ["response", "questionNumber", "isInterviewComplete"],
        };
      }
    }

    const result = await ai.models.generateContentStream({
      model: actualModel,
      contents: contents,
      config: genConfig,
    });

    let fullResponse = "";
    let usageMetadata = null;

    for await (const chunk of result) {
      if (chunk.text) {
        res.write(chunk.text);
        fullResponse += chunk.text;
      }
      if (chunk.usageMetadata) {
        usageMetadata = chunk.usageMetadata;
      }
    }

    if (interviewDoc && fullResponse) {
      const freshDoc = await Interview.findById(interviewId);
      if (freshDoc) {
        freshDoc.history.push({
          role: "model",
          parts: [{ text: fullResponse }],
        });
        await freshDoc.save();
      }

      if (usageMetadata) {
        await updateTokenUsage(
          interviewId,
          "chat",
          actualModel,
          usageMetadata.promptTokenCount || 0,
          usageMetadata.candidatesTokenCount || 0,
        );
      }
    }

    res.end();
  } catch (error) {
    console.error("AI Stream Error:", error);
    const errorMsg = error.message || "Unknown error occurred";

    if (
      errorMsg.includes("Could not load the default credentials") ||
      errorMsg.includes("GOOGLE_API_KEY")
    ) {
      console.error("Auth Error: GOOGLE_API_KEY is not set or invalid");
      if (!res.headersSent) {
        res
          .status(500)
          .json({
            error:
              "API authentication failed. Ensure GOOGLE_API_KEY is set in server environment.",
          });
      }
    } else if (!res.headersSent) {
      res.status(500).json({ error: errorMsg });
    } else {
      res.end();
    }
  }
};

exports.generateFeedback = async (req, res) => {
  const { transcript, language, interviewId } = req.body;

  try {
    const actualModel = getActualModel("mockmate-interviewer");

    let feedbackPrompt = generateFeedbackPrompt(transcript);

    if (language && language !== "English") {
      feedbackPrompt += `\n\nPlease generate the analysis and feedback strictly in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: feedbackPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            communicationScore: { type: Type.NUMBER },
            technicalScore: { type: Type.NUMBER },
            problemSolvingScore: { type: Type.NUMBER },
            domainKnowledgeScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestion: { type: Type.STRING },
          },
          required: [
            "overallScore",
            "communicationScore",
            "technicalScore",
            "strengths",
            "weaknesses",
            "suggestion",
          ],
        },
      },
    });

    if (response.usageMetadata && interviewId) {
      await updateTokenUsage(
        interviewId,
        "feedback",
        actualModel,
        response.usageMetadata.promptTokenCount || 0,
        response.usageMetadata.candidatesTokenCount || 0,
      );
    }

    if (response.text) {
      res.json(JSON.parse(response.text));
    } else {
      throw new Error("No feedback generated");
    }
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.generateSpeechStream = async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    console.warn("[TTS Controller] Empty or invalid text received");
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const ttsService = require("../services/ttsService");

    // Set streaming headers
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Stream TTS chunks in sentence order
    await ttsService.streamTtsChunks(text, res);
  } catch (error) {
    console.error("[TTS Controller] Stream generation failed:", {
      error: error.message,
      stack: error.stack,
      textLength: text.length,
      textPreview: text.substring(0, 100),
    });

    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "TTS generation failed", message: error.message });
    } else if (!res.writableEnded) {
      // If headers already sent (streaming started), end the response
      res.end();
    }
  }
};

// ─── Backup: Gemini TTS (kept for emergency switch) ─────────────────────────
// To activate: rename to generateSpeechStream, update route
//
exports.generateSpeechGemini = async (req, res) => {
  const { text } = req.body;
  try {
    const actualModel = getActualModel('mockmate-tts');
    const response = await ai.models.generateContent({
      model: actualModel,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.status(400).json({ error: 'No audio generated' });
    }
  } catch (error) {
    console.error('[TTS Gemini Backup] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
