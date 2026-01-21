import axios from 'axios';

// const API_URL = 'http://localhost:5001';
const API_URL = '';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export { axiosInstance };

export const api = {
  login: async (email, password) => {
    const { data } = await axiosInstance.post('/api/auth/login', { email, password });
    return data;
  },

  register: async (name, email, password) => {
    const { data } = await axiosInstance.post('/api/auth/register', { name, email, password });
    return data;
  },

  googleLogin: async (token) => {
    const { data } = await axiosInstance.post('/api/auth/google', { token });
    return data;
  },

  getMe: async () => {
    const { data } = await axiosInstance.get('/api/auth/me');
    return data;
  },

  // User Profile
  getProfile: async () => {
    const { data } = await axiosInstance.get('/api/user/profile');
    return data;
  },

  updateProfile: async (profileData) => {
    const { data } = await axiosInstance.put('/api/user/profile', profileData);
    return data;
  },

  completeProfileSetup: async (profileData) => {
    const { data } = await axiosInstance.post('/api/user/profile/complete', profileData);
    return data;
  },

  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    const { data } = await axiosInstance.post('/api/user/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  deleteResume: async () => {
    const { data } = await axiosInstance.delete('/api/user/resume');
    return data;
  },

  createInterview: async (interviewData) => {
    const { data } = await axiosInstance.post('/api/interviews', interviewData);
    return data;
  },

  getMyInterviews: async () => {
    const { data } = await axiosInstance.get('/api/interviews');
    return data;
  },

  getInterview: async (id) => {
    const { data } = await axiosInstance.get(`/api/interviews/${id}`);
    return data;
  },

  updateInterview: async (id, updateData) => {
    const { data } = await axiosInstance.put(`/api/interviews/${id}`, updateData);
    return data;
  },

  deleteInterview: async (id) => {
    const { data } = await axiosInstance.delete(`/api/interviews/${id}`);
    return data;
  },

  uploadAudioRecording: async (interviewId, audioBlob, questionIndex, durationSeconds) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, `recording_q${questionIndex}.webm`);
    formData.append('interviewId', interviewId);
    formData.append('questionIndex', questionIndex);
    formData.append('durationSeconds', durationSeconds || 0);

    const { data } = await axiosInstance.post('/api/audio/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  getAudioPlaybackUrl: async (interviewId, recordingId) => {
    const { data } = await axiosInstance.get(`/api/audio/${interviewId}/${recordingId}`);
    return data;
  },

  getAdminStats: async () => {
    const { data } = await axiosInstance.get('/api/admin/stats');
    return data;
  },

  getAllUsers: async () => {
    const { data } = await axiosInstance.get('/api/admin/users');
    return data;
  },

  getAllInterviews: async (page = 1, limit = 20, status = 'all', search = '') => {
    const { data } = await axiosInstance.get('/api/admin/interviews', {
      params: { page, limit, status, search }
    });
    return data;
  },

  getInterviewDetails: async (interviewId) => {
    const { data } = await axiosInstance.get(`/api/admin/interviews/${interviewId}`);
    return data;
  },

  getInterviewAudioRecordings: async (interviewId) => {
    const { data } = await axiosInstance.get(`/api/audio/interview/${interviewId}`);
    return data;
  },

  chatStream: async (history, message, config, onChunk) => {
    const token = localStorage.getItem('token');
    const payload = { history, message, ...config };

    const res = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.body) throw new Error('Chat API Error');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      onChunk(text);
    }
  },

  generateFeedback: async (prompt, language) => {
    const { data } = await axiosInstance.post('/api/ai/feedback', { prompt, language });
    return data;
  },

  generateSpeech: async (text) => {
    const { data } = await axiosInstance.post('/api/ai/tts', { text });
    return data;
  }
};