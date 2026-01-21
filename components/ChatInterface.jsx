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
}) => {
    const [activeInputMode, setActiveInputMode] = useState(mode);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const enableTextInput = localStorage.getItem("enableTextInput") === "true";

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
        <div className="flex flex-col h-screen max-w-4xl mx-auto bg-slate-50 relative shadow-xl shadow-slate-200/50">
            {/* Header */}
            <header className="flex flex-col border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
                <div className="flex items-center justify-between px-6 py-4">
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
                            <h1 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h1>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                {mode === "audio" && (
                                    <Volume2
                                        size={12}
                                        className="text-blue-500"
                                    />
                                )}
                                <span
                                    className={`w-2 h-2 rounded-full ${mode === "audio" ? "bg-blue-500" : "bg-emerald-500"} animate-pulse`}
                                ></span>
                                {mode === "audio" ? "Voice Session" : "Live Chat"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentQuestion && totalQuestions && (
                            <div className="hidden md:flex flex-col items-end mr-4">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <Target size={12} /> Progress
                                </span>
                                <span className="text-sm font-bold text-slate-800">
                                    Question {currentQuestion} / {totalQuestions}
                                </span>
                            </div>
                        )}

                        {onSaveExit && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onSaveExit}
                                className="flex items-center gap-2"
                            >
                                <Save size={16} />
                                <span className="hidden md:inline">Save & Exit</span>
                            </Button>
                        )}

                        {onEndSession && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onEndSession}
                                className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50"
                            >
                                <StopCircle size={16} />
                                <span className="hidden md:inline">End Interview</span>
                                <span className="md:hidden">End</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
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
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 space-y-2 scroll-smooth bg-slate-50">
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

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-white border-t border-slate-200 transition-all duration-300">
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
                    <div className="relative">
                        <form
                            onSubmit={handleSubmit}
                            className="relative max-w-4xl mx-auto flex items-end gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-md transition-all"
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
                                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg text-white transition-all shadow-md shadow-blue-500/20 mb-[1px]"
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
    );
};
