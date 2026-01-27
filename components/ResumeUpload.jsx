import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, X, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';

export const ResumeUpload = ({ onFileSelect, onBack, isLoading }) => {
  const { user, setUser } = useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [useExistingResume, setUseExistingResume] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const inputRef = useRef(null);

  // Fetch user profile to check for existing resume
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await api.getProfile();
        setUser(profile);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [setUser]);

  const hasExistingResume = user?.resumeFileName && user?.resumeS3Key;

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

  const handleUpload = async () => {
    if (useExistingResume && !selectedFile) {
      // If using existing resume, fetch and convert to File first
      try {
        const response = await fetch(user.resumeSignedUrl || user.resumeUrl);
        const blob = await response.blob();
        
        const extension = user.resumeFileName.split('.').pop().toLowerCase();
        let mimeType = 'application/pdf';
        if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
        if (extension === 'png') mimeType = 'image/png';
        if (extension === 'webp') mimeType = 'image/webp';
        
        const file = new File([blob], user.resumeFileName, { type: mimeType });
        onFileSelect(file);
      } catch (err) {
        console.error('Error using existing resume:', err);
        alert('Failed to load existing resume. Please try uploading a new one.');
        setUseExistingResume(false);
      }
    } else if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleUseExistingResume = () => {
    setUseExistingResume(true);
    setSelectedFile(null);
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setUseExistingResume(false);
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

        {/* Hidden file input - always rendered */}
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          onChange={handleChange} 
          accept=".pdf,.jpg,.jpeg,.png,.webp"
        />

        {/* Existing Resume Option */}
        {loadingProfile ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={24} />
            <span className="ml-2 text-slate-500">Checking for existing resume...</span>
          </div>
        ) : hasExistingResume && !selectedFile && !useExistingResume ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg flex-shrink-0">
                <FileText size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">Previously Uploaded Resume</p>
                <p className="text-sm text-slate-600 truncate">{user.resumeFileName}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleUseExistingResume}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
              >
                <RefreshCw size={18} />
                Use This Resume
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium border border-slate-300 transition-colors"
              >
                <UploadCloud size={18} />
                Upload New
              </button>
            </div>
          </div>
        ) : null}

        {/* Drop Zone - Show when no existing resume or user wants to upload new */}
        {(!hasExistingResume || selectedFile || useExistingResume) && !loadingProfile && (
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-white
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}
              ${selectedFile || useExistingResume ? 'border-emerald-500 bg-emerald-50' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!selectedFile && !useExistingResume ? (
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
            ) : useExistingResume ? (
              <div className="w-full flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-emerald-200">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-slate-900 truncate">{user.resumeFileName}</p>
                    <p className="text-xs text-blue-600 font-medium">Using existing resume</p>
                  </div>
                </div>
                <button onClick={handleClearSelection} className="text-slate-400 hover:text-red-500 p-2">
                  <X size={20} />
                </button>
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
                <button onClick={handleClearSelection} className="text-slate-400 hover:text-red-500 p-2">
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button 
            size="lg" 
            disabled={(!selectedFile && !useExistingResume) || isLoading}
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