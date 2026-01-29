import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Volume2, Loader2 } from 'lucide-react';

export const ChatMessage = ({ message, onPlayAudio }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    if (onPlayAudio && !isPlaying) {
      setIsPlaying(true);
      await onPlayAudio(message.text);
      setIsPlaying(false);
    }
  };
  
  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] lg:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center shadow-sm ${isUser ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}>
          {isUser ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div 
            className={`px-4 py-3 md:px-5 md:py-3.5 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed overflow-hidden
              ${isUser 
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-md' 
                : 'bg-white text-slate-800 rounded-tl-md border border-slate-200/80'
              }`}
          >
            {message.isThinking ? (
               <div className="flex space-x-2 items-center h-6">
                 <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
            ) : (
                <div className={`prose prose-sm md:prose-base max-w-none ${isUser ? 'prose-invert' : 'prose-slate'}`}>
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-1 px-1">
             {/* Audio Replay Button - Hidden for now */}
            {/* {!isUser && !message.isThinking && onPlayAudio && (
                <button 
                    onClick={handlePlay}
                    disabled={isPlaying}
                    className="flex items-center gap-1 text-slate-400 hover:text-blue-600 transition-colors text-xs font-medium disabled:opacity-50"
                    title="Re-play audio"
                >
                    {isPlaying ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                    {isPlaying ? 'Playing...' : 'Re-hear'}
                </button>
            )} */}
            
            {/* Timestamp */}
            <span className="text-xs text-slate-400">
                • {new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};