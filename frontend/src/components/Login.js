import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, LogIn, Eye, EyeOff } from 'lucide-react';
import { track, setUserId, forms } from '../lib/analytics';
import LoggedOutHeader from './LoggedOutHeader';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = ({ onAthleteLogin }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteTitle, setSiteTitle] = useState('TrainSmart');
  const navigate = useNavigate();
  
  // Fetch site title from system settings
  useEffect(() => {
    const fetchSiteTitle = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/system/settings/public`);
        if (response.data?.seo?.siteTitle) {
          setSiteTitle(response.data.seo.siteTitle);
        }
      } catch (error) {
        logger.error(null, 'Error fetching site title:', error);
      }
    };
    fetchSiteTitle();
  }, []);

  // Check for Google OAuth session_id in URL fragment
  useEffect(() => {
    const handleGoogleAuth = async () => {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        setIsLoading(true);
        const sessionId = hash.split('session_id=')[1].split('&')[0];
        
        try {
          // Get session data from Emergent auth
          const response = await axios.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            { headers: { 'X-Session-ID': sessionId } }
          );

          const { id, email, name, picture, session_token } = response.data;

          // Send to backend to create/check user and store session
          const backendResponse = await axios.post(`${API}/auth/google-login`, {
            google_id: id,
            email,
            name,
            picture,
            session_token
          });

          // Clear URL fragment
          window.history.replaceState(null, '', window.location.pathname);

          // Track successful Google login
          track('login', { method: 'google' });
          setUserId(backendResponse.data.athlete_id);

          // Redirect based on if user is new or existing
          if (backendResponse.data.is_new_user) {
            track('signup', { method: 'google' });
            localStorage.setItem('athleteId', backendResponse.data.athlete_id);
            navigate('/account');
          } else {
            localStorage.setItem('athleteId', backendResponse.data.athlete_id);
            onAthleteLogin(backendResponse.data.athlete_id);
            navigate('/dashboard');
          }
        } catch (error) {
          logger.error(null, 'Google auth error:', error);
          track('login_error', { 
            method: 'google',
            error_message: 'Google authentication failed'
          });
          setError('Google authentication failed. Please try again.');
          setIsLoading(false);
        }
      }
    };

    handleGoogleAuth();
  }, [navigate, onAthleteLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Track form start
    forms.start('login', 'login-form');
    
    if (!email.trim()) {
      setError('Please enter your email address');
      forms.error('login', 'login-form', 'Missing email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      forms.error('login', 'login-form', 'Missing password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, { 
        email: email.trim(),
        password: password
      });
      
      if (response.data.athlete_id) {
        // Track successful login
        track('login', { method: 'email' });
        setUserId(response.data.athlete_id);
        forms.submit('login', 'login-form');
        
        // Store athlete ID and notify parent
        localStorage.setItem('athleteId', response.data.athlete_id);
        onAthleteLogin(response.data.athlete_id);
        navigate('/dashboard');
      }
    } catch (error) {
      logger.error(null, 'Login error:', error);
      
      const errorMessage = error.response?.status === 401 
        ? 'Invalid credentials' 
        : error.response?.data?.detail || 'Login failed';
      
      // Track login error
      track('login_error', { 
        method: 'email',
        error_message: errorMessage
      });
      forms.error('login', 'login-form', errorMessage);
      
      if (error.response?.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(error.response?.data?.detail || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Track Google login attempt
    track('login_attempt', { method: 'google' });
    
    const redirectUrl = `${window.location.origin}/login`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <>
      <LoggedOutHeader />
      
      <div className="min-h-screen flex items-center justify-center p-4 pt-20" style={{ 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
      }}>
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-display font-bold text-white mb-2">
              {siteTitle}
            </h1>
            <p className="text-gray-300">{t('auth.welcomeBack')}</p>
            {/* View Pricing Plans Link - HIDDEN BUT NOT DELETED */}
            <Link 
            to="/pricing" 
            className="hidden inline-block mt-3 text-sm font-medium transition-colors text-[#32D3FF] hover:text-[#1FC1FF]"
          >
            View Pricing Plans →
          </Link>
        </div>

        {/* Login Form */}
        <Card 
          className="border-0 shadow-xl" 
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '16px'
          }}
        >
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center text-white">
              <LogIn className="w-6 h-6 mr-2 text-[#32D3FF]" />
              {t('auth.login')}
            </CardTitle>
            <CardDescription className="text-gray-300">
              {t('auth.enterEmailPassword')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="input-focus text-white placeholder-gray-400"
                  style={{
                    background: 'rgba(17, 24, 39, 0.5)',
                    border: '1px solid rgba(71, 85, 105, 0.3)'
                  }}
                  disabled={isLoading}
                  autoFocus
                  data-testid="login-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="input-focus pr-10 text-white placeholder-gray-400"
                    style={{
                      background: 'rgba(17, 24, 39, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)'
                    }}
                    disabled={isLoading}
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#32D3FF] transition-colors focus:outline-none focus:ring-2 focus:ring-[#32D3FF] focus:ring-offset-1 rounded"
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full text-white font-medium py-3 btn-transition border-0 bg-[#32D3FF] hover:bg-[#1FC1FF]"
                disabled={isLoading}
                data-testid="login-submit-btn"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    {t('auth.loginButton')}
                  </>
                )}
              </Button>

              {/* Divider - HIDDEN BUT NOT DELETED */}
              <div className="hidden relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-700 text-gray-400">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In Button - HIDDEN BUT NOT DELETED */}
              <div className="hidden">
                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </Button>
              </div>
            </form>

            {/* Forgot Password Link */}
            <div className="mt-6 text-center space-y-3">
              <div>
                <Link 
                  to="/forgot-password"
                  className="text-sm font-medium transition-colors text-[#32D3FF] hover:text-[#1FC1FF] hover:underline"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('auth.yourDataSecure')}
        </p>
      </div>
    </div>
    </>
  );
};

export default Login;
