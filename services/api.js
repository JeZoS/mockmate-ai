// Wrapper for Backend API calls
// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const api = {
  // Auth
  login: async (email, password) => {
    const res = await fetch(`/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  register: async (name, email, password) => {
    const res = await fetch(`/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) throw new Error('Registration failed');
    return res.json();
  },

  // Interviews
  createInterview: async (data) => {
    const res = await fetch(`/api/interviews`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  getMyInterviews: async () => {
    const res = await fetch(`/api/interviews`, {
      method: 'GET',
      headers: { ...getAuthHeader() }
    });
    return res.json();
  },

  getInterview: async (id) => {
    const res = await fetch(`/api/interviews/${id}`, {
      method: 'GET',
      headers: { ...getAuthHeader() }
    });
    return res.json();
  },

  updateInterview: async (id, data) => {
    const res = await fetch(`/api/interviews/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteInterview: async (id) => {
    const res = await fetch(`/api/interviews/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return res.json();
  },

  // Admin
  getAdminStats: async () => {
    const res = await fetch(`/api/admin/stats`, {
      method: 'GET',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Not authorized');
    return res.json();
  },

  getAllUsers: async () => {
    const res = await fetch(`/api/admin/users`, {
      method: 'GET',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Not authorized');
    return res.json();
  },

  // AI Proxy
  chatStream: async (history, message, config, onChunk) => {
    const payload = { history, message, ...config };
    
    const res = await fetch(`/api/ai/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
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
    const res = await fetch(`/api/ai/feedback`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
         ...getAuthHeader()
      },
      body: JSON.stringify({ prompt, language })
    });
    return res.json();
  },

  generateSpeech: async (text) => {
    const res = await fetch(`/api/ai/tts`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ text })
    });
    return res.json();
  }
};