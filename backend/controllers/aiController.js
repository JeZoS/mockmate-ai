const { GoogleGenAI, Type, Modality } = require("@google/genai");
const Interview = require('../models/Interview');

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Map prefixed models to actual Gemini models
const MODEL_MAP = {
  'mockmate-coordinator': 'gemini-3-flash-preview',
  'mockmate-interviewer': 'gemini-3-flash-preview',
  'mockmate-tts': 'gemini-2.5-flash-preview-tts'
};

const getActualModel = (prefixedName) => {
  return MODEL_MAP[prefixedName] || 'gemini-3-flash-preview';
};

// --- Chat Stream Proxy ---
exports.chatStream = async (req, res) => {
  const { history, message, interviewId, systemInstruction, modelName, maxOutputTokens, language } = req.body;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const actualModel = getActualModel(modelName);
    
    // Inject Language Instruction
    let finalSystemInstruction = systemInstruction || '';
    if (language && language !== 'English') {
      finalSystemInstruction += `\n\nIMPORTANT: You must conduct this entire interview/conversation in ${language}. Ensure all your responses are in ${language}.`;
    }

    let contents = [];
    let interviewDoc = null;

    // DATA PERSISTENCE: If interviewId is provided, use DB history
    if (interviewId) {
      interviewDoc = await Interview.findById(interviewId);
      if (interviewDoc) {
        // Use history from DB
        // We need to convert Mongoose array to plain object for Gemini SDK if necessary, 
        // but typically the structure matches.
        contents = interviewDoc.history.map(h => ({
          role: h.role,
          parts: h.parts.map(p => {
            const part = {};
            if (p.text) {
              part.text = p.text;
            } else if (p.inlineData) {
              part.inlineData = p.inlineData;
            }
            return part;
          })
        }));

        // Handle User Input format
        let userParts = [];
        if (typeof message === 'string') {
          userParts = [{ text: message }];
        } else if (message.parts) {
          userParts = message.parts;
        }

        // Save User Message to DB
        interviewDoc.history.push({ role: 'user', parts: userParts });
        await interviewDoc.save();

        // Add to current context
        contents.push({ role: 'user', parts: userParts });
      }
    } else {
      // Ephemeral mode (Coordinator)
      contents = [...(history || [])];
      if (typeof message === 'string') {
          contents.push({ role: 'user', parts: [{ text: message }] });
      } else if (message.parts) {
          contents.push({ role: 'user', parts: message.parts });
      }
    }

    const result = await ai.models.generateContentStream({
      model: actualModel,
      contents: contents,
      config: {
        systemInstruction: finalSystemInstruction,
        maxOutputTokens: maxOutputTokens || 1024,
        temperature: 0.7
      }
    });

    let fullResponse = "";

    for await (const chunk of result) {
      if (chunk.text) {
        res.write(chunk.text);
        fullResponse += chunk.text;
      }
    }

    // DATA PERSISTENCE: Save Model Response to DB
    if (interviewDoc && fullResponse) {
      // Re-fetch to minimize race conditions, though strictly we are linear here
      const freshDoc = await Interview.findById(interviewId);
      if (freshDoc) {
        freshDoc.history.push({ role: 'model', parts: [{ text: fullResponse }] });
        await freshDoc.save();
      }
    }

    res.end();

  } catch (error) {
    console.error("AI Stream Error:", error);
    if (!res.headersSent) {
        res.status(500).json({ error: error.message });
    } else {
        res.end();
    }
  }
};

// --- Feedback Gen ---
exports.generateFeedback = async (req, res) => {
  const { prompt, language } = req.body;
  
  try {
    const actualModel = getActualModel('mockmate-interviewer');
    
    let adjustedPrompt = prompt;
    if (language && language !== 'English') {
      adjustedPrompt += `\n\nPlease generate the analysis and feedback strictly in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: adjustedPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            communicationScore: { type: Type.NUMBER },
            technicalScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestion: { type: Type.STRING },
          },
          required: ["overallScore", "communicationScore", "technicalScore", "strengths", "weaknesses", "suggestion"]
        }
      }
    });

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

// --- TTS ---
exports.generateSpeech = async (req, res) => {
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
            // Available voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        res.json({ audio: base64Audio });
    } else {
        res.status(400).json({ error: "No audio generated" });
    }
  } catch (error) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: error.message });
  }
};