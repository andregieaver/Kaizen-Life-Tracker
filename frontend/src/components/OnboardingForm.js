import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Eye, EyeOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OnboardingForm = ({ onAthleteCreated }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    
    if (!formData.age || formData.age < 16 || formData.age > 80) {
      newErrors.age = t('onboarding.ageValidation');
    }
    
    if (!formData.weekly_mileage || formData.weekly_mileage < 5 || formData.weekly_mileage > 200) {
      newErrors.weekly_mileage = t('onboarding.mileageValidation');
    }
    
    if (!formData.running_goals.trim()) {
      newErrors.running_goals = t('onboarding.runningGoalsValidation');
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
      const athleteData = {
        ...athleteDataWithoutConfirm,
        age: parseInt(formData.age),
        weekly_mileage: parseFloat(formData.weekly_mileage)
      };
      
      const response = await axios.post(`${API}/athlete`, athleteData);
      onAthleteCreated(response.data.id);
    } catch (error) {
      console.error('Error creating athlete profile:', error);
      setErrors({ submit: t('validation.submitError') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center p-4">
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
            className="inline-block mt-3 text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
          >
            View Pricing Plans →
          </Link>
        </div>

        {/* Form Card */}
        <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600 shadow-xl">
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
                />
                {errors.email && (
                  <p className="text-sm text-red-400" data-testid="email-error">{errors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                    {t('auth.password')}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 ${errors.password ? 'border-red-400' : ''}`}
                    placeholder={t('auth.passwordPlaceholder')}
                    data-testid="password-input"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-400" data-testid="password-error">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-200">
                    {t('auth.confirmPassword')}
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 ${errors.confirmPassword ? 'border-red-400' : ''}`}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    data-testid="confirm-password-input"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-400" data-testid="confirm-password-error">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-sm font-medium text-gray-200">
                    {t('onboarding.age')}
                  </Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    value={formData.age}
                    onChange={handleChange}
                    className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 ${errors.age ? 'border-red-400' : ''}`}
                    placeholder="25"
                    min="16"
                    max="80"
                    data-testid="age-input"
                  />
                  {errors.age && (
                    <p className="text-sm text-red-400" data-testid="age-error">{errors.age}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly_mileage" className="text-sm font-medium text-gray-200">
                    {t('onboarding.weeklyMileage')}
                  </Label>
                  <Input
                    id="weekly_mileage"
                    name="weekly_mileage"
                    type="number"
                    step="0.5"
                    value={formData.weekly_mileage}
                    onChange={handleChange}
                    className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 ${errors.weekly_mileage ? 'border-red-400' : ''}`}
                    placeholder="30"
                    min="5"
                    max="200"
                    data-testid="mileage-input"
                  />
                  {errors.weekly_mileage && (
                    <p className="text-sm text-red-400" data-testid="mileage-error">{errors.weekly_mileage}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recent_race_time" className="text-sm font-medium text-gray-200">
                  {t('onboarding.recentRaceTime')} <span className="text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="recent_race_time"
                  name="recent_race_time"
                  value={formData.recent_race_time}
                  onChange={handleChange}
                  className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500"
                  placeholder={t('onboarding.raceTimeOptional')}
                  data-testid="race-time-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="running_goals" className="text-sm font-medium text-gray-200">
                  {t('onboarding.runningGoals')}
                </Label>
                <Textarea
                  id="running_goals"
                  name="running_goals"
                  value={formData.running_goals}
                  onChange={handleChange}
                  className={`bg-gray-600 border-gray-500 text-white placeholder:text-gray-400 focus:border-teal-500 focus:ring-teal-500 min-h-20 resize-none ${errors.running_goals ? 'border-red-400' : ''}`}
                  placeholder={t('onboarding.runningGoalsPlaceholder')}
                  data-testid="goals-textarea"
                />
                {errors.running_goals && (
                  <p className="text-sm text-red-400" data-testid="goals-error">{errors.running_goals}</p>
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
