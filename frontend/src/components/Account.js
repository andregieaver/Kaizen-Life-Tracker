import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import LanguageSelector from './LanguageSelector';
import ChangePassword from './ChangePassword';
import ChangeEmail from './ChangeEmail';
import { useCountries } from '../utils/translationData';
import { 
  registerServiceWorker,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed
} from '../utils/pushNotifications';
import { 
  User, 
  Key, 
  Zap, 
  Heart, 
  Activity, 
  Shield, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  ExternalLink,
  Trash2,
  Calendar,
  Clock,
  Plus,
  Edit3,
  Repeat,
  LogOut,
  CreditCard,
  Crown,
  TrendingUp,
  Check,
  Mountain,
  Settings,
  X,
  Bell,
  BellOff,
  Utensils,
  Users,
  ShoppingCart,
  FileText,
  Menu,
  HelpCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Simple Integration Card Component
const IntegrationCard = ({ 
  provider, 
  name, 
  description, 
  icon, 
  connected, 
  connectionInfo, 
  onConnect, 
  onDisconnect,
  comingSoon = false,
  t
}) => {
  const formatLastSync = (lastSync) => {
    if (!lastSync) return t('account.never');
    const syncDate = new Date(lastSync);
    const now = new Date();
    const diffMs = now - syncDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return syncDate.toLocaleDateString();
  };

  return (
    <div className="flex items-center justify-between p-4 border-0 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg hover:shadow-lg transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div>
          <h4 className="font-semibold text-white">{name}</h4>
          <p className="text-sm text-gray-300">{description}</p>
          {connected && connectionInfo && (
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
              {connectionInfo.athlete_name && (
                <span>{t('account.connectedAs')}: {connectionInfo.athlete_name}</span>
              )}
              {connectionInfo.user_id && (
                <span>{t('account.userId')}: {connectionInfo.user_id.slice(0, 8)}...</span>
              )}
              <span>{t('account.lastSync')}: {formatLastSync(connectionInfo.last_sync)}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <Badge className="bg-blue-900/30 text-blue-400 border-blue-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('account.connected')}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              {t('common.disconnect')}
            </Button>
          </>
        ) : comingSoon ? (
          <Badge variant="secondary" className="bg-gray-800 text-gray-400">
            {t('account.comingSoon')}
          </Badge>
        ) : (
          <Button
            onClick={onConnect}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('common.connect')} {name}
          </Button>
        )}
      </div>
    </div>
  );
};

