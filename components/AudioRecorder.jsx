import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';

export const AudioRecorder = ({ 
  onRecordingComplete, 
  disabled, 
  isProcessing 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'; 
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="flex items-center gap-3 text-slate-500 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
        <Loader2 className="animate-spin text-blue-500" size={20} />
        <span>Processing answer...</span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 bg-red-50 px-6 py-3 rounded-full border border-red-200 animate-pulse">
           <div className="w-3 h-3 bg-red-500 rounded-full"></div>
           <span className="text-red-600 font-mono w-12 text-center">{formatTime(recordingTime)}</span>
        </div>
        <Button 
          variant="danger" 
          size="lg" 
          onClick={stopRecording}
          className="rounded-full w-16 h-16 flex items-center justify-center p-0 shadow-lg shadow-red-500/30 ring-4 ring-red-100"
        >
          <Square size={24} fill="currentColor" />
        </Button>
        <p className="text-sm text-slate-500">Tap to finish speaking</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button 
        variant="primary" 
        size="lg"
        onClick={startRecording}
        disabled={disabled}
        className="rounded-full w-16 h-16 flex items-center justify-center p-0 bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all hover:scale-105"
      >
        <Mic size={28} />
      </Button>
      <p className="text-sm text-slate-400">Tap to answer</p>
    </div>
  );
};