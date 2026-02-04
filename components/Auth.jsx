import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { api } from '../services/api';
import { Code2, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export const Auth = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [pendingUserData, setPendingUserData] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);

  useEffect(() => {
    let isMounted = true;
    
    const checkAndRedirect = async () => {
      if (user) {
        redirectAuthenticatedUser(user);
        return;
      }
      
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          const userData = await api.getMe();
          if (isMounted) {
            if (onLoginSuccess) onLoginSuccess(userData);
            redirectAuthenticatedUser(userData);
          }
          return;
        } catch (err) {
          localStorage.removeItem('token');
        }
      }
      
      if (isMounted) {
        setCheckingAuth(false);
      }
    };

    checkAndRedirect();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (checkingAuth) return; 
    
    const initializeGoogleOneTap = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "29688754422-1cm4i8vdffevoav9pfuo624gbk9p43oq.apps.googleusercontent.com",
          callback: handleGoogleResponse
        });
        const parentDiv = document.getElementById("googleSignInDiv");
        if (parentDiv) {
          window.google.accounts.id.renderButton(
            parentDiv,
            { theme: "outline", size: "large", width: parentDiv?.offsetWidth || 350 }
          );
        }
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
  }, [checkingAuth]);

  const redirectAuthenticatedUser = (userData) => {
    if (userData.isAdmin) {
      navigate('/mockmate/admin', { replace: true });
    } else if (!userData.profileCompleted) {
      navigate('/mockmate/candidate/profile-setup', { replace: true });
    } else {
      navigate('/mockmate/candidate/dashboard', { replace: true });
    }
  };

  const navigateAfterAuth = (data, isNewRegistration = false) => {
    if (data.isAdmin) {
      navigate('/mockmate/admin');
    } else if (isNewRegistration || !data.profileCompleted) {
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-500">Checking authentication...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await api.login(email, password);
        localStorage.setItem('token', data.token);
        onLoginSuccess(data);
        navigateAfterAuth(data, false);
      } else {
        data = await api.register(name, email, password);
        setPendingUserData(data);
        setShowOtpScreen(true);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.verifyOtp(email, otp);
      localStorage.setItem('token', data.token);
      onLoginSuccess(data);
      navigateAfterAuth(data, true);
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpSending(true);
    setError('');
    try {
      await api.sendOtp(email);
      setError(''); 
      alert('OTP sent successfully!');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleBackToRegister = () => {
    setShowOtpScreen(false);
    setOtp('');
    setPendingUserData(null);
  };

  if (showOtpScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <button 
            onClick={handleBackToRegister}
            className="flex items-center text-slate-500 hover:text-slate-700 mb-6"
          >
            <ArrowLeft size={18} className="mr-1" /> Back
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-emerald-50 rounded-xl mb-4 text-emerald-600">
              <Mail size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verify Your Email</h1>
            <p className="text-slate-500 text-center mt-2">
              We've sent a 6-digit code to<br />
              <span className="font-medium text-slate-700">{email}</span>
            </p>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enter OTP</label>
              <input 
                type="text" 
                value={otp} 
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full p-3 text-center text-2xl tracking-widest border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="000000"
                maxLength={6}
                required 
              />
            </div>
            
            <Button type="submit" className="w-full" isLoading={loading} disabled={otp.length !== 6}>
              Verify & Continue
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">Didn't receive the code? </span>
            <button 
              onClick={handleResendOtp} 
              disabled={otpSending}
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              {otpSending ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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