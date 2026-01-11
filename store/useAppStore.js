import { create } from 'zustand';
import { AppState } from '../types';

export const useAppStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  appState: AppState.LANDING,
  setAppState: (appState) => set({ appState }),
  
  language: 'English',
  setLanguage: (language) => set({ language }),
  
  activeInterviewId: null,
  setActiveInterviewId: (activeInterviewId) => set({ activeInterviewId }),
  
  interviewConfig: null,
  setInterviewConfig: (interviewConfig) => set({ interviewConfig }),
  
  resetSession: () => set({ 
    activeInterviewId: null, 
    interviewConfig: null,
    // Keep language and user
  })
}));