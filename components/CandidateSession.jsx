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
  stopAudio,
  generateFeedback,
  convertHistoryToMessages
} from '../services/geminiService';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { SideDrawer } from './SideDrawer';
import { MenuButton } from './MenuButton';
import { Loader2 } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9);


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
                navigate('/mockmate/candidate/dashboard');
            } finally {
                setIsResuming(false);
            }
        }
    };
    initSession();
  }, [activeInterviewId]);

  useEffect(() => {
    if (appState === AppState.SETUP_ROLE_CHAT && !chatSessionRef.current && !activeInterviewId) {
      startCoordinatorChat();
    }
  }, [appState]);

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
     const context = { ...config.roleDetails, language: config.language, totalQuestions };

     
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
        
        const textResponse = await sendMessageStream(chat, "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.", (chunk) => {
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
        });
        
        if (textResponse) {
             const audioBuffer = await generateSpeech(textResponse);
             if (audioBuffer) playAudioBuffer(audioBuffer);
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

  const handlePlayAudio = async (text) => {
    try {
        const audioBuffer = await generateSpeech(text);
        if (audioBuffer) playAudioBuffer(audioBuffer);
    } catch (error) {
        console.error("Failed to play audio", error);
    }
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
      
      const result = await sendResumeToChat(chat, base64, file.type, language);
      
      // Handle the new structured response format
      const responseText = result.text || result;
      setMessages(prev => prev.map(m => m.id === systemMsgId ? { ...m, text: responseText, isThinking: false } : m));
      
      // Store the analysis if available and generate suggestions
      if (result.analysis) {
        chatSessionRef.current.resumeAnalysis = result.analysis;
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

  // Analyze AI message and generate contextual suggestions
  const generateContextualSuggestions = (aiMessage, analysis = null) => {
    const lowerMessage = aiMessage.toLowerCase();
    const newSuggestions = [];

    // Check if AI is asking about roles (after resume analysis)
    if (analysis?.suggestedRoles && (
      lowerMessage.includes('which one') || 
      lowerMessage.includes('which role') ||
      lowerMessage.includes('choose one') ||
      lowerMessage.includes('select one') ||
      lowerMessage.includes('practice for')
    )) {
      analysis.suggestedRoles.forEach((role, index) => {
        newSuggestions.push({
          label: `${index + 1}. ${role.role}`,
          value: `I'd like to practice for the ${role.role} role, focusing on ${role.focusArea}.`
        });
      });
    }
    // Check if AI is asking about experience level
    else if (
      lowerMessage.includes('experience level') || 
      lowerMessage.includes('seniority') ||
      lowerMessage.includes('how many years') ||
      lowerMessage.includes('what level')
    ) {
      newSuggestions.push(
        { label: 'Entry Level / Fresher', value: 'I am at entry level / fresher.' },
        { label: 'Junior (1-2 years)', value: 'I have 1-2 years of experience, junior level.' },
        { label: 'Mid-Level (3-5 years)', value: 'I have 3-5 years of experience, mid-level.' },
        { label: 'Senior (5+ years)', value: 'I have 5+ years of experience, senior level.' }
      );
    }
    // Check if AI is asking for confirmation
    else if (
      lowerMessage.includes('ready to start') ||
      lowerMessage.includes('shall we begin') ||
      lowerMessage.includes('start the interview') ||
      lowerMessage.includes('proceed with') ||
      lowerMessage.includes('is that correct') ||
      lowerMessage.includes('sound good')
    ) {
      newSuggestions.push(
        { label: "Yes, let's start!", value: "Yes, let's start the interview!" },
        { label: 'I want to change something', value: 'Actually, I want to change the role or focus area.' }
      );
    }
    // Check if AI is asking about role/position
    else if (
      lowerMessage.includes('what role') ||
      lowerMessage.includes('what position') ||
      lowerMessage.includes('practicing for') ||
      lowerMessage.includes('interviewing for')
    ) {
      newSuggestions.push(
        { label: 'Frontend Developer', value: 'I want to practice for a Frontend Developer role.' },
        { label: 'Backend Developer', value: 'I want to practice for a Backend Developer role.' },
        { label: 'Full-Stack Developer', value: 'I want to practice for a Full-Stack Developer role.' },
        { label: 'Software Engineer', value: 'I want to practice for a Software Engineer role.' }
      );
    }
    // Check if AI is asking about focus area / tech stack
    else if (
      lowerMessage.includes('focus area') ||
      lowerMessage.includes('tech stack') ||
      lowerMessage.includes('technologies') ||
      lowerMessage.includes('skills') ||
      lowerMessage.includes('speciali')
    ) {
      newSuggestions.push(
        { label: 'React / Frontend', value: 'Focus on React, JavaScript, and frontend development.' },
        { label: 'Node.js / Backend', value: 'Focus on Node.js, Express, and backend development.' },
        { label: 'MERN Stack', value: 'Focus on the MERN stack (MongoDB, Express, React, Node.js).' },
        { label: 'System Design', value: 'Focus on system design and architecture.' },
        { label: 'DSA & Problem Solving', value: 'Focus on data structures, algorithms, and problem solving.' }
      );
    }

    setSuggestions(newSuggestions);
  };

  // Get current suggestions for display
  const getSuggestionChips = () => {
    if (appState !== AppState.SETUP_RESUME_CHAT && appState !== AppState.SETUP_ROLE_CHAT) return [];
    return suggestions;
  };

  // Handle when user clicks a suggestion chip
  const handleSuggestionClick = (suggestion) => {
    setSuggestions([]); // Clear suggestions after clicking
    const message = typeof suggestion === 'string' ? suggestion : suggestion.value;
    handleCoordinatorMessage(message);
  };

  const startCoordinatorChat = async () => {
    const chat = createCoordinatorChat(language);
    chatSessionRef.current = chat;
    setMessages([]); 
    
    setIsStreaming(true);
    const initialMsgId = generateId();
    setMessages([{ id: initialMsgId, role: 'model', text: '', timestamp: new Date(), isThinking: true }]);

    let fullResponse = "";
    await sendMessageStream(chat, `Hello, I want to practice for an interview in ${language}.`, (chunk) => {
      fullResponse = chunk;
      setMessages(prev => prev.map(m => m.id === initialMsgId ? { ...m, text: chunk, isThinking: false } : m));
    });
    setIsStreaming(false);
    
    generateContextualSuggestions(fullResponse);
  };

  const filterJsonFromText = (text) => {
    return text
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
      .replace(/\{[\s\S]*?"READY"[\s\S]*?\}/g, '')
      .trim();
  };

  const handleCoordinatorMessage = async (text) => {
    if (!chatSessionRef.current) return;

    setSuggestions([]); // Clear suggestions when user sends a message
    const userMsg = { id: generateId(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateId();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', timestamp: new Date(), isThinking: true }]);

    let fullResponse = "";
    await sendMessageStream(chatSessionRef.current, text, (chunk) => {
      fullResponse = chunk;
      const displayText = filterJsonFromText(chunk);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: displayText || 'Processing...', isThinking: !displayText } : m));
    });

    setIsStreaming(false);

    // Generate new contextual suggestions based on AI response
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
           const transitionMessage = cleanedText || `Great! Starting your ${data.role} interview now...`;
           setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: transitionMessage } : m));
           
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
      ? { jd: config.jdText, language: config.language, totalQuestions } 
      : { ...config.roleDetails, resumeData: config.resumeData, language: config.language, totalQuestions };

      
    const chat = createInterviewerChat(context, [], id);
    chatSessionRef.current = chat;
    setMessages([]); 

    setIsStreaming(true);
    const botMsgId = generateId();
    setMessages([{ id: botMsgId, role: 'model', text: 'Preparing interview...', timestamp: new Date(), isThinking: true }]);

    const textResponse = await sendMessageStream(chat, "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.", (chunk) => {
       setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
    });
    
    if (textResponse) {
      const audioBuffer = await generateSpeech(textResponse);
      if (audioBuffer) {
        playAudioBuffer(audioBuffer);
      }
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

    try {
      let fullResponse = "";
      await sendMessageStream(chatSessionRef.current, text, (chunk) => {
        fullResponse = chunk;
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: chunk, isThinking: false } : m));
      });
      
      setCurrentQuestionCount(prev => Math.min(prev + 1, totalQuestions));

      // Update interview duration
      if (activeInterviewId) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          api.updateInterview(activeInterviewId, { 
              durationSeconds: elapsed 
          }).catch(err => console.error('Failed to update interview:', err));
      }

      if (fullResponse) {
         const audioBuffer = await generateSpeech(fullResponse);
         if (audioBuffer) {
           playAudioBuffer(audioBuffer);
         }
      }
      
      // Check if interview should end
      if (currentQuestionCount >= totalQuestions) {
          const fullHistory = convertHistoryToMessages(chatSessionRef.current.history);
          setTimeout(() => handleEndInterview(fullHistory), 4000);
      }
    } catch (error) {
      console.error("Interview Error:", error);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: "Error processing your response. Please try again.", isThinking: false } : m));
    } finally {
      setIsStreaming(false);
    }
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

      // Upload audio to S3 in background (non-blocking)
      if (activeInterviewId) {
        api.uploadAudioRecording(
          activeInterviewId, 
          audioBlob, 
          currentQuestionCount,
          0 // duration will be calculated on backend if needed
        ).catch(err => console.error('Audio upload failed:', err));
      }

      const textResponse = await sendAudioMessage(chatSessionRef.current, base64Audio, audioBlob.type);
      
      setCurrentQuestionCount(prev => Math.min(prev + 1, totalQuestions));

      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: textResponse } : m));
      
      if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.updateInterview(activeInterviewId, { 
             durationSeconds: elapsed
        });
      }

      const audioBuffer = await generateSpeech(textResponse);
      if (currentQuestionCount >= totalQuestions) {
          const fullHistory = convertHistoryToMessages(chatSessionRef.current.history);
          setTimeout(() => handleEndInterview(fullHistory), 4000);
      }

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

  const handleEndInterview = async (finalMessages = null) => {
    stopAudio();
    
    setAppState(AppState.INTERVIEW_FEEDBACK); 
    setMessages(prev => [...prev, { id: generateId(), role: 'system', text: "Interview ended. Generating detailed performance report...", timestamp: new Date() }]);
    
    const msgsToAnalyze = finalMessages || messages;
    const feedback = await generateFeedback(msgsToAnalyze, language);
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

  if (isResuming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Resuming Interview...</p>
        </div>
      </div>
    );
  }

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
      {appState !== AppState.INTERVIEW_ACTIVE && (
        <div className="absolute top-6 right-6 z-30">
          <MenuButton onClick={() => setIsDrawerOpen(true)} />
        </div>
      )}
      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      
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