import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { api } from '../services/api';
import { Code2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Auth = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const navigateAfterAuth = (data, isNewRegistration = false) => {
    if (data.isAdmin) {
      navigate('/mockmate/admin');
    } else if (isNewRegistration || !data.profileCompleted) {
      // New users or users who haven't completed profile go to profile setup
      navigate('/mockmate/candidate/profile-setup');
    } else {
      navigate('/mockmate/candidate/dashboard');
    }
  };

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    try {
      const data = await api.googleLogin(response.credential);
      localStorage.setItem('token', data.token);
      onLoginSuccess(data);
      navigateAfterAuth(data, data.isNewUser);
    } catch (err) {
      console.error(err);
      setError('Google Login failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeGoogleOneTap = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "29688754422-1cm4i8vdffevoav9pfuo624gbk9p43oq.apps.googleusercontent.com",
          callback: handleGoogleResponse
        });
        const parentDiv = document.getElementById("googleSignInDiv");
        window.google.accounts.id.renderButton(
          parentDiv,
          { theme: "outline", size: "large", width: parentDiv?.offsetWidth || 350 }
        );
      }
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleOneTap;
      document.body.appendChild(script);
    } else {
      initializeGoogleOneTap();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      let isNewRegistration = false;
      if (isLogin) {
        data = await api.login(email, password);
      } else {
        data = await api.register(name, email, password);
        isNewRegistration = true;
      }
      localStorage.setItem('token', data.token);
      onLoginSuccess(data);
      navigateAfterAuth(data, isNewRegistration);
    } catch (err) {
      setError('Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
           <div className="p-3 bg-blue-50 rounded-xl mb-4 text-blue-600">
               <Code2 size={32} />
           </div>
           <h1 className="text-2xl font-bold text-slate-900">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
           <p className="text-slate-500">Log in to MockMate AI Portal</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  required 
                />
             </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              required 
            />
          </div>
          
          <Button type="submit" className="w-full" isLoading={loading}>
             {isLogin ? 'Login' : 'Sign Up'}
          </Button>
        </form>

        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200"></span>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or continue with</span>
            </div>
        </div>
        
        <div id="googleSignInDiv" className="w-full flex justify-center mb-6"></div>

        <div className="mt-6 text-center text-sm">
           <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:underline">
             {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
           </button>
        </div>
      </div>
    </div>
  );
};