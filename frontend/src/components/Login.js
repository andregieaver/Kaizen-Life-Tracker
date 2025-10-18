import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, LogIn, Eye, EyeOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = ({ onAthleteLogin }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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

          // Redirect based on if user is new or existing
          if (backendResponse.data.is_new_user) {
            localStorage.setItem('athleteId', backendResponse.data.athlete_id);
            navigate('/account');
          } else {
            localStorage.setItem('athleteId', backendResponse.data.athlete_id);
            onAthleteLogin(backendResponse.data.athlete_id);
            navigate('/dashboard');
          }
        } catch (error) {
          console.error('Google auth error:', error);
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
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, { 
        email: email.trim(),
        password: password
      });
      
      if (response.data.athlete_id) {
        // Store athlete ID and notify parent
        localStorage.setItem('athleteId', response.data.athlete_id);
        onAthleteLogin(response.data.athlete_id);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
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
    const redirectUrl = `${window.location.origin}/login`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Home Link */}
        <Link 
          to="/" 
          className="inline-flex items-center text-sm text-gray-300 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('auth.backToHome')}
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            My Health Tracker
          </h1>
          <p className="text-gray-300">{t('auth.welcomeBack')}</p>
          <Link 
            to="/pricing" 
            className="inline-block mt-3 text-sm font-medium transition-colors"
            style={{ color: '#00C2A8' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#009688'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00C2A8'}
          >
            View Pricing Plans →
          </Link>
        </div>

        {/* Login Form */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-600 to-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center text-white">
              <LogIn className="w-6 h-6 mr-2" style={{ color: '#00C2A8' }} />
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
                  className="input-focus bg-gray-700 border-gray-600 text-white placeholder-gray-400"
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
                    className="input-focus pr-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    disabled={isLoading}
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 rounded"
                    style={{ '--tw-ring-color': '#00C2A8' }}
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
                className="w-full text-white font-medium py-3 btn-transition border-0"
                style={{ backgroundColor: '#00C2A8' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
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
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center space-y-3">
              <div>
                <Link 
                  to="/forgot-password"
                  className="text-sm font-medium hover:underline"
                  style={{ color: '#00C2A8' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#009688'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#00C2A8'}
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <p className="text-sm text-gray-300">
                {t('auth.dontHaveAccount')}{' '}
                <Link 
                  to="/" 
                  className="font-medium hover:underline"
                  style={{ color: '#00C2A8' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#009688'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#00C2A8'}
                >
                  {t('auth.signupHere')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('auth.yourDataSecure')}
        </p>
      </div>
    </div>
  );
};

export default Login;
