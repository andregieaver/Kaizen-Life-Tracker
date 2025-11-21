import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

const OnboardingModal = ({ athleteId, onComplete, onDismiss }) => {
  const { t } = useTranslation();
  const { width, height } = useWindowSize();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    date_of_birth: '',
    gender: '',
    height: '',
    weight: '',
    body_fat_percentage: '',
    vo2_max: '',
    max_heart_rate: ''
  });
  
  // Preferences State
  const [preferences, setPreferences] = useState({
    language: 'en',
    measurement_system: 'imperial',
    timezone: 'UTC'
  });
  
  // Integration State
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  
  // Community Post State
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  
  const totalSteps = 4;

  // Load athlete data on mount
  useEffect(() => {
    loadAthleteData();
  }, [athleteId]);

  const loadAthleteData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/athlete/${athleteId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Pre-fill personal info if exists
        setPersonalInfo({
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || '',
          height: data.height || '',
          weight: data.weight || '',
          body_fat_percentage: data.body_fat_percentage || '',
          vo2_max: data.vo2_max || '',
          max_heart_rate: data.max_heart_rate || ''
        });
        
        // Pre-fill preferences
        setPreferences({
          language: data.language || 'en',
          measurement_system: data.measurement_system || 'imperial',
          timezone: data.timezone || 'UTC'
        });
      }
    } catch (error) {
      console.error('Error loading athlete data:', error);
    }
  };

  const handlePersonalInfoSave = async () => {
    try {
      // Validate required fields
      if (!personalInfo.date_of_birth || !personalInfo.gender || !personalInfo.height || !personalInfo.weight) {
        alert('Please fill in all required fields (Birth Date, Gender, Height, Weight)');
        return false;
      }
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/athlete/${athleteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personalInfo)
      });
      
      if (response.ok) {
        // Mark step as complete
        await markStepComplete('personal_info');
        return true;
      } else {
        const errorData = await response.json();
        console.error('Error saving personal info:', errorData);
        alert('Failed to save personal information. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Error saving personal info:', error);
      alert('An error occurred while saving. Please try again.');
      return false;
    }
  };

  const handlePreferencesSave = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/athlete/${athleteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      
      if (response.ok) {
        await markStepComplete('preferences');
        return true;
      } else {
        const errorData = await response.json();
        console.error('Error saving preferences:', errorData);
        alert('Failed to save preferences. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('An error occurred while saving. Please try again.');
      return false;
    }
  };

  const handleIntegrationConnect = async (integration) => {
    try {
      // Get auth URL from backend
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/${integration}?user_id=${athleteId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.authorization_url || data.authUrl) {
          // Store redirect info in localStorage for when we return
          localStorage.setItem('integration_redirect', window.location.href);
          localStorage.setItem('connecting_provider', integration);
          
          // Redirect to provider's OAuth page
          window.location.href = data.authorization_url || data.authUrl;
        }
      } else {
        console.error('Error getting auth URL:', await response.text());
        alert(`Failed to connect to ${integration}. Please ensure credentials are configured in System Settings.`);
      }
    } catch (error) {
      console.error('Error connecting to integration:', error);
      alert(`An error occurred while connecting to ${integration}. Please try again.`);
    }
  };

  const checkIntegrationStatus = async () => {
    try {
      // Check if any integration is connected
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/onboarding/check-auto-complete/${athleteId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const status = await response.json();
        return status.integration_completed;
      }
      return false;
    } catch (error) {
      console.error('Error checking integration status:', error);
      return false;
    }
  };

  const handleCommunityPost = async () => {
    try {
      const formData = new FormData();
      formData.append('author_id', athleteId);
      formData.append('content', postContent);
      if (postImage) {
        formData.append('images', postImage);
      }
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/community/posts`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await markStepComplete('community_post');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating post:', error);
      return false;
    }
  };

  const markStepComplete = async (step) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/onboarding/step/${athleteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, completed: true })
      });
    } catch (error) {
      console.error('Error marking step complete:', error);
    }
  };

  const handleNext = async () => {
    let canProceed = true;
    
    // Save current step data
    if (currentStep === 1) {
      canProceed = await handlePersonalInfoSave();
    } else if (currentStep === 2) {
      canProceed = await handlePreferencesSave();
    } else if (currentStep === 3) {
      const isConnected = await checkIntegrationStatus();
      if (isConnected) {
        await markStepComplete('integration');
        canProceed = true;
      } else {
        alert(t('onboarding.pleaseConnectIntegration'));
        canProceed = false;
      }
    } else if (currentStep === 4) {
      if (postContent.trim()) {
        canProceed = await handleCommunityPost();
      } else {
        alert(t('onboarding.pleaseEnterPost'));
        canProceed = false;
      }
    }
    
    if (canProceed) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        // All steps complete - show celebration!
        triggerCelebration();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipStep = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Last step - just complete without post
      triggerCelebration();
    }
  };

  const handleSkipForNow = async () => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/onboarding/dismiss/${athleteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permanent: false })
      });
      onDismiss();
    } catch (error) {
      console.error('Error dismissing onboarding:', error);
    }
  };

  const handleNeverShowAgain = async () => {
    const confirmed = window.confirm(t('onboarding.confirmNeverShow'));
    if (confirmed) {
      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/onboarding/dismiss/${athleteId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permanent: true })
        });
        onDismiss();
      } catch (error) {
        console.error('Error permanently dismissing onboarding:', error);
      }
    }
  };

  const triggerCelebration = () => {
    setShowConfetti(true);
    setShowCelebration(true);
    
    // Stop confetti after 2.5 seconds
    setTimeout(() => {
      setShowConfetti(false);
    }, 2500);
  };

  const handleCelebrationComplete = () => {
    onComplete();
  };

  // Progress percentage
  const progressPercentage = (currentStep / totalSteps) * 100;

  if (showCelebration) {
    return (
      <>
        {showConfetti && (
          <Confetti
            width={width}
            height={height}
            numberOfPieces={200}
            recycle={false}
            gravity={0.3}
          />
        )}
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 md:p-12 max-w-2xl w-full text-center shadow-2xl border border-gray-700 animate-fadeIn">
            <div className="mb-6 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center animate-bounce">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t('onboarding.celebration.title')}
            </h1>
            
            <p className="text-xl text-gray-300 mb-8">
              {t('onboarding.celebration.message')}
            </p>
            
            <button
              onClick={handleCelebrationComplete}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold text-lg hover:from-cyan-600 hover:to-blue-600 transition-all transform hover:scale-105 shadow-lg"
            >
              {t('onboarding.celebration.cta')}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 pb-24 md:p-4 md:pb-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-xl md:rounded-2xl shadow-2xl w-full max-w-3xl my-2 md:my-8 border border-gray-700">
        {/* Header */}
        <div className="p-3 md:p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <h2 className="text-lg md:text-2xl font-bold text-white">{t('onboarding.title')}</h2>
            <button
              onClick={handleSkipForNow}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-1 md:mb-2">
            <div className="flex justify-between text-xs md:text-sm text-gray-400 mb-1 md:mb-2">
              <span>{t('onboarding.step', { current: currentStep, total: totalSteps })}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full h-1.5 md:h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-3 pb-4 md:p-6 md:pb-8 min-h-[300px] md:min-h-[400px] max-h-[60vh] overflow-y-auto">
          {currentStep === 1 && <StepPersonalInfo data={personalInfo} onChange={setPersonalInfo} />}
          {currentStep === 2 && <StepPreferences data={preferences} onChange={setPreferences} />}
          {currentStep === 3 && <StepIntegration athleteId={athleteId} onConnect={handleIntegrationConnect} />}
          {currentStep === 4 && <StepCommunityPost content={postContent} onContentChange={setPostContent} image={postImage} onImageChange={setPostImage} />}
        </div>

        {/* Footer */}
        <div className="p-3 md:p-6 border-t border-gray-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-0">
          <div className="flex gap-2 md:gap-3 text-xs md:text-base">
            <button
              onClick={handleSkipStep}
              className="px-2 py-1.5 md:px-4 md:py-2 text-gray-400 hover:text-white transition-colors"
            >
              {t('onboarding.skipStep')}
            </button>
            <button
              onClick={handleNeverShowAgain}
              className="px-2 py-1.5 md:px-4 md:py-2 text-red-400 hover:text-red-300 transition-colors text-xs md:text-sm"
            >
              {t('onboarding.neverShow')}
            </button>
          </div>
          
          <div className="flex gap-2 md:gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 bg-gray-800 text-white rounded-lg md:rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:inline">{t('onboarding.back')}</span>
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg md:rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base"
            >
              <span>{currentStep === totalSteps ? t('onboarding.finish') : t('onboarding.next')}</span>
              {currentStep < totalSteps && <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Step 1: Personal Information
const StepPersonalInfo = ({ data, onChange }) => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-xl font-semibold text-white mb-2 md:mb-4">{t('onboarding.steps.personalInfo.title')}</h3>
      <p className="text-sm md:text-base text-gray-400 mb-3 md:mb-6">{t('onboarding.steps.personalInfo.description')}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.birthdate')} *
          </label>
          <input
            type="date"
            value={data.date_of_birth}
            onChange={(e) => onChange({ ...data, date_of_birth: e.target.value })}
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.gender')} *
          </label>
          <select
            value={data.gender}
            onChange={(e) => onChange({ ...data, gender: e.target.value })}
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          >
            <option value="">Select gender...</option>
            <option value="male">{t('account.male')}</option>
            <option value="female">{t('account.female')}</option>
            <option value="other">{t('account.other')}</option>
            <option value="prefer_not_to_say">{t('account.preferNotToSay')}</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.height')} * (cm)
          </label>
          <input
            type="number"
            step="0.1"
            value={data.height}
            onChange={(e) => onChange({ ...data, height: e.target.value })}
            placeholder="175"
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.weight')} * (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={data.weight}
            onChange={(e) => onChange({ ...data, weight: e.target.value })}
            placeholder="70"
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.bodyFatPercentage')}
          </label>
          <input
            type="number"
            step="0.1"
            value={data.body_fat_percentage}
            onChange={(e) => onChange({ ...data, body_fat_percentage: e.target.value })}
            placeholder="18.5"
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.vo2Max')}
          </label>
          <input
            type="number"
            step="0.1"
            value={data.vo2_max}
            onChange={(e) => onChange({ ...data, vo2_max: e.target.value })}
            placeholder="50"
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.maxHeartRate')}
          </label>
          <input
            type="number"
            value={data.max_heart_rate}
            onChange={(e) => onChange({ ...data, max_heart_rate: e.target.value })}
            placeholder="190"
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
      </div>
      
      <p className="text-sm text-gray-500 mt-4">* {t('onboarding.requiredFields')}</p>
    </div>
  );
};

// Step 2: Preferences
const StepPreferences = ({ data, onChange }) => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-xl font-semibold text-white mb-2 md:mb-4">{t('onboarding.steps.preferences.title')}</h3>
      <p className="text-sm md:text-base text-gray-400 mb-3 md:mb-6">{t('onboarding.steps.preferences.description')}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.language')}
          </label>
          <select
            value={data.language}
            onChange={(e) => onChange({ ...data, language: e.target.value })}
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          >
            <option value="en">English</option>
            <option value="sv">Svenska</option>
            <option value="no">Norsk</option>
            <option value="da">Dansk</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.measurementSystem')}
          </label>
          <select
            value={data.measurement_system}
            onChange={(e) => onChange({ ...data, measurement_system: e.target.value })}
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          >
            <option value="metric">{t('account.metric')}</option>
            <option value="imperial">{t('account.imperial')}</option>
          </select>
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1 md:mb-2">
            {t('account.timezone')}
          </label>
          <select
            value={data.timezone}
            onChange={(e) => onChange({ ...data, timezone: e.target.value })}
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-gray-800 text-white text-sm md:text-base rounded-lg md:rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New York (EST)</option>
            <option value="America/Chicago">America/Chicago (CST)</option>
            <option value="America/Denver">America/Denver (MST)</option>
            <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="Europe/Stockholm">Europe/Stockholm (CET)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// Step 3: Integration
const StepIntegration = ({ athleteId, onConnect }) => {
  const { t } = useTranslation();
  
  const integrations = [
    { id: 'strava', name: 'Strava', icon: '🏃' },
    { id: 'oura', name: 'Oura Ring', icon: '💍' },
    { id: 'garmin', name: 'Garmin', icon: '⌚' },
    { id: 'polar', name: 'Polar Flow', icon: '🐻' },
  ];
  
  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-xl font-semibold text-white mb-2 md:mb-4">{t('onboarding.steps.integration.title')}</h3>
      <p className="text-sm md:text-base text-gray-400 mb-3 md:mb-6">{t('onboarding.steps.integration.description')}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {integrations.map((integration) => (
          <button
            key={integration.id}
            onClick={() => onConnect(integration.id)}
            className="p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-cyan-500 hover:bg-gray-750 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">{integration.icon}</div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  {integration.name}
                </h4>
                <p className="text-sm text-gray-400">{t('onboarding.clickToConnect')}</p>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-cyan-400 transition-colors" />
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-900 bg-opacity-20 border border-blue-500 rounded-xl">
        <p className="text-sm text-blue-300">
          💡 {t('onboarding.steps.integration.hint')}
        </p>
      </div>
    </div>
  );
};

// Step 4: Community Post
const StepCommunityPost = ({ content, onContentChange, image, onImageChange }) => {
  const { t } = useTranslation();
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImageChange(file);
    }
  };
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white mb-4">{t('onboarding.steps.communityPost.title')}</h3>
      <p className="text-gray-400 mb-6">{t('onboarding.steps.communityPost.description')}</p>
      
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('onboarding.steps.communityPost.postContent')}
        </label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={t('onboarding.steps.communityPost.placeholder')}
          rows={6}
          className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('onboarding.steps.communityPost.addImage')} ({t('onboarding.optional')})
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:text-white file:cursor-pointer hover:file:bg-cyan-600"
        />
        {image && (
          <p className="text-sm text-green-400 mt-2">
            <Check className="w-4 h-4 inline mr-1" />
            {image.name}
          </p>
        )}
      </div>
      
      <div className="mt-6 p-4 bg-purple-900 bg-opacity-20 border border-purple-500 rounded-xl">
        <p className="text-sm text-purple-300">
          💬 {t('onboarding.steps.communityPost.hint')}
        </p>
      </div>
    </div>
  );
};

export default OnboardingModal;
