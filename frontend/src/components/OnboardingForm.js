import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCountries } from '../utils/translationData';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Eye, EyeOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OnboardingForm = ({ onAthleteCreated }) => {
  const { t } = useTranslation();
  const countries = useCountries();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    nationality: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

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
            onAthleteCreated(backendResponse.data.athlete_id);
            navigate('/dashboard');
          }
        } catch (error) {
          console.error('Google auth error:', error);
          setErrors({ submit: 'Google authentication failed. Please try again.' });
          setIsLoading(false);
        }
      }
    };

    handleGoogleAuth();
  }, [navigate, onAthleteCreated]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('validation.nameRequired');
    }
    
    if (!formData.email.trim()) {
      newErrors.email = t('validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('validation.emailInvalid');
    }
    
    if (!formData.password) {
      newErrors.password = t('validation.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('validation.passwordTooShort');
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('validation.confirmPasswordRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('validation.passwordsDoNotMatch');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { confirmPassword, ...athleteDataWithoutConfirm } = formData;
      
      const response = await axios.post(`${API}/athlete`, athleteDataWithoutConfirm);
      const athleteId = response.data.id;
      localStorage.setItem('athleteId', athleteId);
      
      // Check if user was selecting a plan (came from pricing page)
      const selectedPlanStr = localStorage.getItem('selectedPlan');
      const referralCode = localStorage.getItem('referralCode');
      
      console.log('After signup - selectedPlan:', selectedPlanStr);
      console.log('After signup - referralCode:', referralCode);
      
      if (selectedPlanStr) {
        // User came from pricing page, redirect to Stripe checkout
        const selectedPlan = JSON.parse(selectedPlanStr);
        const plan_id = `${selectedPlan.planId}_${selectedPlan.billingCycle}`;
        
        console.log('Creating checkout for plan:', plan_id);
        console.log('With referral code:', referralCode);
        
        try {
          // Create Stripe checkout session
          const originUrl = window.location.origin;
          const checkoutBody = {
            athlete_id: athleteId,
            plan_id: plan_id,
            origin_url: originUrl
          };
          
          // Add referral code if present
          if (referralCode) {
            checkoutBody.referral_code = referralCode;
          }
          
          const checkoutResponse = await fetch(`${BACKEND_URL}/api/subscriptions/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkoutBody)
          });
          
          if (!checkoutResponse.ok) {
            const errorData = await checkoutResponse.json();
            console.error('Checkout creation failed:', errorData);
            throw new Error(`Checkout failed: ${errorData.detail || 'Unknown error'}`);
          }
          
          const checkoutData = await checkoutResponse.json();
          console.log('Checkout session created:', checkoutData);
          
          if (checkoutData.url) {
            // Clear localStorage items
            localStorage.removeItem('selectedPlan');
            localStorage.removeItem('referralCode');
            
            console.log('Redirecting to Stripe:', checkoutData.url);
            
            // Redirect to Stripe
            window.location.href = checkoutData.url;
            return; // IMPORTANT: Stop execution here
          } else {
            console.error('No checkout URL received:', checkoutData);
          }
        } catch (checkoutError) {
          console.error('Error creating checkout session:', checkoutError);
          alert(`Failed to create checkout: ${checkoutError.message}`);
          setIsLoading(false);
          return; // Don't redirect to account on error
        }
      }
      
      console.log('No selected plan, redirecting to account');
      // Default: Redirect to account settings for new registrations
      navigate('/account');
    } catch (error) {
      console.error('Error creating athlete profile:', error);
      setErrors({ submit: t('validation.submitError') });
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = `${window.location.origin}/onboarding`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
    }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            My Health Tracker
          </h1>
          <p className="text-lg text-gray-300">
            {t('auth.createYourProfile')}
          </p>
          <Link 
            to="/pricing" 
            className="inline-block mt-3 text-sm text-[#32D3FF] hover:text-[#1FC1FF] font-medium transition-colors"
          >
            View Pricing Plans →
          </Link>
        </div>

        {/* Form Card */}
        <Card 
          className="shadow-xl border-0" 
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '16px'
          }}
        >
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display font-semibold text-white">
              {t('onboarding.title')}
            </CardTitle>
            <CardDescription className="text-gray-300">
              {t('onboarding.description')}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-200">
                  {t('auth.fullName')}
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 ${errors.name ? 'border-red-400' : ''}`}
                  placeholder={t('auth.fullNamePlaceholder')}
                  data-testid="name-input"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-red-400" data-testid="name-error">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-200">
                  {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 ${errors.email ? 'border-red-400' : ''}`}
                  placeholder={t('auth.emailPlaceholder')}
                  data-testid="email-input"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-red-400" data-testid="email-error">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationality" className="text-sm font-medium text-gray-200">
                  Nationality
                </Label>
                <Select
                  value={formData.nationality}
                  onValueChange={(value) => setFormData(prev => ({...prev, nationality: value}))}
                  disabled={isLoading}
                >
                  <SelectTrigger className="bg-gray-600 border-gray-500 text-white focus:border-teal-500 focus:ring-teal-500">
                    <SelectValue placeholder="Select your nationality" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {countries.map(country => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                  {t('auth.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 pr-10 ${errors.password ? 'border-red-400' : ''}`}
                    placeholder={t('auth.passwordPlaceholder')}
                    data-testid="password-input"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors focus:outline-none"
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-400" data-testid="password-error">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-200">
                  {t('auth.confirmPassword')}
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 pr-10 ${errors.confirmPassword ? 'border-red-400' : ''}`}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    data-testid="confirm-password-input"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors focus:outline-none"
                    disabled={isLoading}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-400" data-testid="confirm-password-error">{errors.confirmPassword}</p>
                )}
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-900 border border-red-700 rounded-md">
                  <p className="text-sm text-red-200" data-testid="submit-error">{errors.submit}</p>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="create-profile-btn"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Your Profile...
                  </div>
                ) : (
                  t('onboarding.startCoaching')
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-700 text-gray-400">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In Button */}
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
                Sign up with Google
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-3">
          <p className="text-sm text-gray-400">
            {t('onboarding.insightMessage')}
          </p>
          <div className="pt-2 border-t border-gray-700">
            <p className="text-sm text-gray-300">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link 
                to="/login" 
                className="text-teal-400 hover:text-teal-300 font-medium hover:underline"
                data-testid="login-link"
              >
                {t('auth.loginHere')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
