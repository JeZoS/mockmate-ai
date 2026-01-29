import React, { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, StopCircle, Volume2, Target, Keyboard, Mic, Save } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { Button } from "./ui/Button";
import { AudioRecorder } from "./AudioRecorder";

export const ChatInterface = ({
    messages,
    onSendMessage,
    onSendAudio,
    isStreaming,
    onEndSession,
    onSaveExit,
    title,
    placeholder = "Type your answer...",
    showBackButton,
    onBack,
    mode = "text",
    currentQuestion,
    totalQuestions,
    onPlayAudio,
    suggestions = [],
    onSuggestionClick,
}) => {
    const [activeInputMode, setActiveInputMode] = useState(mode);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Enable text input via localStorage flag OR if no audio handler is provided
    const enableTextInput = localStorage.getItem("enableTextInput") === "true" || !onSendAudio;

    useEffect(() => {
        setActiveInputMode(mode);
    }, [mode]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, activeInputMode]);

    useEffect(() => {
        if (!isStreaming && activeInputMode === "text") {
            inputRef.current?.focus();
        }
    }, [isStreaming, activeInputMode]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (!input.trim() || isStreaming) return;
        onSendMessage(input);
        setInput("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const progressPercentage =
        currentQuestion && totalQuestions ? Math.min((currentQuestion / totalQuestions) * 100, 100) : 0;

    return (
        <div className="flex h-screen w-full bg-slate-100">
            {/* Left Sidebar - Interview Info */}
            <aside className="hidden lg:flex flex-col w-72 xl:w-80 bg-white border-r border-slate-200 flex-shrink-0">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                        {showBackButton && (
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h1>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                {mode === "audio" && (
                                    <Volume2 size={12} className="text-blue-500" />
                                )}
                                <span className={`w-2 h-2 rounded-full ${mode === "audio" ? "bg-blue-500" : "bg-emerald-500"} animate-pulse`}></span>
                                {mode === "audio" ? "Voice Session" : "Live Chat"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress Section */}
                {currentQuestion && totalQuestions && (
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Target size={16} className="text-blue-600" />
                            <span className="text-sm font-semibold text-slate-700">Interview Progress</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-slate-600">
                            Question <span className="font-bold text-blue-600">{currentQuestion}</span> of <span className="font-bold">{totalQuestions}</span>
                        </p>
                    </div>
                )}

                {/* Tips Section */}
                <div className="p-6 flex-1">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">💡 Quick Tips</h3>
                    <ul className="space-y-2 text-xs text-slate-500">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            Take your time to structure your answers
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            Use the STAR method for behavioral questions
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            Ask clarifying questions if needed
                        </li>
                    </ul>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-t border-slate-100 space-y-2">
                    {onSaveExit && (
                        <div className="relative group">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onSaveExit}
                                className="flex items-center justify-center gap-2 w-full"
                            >
                                <Save size={16} />
                                Save & Exit
                            </Button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                Save your progress and continue later
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                    {onEndSession && (
                        <div className="relative group">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onEndSession}
                                className="flex items-center justify-center gap-2 w-full border-red-200 text-red-600 hover:bg-red-50"
                            >
                                <StopCircle size={16} />
                                End Interview
                            </Button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                End now and generate performance report
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Chat Area */}
            <div className="flex flex-col flex-1 min-w-0 bg-slate-50">
                {/* Mobile Header */}
                <header className="lg:hidden flex flex-col border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-10">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                            {showBackButton && (
                                <button
                                    onClick={onBack}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <div>
                                <h1 className="text-base font-bold text-slate-800">{title}</h1>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${mode === "audio" ? "bg-blue-500" : "bg-emerald-500"} animate-pulse`}></span>
                                    {mode === "audio" ? "Voice" : "Chat"}
                                    {currentQuestion && totalQuestions && (
                                        <span className="ml-2">• Q{currentQuestion}/{totalQuestions}</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {onSaveExit && (
                                <Button variant="secondary" size="sm" onClick={onSaveExit} title="Save progress and continue later">
                                    <Save size={16} />
                                </Button>
                            )}
                            {onEndSession && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onEndSession}
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                    title="End now and generate report"
                                >
                                    <StopCircle size={16} />
                                </Button>
                            )}
                        </div>
                    </div>
                    {currentQuestion && totalQuestions && (
                        <div className="w-full bg-slate-100 h-1">
                            <div
                                className="bg-blue-600 h-1 transition-all duration-500 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                    )}
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-12 xl:px-16 space-y-2 scroll-smooth">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-80">
                        <p>
                            {mode === "audio"
                                ? "The interviewer will start speaking..."
                                : "Send a message to start..."}
                        </p>
                    </div>
                )}
                {messages.map((msg) => (
                    <ChatMessage
                        key={msg.id}
                        message={msg}
                        onPlayAudio={onPlayAudio}
                    />
                ))}
                {isStreaming && activeInputMode === "audio" && (
                    <div className="flex justify-start w-full mb-6">
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                            Interviewer is speaking...
                        </div>
                    </div>
                )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestion Chips */}
                {suggestions.length > 0 && !isStreaming && (
                    <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-3 pb-2 bg-white border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-2 font-medium">Quick replies</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => onSuggestionClick?.(suggestion)}
                                    className="px-4 py-2 text-sm bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full border border-slate-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                                >
                                    {suggestion.label || suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className={`px-4 md:px-8 lg:px-12 xl:px-16 py-4 bg-white ${suggestions.length === 0 || isStreaming ? 'border-t border-slate-200' : ''} transition-all duration-300`}>
                    {activeInputMode === "audio" && onSendAudio ? (
                        <div className="flex flex-col items-center justify-center py-4 relative">
                            <AudioRecorder
                                onRecordingComplete={onSendAudio}
                                disabled={isStreaming}
                                isProcessing={isStreaming}
                            />
                            {enableTextInput && (
                                <button
                                    onClick={() => setActiveInputMode("text")}
                                    className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                                    disabled={isStreaming}
                                >
                                    <Keyboard size={18} />
                                    Type response instead
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="relative max-w-4xl">
                            <form
                                onSubmit={handleSubmit}
                                className="relative flex items-end gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-lg transition-all"
                            >
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={placeholder}
                                    disabled={isStreaming}
                                    className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-base p-3 focus:outline-none resize-none max-h-32 min-h-[52px]"
                                    rows={1}
                                    style={{ height: "auto", minHeight: "52px" }}
                                    onInput={(e) => {
                                        const target = e.target;
                                        target.style.height = "auto";
                                        target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isStreaming}
                                    className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl text-white transition-all shadow-md shadow-blue-500/20 mb-[1px]"
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                            {onSendAudio && (
                                <div className="flex justify-center mt-3">
                                    <button
                                        onClick={() => setActiveInputMode("audio")}
                                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                                        disabled={isStreaming}
                                    >
                                        <Mic size={18} />
                                        Switch to Voice
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
