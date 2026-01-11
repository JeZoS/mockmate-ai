import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';

export const ResumeUpload = ({ onFileSelect, onBack, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    // Basic validation for PDF or Image
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (validTypes.includes(file.type)) {
      setSelectedFile(file);
    } else {
      alert("Please upload a PDF or Image file.");
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back
        </button>

        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Upload Resume</h2>
          <p className="text-slate-500">We'll analyze your resume to suggest the best interview topics for you.</p>
        </div>

        <div 
          className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-white
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}
            ${selectedFile ? 'border-emerald-500 bg-emerald-50' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            ref={inputRef}
            type="file" 
            className="hidden" 
            onChange={handleChange} 
            accept=".pdf,.jpg,.jpeg,.png,.webp"
          />

          {!selectedFile ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <UploadCloud size={32} />
              </div>
              <div>
                <p className="font-medium text-slate-900">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500">PDF, PNG or JPG (max 5MB)</p>
              </div>
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>Select File</Button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-emerald-200">
               <div className="flex items-center gap-3 overflow-hidden">
                 <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                   <FileText size={24} />
                 </div>
                 <div className="flex-1 min-w-0 text-left">
                   <p className="font-medium text-slate-900 truncate">{selectedFile.name}</p>
                   <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                 </div>
               </div>
               <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500 p-2">
                 <X size={20} />
               </button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button 
            size="lg" 
            disabled={!selectedFile || isLoading}
            isLoading={isLoading}
            onClick={handleUpload}
            className="w-full shadow-lg shadow-blue-500/20"
          >
            Analyze & Start Chat
          </Button>
        </div>
      </div>
    </div>
  );
};