const Account = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const countries = useCountries(); // Get translated country list
  const [athlete, setAthlete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [integrations, setIntegrations] = useState({
    strava: { connected: false, athlete_name: '', last_sync: null },
    oura: { connected: false, user_id: '', last_sync: null },
    coros: { connected: false, last_sync: null }
  });
  
  const [personalForm, setPersonalForm] = useState({
    name: '',
    age: '',
    profile_picture: '',
    birth_day: '',
    birth_month: '',
    birth_year: '',
    running_goals: '',
    nationality: '',
    // Personal Information fields
    height: '',
    weight: '',
    vo2_max: '',
    max_heart_rate: '',
    gender: '',
    bio: '',
    interests: [],
    // Community Profile Privacy Settings
    share_bio: false,
    share_goals: false,
    share_interests: false,
    estimated_calorie_need: '',
    weight_goal: '',
    health_goals: [],
    allergies: [],
    dietary_preferences: [],
    // Preferences
    distance_unit: 'miles',
    measurement_system: 'imperial',
    week_starts_on: 'monday',
    timezone: 'UTC',
    time_format: '12h',
    date_format: 'MM/DD/YYYY',
    weight_unit: 'lbs',
    fluid_unit: 'fl oz',
    language: 'en',
    coach_language: 'en', // AI Coach preferred language
    voice_preference: 'alloy',
    coach_name: 'Coach', // AI Coach custom name
    coach_avatar: null, // AI Coach custom avatar URL
    background_image: null // Custom background image URL
  });

  // Plan settings from system settings
  const [planSettings, setPlanSettings] = useState({
    free: {
      title: 'Free',
      description: 'Basic features',
      features: []
    },
    pro: {
      title: 'Pro',
      description: 'Advanced features',
      features: []
    },
    premium: {
      title: 'Premium',
      description: 'Complete experience',
      features: []
    }
  });
  
  const [activeTab, setActiveTab] = useState('personal');
  const [previousAccountTab, setPreviousAccountTab] = useState('personal');
  const location = window.location;

  // Tab handling moved to main useEffect below

  // Update URL when tab changes
  const handleTabChange = (value) => {
    setActiveTab(value);
    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set('tab', value);
    window.history.pushState({}, '', url);
  };
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    tier: 'free',
    status: 'active',
    current_period_end: null
  });
  const [availablePlans, setAvailablePlans] = useState([]);
  const [currentPlanDetails, setCurrentPlanDetails] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState(null);
  const [showBillingCycleDialog, setShowBillingCycleDialog] = useState(false);
  const [currentBillingCycle, setCurrentBillingCycle] = useState('monthly');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('monthly');
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState('');
  const [coachAvatarFile, setCoachAvatarFile] = useState(null);
  const [coachAvatarPreview, setCoachAvatarPreview] = useState('');
  const [backgroundImageFile, setBackgroundImageFile] = useState(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState('');
  
  // Push notifications state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (athleteId) {
      loadAccountData();
    }
    
    loadSubscriptionStatus();
    loadPlanSettings();
    
    // Set active tab from URL
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const action = urlParams.get('action');
    
    if (tab && ['personal', 'preferences', 'integrations', 'subscriptions'].includes(tab)) {
      setActiveTab(tab);
    }
    
    if (action === 'billing') {
      setActiveTab('subscriptions');
    }
    
    // Handle Strava OAuth callback
    const stravaStatus = urlParams.get('strava');
    if (stravaStatus === 'connected') {
      setSaveStatus({ 
        type: 'success', 
        message: 'Strava connected successfully! Your activities will now sync automatically.' 
      });
      setTimeout(() => {
        setSaveStatus({ type: '', message: '' });
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 5000);
      // Reload to show connection
      if (athleteId) {
        loadAccountData();
      }
    } else if (stravaStatus === 'error') {
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to connect Strava. Please try again or check System Settings.' 
      });
      setTimeout(() => {
        setSaveStatus({ type: '', message: '' });
        window.history.replaceState({}, '', window.location.pathname);
      }, 5000);
    }
    
    // Check if returning from Stripe checkout
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');
    
    if (sessionId && success === 'true') {
      // Switch to subscription tab
      setActiveTab('subscriptions');
      // Poll for payment status
      pollPaymentStatus(sessionId);
    }
  }, [athleteId, location.search]);

  // Update account tabs bubble position dynamically
  useLayoutEffect(() => {
    const updateAccountTabsBubble = () => {
      const tabsContainer = document.querySelector('.account-tabs-switcher');
      const activeButton = tabsContainer?.querySelector(`button[data-tab-value="${activeTab}"]`);
      
      if (tabsContainer && activeButton) {
        const containerRect = tabsContainer.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        
        const leftOffset = buttonRect.left - containerRect.left;
        const width = buttonRect.width;
        
        console.log('Account tabs bubble UPDATE:', { 
          activeTab, 
          leftOffset, 
          width,
          containerWidth: containerRect.width,
          buttonLeft: buttonRect.left,
          containerLeft: containerRect.left
        });
        
        tabsContainer.style.setProperty('--bubble-left', `${leftOffset}px`);
        tabsContainer.style.setProperty('--bubble-width', `${width}px`);
      } else {
        console.log('Account tabs not found:', { 
          hasContainer: !!tabsContainer, 
          hasButton: !!activeButton, 
          activeTab,
          selector: `button[data-tab-value="${activeTab}"]`
        });
      }
    };

    // Initial update
    updateAccountTabsBubble();
    
    // Multiple timeouts to catch different render phases
    const timer1 = setTimeout(updateAccountTabsBubble, 50);
    const timer2 = setTimeout(updateAccountTabsBubble, 100);
    const timer3 = setTimeout(updateAccountTabsBubble, 200);
    const timer4 = setTimeout(updateAccountTabsBubble, 500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [activeTab]);

  // Initialize push notifications
  useEffect(() => {
    const initPushNotifications = async () => {
      // Check if push is supported
      setPushSupported(isPushSupported());
      
      if (isPushSupported()) {
        try {
          // Register service worker
          await registerServiceWorker();
          
          // Check if already subscribed
          const subscribed = await isSubscribed();
          setPushSubscribed(subscribed);
        } catch (error) {
          console.error('Error initializing push notifications:', error);
        }
      }
    };
    
    initPushNotifications();
  }, []);

  const loadAvailablePlans = async () => {
    try {
      console.log('Loading available plans from API...');
      const response = await axios.get(`${API}/subscription-plans-public`);
      const plans = response.data.plans || [];
      console.log('Loaded plans:', plans);
      setAvailablePlans(plans);
      return plans;
    } catch (error) {
      console.error('Error loading available plans:', error);
      return [];
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      // Load plans first
      const plans = await loadAvailablePlans();
      
      const response = await axios.get(`${API}/subscriptions/status/${athleteId}`);
      console.log('Subscription status response:', response.data);
      
      const tier = response.data.subscription_tier || 'free';
      
      setSubscriptionStatus({
        tier: tier,
        status: response.data.subscription_status || 'active',
        current_period_end: response.data.subscription_current_period_end
      });
      
      // Find current plan details
      const currentPlan = plans.find(p => p.tier === tier);
      console.log('Current plan details:', currentPlan);
      console.log('Looking for tier:', tier);
      setCurrentPlanDetails(currentPlan);
      
      // Detect billing cycle from subscription_interval if available
      if (response.data.subscription_interval) {
        setCurrentBillingCycle(response.data.subscription_interval === 'year' ? 'annual' : 'monthly');
      }
      
      // Load invoices if user has a subscription
      if (response.data.subscription_tier && response.data.subscription_tier !== 'free') {
        loadInvoices();
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      console.log('Fetching invoices for athlete:', athleteId);
      const response = await axios.get(`${API}/subscriptions/invoices/${athleteId}`);
      console.log('Invoices response:', response.data);
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]); // Set empty array on error
    }
  };

  const loadPlanSettings = async () => {
    try {
      const response = await axios.get(`${API}/system/settings/public`);
      if (response.data.plans) {
        setPlanSettings(response.data.plans);
      }
    } catch (error) {
      console.log('Using default plan settings');
    }
  };

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000; // 2 seconds

    if (attempts >= maxAttempts) {
      setSaveStatus({ 
        type: 'error', 
        message: 'Payment status check timed out. Please refresh the page.' 
      });
      return;
    }

    try {
      const response = await axios.get(`${API}/subscriptions/checkout-status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        // Reload subscription status
        await loadSubscriptionStatus();
        setSaveStatus({ 
          type: 'success', 
          message: 'Payment successful! Your subscription is now active.' 
        });
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      } else if (response.data.status === 'expired') {
        setSaveStatus({ 
          type: 'error', 
          message: 'Payment session expired. Please try again.' 
        });
        return;
      }

      // If payment is still pending, continue polling
      setSaveStatus({ 
        type: '', 
        message: 'Processing payment...' 
      });
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Error checking payment status. Please refresh the page.' 
      });
    }
  };

  const handleUpgrade = async () => {
    if (!upgradeTarget) return;
    
    const plan_id = `${upgradeTarget}_${selectedBillingCycle}`;
    
    try {
      const originUrl = window.location.origin;
      
      const response = await axios.post(`${API}/subscriptions/create-checkout-session`, {
        plan_id: plan_id,
        origin_url: originUrl,
        athlete_id: athleteId
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to start checkout. Please try again.' 
      });
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await axios.post(`${API}/subscriptions/downgrade-to-free`, {
        athlete_id: athleteId
      });

      if (response.data.success) {
        setSaveStatus({ 
          type: 'success', 
          message: response.data.message
        });
        setShowCancelDialog(false);
        await loadSubscriptionStatus();
      }
    } catch (error) {
      console.error('Cancel error:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to cancel subscription. Please try again.' 
      });
    }
  };

  const handleManagePaymentMethod = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API}/subscriptions/create-portal-session`, {
        athlete_id: athleteId,
        return_url: window.location.href
      });

      if (response.data.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Portal session error:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to open payment management. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDowngrade = async () => {
    if (!downgradeTarget) return;
    
    const newPlanId = `${downgradeTarget}_${selectedBillingCycle}`;
    
    try {
      const response = await axios.post(`${API}/subscriptions/update-plan`, {
        athlete_id: athleteId,
        new_plan_id: newPlanId
      });

      if (response.data.success) {
        setShowDowngradeDialog(false);
        setSaveStatus({ 
          type: 'success', 
          message: response.data.message + ' Refreshing...'
        });
        
        // Wait for Stripe to update, then reload
        setTimeout(async () => {
          await loadSubscriptionStatus();
          await loadInvoices();
          setSaveStatus({ 
            type: 'success', 
            message: response.data.message
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Downgrade error:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to update subscription. Please try again.' 
      });
    }
  };

  const handleReactivate = async () => {
    try {
      const response = await axios.post(`${API}/subscriptions/reactivate`, {
        athlete_id: athleteId
      });

      if (response.data.success) {
        setSaveStatus({ 
          type: 'success', 
          message: response.data.message
        });
        await loadSubscriptionStatus();
      }
    } catch (error) {
      console.error('Reactivate error:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to reactivate subscription. Please try again.' 
      });
    }
  };

  const handleChangeBillingCycle = async () => {
    const newCycle = currentBillingCycle === 'monthly' ? 'annual' : 'monthly';
    const newPlanId = `${subscriptionStatus.tier}_${newCycle}`;
    
    try {
      const response = await axios.post(`${API}/subscriptions/update-plan`, {
        athlete_id: athleteId,
        new_plan_id: newPlanId
      });

      if (response.data.success) {
        setShowBillingCycleDialog(false);
        setSaveStatus({ 
          type: 'success', 
          message: `Switched to ${newCycle} billing successfully! Refreshing...`
        });
        
        // Wait a bit for Stripe to update, then reload
        setTimeout(async () => {
          await loadSubscriptionStatus();
          await loadInvoices();
          setSaveStatus({ 
            type: 'success', 
            message: `Successfully switched to ${newCycle} billing!`
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Billing cycle change error:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to change billing cycle. Please try again.' 
      });
    }
  };

  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      // Load athlete profile
      const athleteRes = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(athleteRes.data);
      // Parse date of birth if available (avoid timezone issues)
      let birthDay = '', birthMonth = '', birthYear = '';
      if (athleteRes.data.date_of_birth) {
        // Parse YYYY-MM-DD format directly without Date object to avoid timezone issues
        const dateString = athleteRes.data.date_of_birth;
        if (typeof dateString === 'string' && dateString.includes('-')) {
          const [year, month, day] = dateString.split('-');
          birthYear = year;
          birthMonth = parseInt(month).toString(); // Remove leading zero
          birthDay = parseInt(day).toString(); // Remove leading zero
        }
      }
      
      setPersonalForm({
        name: athleteRes.data.name,
        age: athleteRes.data.age?.toString() || '',
        profile_picture: athleteRes.data.profile_picture || '',
        birth_day: birthDay,
        birth_month: birthMonth,
        birth_year: birthYear,
        running_goals: athleteRes.data.running_goals,
        nationality: athleteRes.data.nationality || '',
        // Personal Information fields
        height: athleteRes.data.height || '',
        weight: athleteRes.data.weight || '',
        vo2_max: athleteRes.data.vo2_max || '',
        max_heart_rate: athleteRes.data.max_heart_rate || '',
        gender: athleteRes.data.gender || '',
        bio: athleteRes.data.bio || '',
        interests: athleteRes.data.interests || [],
        // Community Profile Privacy Settings
        share_bio: athleteRes.data.share_bio || false,
        share_goals: athleteRes.data.share_goals || false,
        share_interests: athleteRes.data.share_interests || false,
        estimated_calorie_need: athleteRes.data.estimated_calorie_need || '',
        weight_goal: athleteRes.data.weight_goal || '',
        health_goals: athleteRes.data.health_goals || [],
        allergies: athleteRes.data.allergies || [],
        dietary_preferences: athleteRes.data.dietary_preferences || [],
        // Preferences
        distance_unit: athleteRes.data.distance_unit || 'miles',
        measurement_system: athleteRes.data.measurement_system || 'imperial',
        week_starts_on: athleteRes.data.week_starts_on || 'monday',
        timezone: athleteRes.data.timezone || 'UTC',
        time_format: athleteRes.data.time_format || '12h',
        date_format: athleteRes.data.date_format || 'MM/DD/YYYY',
        weight_unit: athleteRes.data.weight_unit || 'lbs',
        fluid_unit: athleteRes.data.fluid_unit || 'fl oz',
        language: athleteRes.data.language || 'en',
        coach_language: athleteRes.data.coach_language || 'en',
        voice_preference: athleteRes.data.voice_preference || 'alloy',
        coach_name: athleteRes.data.coach_name || 'Coach',
        coach_avatar: athleteRes.data.coach_avatar || null,
        background_image: athleteRes.data.background_image || null
      });
      
      // Set profile picture preview if available
      if (athleteRes.data.profile_picture) {
        setProfilePicturePreview(athleteRes.data.profile_picture);
      }
      
      // Set coach avatar preview if available
      if (athleteRes.data.coach_avatar) {
        setCoachAvatarPreview(athleteRes.data.coach_avatar);
      }
      
      // Set background image preview if available
      if (athleteRes.data.background_image) {
        setBackgroundImagePreview(athleteRes.data.background_image);
      }
      
      // Load integrations data from backend
      try {
        // Load from new OAuth status and legacy integrations
        const [stravaStatusRes, ouraStatusRes, connectionsRes] = await Promise.all([
          axios.get(`${API}/auth/strava/status`, { params: { user_id: athleteId } }).catch(() => ({ data: { connected: false } })),
          axios.get(`${API}/integrations/oura/${athleteId}/status`).catch(() => ({ data: { connected: false } })),
          axios.get(`${API}/me/connections?user_id=${athleteId}`).catch(() => ({ data: { connections: [] } }))
        ]);
        
        const stravaStatus = stravaStatusRes.data;
        const ouraStatus = ouraStatusRes.data;
        const connectionsData = connectionsRes.data.connections || [];
        
        // Initialize integrations state with OAuth data
        const integrationsState = {
          strava: { 
            connected: stravaStatus.connected,
            athlete_name: stravaStatus.athlete ? `${stravaStatus.athlete.firstname} ${stravaStatus.athlete.lastname}` : '',
            last_sync: stravaStatus.last_sync_at
          },
          oura: { 
            connected: ouraStatus.connected,
            user_id: ouraStatus.connected ? 'Connected' : '',
            last_sync: ouraStatus.last_sync
          },
          coros: { connected: false, last_sync: null }
        };
        
        // Update with new connections data (preferred)
        connectionsData.forEach(connection => {
          if (connection.provider_key === 'strava') {
            integrationsState.strava = {
              connected: connection.status === 'active',
              athlete_name: connection.external_user_id || integrationsState.strava.athlete_name,
              last_sync: connection.last_sync_at || integrationsState.strava.last_sync
            };
          } else if (connection.provider_key === 'oura') {
            integrationsState.oura = {
              connected: connection.status === 'active',
              user_id: connection.external_user_id || integrationsState.oura.user_id,
              last_sync: connection.last_sync_at || integrationsState.oura.last_sync
            };
          } else if (connection.provider_key === 'coros') {
            integrationsState.coros = {
              connected: connection.status === 'active',
              last_sync: connection.last_sync_at || integrationsState.coros.last_sync
            };
          }
        });
        
        setIntegrations(integrationsState);
      } catch (error) {
        console.error('Error loading integrations:', error);
        // Set default values if loading fails
        setIntegrations({
          strava: { connected: false, athlete_name: '', last_sync: null },
          oura: { connected: false, user_id: '', last_sync: null },
          coros: { connected: false, last_sync: null }
        });
      }
      
    } catch (error) {
      console.error('Error loading account data:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load account data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonalFormChange = (e) => {
    const { name, value } = e.target;
    setPersonalForm(prev => ({ ...prev, [name]: value }));
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max 800px for profile pictures, maintaining aspect ratio)
          let width = img.width;
          let height = img.height;
          const maxSize = 800;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Check if blob is under 5MB
                if (blob.size > 5 * 1024 * 1024) {
                  // Try with lower quality
                  canvas.toBlob(
                    (blob2) => {
                      if (blob2 && blob2.size <= 5 * 1024 * 1024) {
                        resolve(blob2);
                      } else {
                        reject(new Error('Unable to compress image below 5MB'));
                      }
                    },
                    'image/jpeg',
                    0.7
                  );
                } else {
                  resolve(blob);
                }
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setSaveStatus({ type: '', message: 'Compressing image...' });
        
        const compressedBlob = await compressImage(file);
        
        // Convert blob to file with proper filename and MIME type
        const filename = file.name.replace(/\.[^.]+$/, '.jpg'); // Ensure .jpg extension
        const compressedFile = new File([compressedBlob], filename, { 
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        setProfilePictureFile(compressedFile);
        
        console.log('Compressed file:', {
          name: compressedFile.name,
          type: compressedFile.type,
          size: compressedFile.size
        });
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setProfilePicturePreview(e.target.result);
        };
        reader.readAsDataURL(compressedFile);
        
        // Clear status after short delay
        setTimeout(() => {
          setSaveStatus({ type: '', message: '' });
        }, 1500);
      } catch (error) {
        console.error('Error processing image:', error);
        setSaveStatus({ type: 'error', message: error.message });
      }
    }
  };

  const uploadProfilePicture = async () => {
    if (!profilePictureFile || !athleteId) return null;
    
    try {
      console.log('Uploading profile picture:', {
        fileName: profilePictureFile.name,
        fileType: profilePictureFile.type,
        fileSize: profilePictureFile.size,
        athleteId: athleteId
      });
      
      const formData = new FormData();
      formData.append('file', profilePictureFile);
      
      const response = await fetch(`${API}/athlete/${athleteId}/profile-picture`, {
        method: 'POST',
        body: formData
      });
      
      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload error response:', errorData);
        throw new Error(errorData.detail || 'Failed to upload profile picture');
      }
      
      const result = await response.json();
      console.log('Upload successful:', result);
      return result.profile_picture;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  };

  const uploadCoachAvatar = async () => {
    if (!coachAvatarFile) return null;
    
    try {
      const formData = new FormData();
      formData.append('file', coachAvatarFile);
      
      const response = await fetch(`${API}/athlete/${athleteId}/coach-avatar`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload coach avatar');
      }
      
      const result = await response.json();
      return result.coach_avatar;
    } catch (error) {
      console.error('Error uploading coach avatar:', error);
      throw error;
    }
  };

  const uploadBackgroundImage = async () => {
    if (!backgroundImageFile) return null;
    
    try {
      const formData = new FormData();
      formData.append('file', backgroundImageFile);
      
      const response = await fetch(`${API}/athlete/${athleteId}/background-image`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload background image');
      }
      
      const result = await response.json();
      return result.background_image;
    } catch (error) {
      console.error('Error uploading background image:', error);
      throw error;
    }
  };

  const handleCoachAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setSaveStatus({ type: '', message: 'Compressing image...' });
        
        const compressedBlob = await compressImage(file);
        
        const filename = file.name.replace(/\.[^.]+$/, '.jpg');
        const compressedFile = new File([compressedBlob], filename, { 
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        setCoachAvatarFile(compressedFile);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setCoachAvatarPreview(e.target.result);
        };
        reader.readAsDataURL(compressedFile);
        
        setTimeout(() => {
          setSaveStatus({ type: '', message: '' });
        }, 1000);
      } catch (error) {
        console.error('Error processing coach avatar:', error);
        setSaveStatus({ type: 'error', message: 'Failed to process image. Please try a different image.' });
      }
    }
  };

  const handleBackgroundImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setSaveStatus({ type: '', message: 'Compressing image...' });
        
        const compressedBlob = await compressImage(file);
        
        const filename = file.name.replace(/\.[^.]+$/, '.jpg');
        const compressedFile = new File([compressedBlob], filename, { 
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        setBackgroundImageFile(compressedFile);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setBackgroundImagePreview(e.target.result);
        };
        reader.readAsDataURL(compressedFile);
        
        setTimeout(() => {
          setSaveStatus({ type: '', message: '' });
        }, 1000);
      } catch (error) {
        console.error('Error processing background image:', error);
        setSaveStatus({ type: 'error', message: 'Failed to process image. Please try a different image.' });
      }
    }
  };

  const handleSavePersonalInfo = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Upload profile picture if a new one is selected
      let newProfilePicture = null;
      if (profilePictureFile) {
        try {
          newProfilePicture = await uploadProfilePicture();
        } catch (error) {
          setSaveStatus({ type: 'error', message: error.message });
          setIsLoading(false);
          return;
        }
      }
      
      // Construct date_of_birth from day, month, year (avoid timezone issues)
      let date_of_birth = null;
      if (personalForm.birth_day && personalForm.birth_month && personalForm.birth_year) {
        const year = parseInt(personalForm.birth_year);
        const month = parseInt(personalForm.birth_month);
        const day = parseInt(personalForm.birth_day);
        
        // Create date string directly to avoid timezone conversion issues
        const paddedMonth = month.toString().padStart(2, '0');
        const paddedDay = day.toString().padStart(2, '0');
        date_of_birth = `${year}-${paddedMonth}-${paddedDay}`;
      }
      
      const updatedData = {
        name: personalForm.name,
        date_of_birth: date_of_birth,
        running_goals: personalForm.running_goals,
        nationality: personalForm.nationality || null,
        height: personalForm.height ? parseFloat(personalForm.height) : null,
        weight: personalForm.weight ? parseFloat(personalForm.weight) : null,
        vo2_max: personalForm.vo2_max ? parseFloat(personalForm.vo2_max) : null,
        max_heart_rate: personalForm.max_heart_rate ? parseInt(personalForm.max_heart_rate) : null,
        gender: personalForm.gender || null,
        bio: personalForm.bio || null,
        interests: personalForm.interests || [],
        // Community Profile Privacy Settings - ensure boolean
        share_bio: Boolean(personalForm.share_bio),
        share_goals: Boolean(personalForm.share_goals),
        share_interests: Boolean(personalForm.share_interests),
        estimated_calorie_need: personalForm.estimated_calorie_need ? parseInt(personalForm.estimated_calorie_need) : null,
        weight_goal: personalForm.weight_goal || null,
        health_goals: personalForm.health_goals || [],
        allergies: personalForm.allergies || [],
        dietary_preferences: personalForm.dietary_preferences || [],
        measurement_system: personalForm.measurement_system
      };
      
      // Debug logging
      console.log('📤 Sending update data:', updatedData);
      console.log('🔍 Boolean values:', {
        share_bio: updatedData.share_bio,
        share_goals: updatedData.share_goals,
        share_interests: updatedData.share_interests
      });
      
      // Include profile picture if uploaded
      if (newProfilePicture) {
        updatedData.profile_picture = newProfilePicture;
      }
      
      const response = await axios.put(`${API}/athlete/${athleteId}`, updatedData);
      
      // Update athlete state with the response
      setAthlete(response.data);
      setPersonalForm(response.data);
      
      // Clear profile picture file state after successful upload
      setProfilePictureFile(null);
      if (newProfilePicture) {
        setProfilePicturePreview(newProfilePicture);
      }
      
      setSaveStatus({ type: 'success', message: 'Personal information updated successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      
      // Dispatch event to notify Dashboard to refresh athlete data
      window.dispatchEvent(new CustomEvent('athleteProfileUpdated', { 
        detail: { athleteId, profilePictureUpdated: !!newProfilePicture }
      }));
    } catch (error) {
      console.error('Error updating personal info:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Handle FastAPI validation errors - ALWAYS ensure string output
      let errorMsg = 'Failed to update personal information';
      
      try {
        if (error.response?.data?.detail) {
          const detail = error.response.data.detail;
          // If detail is an array of validation errors
          if (Array.isArray(detail)) {
            errorMsg = detail.map(err => {
              const location = Array.isArray(err.loc) ? err.loc.join('.') : 'field';
              const message = err.msg || 'validation error';
              return `${location}: ${message}`;
            }).join('; ');
          } else if (typeof detail === 'string') {
            errorMsg = detail;
          } else {
            // Convert any object to string
            errorMsg = 'Validation error: ' + JSON.stringify(detail);
          }
        } else if (error.response?.data?.message) {
          errorMsg = String(error.response.data.message);
        } else if (error.message) {
          errorMsg = String(error.message);
        }
      } catch (parseError) {
        console.error('Error parsing error message:', parseError);
        errorMsg = 'An error occurred while updating personal information';
      }
      
      // Final safeguard - ensure it's a string
      if (typeof errorMsg !== 'string') {
        errorMsg = 'Failed to update personal information';
      }
      
      setSaveStatus({ type: 'error', message: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Upload coach avatar if a new one is selected
      let newCoachAvatar = null;
      if (coachAvatarFile) {
        try {
          newCoachAvatar = await uploadCoachAvatar();
        } catch (error) {
          setSaveStatus({ type: 'error', message: error.message });
          setIsLoading(false);
          return;
        }
      }
      
      // Upload background image if a new one is selected
      let newBackgroundImage = null;
      if (backgroundImageFile) {
        try {
          newBackgroundImage = await uploadBackgroundImage();
        } catch (error) {
          setSaveStatus({ type: 'error', message: error.message });
          setIsLoading(false);
          return;
        }
      }
      
      const updatedData = {
        distance_unit: personalForm.distance_unit,
        measurement_system: personalForm.measurement_system,
        week_starts_on: personalForm.week_starts_on,
        timezone: personalForm.timezone,
        time_format: personalForm.time_format,
        date_format: personalForm.date_format,
        weight_unit: personalForm.weight_unit,
        fluid_unit: personalForm.fluid_unit,
        language: personalForm.language,
        coach_language: personalForm.coach_language,
        voice_preference: personalForm.voice_preference,
        coach_name: personalForm.coach_name,
        coach_avatar: newCoachAvatar || personalForm.coach_avatar,
        background_image: backgroundImageFile ? newBackgroundImage : personalForm.background_image
      };
      
      const response = await axios.put(`${API}/athlete/${athleteId}`, updatedData);
      
      // Update athlete state with the response
      setAthlete(response.data);
      setPersonalForm(response.data);
      
      // Clear file states after successful upload
      setCoachAvatarFile(null);
      if (newCoachAvatar) {
        setCoachAvatarPreview(newCoachAvatar);
      }
      
      setBackgroundImageFile(null);
      
      // Update localStorage with current background image from response
      const currentBgImage = response.data.background_image;
      if (currentBgImage) {
        setBackgroundImagePreview(currentBgImage);
        localStorage.setItem('app_background_image', currentBgImage);
      } else {
        setBackgroundImagePreview('');
        localStorage.removeItem('app_background_image');
      }
      
      // Dispatch custom event to notify Dashboard of background change
      window.dispatchEvent(new CustomEvent('backgroundImageUpdated', { 
        detail: { backgroundImage: currentBgImage } 
      }));
      
      setSaveStatus({ type: 'success', message: 'Preferences updated successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error updating preferences:', error);
      setSaveStatus({ type: 'error', message: 'Failed to update preferences' });
    } finally {
      setIsLoading(false);
    }
  };

  // Push notification handlers
  const handleTogglePushNotifications = async () => {
    if (pushLoading) return;
    
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        // Unsubscribe
        await unsubscribeFromPush(athleteId);
        setPushSubscribed(false);
        setSaveStatus({ type: 'success', message: 'Push notifications disabled' });
      } else {
        // Subscribe - first ensure service worker is registered
        console.log('Starting push notification subscription...');
        
        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          throw new Error('Service workers are not supported in this browser');
        }
        
        // Check if push is supported
        if (!('PushManager' in window)) {
          throw new Error('Push notifications are not supported in this browser');
        }
        
        // Register service worker if not already registered
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.log('Registering service worker...');
          registration = await registerServiceWorker();
        }
        console.log('Service worker ready:', registration);
        
        // Now request permission and subscribe
        console.log('Requesting notification permission...');
        await subscribeToPush(athleteId);
        
        setPushSubscribed(true);
        setSaveStatus({ type: 'success', message: 'Push notifications enabled! You\'ll receive alerts for new reports.' });
      }
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      let errorMessage = 'Failed to update push notifications';
      
      if (error.message === 'Notification permission denied') {
        errorMessage = 'Please allow notifications in your browser settings';
      } else if (error.message.includes('not supported')) {
        errorMessage = error.message;
      }
      
      setSaveStatus({ type: 'error', message: errorMessage });
    } finally {
      setPushLoading(false);
    }
  };


  // Simple integration handlers using provider connector infrastructure
  const handleSimpleConnect = async (providerKey) => {
    try {
      // Get auth URL from backend provider connector
      const response = await axios.get(`${API}/auth/${providerKey}?user_id=${athleteId}`);
      
      if (response.data.authorization_url) {
        // Store redirect info in localStorage for when we return
        localStorage.setItem('integration_redirect', window.location.href);
        localStorage.setItem('connecting_provider', providerKey);
        
        // Redirect to provider's OAuth page
        window.location.href = response.data.authorization_url;
      }
    } catch (error) {
      console.error(`Error connecting to ${providerKey}:`, error);
      setSaveStatus({ 
        type: 'error', 
        message: `Failed to connect to ${providerKey}. Please ensure credentials are configured.` 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
    }
  };

  const handleSimpleDisconnect = async (providerKey) => {
    if (!window.confirm(`Are you sure you want to disconnect ${providerKey}?`)) {
      return;
    }

    try {
      await axios.post(`${API}/me/connections/${providerKey}/disconnect?user_id=${athleteId}`);
      
      // Update local state
      setIntegrations(prev => ({
        ...prev,
        [providerKey]: { connected: false, athlete_name: '', user_id: '', last_sync: null }
      }));
      
      setSaveStatus({ type: 'success', message: `${providerKey} disconnected successfully` });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error(`Error disconnecting ${providerKey}:`, error);
      setSaveStatus({ 
        type: 'error', 
        message: `Failed to disconnect ${providerKey}. Please try again.` 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
    }
  };

  const handleStravaConnect = async () => {
    try {
      // Call new OAuth endpoint
      const response = await axios.get(`${API}/auth/strava`, {
        params: { user_id: athleteId }
      });
      
      // Redirect to Strava authorization page
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Error connecting to strava:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to connect to Strava. Please check System Settings for API credentials.' 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
    }
  };

  const handleOuraConnect = async () => {
    // Oura credentials are now system-wide in System Settings
    // Just proceed with OAuth directly
    await handleSimpleConnect('oura');
  };

  const handleDisconnectIntegration = async (integration) => {
    try {
      // Use new OAuth disconnect for Strava
      if (integration === 'strava') {
        await axios.post(`${API}/auth/strava/disconnect`, { user_id: athleteId });
      } else {
        await axios.delete(`${API}/integrations/${athleteId}/${integration}`);
      }
      
      setIntegrations(prev => ({
        ...prev,
        [integration]: { connected: false, athlete_name: '', user_id: '', last_sync: null }
      }));
      
      setSaveStatus({ type: 'success', message: `${integration.charAt(0).toUpperCase() + integration.slice(1)} disconnected successfully!` });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error(`Error disconnecting ${integration}:`, error);
      setSaveStatus({ type: 'error', message: `Failed to disconnect ${integration}` });
    }
  };

  const handleStravaSync = async () => {
    try {
      setSaveStatus({ type: 'info', message: 'Syncing activities from Strava...' });
      const response = await axios.post(`${API}/integrations/strava/${athleteId}/sync`);
      setSaveStatus({ 
        type: 'success', 
        message: `Sync completed! Imported ${response.data.imported_activities} activities.` 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
      
      // Reload integrations to update last sync time
      loadAccountData();
    } catch (error) {
      console.error('Error syncing Strava activities:', error);
      setSaveStatus({ type: 'error', message: 'Failed to sync Strava activities' });
    }
  };

  const handleOuraSync = async () => {
    try {
      setSaveStatus({ type: 'info', message: 'Syncing sleep and recovery data from Oura...' });
      const response = await axios.post(`${API}/integrations/oura/${athleteId}/sync`);
      setSaveStatus({ 
        type: 'success', 
        message: `Sync completed! Imported ${response.data.imported_sleep_records} sleep records.` 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
      
      // Reload integrations to update last sync time
      loadAccountData();
    } catch (error) {
      console.error('Error syncing Oura data:', error);
      setSaveStatus({ type: 'error', message: 'Failed to sync Oura data' });
    }
  };

  const handleCorosConnect = async () => {
    try {
      setSaveStatus({ type: 'info', message: 'Connecting to COROS...' });
      const response = await axios.get(`${API}/auth/coros/${athleteId}`);
      if (response.data.auth_url) {
        window.location.href = response.data.auth_url;
      }
    } catch (error) {
      console.error('Error connecting to COROS:', error);
      setSaveStatus({ type: 'error', message: 'Failed to connect to COROS' });
    }
  };

  const handleCorosSync = async () => {
    try {
      setSaveStatus({ type: 'info', message: 'Syncing activities from COROS...' });
      const response = await axios.post(`${API}/integrations/coros/${athleteId}/sync`);
      setSaveStatus({ 
        type: 'success', 
        message: `Sync completed! Imported ${response.data.imported_activities || 0} activities.` 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
      
      // Reload integrations to update last sync time
      loadAccountData();
    } catch (error) {
      console.error('Error syncing COROS data:', error);
      setSaveStatus({ type: 'error', message: 'Failed to sync COROS data' });
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('athleteId');
      window.location.href = '/';
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 py-6">
        <div className="skeleton h-8 w-48 mb-6" style={{ background: 'var(--bg-800)', opacity: 0.5 }}></div>
        <div className="skeleton h-96 rounded-lg" style={{ background: 'var(--bg-800)', opacity: 0.5 }}></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 py-6 md:pt-0">
      {/* Header */}
      <div className="mb-8 relative">
        <div className="flex flex-col">
          <div className="w-full mb-4">
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              {t('account.title')}
            </h1>
            <p className="text-gray-300">
              {t('account.manageProfile')}
            </p>
          </div>
          {/* Support Button (visible to all users) */}
          <div className="mb-4">
            <Button
              onClick={() => navigate('/dashboard/support')}
              className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white px-4 py-2 rounded-lg flex items-center gap-2"
              title={t('account.contactSupport')}
            >
              <HelpCircle className="w-5 h-5" />
              <span className="font-semibold">{t('account.contactSupport')}</span>
            </Button>
          </div>
          {athlete?.is_super_admin && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full justify-between sm:justify-start">
              <Button
                onClick={() => navigate('/dashboard/pages')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.pages')}
              >
                <FileText className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.pages')}</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard/menus')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.menus')}
              >
                <Menu className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.menus')}</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard/crm')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.crm')}
              >
                <Users className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.crm')}</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard/orders')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.orders')}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.orders')}</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard/subscriptions')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.subscriptions')}
              >
                <Repeat className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.subscriptions')}</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard/emails')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.emails')}
              >
                <FileText className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.emails')}</span>
              </Button>
              <Button
                onClick={() => navigate('/dashboard/system-settings')}
                className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
                title={t('account.systemSettings')}
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">{t('account.systemSettings')}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {saveStatus.message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          saveStatus.type === 'success' 
            ? 'bg-blue-900/30 border-blue-700 text-blue-400'
            : 'bg-red-900/30 border-red-700 text-red-400'
        }`}>
          <div className="flex items-center">
            {saveStatus.type === 'success' ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            {saveStatus.message}
          </div>
        </div>
      )}

      {/* Account Tabs */}
      {/* Custom tab switcher wrapper - EXACT COPY OF JOURNAL STRUCTURE */}
      <div 
        className="account-tabs-switcher flex items-center space-x-2 p-2 relative mb-8"
        data-previous={previousAccountTab}
        style={{
          '--bubble-left': '0px',
          '--bubble-width': '100px',
          background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          borderRadius: '99em',
          boxShadow: `
            inset 0 2px 4px -1px rgba(0,0,0,0.3),
            inset 0 -1px 2px rgba(255,255,255,0.05)
          `
        }}
      >
        <button
          type="button"
          data-tab-value="personal"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviousAccountTab(activeTab);
            handleTabChange('personal');
          }}
          style={{
            color: activeTab === 'personal' ? 'var(--bg-950)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            position: 'relative',
            zIndex: 1
          }}
          className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center text-xs md:text-sm"
          data-testid="personal-tab"
        >
          <span className="hidden sm:inline">{t('account.personalInfo')}</span>
          <span className="sm:hidden">{t('nav.account')}</span>
        </button>
        <button
          type="button"
          data-tab-value="preferences"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviousAccountTab(activeTab);
            handleTabChange('preferences');
          }}
          style={{
            color: activeTab === 'preferences' ? 'var(--bg-950)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            position: 'relative',
            zIndex: 1
          }}
          className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center text-xs md:text-sm"
          data-testid="preferences-tab"
        >
          <span className="hidden sm:inline">{t('account.preferences')}</span>
          <span className="sm:hidden">{t('account.preferences')}</span>
        </button>
        <button
          type="button"
          data-tab-value="integrations"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviousAccountTab(activeTab);
            handleTabChange('integrations');
          }}
          style={{
            color: activeTab === 'integrations' ? 'var(--bg-950)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            position: 'relative',
            zIndex: 1
          }}
          className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center text-xs md:text-sm"
          data-testid="integrations-tab"
        >
          <span className="hidden sm:inline">{t('account.integrations')}</span>
          <span className="sm:hidden">{t('account.integrations')}</span>
        </button>
        <button
          type="button"
          data-tab-value="subscriptions"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviousAccountTab(activeTab);
            handleTabChange('subscriptions');
          }}
          style={{
            color: activeTab === 'subscriptions' ? 'var(--bg-950)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            position: 'relative',
            zIndex: 1
          }}
          className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center text-xs md:text-sm"
          data-testid="subscriptions-tab"
        >
          <span className="hidden sm:inline">{t('account.subscription')}</span>
          <span className="sm:hidden">{t('account.subscription')}</span>
        </button>
      </div>
      
      {/* Keep Radix Tabs for content areas only */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="bg-transparent">
        <TabsList style={{ display: 'none' }}>
          <TabsTrigger value="personal" />
          <TabsTrigger value="preferences" />
          <TabsTrigger value="integrations" />
          <TabsTrigger value="subscriptions" />
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="bg-transparent">
          <div className="p-4 md:p-6 mb-4" style={{
            background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px'
          }}>
            <div className="mb-6">
              <h3 className="flex items-center text-white text-xl font-semibold">
                <User className="w-5 h-5 mr-2 text-[#32D3FF]" />
                {t('account.personalInfoSection.title')}
              </h3>
              <p className="text-gray-400 mt-1">
                {t('account.personalInfoSection.description')}
              </p>
            </div>
            <div>
              <form onSubmit={handleSavePersonalInfo} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-white">{t('account.profilePicture')}</Label>
                    <div className="flex items-center space-x-4">
                      {/* Profile Picture Preview */}
                      <div className="relative">
                        {profilePicturePreview ? (
                          <img
                            src={profilePicturePreview}
                            alt="Profile"
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-700"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-700">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Upload Button */}
                      <div className="flex-1">
                        <input
                          type="file"
                          id="profile-picture"
                          accept="image/*"
                          onChange={handleProfilePictureChange}
                          className="hidden"
                        />
                        <Label
                          htmlFor="profile-picture"
                          className="inline-flex items-center justify-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          {profilePictureFile ? t('account.changePicture') : t('account.uploadPicture')}
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('account.profilePictureHint')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-white">{t('auth.fullName')}</Label>
                  <Input
                    id="name"
                    name="name"
                    value={personalForm.name}
                    onChange={handlePersonalFormChange}
                    className="text-white placeholder:text-gray-500"
                    style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                    data-testid="name-input"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nationality" className="text-sm font-medium text-white">Nationality</Label>
                      <Select
                        value={personalForm.nationality}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, nationality: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue placeholder={t('account.selectCountry')} />
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
                      <Label className="text-sm font-medium text-white">{t('account.dateOfBirth')}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-gray-400">{t('account.birthDay')}</Label>
                        <Select
                          value={personalForm.birth_day}
                          onValueChange={(value) => setPersonalForm(prev => ({...prev, birth_day: value}))}
                        >
                          <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                            <SelectValue placeholder={t('account.selectDay')} />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">{t('account.birthMonth')}</Label>
                        <Select
                          value={personalForm.birth_month}
                          onValueChange={(value) => setPersonalForm(prev => ({...prev, birth_month: value}))}
                        >
                          <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                            <SelectValue placeholder={t('account.selectMonth')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">{t('account.january')}</SelectItem>
                            <SelectItem value="2">{t('account.february')}</SelectItem>
                            <SelectItem value="3">{t('account.march')}</SelectItem>
                            <SelectItem value="4">{t('account.april')}</SelectItem>
                            <SelectItem value="5">{t('account.may')}</SelectItem>
                            <SelectItem value="6">{t('account.june')}</SelectItem>
                            <SelectItem value="7">{t('account.july')}</SelectItem>
                            <SelectItem value="8">{t('account.august')}</SelectItem>
                            <SelectItem value="9">{t('account.september')}</SelectItem>
                            <SelectItem value="10">{t('account.october')}</SelectItem>
                            <SelectItem value="11">{t('account.november')}</SelectItem>
                            <SelectItem value="12">{t('account.december')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">{t('account.birthYear')}</Label>
                        <Select
                          value={personalForm.birth_year}
                          onValueChange={(value) => setPersonalForm(prev => ({...prev, birth_year: value}))}
                        >
                          <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                            <SelectValue placeholder={t('account.selectYear')} />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="opacity-10" />

                <div className="space-y-2">
                  <Label htmlFor="running_goals" className="text-sm font-medium text-white">{t('account.runningGoals')}</Label>
                  <textarea
                    id="running_goals"
                    name="running_goals"
                    value={personalForm.running_goals}
                    onChange={handlePersonalFormChange}
                    className="w-full min-h-24 p-3 text-white placeholder:text-gray-500 rounded-md resize-none focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                    style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                    placeholder={t('onboarding.runningGoalsPlaceholder')}
                    data-testid="goals-textarea"
                  />
                </div>

                <Separator className="opacity-10" />

                {/* Physical Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center">
                    <User className="w-5 h-5 mr-2 text-[#32D3FF]" />
                    {t('account.physicalInformation')}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="height" className="text-sm font-medium text-white">{t('account.height')}</Label>
                      <Input
                        id="height"
                        name="height"
                        type="number"
                        value={personalForm.height}
                        onChange={handlePersonalFormChange}
                        placeholder="175"
                        className="text-white placeholder:text-gray-500"
                        style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="weight" className="text-sm font-medium text-white">{t('account.weight')}</Label>
                      <Input
                        id="weight"
                        name="weight"
                        type="number"
                        value={personalForm.weight}
                        onChange={handlePersonalFormChange}
                        placeholder="70"
                        className="text-white placeholder:text-gray-500"
                        style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="vo2_max" className="text-sm font-medium text-white">{t('account.vo2Max')}</Label>
                      <Input
                        id="vo2_max"
                        name="vo2_max"
                        type="number"
                        step="0.1"
                        value={personalForm.vo2_max}
                        onChange={handlePersonalFormChange}
                        placeholder="50.0"
                        className="text-white placeholder:text-gray-500"
                        style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_heart_rate" className="text-sm font-medium text-white">{t('account.maxHeartRate')}</Label>
                      <Input
                        id="max_heart_rate"
                        name="max_heart_rate"
                        type="number"
                        value={personalForm.max_heart_rate}
                        onChange={handlePersonalFormChange}
                        placeholder="190"
                        className="text-white placeholder:text-gray-500"
                        style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium text-white">{t('account.gender')}</Label>
                      <Select
                        value={personalForm.gender}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, gender: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue placeholder={`Select ${t('account.gender').toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t('account.genderMale')}</SelectItem>
                          <SelectItem value="female">{t('account.genderFemale')}</SelectItem>
                          <SelectItem value="other">{t('account.genderOther')}</SelectItem>
                          <SelectItem value="prefer_not_to_say">{t('account.genderPreferNotToSay')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-sm font-medium text-white">{t('account.bio')}</Label>
                    <textarea
                      id="bio"
                      name="bio"
                      value={personalForm.bio}
                      onChange={handlePersonalFormChange}
                      className="w-full min-h-20 p-3 text-white placeholder:text-gray-500 rounded-md resize-none focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                      style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                      placeholder={t('account.bioPlaceholder')}
                      maxLength="500"
                    />
                    <p className="text-xs text-gray-500">{t('account.characterCount', { count: personalForm.bio?.length || 0 })}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">{t('account.interests')}</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { key: 'Running', label: t('account.interestRunning') },
                        { key: 'Marathon', label: t('account.interestMarathon') },
                        { key: 'Trail Running', label: t('account.interestTrailRunning') },
                        { key: 'Ultramarathon', label: t('account.interestUltramarathon') },
                        { key: 'Cycling', label: t('account.interestCycling') },
                        { key: 'Swimming', label: t('account.interestSwimming') },
                        { key: 'Triathlon', label: t('account.interestTriathlon') },
                        { key: 'Fitness', label: t('account.interestFitness') },
                        { key: 'Nutrition', label: t('account.interestNutrition') },
                        { key: 'Yoga', label: t('account.interestYoga') },
                        { key: 'Strength Training', label: t('account.interestStrengthTraining') },
                        { key: 'CrossFit', label: t('account.interestCrossFit') },
                        { key: 'Hiking', label: t('account.interestHiking') },
                        { key: 'Rock Climbing', label: t('account.interestRockClimbing') },
                        { key: 'Tennis', label: t('account.interestTennis') },
                        { key: 'Basketball', label: t('account.interestBasketball') }
                      ].map((interest) => (
                        <label key={interest.key} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={personalForm.interests.includes(interest.key)}
                            onChange={(e) => {
                              const newInterests = e.target.checked
                                ? [...personalForm.interests, interest.key]
                                : personalForm.interests.filter(i => i !== interest.key);
                              setPersonalForm(prev => ({...prev, interests: newInterests}));
                            }}
                            className="rounded border-gray-700 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">{interest.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="opacity-10" />

                {/* Community Profile Privacy Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-display font-semibold text-white">{t('account.communityProfilePrivacy')}</h3>
                  <p className="text-sm text-gray-400">{t('account.communityProfilePrivacyDescription')}</p>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={personalForm.share_bio || false}
                        onChange={(e) => setPersonalForm(prev => ({...prev, share_bio: e.target.checked}))}
                        className="w-5 h-5 rounded border-gray-700 text-blue-500 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-white group-hover:text-[#32D3FF] transition-colors">{t('account.showBio')}</span>
                        <p className="text-xs text-gray-500">{t('account.showBioDescription')}</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={personalForm.share_goals || false}
                        onChange={(e) => setPersonalForm(prev => ({...prev, share_goals: e.target.checked}))}
                        className="w-5 h-5 rounded border-gray-700 text-blue-500 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-white group-hover:text-[#32D3FF] transition-colors">{t('account.showHealthGoals')}</span>
                        <p className="text-xs text-gray-500">{t('account.showHealthGoalsDescription')}</p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={personalForm.share_interests || false}
                        onChange={(e) => setPersonalForm(prev => ({...prev, share_interests: e.target.checked}))}
                        className="w-5 h-5 rounded border-gray-700 text-blue-500 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-white group-hover:text-[#32D3FF] transition-colors">{t('account.showInterests')}</span>
                        <p className="text-xs text-gray-500">{t('account.showInterestsDescription')}</p>
                      </div>
                    </label>
                  </div>
                </div>

                <Separator className="opacity-10" />

                <div className="space-y-4">
                  <h3 className="text-lg font-display font-semibold text-white">{t('account.healthNutritionGoals')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Estimated Calorie Need */}
                    <div className="space-y-2">
                      <Label htmlFor="estimated_calorie_need" className="text-sm font-medium text-white">
                        {t('account.estimatedCalorieNeed')}
                      </Label>
                      <Input
                        id="estimated_calorie_need"
                        name="estimated_calorie_need"
                        type="number"
                        value={personalForm.estimated_calorie_need}
                        onChange={handlePersonalFormChange}
                        placeholder="e.g., 2500"
                        className="text-white placeholder:text-gray-500"
                        style={{ backgroundColor: '#111827', borderColor: '#374151' }}
                      />
                      <p className="text-xs text-gray-500">
                        {t('account.caloriesPerDay')}
                      </p>
                    </div>

                    {/* Weight Goal */}
                    <div className="space-y-2">
                      <Label htmlFor="weight_goal" className="text-sm font-medium text-white">
                        {t('account.weightGoal')}
                      </Label>
                      <Select 
                        value={personalForm.weight_goal}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, weight_goal: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue placeholder={t('account.selectWeightGoal')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="decrease">{t('account.decreaseWeight')}</SelectItem>
                          <SelectItem value="maintain">{t('account.maintainWeight')}</SelectItem>
                          <SelectItem value="increase">{t('account.increaseWeight')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Health Goals */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">{t('account.healthGoals')}</Label>
                    <p className="text-xs text-gray-500 mb-3">{t('account.healthGoalsDescription')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { value: 'muscle_mass', label: t('account.goalIncreaseMuscle') },
                        { value: 'speed', label: t('account.goalImproveSpeed') },
                        { value: 'strength', label: t('account.goalBuildStrength') },
                        { value: 'flexibility', label: t('account.goalIncreaseFlexibility') },
                        { value: 'endurance', label: t('account.goalBuildEndurance') },
                        { value: 'longevity', label: t('account.goalLongevity') },
                        { value: 'mental_clarity', label: t('account.goalMentalClarity') },
                        { value: 'emotional_stability', label: t('account.goalEmotionalStability') }
                      ].map((goal) => (
                        <label key={goal.value} className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={personalForm.health_goals.includes(goal.value)}
                            onChange={(e) => {
                              const newGoals = e.target.checked
                                ? [...personalForm.health_goals, goal.value]
                                : personalForm.health_goals.filter(g => g !== goal.value);
                              setPersonalForm(prev => ({...prev, health_goals: newGoals}));
                            }}
                            className="mt-0.5 rounded border-gray-700 text-[#32D3FF] focus:ring-[#32D3FF]"
                          />
                          <span className="text-sm text-gray-300">{goal.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="opacity-10" />

                {/* Dietary Restrictions & Preferences */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center">
                    <Utensils className="w-5 h-5 mr-2 text-[#32D3FF]" />
                    {t('account.dietaryRestrictionsPreferences')}
                  </h3>
                  
                  {/* Allergies */}
                  <div>
                    <Label className="text-base font-medium text-white mb-3 block">{t('account.allergies')}</Label>
                    <p className="text-sm text-gray-400 mb-3">{t('account.allergiesDescription')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { value: 'dairy', label: t('account.allergyDairy') },
                        { value: 'eggs', label: t('account.allergyEggs') },
                        { value: 'fish', label: t('account.allergyFish') },
                        { value: 'shellfish', label: t('account.allergyShellfish') },
                        { value: 'tree_nuts', label: t('account.allergyTreeNuts') },
                        { value: 'peanuts', label: t('account.allergyPeanuts') },
                        { value: 'wheat', label: t('account.allergyWheat') },
                        { value: 'soy', label: t('account.allergySoy') },
                        { value: 'sesame', label: t('account.allergySesame') },
                        { value: 'gluten', label: t('account.allergyGluten') },
                      ].map(allergy => (
                        <label key={allergy.value} className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={personalForm.allergies?.includes(allergy.value)}
                            onChange={(e) => {
                              const newAllergies = e.target.checked
                                ? [...(personalForm.allergies || []), allergy.value]
                                : (personalForm.allergies || []).filter(a => a !== allergy.value);
                              setPersonalForm(prev => ({...prev, allergies: newAllergies}));
                            }}
                            className="mt-0.5 rounded border-gray-700 text-[#32D3FF] focus:ring-[#32D3FF]"
                          />
                          <span className="text-sm text-gray-300">{allergy.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Dietary Preferences */}
                  <div>
                    <Label className="text-base font-medium text-white mb-3 block">{t('account.dietaryPreferences')}</Label>
                    <p className="text-sm text-gray-400 mb-3">{t('account.dietaryPreferencesDescription')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { value: 'vegan', label: t('account.dietVegan') },
                        { value: 'vegetarian', label: t('account.dietVegetarian') },
                        { value: 'pescatarian', label: t('account.dietPescatarian') },
                        { value: 'keto', label: t('account.dietKeto') },
                        { value: 'paleo', label: t('account.dietPaleo') },
                        { value: 'mediterranean', label: t('account.dietMediterranean') },
                        { value: 'low_carb', label: t('account.dietLowCarb') },
                        { value: 'gluten_free', label: t('account.dietGlutenFree') },
                        { value: 'dairy_free', label: t('account.dietDairyFree') },
                      ].map(diet => (
                        <label key={diet.value} className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={personalForm.dietary_preferences?.includes(diet.value)}
                            onChange={(e) => {
                              const newPrefs = e.target.checked
                                ? [...(personalForm.dietary_preferences || []), diet.value]
                                : (personalForm.dietary_preferences || []).filter(d => d !== diet.value);
                              setPersonalForm(prev => ({...prev, dietary_preferences: newPrefs}));
                            }}
                            className="mt-0.5 rounded border-gray-700 text-[#32D3FF] focus:ring-[#32D3FF]"
                          />
                          <span className="text-sm text-gray-300">{diet.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white font-medium px-6 py-2"
                    data-testid="save-personal-info-btn"
                  >
                    {t('account.saveChanges')}
                  </Button>
                </div>
              </form>

              {/* Security Section - Outside form to avoid nested forms */}
              <Separator className="opacity-10 my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-[#32D3FF]" />
                  {t('account.security')}
                </h3>
                <ChangeEmail athleteId={athleteId} currentEmail={personalForm.email} />
                <ChangePassword athleteId={athleteId} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="bg-transparent">
          <div className="p-4 md:p-6 mb-4" style={{
            background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px'
          }}>
            <div className="mb-6">
              <h3 className="flex items-center text-white text-xl font-semibold">
                <Settings className="w-5 h-5 mr-2 text-[#32D3FF]" />
                {t('account.preferences')}
              </h3>
              <p className="text-gray-400 mt-1">
                {t('account.customizeSettings')}
              </p>
            </div>
            <div>
              <form onSubmit={handleSavePreferences} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">{t('account.languageRegion')}</h3>
                  <div className="space-y-2">
                    <Label htmlFor="language" className="text-sm font-medium text-white">{t('account.language')}</Label>
                    <LanguageSelector />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-sm font-medium text-white">{t('account.timezone')}</Label>
                    <Select
                      value={personalForm.timezone || 'UTC'}
                      onValueChange={(value) => setPersonalForm(prev => ({...prev, timezone: value}))}
                    >
                      <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                        <SelectValue placeholder={t('account.selectTimezone')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                        <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                        <SelectItem value="Europe/Oslo">Oslo (CET)</SelectItem>
                        <SelectItem value="Europe/Stockholm">Stockholm (CET)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney (AEDT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="opacity-10" />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">{t('account.unitsMeasurements')}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">{t('account.distanceUnit')}</Label>
                      <Select
                        value={personalForm.distance_unit || 'miles'}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, distance_unit: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="miles">{t('account.miles')}</SelectItem>
                          <SelectItem value="km">{t('account.kilometers')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">Measurement System</Label>
                      <Select
                        value={personalForm.measurement_system || 'imperial'}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, measurement_system: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imperial">Imperial (lbs, ft/in)</SelectItem>
                          <SelectItem value="metric">Metric (kg, cm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Push Notifications */}
                  <div className="space-y-4 border border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {pushSubscribed ? (
                            <Bell className="w-5 h-5 text-[#32D3FF]" />
                          ) : (
                            <BellOff className="w-5 h-5 text-gray-400" />
                          )}
                          <Label className="text-sm font-medium text-white">Push Notifications</Label>
                          {pushSubscribed && (
                            <Badge className="bg-blue-900/30 text-blue-400">Enabled</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {pushSupported 
                            ? 'Get instant alerts for new AI-generated reports and recommendations'
                            : 'Push notifications are not supported on this browser'
                          }
                        </p>
                      </div>
                      {pushSupported && (
                        <Button
                          type="button"
                          onClick={handleTogglePushNotifications}
                          disabled={pushLoading}
                          variant={pushSubscribed ? "outline" : "default"}
                          className={pushSubscribed ? "border-gray-600 text-white hover:bg-gray-700" : "bg-[#32D3FF] hover:bg-[#1FC1FF] text-white"}
                        >
                          {pushLoading ? 'Loading...' : pushSubscribed ? 'Disable' : 'Enable'}
                        </Button>
                      )}
                    </div>
                    {pushSupported && pushSubscribed && (
                      <div className="text-xs text-gray-400 p-2 rounded border border-gray-700">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-white">You'll receive notifications for:</p>
                            <ul className="mt-1 space-y-1 ml-2">
                              <li>• New AI-generated reports</li>
                              <li>• Scheduled analysis completions</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator className="opacity-10" />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Calendar & Time</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">Week Starts On</Label>
                      <Select
                        value={personalForm.week_starts_on || 'monday'}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, week_starts_on: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sunday">Sunday</SelectItem>
                          <SelectItem value="monday">Monday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">Time Format</Label>
                      <Select
                        value={personalForm.time_format || '12h'}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, time_format: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                          <SelectItem value="24h">24 Hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">Date Format</Label>
                    <Select
                      value={personalForm.date_format || 'MM/DD/YYYY'}
                      onValueChange={(value) => setPersonalForm(prev => ({...prev, date_format: value}))}
                    >
                      <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</SelectItem>
                        <SelectItem value="MMM DD, YYYY">MMM DD, YYYY (Dec 31, 2024)</SelectItem>
                        <SelectItem value="DD MMM YYYY">DD MMM YYYY (31 Dec 2024)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">Weight Unit</Label>
                      <Select
                        value={personalForm.weight_unit || 'lbs'}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, weight_unit: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                          <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">Fluid Unit</Label>
                      <Select
                        value={personalForm.fluid_unit || 'fl oz'}
                        onValueChange={(value) => setPersonalForm(prev => ({...prev, fluid_unit: value}))}
                      >
                        <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fl oz">Fluid Ounces (fl oz)</SelectItem>
                          <SelectItem value="ml">Milliliters (ml)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">{t('account.aiCoachVoice')}</Label>
                    <Select
                      value={personalForm.voice_preference || 'alloy'}
                      onValueChange={(value) => setPersonalForm(prev => ({...prev, voice_preference: value}))}
                    >
                      <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                        <SelectItem value="ash">Ash (Calm)</SelectItem>
                        <SelectItem value="ballad">Ballad (Expressive)</SelectItem>
                        <SelectItem value="coral">Coral (Friendly)</SelectItem>
                        <SelectItem value="echo">Echo (Steady)</SelectItem>
                        <SelectItem value="sage">Sage (Wise)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (Bright)</SelectItem>
                        <SelectItem value="verse">Verse (Articulate)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* AI Coach Language Preference */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">{t('account.aiCoachLanguagePreference')}</Label>
                    <p className="text-xs text-gray-500">{t('account.aiCoachLanguageDescription')}</p>
                    <Select
                      value={personalForm.coach_language || 'en'}
                      onValueChange={(value) => setPersonalForm(prev => ({...prev, coach_language: value}))}
                    >
                      <SelectTrigger className="text-white" style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish (Español)</SelectItem>
                        <SelectItem value="fr">French (Français)</SelectItem>
                        <SelectItem value="de">German (Deutsch)</SelectItem>
                        <SelectItem value="it">Italian (Italiano)</SelectItem>
                        <SelectItem value="pt">Portuguese (Português)</SelectItem>
                        <SelectItem value="nl">Dutch (Nederlands)</SelectItem>
                        <SelectItem value="no">Norwegian (Norsk)</SelectItem>
                        <SelectItem value="sv">Swedish (Svenska)</SelectItem>
                        <SelectItem value="da">Danish (Dansk)</SelectItem>
                        <SelectItem value="fi">Finnish (Suomi)</SelectItem>
                        <SelectItem value="pl">Polish (Polski)</SelectItem>
                        <SelectItem value="ru">Russian (Русский)</SelectItem>
                        <SelectItem value="ja">Japanese (日本語)</SelectItem>
                        <SelectItem value="zh">Chinese (中文)</SelectItem>
                        <SelectItem value="ko">Korean (한국어)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Coach Name */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">Coach Name</Label>
                    <p className="text-xs text-gray-500">Personalize your AI coach with a custom name</p>
                    <input
                      type="text"
                      value={personalForm.coach_name || 'Coach'}
                      onChange={(e) => setPersonalForm(prev => ({...prev, coach_name: e.target.value}))}
                      placeholder="Coach"
                      className="w-full bg-gray-900 border border-gray-700 text-white placeholder:text-gray-500 px-3 py-2 rounded-lg focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
                    />
                  </div>

                  {/* Coach Avatar Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">Coach Avatar</Label>
                    <p className="text-xs text-gray-500">Upload a custom avatar for your AI coach</p>
                    <div className="flex items-center gap-4">
                      {coachAvatarPreview ? (
                        <img
                          src={coachAvatarPreview}
                          alt="Coach Avatar"
                          className="w-16 h-16 rounded-full object-cover border-2 border-[#32D3FF]"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoachAvatarChange}
                          className="hidden"
                          id="coach-avatar-upload"
                        />
                        <label
                          htmlFor="coach-avatar-upload"
                          className="inline-block px-4 py-2 text-white rounded-lg cursor-pointer transition-colors text-sm"
                          style={{ backgroundColor: '#32D3FF' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                        >
                          {coachAvatarFile ? 'Change Avatar' : 'Upload Avatar'}
                        </label>
                        <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF (max 5MB)</p>
                      </div>
                    </div>
                  </div>

                  {/* Background Image Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">Background Image</Label>
                    <p className="text-xs text-gray-500">Upload a custom background image for all pages (optional)</p>
                    <div className="flex items-center gap-4">
                      {backgroundImagePreview || personalForm.background_image ? (
                        <img
                          src={backgroundImagePreview || personalForm.background_image}
                          alt="Background Preview"
                          className="w-32 h-20 rounded-lg object-cover border-2 border-[#32D3FF]"
                        />
                      ) : (
                        <div className="w-32 h-20 rounded-lg bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                          <span className="text-xs text-gray-400">No image</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBackgroundImageChange}
                          className="hidden"
                          id="background-image-upload"
                        />
                        <label
                          htmlFor="background-image-upload"
                          className="inline-block px-4 py-2 text-white rounded-lg cursor-pointer transition-colors text-sm"
                          style={{ backgroundColor: '#32D3FF' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                        >
                          {backgroundImageFile || personalForm.background_image ? 'Change Background' : 'Upload Background'}
                        </label>
                        {(backgroundImagePreview || personalForm.background_image) && (
                          <button
                            type="button"
                            onClick={() => {
                              setBackgroundImageFile(null);
                              setBackgroundImagePreview('');
                              setPersonalForm(prev => ({...prev, background_image: null}));
                              // Clear from localStorage immediately
                              localStorage.removeItem('app_background_image');
                              // Dispatch event to update Dashboard immediately
                              window.dispatchEvent(new CustomEvent('backgroundImageUpdated', { 
                                detail: { backgroundImage: null } 
                              }));
                            }}
                            className="ml-2 px-4 py-2 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                            style={{ backgroundColor: '#dc2626' }}
                          >
                            Remove
                          </button>
                        )}
                        <p className="text-xs text-gray-500 mt-1">JPG or PNG (max 5MB). Will replace gradient background.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="opacity-10" />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    className="border-gray-600 text-white hover:bg-gray-700"
                    onClick={() => setPersonalForm({
                      ...athlete,
                      distance_unit: athlete?.distance_unit || 'miles',
                      measurement_system: athlete?.measurement_system || 'imperial',
                      week_starts_on: athlete?.week_starts_on || 'monday',
                      timezone: athlete?.timezone || 'UTC',
                      time_format: athlete?.time_format || '12h',
                      date_format: athlete?.date_format || 'MM/DD/YYYY',
                      weight_unit: athlete?.weight_unit || 'lbs',
                      fluid_unit: athlete?.fluid_unit || 'fl oz'
                    })}
                  >
                    Reset
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white font-medium px-6 py-2"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </div>

                {saveStatus.type && (
                  <div className={`p-3 rounded-lg text-sm ${
                    saveStatus.type === 'success' 
                      ? 'bg-blue-900/30 text-blue-400 border border-blue-700' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {saveStatus.message}
                  </div>
                )}
              </form>
            </div>
          </div>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscriptions" className="bg-transparent">
          <div className="space-y-4">
            {/* Current Plan */}
            <div className="p-4 md:p-6" style={{
              background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="flex items-center text-white text-lg md:text-xl font-semibold">
                      <Crown className="w-5 h-5 mr-2 text-[#32D3FF] flex-shrink-0" />
                      <span>Current Plan</span>
                    </h3>
                    <p className="text-gray-400 mt-1 text-sm">
                      Manage your subscription and billing
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-700 self-start sm:self-center"
                    onClick={() => {
                      loadSubscriptionStatus();
                      setSaveStatus({ type: '', message: 'Refreshing...' });
                      setTimeout(() => setSaveStatus({ type: '', message: '' }), 1000);
                    }}
                  >
                    <Repeat className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </div>
              </div>
              <div>
                {subscriptionStatus.status === 'canceling' ? (
                  <div className="p-4 bg-gradient-to-r from-orange-900/30 to-red-900/30 border-2 border-orange-700 rounded-lg mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-2xl font-bold text-white capitalize">
                            {subscriptionStatus.tier} Plan
                          </h3>
                          <Badge variant="destructive">
                            Canceling
                          </Badge>
                        </div>
                        <p className="text-gray-300 font-medium mb-2">
                          ⚠️ Your subscription will end on{' '}
                          {subscriptionStatus.current_period_end 
                            ? new Date(subscriptionStatus.current_period_end).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : 'the end of your billing period'}
                        </p>
                        <p className="text-sm text-gray-400">
                          You can reactivate your subscription anytime before it ends to continue enjoying all features.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-700 to-gray-800 border border-gray-600 rounded-lg mb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-2xl font-bold text-white capitalize">
                          {subscriptionStatus.tier} Plan
                        </h3>
                        <Badge variant={subscriptionStatus.status === 'active' ? 'secondary' : 'destructive'}>
                          {subscriptionStatus.status}
                        </Badge>
                      </div>
                      <p className="text-gray-300 mt-1">
                        {currentPlanDetails ? (
                          <>
                            {subscriptionStatus.tier === 'free' ? (
                              '€0/month • ' + (currentPlanDetails.description || 'Basic features')
                            ) : (
                              <>
                                {(() => {
                                  const variation = currentPlanDetails.variations?.find(v => v.interval === (currentBillingCycle === 'monthly' ? 'month' : 'year'));
                                  return variation ? `€${variation.price}/${variation.interval === 'month' ? 'month' : 'year'}` : '';
                                })()}
                                {' • '}
                                {currentPlanDetails.description || 'Enhanced features'}
                              </>
                            )}
                          </>
                        ) : (
                          subscriptionStatus.tier === 'free' ? '€0/month • Basic features' : 'Loading...'
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Next billing date</p>
                      <p className="font-semibold text-white">
                        {subscriptionStatus.current_period_end 
                          ? new Date(subscriptionStatus.current_period_end).toLocaleDateString() 
                          : '-'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  <h4 className="font-semibold text-white mb-2">Current Features:</h4>
                  {currentPlanDetails && currentPlanDetails.features && currentPlanDetails.features.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {currentPlanDetails.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-300">
                          <Check className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">Loading features...</div>
                  )}
                </div>

                {subscriptionStatus.tier === 'free' ? (
                  <Button className="w-full text-white bg-gradient-to-r from-[#32D3FF] to-[#32D3FF] hover:from-[#1FC1FF] hover:to-[#32D3FF] shadow-lg" onClick={() => navigate('/pricing')}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Upgrade Your Plan
                  </Button>
                ) : subscriptionStatus.status === 'canceling' ? (
                  <Button 
                    className="w-full" 
                    variant="default"
                    onClick={handleReactivate}
                  >
                    <Repeat className="w-4 h-4 mr-2" />
                    Resubscribe
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      className="w-full sm:flex-1 bg-gradient-to-r from-[#32D3FF] to-[#32D3FF] hover:from-[#1FC1FF] hover:to-[#32D3FF] text-white border-none shadow-lg"
                      onClick={() => setShowBillingCycleDialog(true)}
                    >
                      <Repeat className="w-4 h-4 mr-2" />
                      {currentBillingCycle === 'monthly' ? 'Switch to Annual' : 'Switch to Monthly'}
                    </Button>
                    <Button 
                      className="w-full sm:flex-1 bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Available Plans */}
            <Card className="border-0 shadow-lg border-gray-700" style={{background: "transparent"}}>
              <CardHeader>
                <h3 className="text-white">Available Plans</h3>
                <p className="text-gray-400 mt-1">
                  Choose the plan that fits your needs
                </p>
              </CardHeader>
              <CardContent>
                {availablePlans.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">Loading plans...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availablePlans.map((plan) => {
                      const isCurrentPlan = subscriptionStatus.tier === plan.tier;
                      const isFree = plan.tier === 'free';
                      const isPro = plan.tier === 'pro';
                      const monthlyVar = plan.variations?.find(v => v.interval === 'month');
                      const annualVar = plan.variations?.find(v => v.interval === 'year');
                      
                      return (
                        <div 
                          key={plan.tier}
                          className={`border-2 rounded-lg p-4 hover:border-gray-500 transition-colors ${
                            isPro ? 'border-blue-600 hover:border-blue-500' : 'border-gray-600'
                          }`} 
                          style={{ backgroundColor: '#111827' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                              <p className="text-sm text-gray-400">{plan.description || 'No description'}</p>
                            </div>
                            {isPro && <Badge className="bg-blue-600 text-white">Popular</Badge>}
                            {isFree && <Shield className="w-5 h-5 text-gray-400" />}
                          </div>
                          <div className="mb-4">
                            {isFree ? (
                              <div className="flex items-baseline">
                                <span className="text-3xl font-bold text-white">€0</span>
                                <span className="text-gray-400 ml-1">/month</span>
                              </div>
                            ) : monthlyVar ? (
                              <>
                                <div className="flex items-baseline">
                                  <span className="text-3xl font-bold text-white">€{monthlyVar.price}</span>
                                  <span className="text-gray-400 ml-1">/month</span>
                                </div>
                                {annualVar && (
                                  <p className="text-sm text-blue-400 mt-1">
                                    or €{annualVar.price}/year (save {Math.round((1 - (annualVar.price / (monthlyVar.price * 12))) * 100)}%)
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="text-gray-400 text-sm">Contact us for pricing</div>
                            )}
                          </div>
                          <ul className="space-y-2 mb-4">
                            {plan.features && plan.features.length > 0 ? (
                              plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start text-sm text-gray-300">
                                  <Check className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                                  <span>{feature}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-sm text-gray-400 italic">No features listed</li>
                            )}
                          </ul>
                          {isCurrentPlan ? (
                            <Button className="w-full border-gray-600 text-gray-400" variant="outline" disabled>
                              Current Plan
                            </Button>
                          ) : isFree && !isCurrentPlan ? (
                            <Button 
                              className="w-full border-gray-600 text-white hover:bg-gray-700" 
                              variant="outline"
                              onClick={() => setShowCancelDialog(true)}
                            >
                              Downgrade to Free
                            </Button>
                          ) : !isFree && subscriptionStatus.tier === 'free' ? (
                            <Button 
                              className="w-full text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg" 
                              variant="default"
                              onClick={() => {
                                setUpgradeTarget(plan.tier);
                                setSelectedBillingCycle('monthly');
                                setShowUpgradeDialog(true);
                              }}
                            >
                              Upgrade to {plan.name}
                            </Button>
                          ) : (
                            <Button 
                              className="w-full border-gray-600 text-white hover:bg-gray-700" 
                              variant="outline"
                              onClick={() => {
                                setDowngradeTarget(plan.tier);
                                setSelectedBillingCycle('monthly');
                                setShowDowngradeDialog(true);
                              }}
                            >
                              Upgrade/Change Plan
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 p-4 rounded-lg border border-gray-600" style={{ backgroundColor: '#111827' }}>
                  <p className="text-sm text-gray-300 text-center">
                    <strong className="text-white">Secure Payment:</strong> All payments are processed securely through Stripe. 
                    Your payment information is never stored on our servers.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Billing Management */}
            <Card className="border-0 shadow-lg border-gray-700" style={{background: "transparent"}}>
              <CardHeader>
                <h3 className="flex items-center text-white text-xl font-semibold">
                  <CreditCard className="w-5 h-5 mr-2 text-[#32D3FF]" />
                  Billing Management
                </h3>
                <p className="text-gray-400 mt-1">
                  Manage payment methods and view billing history
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border border-gray-600 rounded-lg" style={{ backgroundColor: '#111827' }}>
                    <h4 className="font-semibold text-white mb-2">Payment Method</h4>
                    {subscriptionStatus.tier === 'free' ? (
                      <p className="text-sm text-gray-400">
                        No payment method on file (Free plan)
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2 mb-3">
                          <CreditCard className="w-4 h-4 text-blue-500" />
                          <p className="text-sm text-gray-300">
                            Payment method active • Managed by Stripe
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-white hover:bg-gray-700"
                          onClick={handleManagePaymentMethod}
                          disabled={isLoading}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Manage Payment Method
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="p-4 border border-gray-600 rounded-lg" style={{ backgroundColor: '#111827' }}>
                    <h4 className="font-semibold text-white mb-2">Billing History</h4>
                    {subscriptionStatus.tier === 'free' ? (
                      <p className="text-sm text-gray-400">
                        No invoices yet
                      </p>
                    ) : invoices.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        Loading invoices...
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {invoices.map((invoice) => (
                          <div 
                            key={invoice.id} 
                            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-white">
                                  €{invoice.amount.toFixed(2)}
                                </p>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  invoice.status === 'paid' 
                                    ? 'bg-blue-900/30 text-blue-400' 
                                    : invoice.status === 'open'
                                    ? 'bg-yellow-900/30 text-yellow-400'
                                    : 'bg-red-900/30 text-red-400'
                                }`}>
                                  {invoice.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(invoice.created * 1000).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            <a
                              href={invoice.invoice_pdf || invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#32D3FF] hover:text-[#1FC1FF] text-sm font-medium flex items-center"
                            >
                              Download
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cancel Subscription Dialog */}
          {showCancelDialog && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <Card className="w-full max-w-md mx-4 bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-red-400">Cancel Subscription?</CardTitle>
                  <CardDescription className="text-gray-300">
                    Are you sure you want to cancel your subscription?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <p className="text-sm text-amber-200">
                      <strong>What happens next:</strong>
                    </p>
                    <ul className="text-sm text-amber-100 mt-2 space-y-1 list-disc list-inside">
                      <li>Your subscription will remain active until the end of your billing period</li>
                      <li>You'll be downgraded to the Free plan automatically</li>
                      <li>You won't be charged again</li>
                      <li>You can resubscribe anytime</li>
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                      onClick={() => setShowCancelDialog(false)}
                    >
                      Keep Subscription
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleCancelSubscription}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Upgrade Dialog */}
          {showUpgradeDialog && upgradeTarget && (() => {
            const targetPlan = availablePlans.find(p => p.tier === upgradeTarget);
            if (!targetPlan) return null;
            
            const monthlyVar = targetPlan.variations?.find(v => v.interval === 'month');
            const annualVar = targetPlan.variations?.find(v => v.interval === 'year');
            const selectedPrice = selectedBillingCycle === 'monthly' ? monthlyVar : annualVar;
            const savings = monthlyVar && annualVar ? 
              Math.round((1 - (annualVar.price / (monthlyVar.price * 12))) * 100) : 0;
            
            return (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-lg bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-white text-2xl">Upgrade to {targetPlan.name}?</CardTitle>
                    <CardDescription className="text-gray-300">
                      Choose your billing cycle
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Billing Cycle Toggle */}
                    {monthlyVar && annualVar && (
                      <div className="flex items-center justify-center space-x-4 bg-gray-950 rounded-full p-2">
                        <button
                          onClick={() => setSelectedBillingCycle('monthly')}
                          className={`px-6 py-2 rounded-full font-medium transition-all ${
                            selectedBillingCycle === 'monthly'
                              ? 'bg-[#32D3FF] text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setSelectedBillingCycle('annual')}
                          className={`px-6 py-2 rounded-full font-medium transition-all flex items-center ${
                            selectedBillingCycle === 'annual'
                              ? 'bg-[#32D3FF] text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Annual
                          {savings > 0 && (
                            <Badge variant="default" className="ml-2 bg-[#32D3FF] text-white border-0">
                              Save {savings}%
                            </Badge>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Pricing Display */}
                    {selectedPrice && (
                      <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="text-center">
                          <p className="text-4xl font-bold text-white">
                            €{selectedPrice.price}
                            <span className="text-xl text-gray-400">
                              /{selectedPrice.interval === 'month' ? 'mo' : 'year'}
                            </span>
                          </p>
                          {selectedBillingCycle === 'annual' && monthlyVar && savings > 0 && (
                            <p className="text-sm text-blue-400 mt-2">
                              Save €{((monthlyVar.price * 12) - annualVar.price).toFixed(2)} per year!
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    {targetPlan.features && targetPlan.features.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-400 uppercase">What you'll get:</h4>
                        <ul className="space-y-2">
                          {targetPlan.features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="flex items-start text-sm text-gray-300">
                              <Check className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                        onClick={() => {
                          setShowUpgradeDialog(false);
                          setUpgradeTarget(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1 bg-[#32D3FF] hover:bg-[#1FC1FF] text-white"
                        onClick={handleUpgrade}
                        disabled={!selectedPrice}
                      >
                        Continue to Checkout
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Downgrade Confirmation Dialog */}
          {showDowngradeDialog && downgradeTarget && (() => {
            const targetPlan = availablePlans.find(p => p.tier === downgradeTarget);
            if (!targetPlan) return null;
            
            const monthlyVar = targetPlan.variations?.find(v => v.interval === 'month');
            const annualVar = targetPlan.variations?.find(v => v.interval === 'year');
            const selectedPrice = selectedBillingCycle === 'monthly' ? monthlyVar : annualVar;
            const savings = monthlyVar && annualVar ? 
              Math.round((1 - (annualVar.price / (monthlyVar.price * 12))) * 100) : 0;
            
            return (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-lg bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-white text-2xl">
                      Change Plan to {targetPlan.name}?
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Choose your billing cycle
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Billing Cycle Toggle */}
                    {monthlyVar && annualVar && (
                      <div className="flex items-center justify-center space-x-4 bg-gray-950 rounded-full p-2">
                        <button
                          onClick={() => setSelectedBillingCycle('monthly')}
                          className={`px-6 py-2 rounded-full font-medium transition-all ${
                            selectedBillingCycle === 'monthly'
                              ? 'bg-[#32D3FF] text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setSelectedBillingCycle('annual')}
                          className={`px-6 py-2 rounded-full font-medium transition-all flex items-center ${
                            selectedBillingCycle === 'annual'
                              ? 'bg-[#32D3FF] text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Annual
                          {savings > 0 && (
                            <Badge variant="default" className="ml-2 bg-[#32D3FF] text-white border-0">
                              Save {savings}%
                            </Badge>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Pricing Display */}
                    {selectedPrice && (
                      <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="text-center mb-4">
                          <p className="text-4xl font-bold text-white">
                            €{selectedPrice.price}
                            <span className="text-xl text-gray-400">
                              /{selectedPrice.interval === 'month' ? 'mo' : 'year'}
                            </span>
                          </p>
                          {selectedBillingCycle === 'annual' && monthlyVar && savings > 0 && (
                            <p className="text-sm text-blue-400 mt-2">
                              Save €{((monthlyVar.price * 12) - annualVar.price).toFixed(2)} per year!
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-gray-300 bg-gray-950 rounded-lg p-4">
                          <p className="font-semibold mb-2 text-white">What happens next:</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>Your plan will change immediately</li>
                            <li>You'll receive a prorated credit</li>
                            <li>New billing cycle starts today</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                        onClick={() => {
                          setShowDowngradeDialog(false);
                          setDowngradeTarget(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1 bg-[#32D3FF] hover:bg-[#1FC1FF] text-white"
                        onClick={handleDowngrade}
                        disabled={!selectedPrice}
                      >
                        Confirm Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Billing Cycle Change Dialog */}
          {showBillingCycleDialog && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <Card className="w-full max-w-md mx-4 bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white">
                    Switch to {currentBillingCycle === 'monthly' ? 'Annual' : 'Monthly'} Billing?
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Change your billing cycle
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                    <p className="text-sm text-blue-200 mb-2">
                      <strong>Switching to {currentBillingCycle === 'monthly' ? 'Annual' : 'Monthly'}:</strong>
                    </p>
                    {currentBillingCycle === 'monthly' ? (
                      <>
                        <p className="text-sm text-blue-100 mb-2">
                          Save 17% with annual billing!
                        </p>
                        <ul className="text-sm text-blue-100 space-y-1 list-disc list-inside">
                          <li>{subscriptionStatus.tier === 'pro' ? '€99/year instead of €119.88' : '€199/year instead of €239.88'}</li>
                          <li>You'll be charged the prorated amount today</li>
                          <li>Next billing: 1 year from today</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <ul className="text-sm text-blue-100 space-y-1 list-disc list-inside">
                          <li>Switch to monthly billing</li>
                          <li>You'll receive a prorated credit</li>
                          <li>Next billing: 1 month from today</li>
                          <li>{subscriptionStatus.tier === 'pro' ? '€9.99/month' : '€19.99/month'}</li>
                        </ul>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                      onClick={() => setShowBillingCycleDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="default" 
                      className="flex-1 bg-gray-900 hover:bg-black text-white border-gray-600"
                      onClick={handleChangeBillingCycle}
                    >
                      Confirm Switch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="bg-transparent">
          <div className="space-y-4">

            {/* Third-Party Integrations */}
            <Card className="border-0 shadow-lg border-gray-700" style={{
              background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <CardHeader>
                <h3 className="flex items-center text-white text-xl font-semibold">
                  <Zap className="w-5 h-5 mr-2 text-[#32D3FF]" />
                  Connected Apps
                </h3>
                <p className="text-gray-400 mt-1">
                  Connect your fitness apps and wearables to automatically sync your data
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Strava */}
                <IntegrationCard
                  provider="strava"
                  name="Strava"
                  description="Activities and performance data"
                  icon={<Activity className="w-8 h-8 text-orange-500" />}
                  connected={integrations.strava.connected}
                  connectionInfo={integrations.strava}
                  onConnect={() => handleSimpleConnect('strava')}
                  onDisconnect={() => handleSimpleDisconnect('strava')}
                  t={t}
                />
                
                {/* Oura */}
                <IntegrationCard
                  provider="oura"
                  name="Oura Ring"
                  description="Sleep, recovery, and readiness data"
                  icon={<Heart className="w-8 h-8 text-purple-500" />}
                  connected={integrations.oura.connected}
                  connectionInfo={integrations.oura}
                  onConnect={handleOuraConnect}
                  onDisconnect={() => handleSimpleDisconnect('oura')}
                  t={t}
                />
                
                {/* COROS */}
                <IntegrationCard
                  provider="coros"
                  name="COROS"
                  description="GPS sports watches and training data"
                  icon={<Mountain className="w-8 h-8 text-blue-600" />}
                  connected={integrations.coros.connected}
                  connectionInfo={integrations.coros}
                  onConnect={() => handleSimpleConnect('coros')}
                  onDisconnect={() => handleSimpleDisconnect('coros')}
                  comingSoon={true}
                  t={t}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Logout Section */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <Card className="border-0 shadow-lg border-gray-700" style={{background: "transparent"}}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">
                  {t('account.logoutTitle')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('account.logoutDescription')}
                </p>
              </div>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-red-600 text-white hover:bg-red-600/10 hover:border-red-500 btn-transition w-full md:w-auto bg-gradient-to-r from-red-500 to-red-600"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('auth.logout')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Account;
