import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Landing } from './Landing';
import { JDPaste } from './JDPaste';
import { ResumeUpload } from './ResumeUpload';
import { ChatInterface } from './ChatInterface';
import { FeedbackView } from './FeedbackView';
import { AppState } from '../types';
import { 
  createCoordinatorChat,
  createResumeCoordinatorChat,
  createInterviewerChat, 
  sendMessageStream, 
  sendAudioMessage,
  sendResumeToChat,
  generateSpeech,
  playAudioBuffer,
  generateFeedback,
  convertHistoryToMessages
} from '../services/geminiService';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

const generateId = () => Math.random().toString(36).substring(2, 9);
const TOTAL_QUESTIONS = 5;

// Helper to convert Blob to Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (base64String.includes(',')) {
        resolve(base64String.split(',')[1]);
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
    appState, setAppState, 
    language,
    activeInterviewId, setActiveInterviewId,
    interviewConfig, setInterviewConfig,
    resetSession
  } = useAppStore();

  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQuestionCount, setCurrentQuestionCount] = useState(0);
  const [feedbackData, setFeedbackData] = useState(null);
  const [resumeContext, setResumeContext] = useState(null);
  const startTimeRef = useRef(Date.now());
  
  const chatSessionRef = useRef(null);

  useEffect(() => {
    const initSession = async () => {
        if (activeInterviewId && !chatSessionRef.current) {
            try {
                const interview = await api.getInterview(activeInterviewId);
                await resumeInterview(interview);
            } catch (e) {
                console.error("Failed to recover session", e);
                navigate('/mockmate/candidate/dashboard');
            }
        }
    };
    initSession();
  }, [activeInterviewId]);

  const resumeInterview = async (interview) => {
     setActiveInterviewId(interview._id);
     const config = {
         type: 'role_based', 
         roleDetails: {
             role: interview.role,
             focusArea: interview.focusArea,
             level: interview.level
         },
         language: interview.language
     };
     setInterviewConfig(config);
     
     const history = interview.history || [];
     const context = { ...config.roleDetails, language: config.language };
     
     const chat = createInterviewerChat(context, history, interview._id);
     chatSessionRef.current = chat;
     
     const restoredMessages = convertHistoryToMessages(history);
     setMessages(restoredMessages);
     setCurrentQuestionCount(Math.floor(restoredMessages.length / 2));
     setAppState(AppState.INTERVIEW_ACTIVE);

     if (history.length === 0) {
        setIsStreaming(true);
        const botMsgId = generateId();
        setMessages([{ id: botMsgId, role: 'model', text: 'Preparing interview...', timestamp: new Date(), isThinking: true }]);
        
        const textResponse = await sendMessageStream(chat, "Start the interview now. Introduce yourself briefly and ask the first question.", (chunk) => {
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
        });
        
        if (textResponse) {
             setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: true, text: textResponse } : m));
             const audioBuffer = await generateSpeech(textResponse);
             if (audioBuffer) playAudioBuffer(audioBuffer);
             setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: false } : m));
        }
        setIsStreaming(false);
     }
  };

  const handleSelectMode = (mode) => {
    if (mode === 'jd') {
      setAppState(AppState.SETUP_JD);
    } else if (mode === 'resume') {
      setAppState(AppState.SETUP_RESUME);
    } else {
      setAppState(AppState.SETUP_ROLE_CHAT);
      startCoordinatorChat();
    }
  };

  const handleBackToLanding = () => {
    resetSession();
    navigate('/mockmate/candidate/dashboard');
  };

  const handleGoToDashboard = () => {
    resetSession();
    navigate('/mockmate/candidate/dashboard');
  };

  const handleJDStart = (jdText) => {
    const config = { type: 'jd', jdText, language };
    setInterviewConfig(config);
    startInterview(config);
  };

  const handleResumeFileSelect = async (file) => {
    setIsStreaming(true);
    try {
      const base64 = await blobToBase64(file);
      setResumeContext({ base64, mimeType: file.type });
      
      const chat = createResumeCoordinatorChat(language);
      chatSessionRef.current = chat;
      
      setAppState(AppState.SETUP_RESUME_CHAT);
      setMessages([]);

      const systemMsgId = generateId();
      setMessages([{ id: systemMsgId, role: 'model', text: 'Analyzing resume...', timestamp: new Date(), isThinking: true }]);
      
      const responseText = await sendResumeToChat(chat, base64, file.type);
      
      setMessages(prev => prev.map(m => m.id === systemMsgId ? { ...m, text: responseText, isThinking: false } : m));
      
    } catch (err) {
      console.error(err);
      alert("Failed to analyze resume.");
      setAppState(AppState.SETUP_RESUME);
      setResumeContext(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const startCoordinatorChat = async () => {
    const chat = createCoordinatorChat(language);
    chatSessionRef.current = chat;
    setMessages([]); 
    
    setIsStreaming(true);
    const initialMsgId = generateId();
    setMessages([{ id: initialMsgId, role: 'model', text: '', timestamp: new Date(), isThinking: true }]);

    await sendMessageStream(chat, `Hello, I want to practice for an interview in ${language}.`, (chunk) => {
      setMessages(prev => prev.map(m => m.id === initialMsgId ? { ...m, text: chunk, isThinking: false } : m));
    });
    setIsStreaming(false);
  };

  const handleCoordinatorMessage = async (text) => {
    if (!chatSessionRef.current) return;

    const userMsg = { id: generateId(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateId();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', timestamp: new Date(), isThinking: true }]);

    let fullResponse = "";
    await sendMessageStream(chatSessionRef.current, text, (chunk) => {
      fullResponse = chunk;
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
    });

    setIsStreaming(false);

    let jsonMatch = fullResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (!jsonMatch) {
       jsonMatch = fullResponse.match(/(\{[\s\S]*?"READY"[\s\S]*?\})/);
    }

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1];
        const data = JSON.parse(jsonStr);
        
        if (data.READY && data.role) {
           const config = {
             type: 'role_based',
             roleDetails: {
               role: data.role,
               focusArea: data.focusArea || 'General',
               level: data.level || 'Mid-Level'
             },
             resumeData: resumeContext || undefined,
             language
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
                role: config.roleDetails?.role || 'Custom JD',
                focusArea: config.roleDetails?.focusArea,
                level: config.roleDetails?.level,
                language: config.language,
                history: []
            });
            id = newInterview._id;
            setActiveInterviewId(id);
        } catch (e) {
            console.error("Failed to create interview session", e);
        }
    }

    setAppState(AppState.INTERVIEW_ACTIVE);
    setCurrentQuestionCount(1);
    
    const context = config.type === 'jd' 
      ? { jd: config.jdText, language: config.language } 
      : { ...config.roleDetails, resumeData: config.resumeData, language: config.language };
      
    const chat = createInterviewerChat(context, [], id);
    chatSessionRef.current = chat;
    setMessages([]); 

    setIsStreaming(true);
    const botMsgId = generateId();
    setMessages([{ id: botMsgId, role: 'model', text: 'Preparing interview...', timestamp: new Date(), isThinking: true }]);

    const textResponse = await sendMessageStream(chat, "Start the interview now. Introduce yourself briefly and ask the first question.", (chunk) => {
       setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
    });
    
    if (textResponse) {
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: true, text: textResponse } : m)); 
      const audioBuffer = await generateSpeech(textResponse);
      if (audioBuffer) {
        playAudioBuffer(audioBuffer);
      }
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: false } : m));
    }
    
    setIsStreaming(false);
  };

  const handleInterviewMessage = async (text) => {
    if (!chatSessionRef.current) return;
    
    const userMsg = { id: generateId(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateId();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: 'Thinking...', timestamp: new Date(), isThinking: true }]);

    let fullResponse = "";
    await sendMessageStream(chatSessionRef.current, text, (chunk) => {
      fullResponse = chunk;
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
    });
    
    setCurrentQuestionCount(prev => Math.min(prev + 1, TOTAL_QUESTIONS));
    
    if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.updateInterview(activeInterviewId, { 
            status: 'IN_PROGRESS', // Keep status updated implicitly
            durationSeconds: elapsed 
        });
    }

    if (fullResponse) {
       setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: true } : m));
       const audioBuffer = await generateSpeech(fullResponse);
       if (audioBuffer) {
         playAudioBuffer(audioBuffer);
       }
       setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: false } : m));
    }
    
    setIsStreaming(false);
  };

  const handleInterviewAudio = async (audioBlob) => {
    if (!chatSessionRef.current) return;

    const userMsg = { 
      id: generateId(), 
      role: 'user', 
      text: '🎤 Audio Answer Submitted', 
      timestamp: new Date(),
      isAudio: true 
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    try {
      const base64Audio = await blobToBase64(audioBlob);
      
      const botMsgId = generateId();
      setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: 'Listening and thinking...', timestamp: new Date(), isThinking: true }]);

      const textResponse = await sendAudioMessage(chatSessionRef.current, base64Audio, audioBlob.type);
      
      setCurrentQuestionCount(prev => Math.min(prev + 1, TOTAL_QUESTIONS));
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: textResponse } : m));
      
      if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.updateInterview(activeInterviewId, { 
             durationSeconds: elapsed
        });
      }

      const audioBuffer = await generateSpeech(textResponse);
      if (audioBuffer) {
        playAudioBuffer(audioBuffer);
      }
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isThinking: false } : m));

    } catch (error) {
      console.error("Interview Error:", error);
      setMessages(prev => [...prev, { id: generateId(), role: 'system', text: "Error processing audio. Please try again.", timestamp: new Date() }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveAndExit = async () => {
    if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        await api.updateInterview(activeInterviewId, {
            status: 'IN_PROGRESS',
            durationSeconds: elapsed
        });
    }
    handleGoToDashboard();
  };

  const handleEndInterview = async () => {
    setAppState(AppState.INTERVIEW_FEEDBACK); 
    setMessages(prev => [...prev, { id: generateId(), role: 'system', text: "Interview ended. Generating detailed performance report...", timestamp: new Date() }]);
    
    const feedback = await generateFeedback(messages, language);
    setFeedbackData(feedback);

    if (feedback && activeInterviewId) {
      try {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        await api.updateInterview(activeInterviewId, {
          feedback: feedback,
          status: 'COMPLETED',
          durationSeconds: elapsed
        });
      } catch (err) {
        console.error("Failed to save interview", err);
      }
    }
  };

  if (appState === AppState.INTERVIEW_FEEDBACK) {
     if (!feedbackData) {
       return (
         <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
           <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
           <h2 className="text-xl font-semibold text-slate-800">Generating Performance Report...</h2>
           <p className="text-slate-500">Analyzing your answers, tone, and technical accuracy in {language}.</p>
         </div>
       );
     }
     return <FeedbackView data={feedbackData} onHome={handleGoToDashboard} />;
  }

  return (
    <>
      {appState === AppState.LANDING && (
        <Landing onSelectMode={handleSelectMode} />
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

      {(appState === AppState.SETUP_ROLE_CHAT || appState === AppState.SETUP_RESUME_CHAT) && (
        <ChatInterface
          title={appState === AppState.SETUP_RESUME_CHAT ? "Resume Analysis" : "Interview Setup"}
          messages={messages}
          onSendMessage={handleCoordinatorMessage}
          isStreaming={isStreaming}
          showBackButton
          onBack={handleBackToLanding}
          placeholder="Answer the coordinator..."
          mode="text"
        />
      )}

      {appState === AppState.INTERVIEW_ACTIVE && (
        <ChatInterface
          title="Mock Interview Session"
          messages={messages}
          onSendMessage={handleInterviewMessage}
          onSendAudio={handleInterviewAudio}
          isStreaming={isStreaming}
          onEndSession={handleEndInterview}
          onSaveExit={handleSaveAndExit}
          placeholder="Type your answer or use microphone..."
          mode="audio"
          currentQuestion={currentQuestionCount}
          totalQuestions={TOTAL_QUESTIONS}
        />
      )}
    </>
  );
};