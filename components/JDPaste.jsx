import React, { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

export const JDPaste = ({ onStart, onBack }) => {
  const [text, setText] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back
        </button>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">Paste Job Description</h2>
          <p className="text-slate-500">Copy the full job description here. The AI will analyze key skills and requirements.</p>
        </div>

        <div className="relative shadow-sm">
          <textarea
            className="w-full h-64 bg-white border border-slate-200 rounded-xl p-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-inner"
            placeholder="e.g. We are looking for a Senior React Engineer with 5+ years experience in..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button 
            size="lg" 
            disabled={text.length < 50}
            onClick={() => onStart(text)}
            className="w-full md:w-auto shadow-lg shadow-blue-500/20"
          >
            <Sparkles size={18} className="mr-2" />
            Start Interview
          </Button>
        </div>
      </div>
    </div>
  );
};