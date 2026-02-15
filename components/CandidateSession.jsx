import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { Landing } from "./Landing";
import { JDPaste } from "./JDPaste";
import { ResumeUpload } from "./ResumeUpload";
import { ChatInterface } from "./ChatInterface";
import { FeedbackView } from "./FeedbackView";
import { AppState } from "../types";
import {
  createCoordinatorChat,
  createResumeCoordinatorChat,
  createInterviewerChat,
  sendMessageStream,
  sendAudioMessage,
  sendResumeToChat,
  generateFeedback,
  convertHistoryToMessages,
} from "../services/geminiService";
import { speak as speakTTS, stop as stopTTS } from "../services/ttsPlayer";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";
import { SideDrawer } from "./SideDrawer";
import { MenuButton } from "./MenuButton";
import { Loader2 } from "lucide-react";

const generateId = () => Math.random().toString(36).substring(2, 9);

// Helper to convert Blob to Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (base64String.includes(",")) {
        resolve(base64String.split(",")[1]);
      } else {
        resolve(base64String);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const CandidateSession = () => {
  const {
    appState,
    setAppState,
    language,
    activeInterviewId,
    setActiveInterviewId,
    interviewConfig,
    setInterviewConfig,
    resetSession,
  } = useAppStore();

  const navigate = useNavigate();

  const [totalQuestions, setTotalQuestions] = useState(7);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQuestionCount, setCurrentQuestionCount] = useState(0);
  const [feedbackData, setFeedbackData] = useState(null);
  const [resumeContext, setResumeContext] = useState(null);
  const [isResuming, setIsResuming] = useState(!!activeInterviewId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const startTimeRef = useRef(Date.now());

  const chatSessionRef = useRef(null);

  useEffect(() => {
    const initSession = async () => {
      if (activeInterviewId && !chatSessionRef.current) {
        setIsResuming(true);
        try {
          const interview = await api.getInterview(activeInterviewId);
          await resumeInterview(interview);
        } catch (e) {
          console.error("Failed to recover session", e);
          navigate("/mockmate/candidate/dashboard");
        } finally {
          setIsResuming(false);
        }
      }
    };
    initSession();
  }, [activeInterviewId]);

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      stopTTS();
    };
  }, []);

  useEffect(() => {
    if (
      appState === AppState.SETUP_ROLE_CHAT &&
      !chatSessionRef.current &&
      !activeInterviewId
    ) {
      startCoordinatorChat();
    }
  }, [appState]);

  const resumeInterview = async (interview) => {
    setActiveInterviewId(interview._id);
    const config = {
      type: "role_based",
      roleDetails: {
        role: interview.role,
        focusArea: interview.focusArea,
        level: interview.level,
      },
      language: interview.language,
    };
    setInterviewConfig(config);

    const history = interview.history || [];
    const context = {
      ...config.roleDetails,
      language: config.language,
      totalQuestions,
    };

    const chat = createInterviewerChat(context, history, interview._id);
    chatSessionRef.current = chat;

    const restoredMessages = convertHistoryToMessages(history);
    setMessages(restoredMessages);
    setCurrentQuestionCount(Math.floor(restoredMessages.length / 2));
    setAppState(AppState.INTERVIEW_ACTIVE);

    if (history.length === 0) {
      setIsStreaming(true);
      const botMsgId = generateId();
      setMessages([
        {
          id: botMsgId,
          role: "model",
          text: "Preparing interview...",
          timestamp: new Date(),
          isThinking: true,
        },
      ]);

      let fullText = "";
      const textResponse = await sendMessageStream(
        chat,
        "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.",
        (chunk) => {
          fullText += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? { ...m, text: fullText, isThinking: false }
                : m,
            ),
          );
        },
      );

      if (textResponse) {
        // Fire-and-forget speech — don't block resume flow
        speakTTS(textResponse).catch((err) =>
          console.error("[TTS] Resume interview speech failed:", err),
        );
      }
      setIsStreaming(false);
    }
  };

  const handleSelectMode = (mode) => {
    if (mode === "jd") {
      setAppState(AppState.SETUP_JD);
    } else if (mode === "resume") {
      setAppState(AppState.SETUP_RESUME);
    } else {
      setAppState(AppState.SETUP_ROLE_CHAT);
      startCoordinatorChat();
    }
  };

  const handleBackToLanding = () => {
    stopTTS();
    resetSession();
    navigate("/mockmate/candidate/dashboard");
  };

  const handleGoToDashboard = () => {
    stopTTS();
    resetSession();
    navigate("/mockmate/candidate/dashboard");
  };

  const handleJDStart = (jdText) => {
    const config = { type: "jd", jdText, language };
    setInterviewConfig(config);
    startInterview(config);
  };

  const handlePlayAudio = async (text) => {
    try {
      await speakTTS(text);
    } catch (error) {
      console.error("[TTS] Failed to play audio:", error);
    }
  };

  const handleResumeFileSelect = async (file) => {
    setIsStreaming(true);
    try {
      const base64 = await blobToBase64(file);
      setResumeContext({ base64, mimeType: file.type });

      const chat = createResumeCoordinatorChat(language);
      chatSessionRef.current = chat;

      const result = await sendResumeToChat(chat, base64, file.type, language);

      const responseText = result.text || result;

      if (result.analysis) {
        chatSessionRef.current.resumeAnalysis = result.analysis;
      }

      setAppState(AppState.SETUP_RESUME_CHAT);
      setMessages([
        {
          id: generateId(),
          role: "model",
          text: responseText,
          timestamp: new Date(),
          isThinking: false,
        },
      ]);

      if (result.analysis) {
        generateContextualSuggestions(responseText, result.analysis);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to analyze resume.");
      setAppState(AppState.SETUP_RESUME);
      setResumeContext(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const generateContextualSuggestions = (aiMessage, analysis = null) => {
    const lowerMessage = aiMessage.toLowerCase();
    const newSuggestions = [];

    if (
      analysis?.suggestedRoles &&
      (lowerMessage.includes("which one") ||
        lowerMessage.includes("which role") ||
        lowerMessage.includes("choose one") ||
        lowerMessage.includes("select one") ||
        lowerMessage.includes("practice for"))
    ) {
      analysis.suggestedRoles.forEach((role, index) => {
        newSuggestions.push({
          label: `${index + 1}. ${role.role}`,
          value: `I'd like to practice for the ${role.role} role, focusing on ${role.focusArea}.`,
        });
      });
    } else if (
      lowerMessage.includes("experience level") ||
      lowerMessage.includes("seniority") ||
      lowerMessage.includes("how many years") ||
      lowerMessage.includes("what level")
    ) {
      newSuggestions.push(
        {
          label: "Entry Level / Fresher",
          value: "I am at entry level / fresher.",
        },
        {
          label: "Junior (1-2 years)",
          value: "I have 1-2 years of experience, junior level.",
        },
        {
          label: "Mid-Level (3-5 years)",
          value: "I have 3-5 years of experience, mid-level.",
        },
        {
          label: "Senior (5+ years)",
          value: "I have 5+ years of experience, senior level.",
        },
      );
    } else if (
      lowerMessage.includes("ready to start") ||
      lowerMessage.includes("shall we begin") ||
      lowerMessage.includes("start the interview") ||
      lowerMessage.includes("proceed with") ||
      lowerMessage.includes("is that correct") ||
      lowerMessage.includes("sound good")
    ) {
      newSuggestions.push(
        {
          label: "Yes, let's start!",
          value: "Yes, let's start the interview!",
        },
        {
          label: "I want to change something",
          value: "Actually, I want to change the role or focus area.",
        },
      );
    } else if (
      lowerMessage.includes("what role") ||
      lowerMessage.includes("what position") ||
      lowerMessage.includes("practicing for") ||
      lowerMessage.includes("interviewing for")
    ) {
      newSuggestions.push(
        {
          label: "Frontend Developer",
          value: "I want to practice for a Frontend Developer role.",
        },
        {
          label: "Backend Developer",
          value: "I want to practice for a Backend Developer role.",
        },
        {
          label: "Full-Stack Developer",
          value: "I want to practice for a Full-Stack Developer role.",
        },
        {
          label: "Software Engineer",
          value: "I want to practice for a Software Engineer role.",
        },
      );
    } else if (
      lowerMessage.includes("focus area") ||
      lowerMessage.includes("tech stack") ||
      lowerMessage.includes("technologies") ||
      lowerMessage.includes("skills") ||
      lowerMessage.includes("speciali")
    ) {
      newSuggestions.push(
        {
          label: "React / Frontend",
          value: "Focus on React, JavaScript, and frontend development.",
        },
        {
          label: "Node.js / Backend",
          value: "Focus on Node.js, Express, and backend development.",
        },
        {
          label: "MERN Stack",
          value: "Focus on the MERN stack (MongoDB, Express, React, Node.js).",
        },
        {
          label: "System Design",
          value: "Focus on system design and architecture.",
        },
        {
          label: "DSA & Problem Solving",
          value: "Focus on data structures, algorithms, and problem solving.",
        },
      );
    }

    setSuggestions(newSuggestions);
  };

  const getSuggestionChips = () => {
    if (
      appState !== AppState.SETUP_RESUME_CHAT &&
      appState !== AppState.SETUP_ROLE_CHAT
    )
      return [];
    return suggestions;
  };

  const handleSuggestionClick = (suggestion) => {
    setSuggestions([]);
    const message =
      typeof suggestion === "string" ? suggestion : suggestion.value;
    handleCoordinatorMessage(message);
  };

  const startCoordinatorChat = async () => {
    const chat = createCoordinatorChat(language);
    chatSessionRef.current = chat;
    setMessages([]);

    setIsStreaming(true);
    const initialMsgId = generateId();
    setMessages([
      {
        id: initialMsgId,
        role: "model",
        text: "",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    let fullResponse = "";
    let lastUpdateTime = 0;
    const updateInterval = 50;

    const structuredResponse = await sendMessageStream(
      chat,
      `Hello, I want to practice for an interview in ${language}.`,
      (chunk) => {
        if (
          chunk.startsWith("{") ||
          (fullResponse.startsWith("{") && chunk.includes('"message"'))
        ) {
          if (chunk.length > fullResponse.length) {
            fullResponse = chunk;
          } else {
            fullResponse += chunk;
          }
        } else {
          fullResponse += chunk;
        }

        const now = Date.now();
        if (now - lastUpdateTime > updateInterval) {
          lastUpdateTime = now;
          try {
            const parsed = JSON.parse(fullResponse);
            const displayText = parsed.message || "";
            if (displayText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === initialMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            }
          } catch (e) {
            const displayText = filterJsonFromText(fullResponse);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === initialMsgId
                  ? {
                      ...m,
                      text: displayText || "Processing...",
                      isThinking: !displayText,
                    }
                  : m,
              ),
            );
          }
        }
      },
    );

    let displayText = fullResponse;
    if (structuredResponse && typeof structuredResponse === "object") {
      displayText = structuredResponse.message || fullResponse;
    } else {
      try {
        const parsed = JSON.parse(fullResponse);
        displayText = parsed.message || fullResponse;
      } catch (e) {
        displayText = filterJsonFromText(fullResponse);
      }
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === initialMsgId
          ? { ...m, text: displayText, isThinking: false }
          : m,
      ),
    );
    setIsStreaming(false);

    generateContextualSuggestions(displayText);
  };

  const filterJsonFromText = (text) => {
    return text
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, "")
      .replace(/\{[\s\S]*?"READY"[\s\S]*?\}/g, "")
      .trim();
  };

  const handleCoordinatorMessage = async (text) => {
    if (!chatSessionRef.current) return;

    setSuggestions([]);
    const userMsg = {
      id: generateId(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: "model",
        text: "",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    let fullResponse = "";
    let structuredResponse = null;
    let lastUpdateTime = 0;
    const updateInterval = 50;

    structuredResponse = await sendMessageStream(
      chatSessionRef.current,
      text,
      (chunk) => {
        if (
          chunk.startsWith("{") ||
          (fullResponse.startsWith("{") && chunk.includes('"message"'))
        ) {
          if (chunk.length > fullResponse.length) {
            fullResponse = chunk;
          } else {
            fullResponse += chunk;
          }
        } else {
          fullResponse += chunk;
        }

        const now = Date.now();

        if (now - lastUpdateTime > updateInterval) {
          lastUpdateTime = now;
          try {
            const parsed = JSON.parse(fullResponse);
            const displayText = parsed.message || "";
            if (displayText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            }
          } catch (e) {
            const displayText = filterJsonFromText(fullResponse);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? {
                      ...m,
                      text: displayText || "Processing...",
                      isThinking: !displayText,
                    }
                  : m,
              ),
            );
          }
        }
      },
    );

    setIsStreaming(false);

    if (structuredResponse && typeof structuredResponse === "object") {
      const displayText =
        structuredResponse.message || filterJsonFromText(fullResponse);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: displayText, isThinking: false }
            : m,
        ),
      );

      const analysis = chatSessionRef.current?.resumeAnalysis;
      generateContextualSuggestions(displayText, analysis);

      if (structuredResponse.READY && structuredResponse.role) {
        const config = {
          type: "role_based",
          roleDetails: {
            role: structuredResponse.role,
            focusArea: structuredResponse.focusArea || "General",
            level: structuredResponse.level || "Mid-Level",
          },
          resumeData: resumeContext || undefined,
          language,
        };
        setInterviewConfig(config);

        setTimeout(() => {
          startInterview(config);
        }, 1500);
      }
      return;
    }

    const analysis = chatSessionRef.current?.resumeAnalysis;
    generateContextualSuggestions(fullResponse, analysis);

    let jsonMatch = fullResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (!jsonMatch) {
      jsonMatch = fullResponse.match(/(\{[\s\S]*?"READY"[\s\S]*?\})/);
    }

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1];
        const data = JSON.parse(jsonStr);

        if (data.READY && data.role) {
          const cleanedText = filterJsonFromText(fullResponse);
          const transitionMessage =
            cleanedText || `Great! Starting your ${data.role} interview now...`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, text: transitionMessage } : m,
            ),
          );

          const config = {
            type: "role_based",
            roleDetails: {
              role: data.role,
              focusArea: data.focusArea || "General",
              level: data.level || "Mid-Level",
            },
            resumeData: resumeContext || undefined,
            language,
          };
          setInterviewConfig(config);

          setTimeout(() => {
            startInterview(config);
          }, 1500);
        }
      } catch (e) {
        console.error("Failed to parse coordinator JSON", e);
      }
    }
  };

  const startInterview = async (config) => {
    let id = activeInterviewId;
    startTimeRef.current = Date.now();

    if (!id) {
      try {
        const newInterview = await api.createInterview({
          role: config.roleDetails?.role || "Custom JD",
          focusArea: config.roleDetails?.focusArea,
          level: config.roleDetails?.level,
          language: config.language,
          history: [],
        });
        id = newInterview._id;
        setActiveInterviewId(id);
      } catch (e) {
        console.error("Failed to create interview session", e);
      }
    }

    setAppState(AppState.INTERVIEW_ACTIVE);
    setCurrentQuestionCount(1);

    const context =
      config.type === "jd"
        ? { jd: config.jdText, language: config.language, totalQuestions }
        : {
            ...config.roleDetails,
            resumeData: config.resumeData,
            language: config.language,
            totalQuestions,
          };

    const chat = createInterviewerChat(context, [], id);
    chatSessionRef.current = chat;
    setMessages([]);

    setIsStreaming(true);
    const botMsgId = generateId();
    setMessages([
      {
        id: botMsgId,
        role: "model",
        text: "Preparing interview...",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    let fullText = "";
    let lastUpdateTime = 0;
    const updateInterval = 50;

    const structuredResponse = await sendMessageStream(
      chat,
      "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.",
      (chunk) => {
        if (
          chunk.startsWith("{") ||
          (fullText.startsWith("{") && chunk.includes('"response"'))
        ) {
          if (chunk.length > fullText.length) {
            fullText = chunk;
          } else {
            fullText += chunk;
          }
        } else {
          fullText += chunk;
        }

        const now = Date.now();
        if (now - lastUpdateTime > updateInterval) {
          lastUpdateTime = now;
          try {
            const parsed = JSON.parse(fullText);
            const displayText = parsed.response || fullText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, text: displayText, isThinking: false }
                  : m,
              ),
            );
          } catch (e) {
            const responseMatch = fullText.match(/"response"\s*:\s*"([^"]*)/);
            const displayText = responseMatch
              ? responseMatch[1]
              : fullText.replace(/[{}"]|response:|^\s*/g, "");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? {
                      ...m,
                      text: displayText || "Preparing...",
                      isThinking: !displayText,
                    }
                  : m,
              ),
            );
          }
        }
      },
    );

    let displayText = fullText;
    if (structuredResponse && typeof structuredResponse === "object") {
      displayText = structuredResponse.response || fullText;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === botMsgId ? { ...m, text: displayText, isThinking: false } : m,
      ),
    );

    setIsStreaming(false);

    if (displayText) {
      // Fire-and-forget speech — don't block interview start
      speakTTS(displayText).catch((err) =>
        console.error("[TTS] Interview start speech failed:", err),
      );
    }
  };

  const handleInterviewMessage = async (text) => {
    if (!chatSessionRef.current) return;

    const userMsg = {
      id: generateId(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: "model",
        text: "Thinking...",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    try {
      let fullResponse = "";
      let lastUpdateTime = 0;
      const updateInterval = 50;

      const structuredResponse = await sendMessageStream(
        chatSessionRef.current,
        text,
        (chunk) => {
          if (
            chunk.startsWith("{") ||
            (fullResponse.startsWith("{") && chunk.includes('"response"'))
          ) {
            if (chunk.length > fullResponse.length) {
              fullResponse = chunk;
            } else {
              fullResponse += chunk;
            }
          } else {
            fullResponse += chunk;
          }

          const now = Date.now();
          if (now - lastUpdateTime > updateInterval) {
            lastUpdateTime = now;
            try {
              const parsed = JSON.parse(fullResponse);
              const displayText = parsed.response || fullResponse;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            } catch (e) {
              const responseMatch = fullResponse.match(
                /"response"\s*:\s*"([^"]*)/,
              );
              const displayText = responseMatch
                ? responseMatch[1]
                : fullResponse.replace(/[{}"]|response:|^\s*/g, "");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                        ...m,
                        text: displayText || "Thinking...",
                        isThinking: !displayText,
                      }
                    : m,
                ),
              );
            }
          }
        },
      );

      let displayText = fullResponse;
      let isInterviewComplete = false;
      let questionNumber = currentQuestionCount;

      if (structuredResponse && typeof structuredResponse === "object") {
        displayText = structuredResponse.response || fullResponse;
        isInterviewComplete = structuredResponse.isInterviewComplete || false;
        questionNumber =
          structuredResponse.questionNumber || currentQuestionCount + 1;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: displayText, isThinking: false }
            : m,
        ),
      );

      setCurrentQuestionCount(Math.min(questionNumber, totalQuestions));

      if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api
          .updateInterview(activeInterviewId, {
            durationSeconds: elapsed,
          })
          .catch((err) => console.error("Failed to update interview:", err));
      }

      if (isInterviewComplete || currentQuestionCount >= totalQuestions) {
        // Interview is complete:
        // 1. Start report generation immediately (don't wait for audio)
        const fullHistory = convertHistoryToMessages(
          chatSessionRef.current.history,
        );
        const reportPromise = generateReportInBackground(fullHistory);

        // 2. Play the final audio, then transition UI after it finishes
        if (displayText) {
          speakTTS(displayText)
            .then(() => reportPromise)
            .then((feedback) => applyFeedbackAndTransition(feedback))
            .catch((err) => {
              console.error("[TTS] Final audio or report error:", err);
              reportPromise
                .then((feedback) => applyFeedbackAndTransition(feedback))
                .catch(() => {});
            });
        } else {
          reportPromise
            .then((feedback) => applyFeedbackAndTransition(feedback))
            .catch(() => {});
        }
      } else if (displayText) {
        // Normal question — play audio, don't block
        speakTTS(displayText).catch((err) =>
          console.error("[TTS] Speech failed:", err),
        );
      }
    } catch (error) {
      console.error("Interview Error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: "Error processing your response. Please try again.",
                isThinking: false,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleInterviewAudio = async (audioBlob) => {
    if (!chatSessionRef.current) return;

    const userMsg = {
      id: generateId(),
      role: "user",
      text: "🎤 Audio Answer Submitted",
      timestamp: new Date(),
      isAudio: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    try {
      const base64Audio = await blobToBase64(audioBlob);

      const botMsgId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: "model",
          text: "Listening and thinking...",
          timestamp: new Date(),
          isThinking: true,
        },
      ]);

      if (activeInterviewId) {
        api
          .uploadAudioRecording(
            activeInterviewId,
            audioBlob,
            currentQuestionCount,
            0,
          )
          .catch((err) => console.error("Audio upload failed:", err));
      }

      const response = await sendAudioMessage(
        chatSessionRef.current,
        base64Audio,
        audioBlob.type,
      );

      let displayText = response;
      let isInterviewComplete = false;
      let questionNumber = currentQuestionCount + 1;

      if (response && typeof response === "object") {
        displayText = response.response || JSON.stringify(response);
        isInterviewComplete = response.isInterviewComplete || false;
        questionNumber = response.questionNumber || currentQuestionCount + 1;
      }

      setCurrentQuestionCount(Math.min(questionNumber, totalQuestions));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: displayText, isThinking: false }
            : m,
        ),
      );

      if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.updateInterview(activeInterviewId, {
          durationSeconds: elapsed,
        });
      }

      if (isInterviewComplete || currentQuestionCount >= totalQuestions) {
        // Interview is complete:
        // 1. Start report generation immediately
        const fullHistory = convertHistoryToMessages(
          chatSessionRef.current.history,
        );
        const reportPromise = generateReportInBackground(fullHistory);

        // 2. Play audio, then transition UI after it finishes
        if (displayText) {
          speakTTS(displayText)
            .then(() => reportPromise)
            .then((feedback) => applyFeedbackAndTransition(feedback))
            .catch((err) => {
              console.error("[TTS] Final audio or report error:", err);
              reportPromise
                .then((feedback) => applyFeedbackAndTransition(feedback))
                .catch(() => {});
            });
        } else {
          reportPromise
            .then((feedback) => applyFeedbackAndTransition(feedback))
            .catch(() => {});
        }
      } else if (displayText) {
        speakTTS(displayText).catch((err) =>
          console.error("[TTS] Speech failed:", err),
        );
      }
    } catch (error) {
      console.error("Interview Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "system",
          text: "Error processing audio. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveAndExit = async () => {
    stopTTS();
    if (activeInterviewId) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      await api.updateInterview(activeInterviewId, {
        status: "IN_PROGRESS",
        durationSeconds: elapsed,
      });
    }
    handleGoToDashboard();
  };

  // Generate report in background (returns Promise<feedback>)
  const generateReportInBackground = async (historyMessages) => {
    try {
      const msgsToAnalyze = historyMessages || messages;
      const feedback = await generateFeedback(
        msgsToAnalyze,
        language,
        activeInterviewId,
      );
      return feedback;
    } catch (err) {
      console.error("[Report] Failed to generate feedback:", err);
      return null;
    }
  };

  // Apply feedback and transition UI to report view
  const applyFeedbackAndTransition = async (feedback) => {
    setAppState(AppState.INTERVIEW_FEEDBACK);
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "system",
        text: "Interview ended. Generating detailed performance report...",
        timestamp: new Date(),
      },
    ]);

    const fallbackFeedback = {
      overallScore: 0,
      communicationScore: 0,
      technicalScore: 0,
      strengths: ["Interview completed"],
      weaknesses: ["Feedback generation failed"],
      suggestion:
        "We encountered an error generating feedback. Please check your interview history.",
    };

    if (!feedback || typeof feedback.overallScore === "undefined") {
      console.error("[Report] Invalid feedback received:", feedback);
      setFeedbackData(fallbackFeedback);
    } else {
      setFeedbackData(feedback);
    }

    if (feedback && activeInterviewId) {
      try {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        await api.updateInterview(activeInterviewId, {
          feedback,
          status: "COMPLETED",
          durationSeconds: elapsed,
        });
      } catch (err) {
        console.error("[Report] Failed to save feedback:", err);
      }
    }
  };

  // Manual end interview (Save & Exit, or End button)
  const handleEndInterview = async (finalMessages = null) => {
    stopTTS(); // Stop any playing audio immediately

    const historyMessages = finalMessages || messages;
    setAppState(AppState.INTERVIEW_FEEDBACK);
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "system",
        text: "Interview ended. Generating detailed performance report...",
        timestamp: new Date(),
      },
    ]);

    try {
      const feedback = await generateFeedback(
        historyMessages,
        language,
        activeInterviewId,
      );
      await applyFeedbackAndTransition(feedback);
    } catch (err) {
      console.error("[Report] Error in manual end interview:", err);
      setFeedbackData({
        overallScore: 0,
        communicationScore: 0,
        technicalScore: 0,
        strengths: ["Interview completed"],
        weaknesses: ["Feedback generation failed"],
        suggestion:
          "We encountered an error generating your feedback. Please check your interview history.",
      });
    }
  };

  if (isResuming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">
            Resuming Interview...
          </p>
        </div>
      </div>
    );
  }

  if (appState === AppState.INTERVIEW_FEEDBACK) {
    if (!feedbackData) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-slate-800">
            Generating Performance Report...
          </h2>
          <p className="text-slate-500">
            Analyzing your answers, tone, and technical accuracy in {language}.
          </p>
        </div>
      );
    }
    return <FeedbackView data={feedbackData} onHome={handleGoToDashboard} />;
  }

  return (
    <>
      {appState !== AppState.INTERVIEW_ACTIVE && (
        <div className="absolute top-6 right-6 z-30">
          <MenuButton onClick={() => setIsDrawerOpen(true)} />
        </div>
      )}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {appState === AppState.LANDING && (
        <Landing
          onSelectMode={handleSelectMode}
          totalQuestions={totalQuestions}
          onTotalQuestionsChange={setTotalQuestions}
        />
      )}

      {appState === AppState.SETUP_JD && (
        <JDPaste onStart={handleJDStart} onBack={handleBackToLanding} />
      )}

      {appState === AppState.SETUP_RESUME && (
        <ResumeUpload
          onFileSelect={handleResumeFileSelect}
          onBack={handleBackToLanding}
          isLoading={isStreaming}
        />
      )}

      {(appState === AppState.SETUP_ROLE_CHAT ||
        appState === AppState.SETUP_RESUME_CHAT) && (
        <ChatInterface
          title={
            appState === AppState.SETUP_RESUME_CHAT
              ? "Resume Analysis"
              : "Interview Setup"
          }
          messages={messages}
          onSendMessage={handleCoordinatorMessage}
          isStreaming={isStreaming}
          showBackButton
          onBack={handleBackToLanding}
          placeholder="Answer the coordinator..."
          mode="text"
          suggestions={getSuggestionChips()}
          onSuggestionClick={handleSuggestionClick}
        />
      )}

      {appState === AppState.INTERVIEW_ACTIVE && (
        <ChatInterface
          title="Mock Interview Session"
          messages={messages}
          onSendMessage={handleInterviewMessage}
          onSendAudio={handleInterviewAudio}
          onPlayAudio={handlePlayAudio}
          isStreaming={isStreaming}
          onEndSession={handleEndInterview}
          onSaveExit={handleSaveAndExit}
          placeholder="Type your answer or use microphone..."
          mode="audio"
          currentQuestion={currentQuestionCount}
          totalQuestions={totalQuestions}
        />
      )}
    </>
  );
};
