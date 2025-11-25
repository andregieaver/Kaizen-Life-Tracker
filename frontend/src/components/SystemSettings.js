import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Settings, 
  Upload, 
  Save, 
  ChevronDown, 
  ChevronUp, 
  User, 
  GripVertical,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  EyeOff,
  Calendar,
  ArrowLeftRight,
  DollarSign,
  Activity,
  Percent,
  Zap,
  MessageSquare,
  Heart,
  UserCheck,
  UserPlus,
  Gift,
  Target,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Download,
  X,
  Cookie,
  RefreshCw,
  Shield
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { logger } from '../utils/logger';

// Custom hooks
import {
  useModuleSettings,
  useWaitingList,
  useCookieSettings,
  useCouponManagement,
  useSubscriptionStats,
  usePlanSettings,
  useAdvancedSettings
} from '../hooks/systemSettings';

// Tab components
import {
  ModulesTab,
  WaitingListTab,
  CookiesTab,
  CouponsTab,
  StatisticsTab,
  PlansTab,
  AdvancedTab
} from './systemSettings/tabs';
import {
  Line as ChartLine
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SystemSettings = ({ athleteId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize active tab from localStorage, URL hash, or default to 'modules'
  const [activeTab, setActiveTab] = useState(() => {
    // First try localStorage
    const savedTab = localStorage.getItem('systemSettings_activeTab');
    logger.debug(null, '🔍 Loading tab from localStorage:', savedTab);
    if (savedTab && ['modules', 'plans', 'coupons', 'waitinglist', 'statistics', 'cookies', 'advanced'].includes(savedTab)) {
      // Also update hash to match
      window.location.hash = savedTab;
      return savedTab;
    }
    // Then try URL hash
    const hash = location.hash.replace('#', '');
    logger.debug(null, '🔍 Loading tab from hash:', hash);
    if (['modules', 'plans', 'coupons', 'waitinglist', 'statistics', 'cookies', 'advanced'].includes(hash)) {
      return hash;
    }
    // Default to 'modules'
    logger.debug(null, '🔍 Using default tab: modules');
    return 'modules';
  });
  const [loading, setLoading] = useState(true);
  
  // Initialize all custom hooks
  const moduleHook = useModuleSettings(athleteId);
  const planHook = usePlanSettings(athleteId);
  const couponHook = useCouponManagement(athleteId);
  const waitingListHook = useWaitingList(athleteId);
  const cookieHook = useCookieSettings(athleteId);
  const statsHook = useSubscriptionStats(athleteId);
  const advancedHook = useAdvancedSettings(athleteId);
  
  // SEO State
  const [seoSettings, setSeoSettings] = useState({
    siteTitle: '',
    favicon: null,
    metaTitle: '',
    metaDescription: '',
    focusKeyword: ''
  });
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });

  // Advanced Settings State
  const [advancedSettings, setAdvancedSettings] = useState({
    seo: {
      siteTitle: '',
      metaDescription: '',
      faviconUrl: '',
      logoUrl: '',
      ogImage: ''
    },
    openaiApiKey: '',
    showKey: false,
    stripe: {
      mode: 'test', // 'test' or 'live'
      live: {
        publishableKey: '',
        apiKey: '',
        webhookSecret: ''
      },
      sandbox: {
        publishableKey: '',
        apiKey: '',
        webhookSecret: ''
      }
    },
    showStripeLiveKey: false,
    showStripeLiveWebhook: false,
    showStripeSandboxKey: false,
    showStripeSandboxWebhook: false,
    sendgrid: {
      apiKey: '',
      senderEmail: '',
      senderName: ''
    },
    showSendgridKey: false,
    googleTagManager: {
      headCode: '',
      bodyCode: ''
    },
    microsoftClarity: {
      scriptCode: ''
    },
    strava: {
      clientId: '',
      clientSecret: '',
      webhookVerifyToken: '',
      callbackDomain: ''
    },
    showStravaSecret: false,
    showStravaVerifyToken: false
  });

  // Modules State
  const [moduleSettings, setModuleSettings] = useState({
    affiliateProgram: {
      enabled: true,
      expanded: true
    },
    community: {
      enabled: true,
      expanded: true
    }
  });

  // Plan Settings State
  const [planSettings, setPlanSettings] = useState({
    free: {
      title: 'Free',
      description: 'Get started with basic features',
      features: ['Basic training plans', '30-day history', 'Community access']
    },
    pro: {
      title: 'Pro',
      description: 'Advanced features for serious runners',
      features: ['Everything in Free', 'Unlimited history', 'AI coach chat', 'Advanced analytics']
    },
    premium: {
      title: 'Premium',
      description: 'Complete running coaching experience',
      features: ['Everything in Pro', 'Custom training plans', 'Nutrition guidance', 'Priority support']
    }
  });

  // Statistics State
  const [subscriberStats, setSubscriberStats] = useState({
    total_subscribers: 0,
    paid_subscribers: 0,
    free_subscribers: 0,
    pro_subscribers: 0,
    premium_subscribers: 0,
    growth_count: 0,
    growth_percentage: 0,
    time_series: [],
    period: "90d",
    comparison: null
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("90d");
  const [compareEnabled, setCompareEnabled] = useState(false);
  
  // Coupon management state
  const [coupons, setCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [showDisabledCoupons, setShowDisabledCoupons] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    name: '',
    type: 'percentage',
    value: '',
    max_uses: '',
    expires_at: '',
    applies_to: 'all',
    specific_plans: [],
    min_purchase_amount: ''
  });

  // Available plans for coupon selection
  const availablePlans = [
    { id: 'pro_monthly', name: 'Pro Monthly' },
    { id: 'pro_annual', name: 'Pro Annual' },
    { id: 'premium_monthly', name: 'Premium Monthly' },
    { id: 'premium_annual', name: 'Premium Annual' }
  ];

  // Subscription plan management state
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [showCreateVariationModal, setShowCreateVariationModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Waiting list state
  const [waitingListEntries, setWaitingListEntries] = useState([]);
  const [loadingWaitingList, setLoadingWaitingList] = useState(false);
  const [waitingListFilter, setWaitingListFilter] = useState('all');
  const [newPlan, setNewPlan] = useState({
    tier: '',
    name: '',
    description: '',
    features: [],
    sort_order: 0
  });
  const [editingPlan, setEditingPlan] = useState({
    tier: '',
    name: '',
    description: '',
    features: [],
    sort_order: 0
  });

  // Cookie Management State
  const [cookieSettings, setCookieSettings] = useState({
    enabled: false,
    consent_mode: 'gtm',
    auto_scan_enabled: true,
    auto_scan_frequency: 'weekly',
    last_scan: null,
    detected_cookies: [],
    consent_texts: {
      banner_title: 'We value your privacy',
      banner_description: 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking \'Accept All\', you consent to our use of cookies.',
      accept_all_button: 'Accept All',
      reject_all_button: 'Reject All',
      customize_button: 'Customize',
      save_preferences_button: 'Save Preferences',
      cookie_policy_link: '/cookie-policy',
      cookie_policy_text: 'Cookie Policy',
      necessary_title: 'Necessary Cookies',
      necessary_description: 'These cookies are essential for the website to function properly.',
      analytics_title: 'Analytics Cookies',
      analytics_description: 'These cookies help us understand how visitors interact with our website.',
      marketing_title: 'Marketing Cookies',
      marketing_description: 'These cookies are used to track visitors across websites for advertising purposes.',
      functional_title: 'Functional Cookies',
      functional_description: 'These cookies enable enhanced functionality and personalization.'
    },
    gtm_integration: {
      enabled: true,
      container_id: ''
    }
  });
  const [loadingCookieSettings, setLoadingCookieSettings] = useState(false);
  const [scanningCookies, setScanningCookies] = useState(false);

  const [newFeature, setNewFeature] = useState('');
  const [newVariation, setNewVariation] = useState({
    plan_id: '',
    name: '',
    price: '',
    interval: 'month',
    interval_count: 1
  });

  // Load settings on mount
  // Initialize all hooks on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setLoading(true);
        
        // Load settings for all tabs
        await Promise.all([
          moduleHook.loadModuleSettings(),
          planHook.loadPlanSettings(),
          advancedHook.loadAdvancedSettings()
        ]);
        
      } catch (error) {
        logger.error(null, 'Error initializing system settings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeSettings();
  }, [athleteId]);

  // Load data when specific tabs become active
  useEffect(() => {
    if (activeTab === 'coupons') {
      couponHook.loadCoupons();
    } else if (activeTab === 'plans') {
      planHook.loadPlans();
    } else if (activeTab === 'waitinglist') {
      waitingListHook.loadWaitingList();
    } else if (activeTab === 'cookies') {
      cookieHook.loadCookieSettings();
    } else if (activeTab === 'statistics') {
      statsHook.loadSubscriberStats();
    }
  }, [activeTab]);

  const loadSubscriberStats = async (period = selectedPeriod, compare = compareEnabled) => {
    setLoadingStats(true);
    try {
      const response = await axios.get(`${API}/system/subscriber-stats`, {
        params: { 
          athlete_id: athleteId,
          period: period,
          compare: compare
        }
      });
      setSubscriberStats(response.data);
    } catch (error) {
      logger.error(null, 'Error loading subscriber stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriod(newPeriod);
    loadSubscriberStats(newPeriod, compareEnabled);
  };

  const handleCompareToggle = () => {
    const newCompareValue = !compareEnabled;
    setCompareEnabled(newCompareValue);
    loadSubscriberStats(selectedPeriod, newCompareValue);
  };

  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/system/settings?athlete_id=${athleteId}`);
      
      // Load module settings
      if (response.data.modules) {
        setModuleSettings(response.data.modules);
      }
      
      // Load SEO settings
      if (response.data.seo) {
        setSeoSettings({
          siteTitle: response.data.seo.siteTitle || '',
          favicon: null,
          metaTitle: response.data.seo.metaTitle || '',
          metaDescription: response.data.seo.metaDescription || '',
          focusKeyword: response.data.seo.focusKeyword || ''
        });
        
        if (response.data.seo.faviconUrl) {
          setFaviconPreview(response.data.seo.faviconUrl);
        }
        
        // Apply SEO settings on load
        applySeoSettings(response.data.seo);
      }
      
      // Load plan settings
      if (response.data.plans) {
        setPlanSettings(response.data.plans);
      }
      
      // Load advanced settings (SEO, OpenAI key, Stripe, SendGrid, and GTM)
      if (response.data.advanced) {
        setAdvancedSettings(prev => ({
          ...prev,
          seo: {
            siteTitle: response.data.advanced.seo?.siteTitle || '',
            metaDescription: response.data.advanced.seo?.metaDescription || '',
            faviconUrl: response.data.advanced.seo?.faviconUrl || '',
            logoUrl: response.data.advanced.seo?.logoUrl || '',
            ogImage: response.data.advanced.seo?.ogImage || ''
          },
          openaiApiKey: response.data.advanced.openaiApiKey || '',
          showKey: false,
          stripe: {
            mode: response.data.advanced.stripe?.mode || 'test',
            live: {
              publishableKey: response.data.advanced.stripe?.live?.publishableKey || '',
              apiKey: response.data.advanced.stripe?.live?.apiKey || '',
              webhookSecret: response.data.advanced.stripe?.live?.webhookSecret || ''
            },
            sandbox: {
              publishableKey: response.data.advanced.stripe?.sandbox?.publishableKey || '',
              apiKey: response.data.advanced.stripe?.sandbox?.apiKey || '',
              webhookSecret: response.data.advanced.stripe?.sandbox?.webhookSecret || ''
            }
          },
          showStripeLiveKey: false,
          showStripeLiveWebhook: false,
          showStripeSandboxKey: false,
          showStripeSandboxWebhook: false,
          sendgrid: {
            apiKey: response.data.advanced.sendgrid?.apiKey || '',
            senderEmail: response.data.advanced.sendgrid?.senderEmail || '',
            senderName: response.data.advanced.sendgrid?.senderName || ''
          },
          showSendgridKey: false,
          googleTagManager: {
            headCode: response.data.advanced.googleTagManager?.headCode || '',
            bodyCode: response.data.advanced.googleTagManager?.bodyCode || ''
          },
          microsoftClarity: {
            scriptCode: response.data.advanced.microsoftClarity?.scriptCode || ''
          },
          strava: {
            clientId: response.data.advanced.strava?.clientId || '',
            clientSecret: response.data.advanced.strava?.clientSecret || '',
            webhookVerifyToken: response.data.advanced.strava?.webhookVerifyToken || '',
            callbackDomain: response.data.advanced.strava?.callbackDomain || ''
          },
          oura: {
            clientId: response.data.advanced.oura?.clientId || '',
            clientSecret: response.data.advanced.oura?.clientSecret || '',
            callbackDomain: response.data.advanced.oura?.callbackDomain || ''
          },
          polar: {
            clientId: response.data.advanced.polar?.clientId || '',
            clientSecret: response.data.advanced.polar?.clientSecret || '',
            callbackDomain: response.data.advanced.polar?.callbackDomain || ''
          },
          fitbit: {
            clientId: response.data.advanced.fitbit?.clientId || '',
            clientSecret: response.data.advanced.fitbit?.clientSecret || '',
            callbackDomain: response.data.advanced.fitbit?.callbackDomain || ''
          },
          garmin: {
            clientId: response.data.advanced.garmin?.clientId || '',
            clientSecret: response.data.advanced.garmin?.clientSecret || '',
            callbackDomain: response.data.advanced.garmin?.callbackDomain || ''
          },
          coros: {
            clientId: response.data.advanced.coros?.clientId || '',
            clientSecret: response.data.advanced.coros?.clientSecret || '',
            callbackDomain: response.data.advanced.coros?.callbackDomain || ''
          },
          whoop: {
            clientId: response.data.advanced.whoop?.clientId || '',
            clientSecret: response.data.advanced.whoop?.clientSecret || '',
            callbackDomain: response.data.advanced.whoop?.callbackDomain || ''
          },
          suunto: {
            clientId: response.data.advanced.suunto?.clientId || '',
            clientSecret: response.data.advanced.suunto?.clientSecret || '',
            callbackDomain: response.data.advanced.suunto?.callbackDomain || ''
          },
          showStravaSecret: false,
          showStravaVerifyToken: false,
          showOuraSecret: false,
          showPolarSecret: false,
          showFitbitSecret: false,
          showGarminSecret: false,
          showCorosSecret: false,
          showWhoopSecret: false,
          showSuuntoSecret: false
        }));
      }
      
      setLoading(false);
    } catch (error) {
      logger.error(null, 'Error loading system settings:', error);
      setLoading(false);
    }
  };

  // Coupon Management Functions
  const loadCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const response = await axios.get(`${API}/coupons`, {
        params: { 
          athlete_id: athleteId,
          include_disabled: showDisabledCoupons
        }
      });
      setCoupons(response.data.coupons || []);
    } catch (error) {
      logger.error(null, 'Error loading coupons:', error);
      alert('Failed to load coupons');
    } finally {
      setLoadingCoupons(false);
    }
  };

  const createCoupon = async () => {
    try {
      // Validate required fields
      if (!newCoupon.code || !newCoupon.name || !newCoupon.value) {
        alert('Please fill in all required fields');
        return;
      }

      // Validate value based on type
      const value = parseFloat(newCoupon.value);
      if (isNaN(value) || value <= 0) {
        alert('Please enter a valid discount value');
        return;
      }

      if (newCoupon.type === 'percentage' && (value < 0 || value > 100)) {
        alert('Percentage must be between 0 and 100');
        return;
      }

      const couponData = {
        code: newCoupon.code.toUpperCase().trim(),
        name: newCoupon.name,
        type: newCoupon.type,
        value: value,
        applies_to: newCoupon.applies_to,
        enabled: true
      };

      // Add optional fields if provided
      if (newCoupon.max_uses) {
        couponData.max_uses = parseInt(newCoupon.max_uses);
      }
      if (newCoupon.expires_at) {
        couponData.expires_at = new Date(newCoupon.expires_at).toISOString();
      }
      if (newCoupon.min_purchase_amount) {
        couponData.min_purchase_amount = parseFloat(newCoupon.min_purchase_amount);
      }
      if (newCoupon.specific_plans && newCoupon.specific_plans.length > 0) {
        couponData.specific_plans = newCoupon.specific_plans;
      }

      await axios.post(`${API}/coupons?athlete_id=${athleteId}`, couponData);
      
      alert('Coupon created successfully!');
      
      // Reset form
      setNewCoupon({
        code: '',
        name: '',
        type: 'percentage',
        value: '',
        max_uses: '',
        expires_at: '',
        applies_to: 'all',
        specific_plans: [],
        min_purchase_amount: ''
      });
      
      // Reload coupons
      loadCoupons();
    } catch (error) {
      logger.error(null, 'Error creating coupon:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create coupon';
      alert(errorMessage);
    }
  };

  const toggleCoupon = async (code, currentlyEnabled) => {
    try {
      await axios.put(
        `${API}/coupons/${code}?athlete_id=${athleteId}`,
        { enabled: !currentlyEnabled }
      );
      loadCoupons();
    } catch (error) {
      logger.error(null, 'Error toggling coupon:', error);
      alert('Failed to update coupon status');
    }
  };

  const deleteCoupon = async (code) => {
    if (!window.confirm(`Are you sure you want to delete coupon ${code}?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/coupons/${code}?athlete_id=${athleteId}`);
      alert('Coupon deleted successfully');
      loadCoupons();
    } catch (error) {
      logger.error(null, 'Error deleting coupon:', error);
      alert('Failed to delete coupon');
    }
  };

  // Load coupons when tab is active
  useEffect(() => {
    if (activeTab === 'coupons') {
      loadCoupons();
    }
  }, [activeTab, showDisabledCoupons]);

  // Load subscription plans when plans tab is active
  useEffect(() => {
    if (activeTab === 'plans') {
      loadSubscriptionPlans();
    }
  }, [activeTab]);

  // Load waiting list when waitinglist tab is active
  useEffect(() => {
    if (activeTab === 'waitinglist') {
      loadWaitingList();
    }
  }, [activeTab, waitingListFilter]);


  // Load cookie settings when cookies tab is active
  useEffect(() => {
    if (activeTab === 'cookies') {
      loadCookieSettings();
    }
  }, [activeTab]);


  // Subscription Plan Management Functions
  const loadSubscriptionPlans = async () => {
    setLoadingPlans(true);
    try {
      const response = await axios.get(`${API}/subscription-plans`, {
        params: { athlete_id: athleteId }
      });
      setSubscriptionPlans(response.data.plans || []);
    } catch (error) {
      logger.error(null, 'Error loading subscription plans:', error);
      alert('Failed to load subscription plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  const createPlan = async () => {
    try {
      if (!newPlan.tier || !newPlan.name) {
        alert('Please fill in tier and name');
        return;
      }

      await axios.post(`${API}/subscription-plans?athlete_id=${athleteId}`, newPlan);
      
      alert('Plan created successfully!');
      setShowCreatePlanModal(false);
      setNewPlan({
        tier: '',
        name: '',
        description: '',
        features: [],
        sort_order: 0
      });
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error creating plan:', error);
      alert(error.response?.data?.detail || 'Failed to create plan');
    }
  };

  const updatePlan = async (tier, updates) => {
    try {
      logger.debug(null, 'Updating plan:', tier, 'with updates:', updates);
      await axios.put(`${API}/subscription-plans/${tier}?athlete_id=${athleteId}`, updates);
      alert('Plan updated successfully');
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error updating plan:', error);
      alert('Failed to update plan');
    }
  };

  const deletePlan = async (tier) => {
    if (!window.confirm(`Are you sure you want to delete the ${tier} plan? This will also delete all its variations.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/subscription-plans/${tier}?athlete_id=${athleteId}`);
      alert('Plan deleted successfully');
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error deleting plan:', error);
      alert('Failed to delete plan');
    }
  };

  const createVariation = async () => {
    try {
      if (!newVariation.plan_id || !newVariation.name || !newVariation.price) {
        alert('Please fill in all required fields');
        return;
      }

      const price = parseFloat(newVariation.price);
      if (isNaN(price) || price <= 0) {
        alert('Please enter a valid price');
        return;
      }

      await axios.post(
        `${API}/subscription-plans/${selectedPlan.tier}/variations?athlete_id=${athleteId}`,
        {
          ...newVariation,
          price: price
        }
      );
      
      alert('Variation created successfully!');
      setShowCreateVariationModal(false);
      setNewVariation({
        plan_id: '',
        name: '',
        price: '',
        interval: 'month',
        interval_count: 1
      });
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error creating variation:', error);
      alert(error.response?.data?.detail || 'Failed to create variation');
    }
  };

  const updateVariation = async (planId, updates) => {
    try {
      await axios.put(
        `${API}/subscription-plans/variations/${planId}?athlete_id=${athleteId}`,
        updates
      );
      alert('Variation updated successfully');
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error updating variation:', error);
      alert('Failed to update variation');
    }
  };

  const deleteVariation = async (planId) => {
    if (!window.confirm(`Are you sure you want to delete this pricing variation?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/subscription-plans/variations/${planId}?athlete_id=${athleteId}`);
      alert('Variation deleted successfully');
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error deleting variation:', error);
      alert('Failed to delete variation');
    }
  };

  const quickSetupPlans = async () => {
    if (!window.confirm('This will create the standard 3-tier structure:\n\n✅ Free (no pricing)\n✅ Pro (Monthly $29.99 + Annual $299.99)\n✅ Premium (Monthly $99.99 + Annual $999.99)\n\nEach plan includes a features list you can edit.\n\nContinue?')) {
      return;
    }
    
    setLoadingPlans(true);
    try {
      const response = await axios.post(
        `${API}/subscription-plans/quick-setup?athlete_id=${athleteId}`
      );
      
      alert(`Quick setup completed!\n\nCreated plans: ${response.data.created_plans.join(', ')}\nCreated variations: ${response.data.created_variations.join(', ')}\n\nYou can now edit features, prices, and add more variations.`);
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error in quick setup:', error);
      alert(error.response?.data?.detail || 'Failed to complete quick setup');
    } finally {
      setLoadingPlans(false);
    }
  };

  const syncWithStripe = async () => {
    if (!window.confirm('This will fetch all products and prices from Stripe and sync them to your database. Existing plans will be updated. Continue?')) {
      return;
    }
    
    setLoadingPlans(true);
    try {
      const response = await axios.post(
        `${API}/subscription-plans/sync-stripe?athlete_id=${athleteId}`
      );
      
      const stats = response.data.stats;
      let message = 'Stripe sync completed!\n\n';
      message += `Products: ${stats.products_synced} synced (${stats.products_created} created, ${stats.products_updated} updated)\n`;
      message += `Prices: ${stats.prices_synced} synced (${stats.prices_created} created, ${stats.prices_updated} updated)`;
      
      if (stats.errors && stats.errors.length > 0) {
        message += `\n\nErrors:\n${stats.errors.join('\n')}`;
      }
      
      alert(message);
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error syncing with Stripe:', error);
      alert(error.response?.data?.detail || 'Failed to sync with Stripe');
    } finally {
      setLoadingPlans(false);
    }
  };

  const syncToStripe = async () => {
    if (!window.confirm('This will create Stripe products and prices based on your local plans. Any plans without Stripe IDs will be pushed to Stripe. Continue?')) {
      return;
    }
    
    setLoadingPlans(true);
    try {
      const response = await axios.post(
        `${API}/subscription-plans/push-to-stripe?athlete_id=${athleteId}`
      );
      
      const stats = response.data.stats;
      let message = 'Sync to Stripe completed!\n\n';
      message += `Products Created: ${stats.products_created}\n`;
      message += `Prices Created: ${stats.prices_created}\n`;
      message += `Plans Updated: ${stats.plans_updated}`;
      
      if (stats.errors && stats.errors.length > 0) {
        message += `\n\n⚠️ WARNINGS:\n${stats.errors.join('\n')}`;
        message += t('systemSettings.plans.pricingVariationsInstructions');
      }
      
      alert(message);
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error syncing to Stripe:', error);
      alert(error.response?.data?.detail || t('systemSettings.messages.syncError'));
    } finally {
      setLoadingPlans(false);
    }
  };

  const resetStripeIds = async () => {
    if (!window.confirm(t('systemSettings.plans.resetStripeWarning'))) {
      return;
    }
    
    setLoadingPlans(true);
    try {
      const response = await axios.post(
        `${API}/subscription-plans/reset-stripe-ids?athlete_id=${athleteId}`
      );
      
      alert(`Reset complete!\n\n${response.data.message}\nPlans affected: ${response.data.plans_updated}`);
      loadSubscriptionPlans();
    } catch (error) {
      logger.error(null, 'Error resetting Stripe IDs:', error);
      alert(error.response?.data?.detail || 'Failed to reset Stripe IDs');
    } finally {
      setLoadingPlans(false);
    }
  };

  // Waiting List Functions
  const loadWaitingList = async () => {
    setLoadingWaitingList(true);
    try {
      const statusParam = waitingListFilter !== 'all' ? `&status=${waitingListFilter}` : '';
      const response = await axios.get(`${API}/waiting-list?athlete_id=${athleteId}${statusParam}`);
      setWaitingListEntries(response.data.entries || []);
    } catch (error) {
      logger.error(null, 'Error loading waiting list:', error);
      alert('Failed to load waiting list');
    } finally {
      setLoadingWaitingList(false);
    }
  };

  const exportWaitingListCSV = async () => {
    try {
      const statusParam = waitingListFilter !== 'all' ? `?status=${waitingListFilter}&` : '?';
      const response = await axios.get(
        `${API}/waiting-list/export${statusParam}athlete_id=${athleteId}`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `waiting-list-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      logger.error(null, 'Error exporting waiting list:', error);
      alert('Failed to export waiting list');
    }
  };

  const updateWaitingListStatus = async (entryId, newStatus) => {
    try {
      await axios.put(
        `${API}/waiting-list/${entryId}?athlete_id=${athleteId}`,
        { status: newStatus }
      );
      loadWaitingList();
    } catch (error) {
      logger.error(null, 'Error updating entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteWaitingListEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/waiting-list/${entryId}?athlete_id=${athleteId}`);
      loadWaitingList();
    } catch (error) {
      logger.error(null, 'Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  const handleTabChange = (value) => {
    logger.debug(null, '📝 Saving tab to localStorage:', value);
    setActiveTab(value);
    // Update URL hash and localStorage immediately
    window.location.hash = value;
    localStorage.setItem('systemSettings_activeTab', value);
  };

  const handleSeoChange = (field, value) => {
    setSeoSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFaviconUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSeoSettings(prev => ({
        ...prev,
        favicon: file
      }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaviconPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSeoSettings = async (e) => {
    e.preventDefault();
    
    try {
      // Upload favicon if present
      let faviconUrl = seoSettings.favicon ? faviconPreview : null;
      
      if (seoSettings.favicon && seoSettings.favicon instanceof File) {
        // For now, store as base64 data URL
        // In production, you'd upload to a file storage service
        faviconUrl = faviconPreview;
      }
      
      // Save SEO settings to backend
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        seo: {
          siteTitle: seoSettings.siteTitle,
          metaTitle: seoSettings.metaTitle,
          metaDescription: seoSettings.metaDescription,
          focusKeyword: seoSettings.focusKeyword,
          faviconUrl: faviconUrl
        }
      });
      
      setSaveStatus({
        message: 'SEO settings saved successfully!',
        type: 'success'
      });
      
      // Apply SEO changes immediately
      applySeoSettings({
        siteTitle: seoSettings.siteTitle,
        metaTitle: seoSettings.metaTitle,
        metaDescription: seoSettings.metaDescription,
        faviconUrl: faviconUrl
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error saving SEO settings:', error);
      setSaveStatus({
        message: 'Failed to save SEO settings',
        type: 'error'
      });
    }
  };

  const applySeoSettings = (seoData) => {
    // Update document title
    if (seoData.siteTitle) {
      document.title = seoData.siteTitle;
    }
    
    // Update meta title
    let metaTitleTag = document.querySelector('meta[property="og:title"]');
    if (!metaTitleTag) {
      metaTitleTag = document.createElement('meta');
      metaTitleTag.setAttribute('property', 'og:title');
      document.head.appendChild(metaTitleTag);
    }
    metaTitleTag.setAttribute('content', seoData.metaTitle || seoData.siteTitle || '');
    
    // Update meta description
    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.setAttribute('name', 'description');
      document.head.appendChild(metaDescTag);
    }
    metaDescTag.setAttribute('content', seoData.metaDescription || '');
    
    // Update OG description
    let ogDescTag = document.querySelector('meta[property="og:description"]');
    if (!ogDescTag) {
      ogDescTag = document.createElement('meta');
      ogDescTag.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescTag);
    }
    ogDescTag.setAttribute('content', seoData.metaDescription || '');
    
    // Update favicon
    if (seoData.faviconUrl) {
      let faviconLink = document.querySelector('link[rel="icon"]');
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.setAttribute('rel', 'icon');
        document.head.appendChild(faviconLink);
      }
      faviconLink.setAttribute('href', seoData.faviconUrl);
    }
  };

  const toggleModule = (moduleName) => {
    setModuleSettings(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        enabled: !prev[moduleName].enabled,
        expanded: !prev[moduleName].enabled // Auto-expand when enabling, collapse when disabling
      }
    }));
    
    // TODO: Save to backend and update global state
    // This will control icon visibility in Dashboard header
  };

  const toggleModuleExpansion = (moduleName) => {
    setModuleSettings(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        expanded: !prev[moduleName].expanded
      }
    }));
  };

  const handleSaveModuleSettings = async () => {
    try {
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        modules: moduleSettings
      });
      
      setSaveStatus({
        message: 'Module settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error saving module settings:', error);
      setSaveStatus({
        message: 'Failed to save module settings',
        type: 'error'
      });
    }
  };

  const handlePlanChange = (planType, field, value) => {
    setPlanSettings(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        [field]: value
      }
    }));
  };

  const handleAddFeature = (planType) => {
    setPlanSettings(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        features: [...prev[planType].features, '']
      }
    }));
  };

  const handleRemoveFeature = (planType, index) => {
    setPlanSettings(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        features: prev[planType].features.filter((_, i) => i !== index)
      }
    }));
  };

  const handleFeatureChange = (planType, index, value) => {
    setPlanSettings(prev => {
      const newFeatures = [...prev[planType].features];
      newFeatures[index] = value;
      return {
        ...prev,
        [planType]: {
          ...prev[planType],
          features: newFeatures
        }
      };
    });
  };

  // Drag handlers for feature reordering
  const handleFeatureDragStart = (e, planType, index) => {
    setDraggedFeature({ plan: planType, index });
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image to prevent default ghost image horizontal movement
    const dragImg = e.target.cloneNode(true);
    dragImg.style.opacity = '0';
    document.body.appendChild(dragImg);
    e.dataTransfer.setDragImage(dragImg, 0, 0);
    setTimeout(() => document.body.removeChild(dragImg), 0);
  };

  const handleFeatureDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFeatureDrop = (e, planType, dropIndex) => {
    e.preventDefault();
    
    const { plan: dragPlan, index: dragIndex } = draggedFeature;
    
    // Only allow reordering within the same plan
    if (dragPlan !== planType || dragIndex === null || dragIndex === dropIndex) {
      setDraggedFeature({ plan: null, index: null });
      return;
    }

    setPlanSettings(prev => {
      const features = [...prev[planType].features];
      const [draggedItem] = features.splice(dragIndex, 1);
      features.splice(dropIndex, 0, draggedItem);
      
      return {
        ...prev,
        [planType]: {
          ...prev[planType],
          features
        }
      };
    });
    
    setDraggedFeature({ plan: null, index: null });
  };

  const handleFeatureDragEnd = () => {
    setDraggedFeature({ plan: null, index: null });
  };

  const handleSavePlanSettings = async () => {
    try {
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        plans: planSettings
      });
      
      setSaveStatus({
        message: 'Plan settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error saving plan settings:', error);
      setSaveStatus({
        message: 'Failed to save plan settings',
        type: 'error'
      });
    }
  };

  const handleSaveAdvancedSettings = async () => {
    try {
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        advanced: {
          seo: {
            siteTitle: advancedSettings.seo.siteTitle,
            metaDescription: advancedSettings.seo.metaDescription,
            faviconUrl: advancedSettings.seo.faviconUrl,
            logoUrl: advancedSettings.seo.logoUrl,
            ogImage: advancedSettings.seo.ogImage
          },
          openaiApiKey: advancedSettings.openaiApiKey,
          stripe: {
            mode: advancedSettings.stripe.mode,
            live: {
              publishableKey: advancedSettings.stripe.live.publishableKey,
              apiKey: advancedSettings.stripe.live.apiKey,
              webhookSecret: advancedSettings.stripe.live.webhookSecret
            },
            sandbox: {
              publishableKey: advancedSettings.stripe.sandbox.publishableKey,
              apiKey: advancedSettings.stripe.sandbox.apiKey,
              webhookSecret: advancedSettings.stripe.sandbox.webhookSecret
            }
          },
          sendgrid: {
            apiKey: advancedSettings.sendgrid.apiKey,
            senderEmail: advancedSettings.sendgrid.senderEmail,
            senderName: advancedSettings.sendgrid.senderName
          },
          googleTagManager: {
            headCode: advancedSettings.googleTagManager.headCode,
            bodyCode: advancedSettings.googleTagManager.bodyCode
          },
          microsoftClarity: {
            scriptCode: advancedSettings.microsoftClarity.scriptCode
          },
          strava: {
            clientId: advancedSettings.strava.clientId,
            clientSecret: advancedSettings.strava.clientSecret,
            webhookVerifyToken: advancedSettings.strava.webhookVerifyToken,
            callbackDomain: advancedSettings.strava.callbackDomain
          },
          oura: {
            clientId: advancedSettings.oura.clientId,
            clientSecret: advancedSettings.oura.clientSecret,
            callbackDomain: advancedSettings.oura.callbackDomain
          },
          polar: {
            clientId: advancedSettings.polar.clientId,
            clientSecret: advancedSettings.polar.clientSecret,
            callbackDomain: advancedSettings.polar.callbackDomain
          },
          fitbit: {
            clientId: advancedSettings.fitbit.clientId,
            clientSecret: advancedSettings.fitbit.clientSecret,
            callbackDomain: advancedSettings.fitbit.callbackDomain
          },
          garmin: {
            clientId: advancedSettings.garmin.clientId,
            clientSecret: advancedSettings.garmin.clientSecret,
            callbackDomain: advancedSettings.garmin.callbackDomain
          },
          coros: {
            clientId: advancedSettings.coros.clientId,
            clientSecret: advancedSettings.coros.clientSecret,
            callbackDomain: advancedSettings.coros.callbackDomain
          },
          whoop: {
            clientId: advancedSettings.whoop.clientId,
            clientSecret: advancedSettings.whoop.clientSecret,
            callbackDomain: advancedSettings.whoop.callbackDomain
          },
          suunto: {
            clientId: advancedSettings.suunto.clientId,
            clientSecret: advancedSettings.suunto.clientSecret,
            callbackDomain: advancedSettings.suunto.callbackDomain
          }
        }
      });
      
      setSaveStatus({
        message: 'Advanced settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error saving advanced settings:', error);
      setSaveStatus({
        message: 'Failed to save advanced settings',
        type: 'error'
      });
    }
  };


  // Cookie Management Handlers
  const handleScanCookies = async () => {
    try {
      setScanningCookies(true);
      logger.debug(null, '🍪 Scanning for cookies...');
      
      const response = await axios.post(`${API}/cookies/scan?athlete_id=${athleteId}`);
      
      logger.debug(null, '🍪 Cookie scan result:', response.data);
      
      // Update cookie settings with scan results
      setCookieSettings(prev => ({
        ...prev,
        last_scan: {
          scan_id: response.data.scan_id,
          scanned_at: response.data.scanned_at,
          cookies: response.data.cookies
        },
        detected_cookies: response.data.cookies
      }));
      
      setSaveStatus({
        message: `Cookie scan completed! Found ${response.data.total_count} cookies.`,
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error scanning cookies:', error);
      setSaveStatus({
        message: 'Failed to scan cookies',
        type: 'error'
      });
    } finally {
      setScanningCookies(false);
    }
  };

  const handleSaveCookieSettings = async () => {
    try {
      setLoadingCookieSettings(true);
      logger.debug(null, '💾 Saving cookie settings...');
      
      await axios.post(`${API}/cookies/settings?athlete_id=${athleteId}`, cookieSettings);
      
      setSaveStatus({
        message: 'Cookie settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      logger.error(null, 'Error saving cookie settings:', error);
      setSaveStatus({
        message: 'Failed to save cookie settings',
        type: 'error'
      });
    } finally {
      setLoadingCookieSettings(false);
    }
  };

  const loadCookieSettings = async () => {
    try {
      logger.debug(null, '📥 Loading cookie settings...');
      const response = await axios.get(`${API}/cookies/settings?athlete_id=${athleteId}`);
      logger.debug(null, '📥 Cookie settings loaded:', response.data);
      
      setCookieSettings(response.data);
    } catch (error) {
      logger.error(null, 'Error loading cookie settings:', error);
    }
  };


  const handleSEOImageUpload = async (imageType, file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API}/system/upload-seo-image?athlete_id=${athleteId}&image_type=${imageType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Update the appropriate field
      setAdvancedSettings(prev => ({
        ...prev,
        seo: {
          ...prev.seo,
          [imageType === 'favicon' ? 'faviconUrl' : imageType === 'logo' ? 'logoUrl' : 'ogImage']: response.data.path
        }
      }));

      alert(`${imageType === 'favicon' ? 'Favicon' : imageType === 'logo' ? 'Logo' : 'OG Image'} uploaded successfully!`);
    } catch (error) {
      logger.error(null, 'Error uploading image:', error);
      alert('Failed to upload image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#32D3FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{t('systemSettings.loadingSettings')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ width: '100vw', maxWidth: '100vw' }}>
      <div className="w-full">
        {/* Header with Account Settings Button */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Settings className="w-8 h-8 text-[#32D3FF] mr-3" />
              <h1 className="text-3xl font-display font-bold text-white">{t('systemSettings.title')}</h1>
            </div>
            <Button
              onClick={() => navigate('/dashboard/account')}
              className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
              title={t('systemSettings.accountSettings')}
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline font-semibold">{t('systemSettings.accountSettings')}</span>
            </Button>
          </div>
          <p className="text-gray-300">
            {t('systemSettings.subtitle')}
          </p>
        </div>

        {/* Status Messages */}
        {saveStatus.message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            saveStatus.type === 'success' 
              ? 'bg-green-900/30 border-green-700 text-green-400'
              : 'bg-red-900/30 border-red-700 text-red-400'
          }`}>
            {saveStatus.message}
          </div>
        )}

        {/* System Settings Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 mb-8 bg-gray-800 border border-gray-700 p-1.5 h-auto gap-1">
            <TabsTrigger value="modules" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.modules')}</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.plans')}</span>
            </TabsTrigger>
            <TabsTrigger value="coupons" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.coupons')}</span>
            </TabsTrigger>
            <TabsTrigger value="waitinglist" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.waitingList')}</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.statistics')}</span>
            </TabsTrigger>
            <TabsTrigger value="cookies" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.cookies')}</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>{t('systemSettings.tabs.advanced')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <ModulesTab
              moduleSettings={moduleHook.moduleSettings}
              toggleModule={moduleHook.toggleModule}
              toggleModuleExpansion={moduleHook.toggleModuleExpansion}
              saveModuleSettings={moduleHook.saveModuleSettings}
              isSaving={moduleHook.isSaving}
            />
          </TabsContent>

          {/* Plan Editor Tab */}
          <TabsContent value="plans">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <h3 className="text-blue-400 font-semibold mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                How Plan Structure Works
              </h3>
              <div className="text-gray-300 text-sm space-y-2">
                <p><strong>Plans (Tiers):</strong> Free, Pro, Premium - each is a Stripe Product with features list</p>
                <p><strong>Variations:</strong> Monthly & Annual pricing for each plan - each is a Stripe Price</p>
                <p><strong>Example:</strong> "Pro" plan → "Pro Monthly" ($29.99/mo) + "Pro Annual" ($299/yr)</p>
              </div>
            </div>

            {/* Create Plan Button */}
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700 mb-6">
              <CardHeader className="flex flex-col gap-4">
                <div>
                  <CardTitle className="text-white text-lg sm:text-xl">{t('systemSettings.plans.title')}</CardTitle>
                  <CardDescription className="text-gray-400 text-sm">
                    {t('systemSettings.plans.description')}
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {subscriptionPlans.length === 0 && (
                    <Button 
                      onClick={quickSetupPlans}
                      disabled={loadingPlans}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white w-full sm:w-auto"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Quick Setup (3-Tier Structure)
                    </Button>
                  )}
                  <Button 
                    onClick={syncWithStripe}
                    variant="outline"
                    disabled={loadingPlans}
                    className="text-gray-300 border-gray-600 hover:bg-gray-700 w-full sm:w-auto"
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Sync from Stripe
                  </Button>
                  <Button 
                    onClick={syncToStripe}
                    variant="outline"
                    disabled={loadingPlans}
                    className="text-[#32D3FF] border-[#32D3FF] hover:bg-[#32D3FF]/10 w-full sm:w-auto"
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2 rotate-180" />
                    {loadingPlans ? t('systemSettings.plans.syncingToStripe') : t('systemSettings.plans.syncToStripe')}
                  </Button>
                  <Button 
                    onClick={resetStripeIds}
                    variant="outline"
                    disabled={loadingPlans}
                    className="text-red-400 border-red-600 hover:bg-red-600/10 w-full sm:w-auto"
                  >
                    <X className="w-4 h-4 mr-2" />
                    {t('systemSettings.plans.resetStripe')}
                  </Button>
                  <Button 
                    onClick={() => setShowCreatePlanModal(true)}
                    className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Custom Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPlans ? (
                  <div className="text-center py-8 text-gray-400">{t('systemSettings.plans.loadingPlans')}</div>
                ) : subscriptionPlans.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      No subscription plans yet.
                    </div>
                    <div className="text-gray-500 text-sm space-y-2">
                      <p>{t('systemSettings.plans.quickSetupHelp')}</p>
                      <p>or</p>
                      <p>{t('systemSettings.plans.createCustomHelp')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {subscriptionPlans.map((plan) => (
                      <Card key={plan.tier} className="border-gray-600 bg-gray-700/50">
                        <CardHeader>
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex-1">
                              <CardTitle className="text-white text-lg sm:text-xl">{plan.name}</CardTitle>
                              <CardDescription className="text-gray-400 mt-1 text-sm">
                                {plan.description || 'No description'}
                              </CardDescription>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 bg-teal-500/20 text-teal-400 rounded">
                                  Tier: {plan.tier}
                                </span>
                                {plan.stripe_product_id && (
                                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                    Synced with Stripe
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPlan(plan);
                                  setEditingPlan({
                                    tier: plan.tier,
                                    name: plan.name,
                                    description: plan.description || '',
                                    features: plan.features || [],
                                    sort_order: plan.sort_order || 0
                                  });
                                  setShowEditPlanModal(true);
                                }}
                                className="text-gray-300 border-gray-600"
                              >
                                <Pencil className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">{t('systemSettings.plans.edit')}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deletePlan(plan.tier)}
                                className="text-red-400 border-red-600"
                              >
                                <Trash2 className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">{t('systemSettings.plans.delete')}</span>
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Pricing Variations */}
                          <div className="mb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                              <h4 className="text-white font-semibold text-sm sm:text-base">{t('systemSettings.plans.pricingVariations')}</h4>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedPlan(plan);
                                  setNewVariation({
                                    plan_id: `${plan.tier}_`,
                                    name: '',
                                    price: '',
                                    interval: 'month',
                                    interval_count: 1
                                  });
                                  setShowCreateVariationModal(true);
                                }}
                                className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                {t('systemSettings.plans.addVariation')}
                              </Button>
                            </div>
                            
                            {plan.variations && plan.variations.length > 0 ? (
                              <div className="space-y-2">
                                {plan.variations.map((variation) => (
                                  <div
                                    key={variation.id}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-600/50 rounded-lg gap-3"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                        <span className="text-white font-medium text-sm sm:text-base truncate">
                                          {variation.name || `${plan.name} ${variation.interval === 'month' ? 'Monthly' : 'Annual'}`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-teal-400 font-bold text-base sm:text-lg">
                                            {variation.currency || 'EUR'} {variation.price}
                                          </span>
                                          <span className="text-gray-400 text-xs sm:text-sm">
                                            / {(variation.interval_count && variation.interval_count > 1) ? `${variation.interval_count} ` : ''}
                                            {variation.interval}
                                            {variation.interval_count > 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 truncate">
                                        ID: {variation.plan_id}
                                        {variation.stripe_price_id && (
                                          <span className="ml-2 hidden sm:inline">• Stripe: {variation.stripe_price_id}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          const newPrice = prompt('Enter new price:', variation.price);
                                          if (newPrice && !isNaN(parseFloat(newPrice))) {
                                            updateVariation(variation.id, { price: parseFloat(newPrice) });
                                          }
                                        }}
                                        className="text-gray-300 border-gray-500 flex-1 sm:flex-none"
                                      >
                                        <DollarSign className="w-4 h-4 sm:mr-1" />
                                        <span className="hidden sm:inline">{t('systemSettings.plans.editPrice')}</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => deleteVariation(variation.id)}
                                        className="text-red-400 border-red-600 flex-1 sm:flex-none"
                                      >
                                        <Trash2 className="w-4 h-4 sm:mr-1" />
                                        <span className="hidden sm:inline">{t('systemSettings.plans.delete')}</span>
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-400 text-sm">
                                No pricing variations. Add one to enable subscriptions.
                              </div>
                            )}
                          </div>

                          {/* Features */}
                          {plan.features && plan.features.length > 0 && (
                            <div>
                              <h4 className="text-white font-semibold mb-2">{t('systemSettings.plans.features')}</h4>
                              <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                                {plan.features.map((feature, idx) => (
                                  <li key={idx}>{feature}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Create Plan Modal */}
            {showCreatePlanModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="bg-gray-800 border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <CardHeader>
                    <CardTitle className="text-white">{t('systemSettings.plans.createNewPlan')}</CardTitle>
                    <CardDescription className="text-gray-400">
                      This will create a Stripe Product and sync it to your database
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.tierId')} *</label>
                      <input
                        type="text"
                        placeholder={t('systemSettings.plans.tierIdPlaceholder')}
                        value={newPlan.tier}
                        onChange={(e) => setNewPlan({...newPlan, tier: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                      <p className="text-gray-500 text-xs mt-1">{t('systemSettings.plans.tierIdHelp')}</p>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.planName')} *</label>
                      <input
                        type="text"
                        placeholder={t('systemSettings.plans.planNamePlaceholder')}
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('account.tabs.profile.description')}</label>
                      <textarea
                        placeholder={t('systemSettings.plans.planDescription')}
                        value={newPlan.description}
                        onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('account.tabs.profile.interests')}</label>
                      <div className="space-y-2">
                        {newPlan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={feature}
                              onChange={(e) => {
                                const updated = [...newPlan.features];
                                updated[idx] = e.target.value;
                                setNewPlan({...newPlan, features: updated});
                              }}
                              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = newPlan.features.filter((_, i) => i !== idx);
                                setNewPlan({...newPlan, features: updated});
                              }}
                              className="text-red-400 border-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={t('systemSettings.plans.addFeature')}
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && newFeature.trim()) {
                                setNewPlan({...newPlan, features: [...newPlan.features, newFeature.trim()]});
                                setNewFeature('');
                              }
                            }}
                            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (newFeature.trim()) {
                                setNewPlan({...newPlan, features: [...newPlan.features, newFeature.trim()]});
                                setNewFeature('');
                              }
                            }}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.sortOrder')}</label>
                      <input
                        type="number"
                        value={newPlan.sort_order}
                        onChange={(e) => setNewPlan({...newPlan, sort_order: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                      <p className="text-gray-500 text-xs mt-1">{t('systemSettings.plans.sortOrderHelp')}</p>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6 flex gap-3">
                    <Button
                      onClick={createPlan}
                      className="flex-1 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white"
                    >
                      Create Plan
                    </Button>
                    <Button
                      onClick={() => setShowCreatePlanModal(false)}
                      variant="outline"
                      className="flex-1 text-gray-300 border-gray-600"
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* Edit Plan Modal */}
            {showEditPlanModal && selectedPlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="bg-gray-800 border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <CardHeader>
                    <CardTitle className="text-white">{t('systemSettings.plans.editPlan')}: {selectedPlan.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      Update plan details (Stripe product will be updated)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.tierId')}</label>
                      <input
                        type="text"
                        value={selectedPlan.tier}
                        disabled
                        className="w-full bg-gray-600 text-gray-400 px-4 py-2 rounded border border-gray-600 cursor-not-allowed"
                      />
                      <p className="text-gray-500 text-xs mt-1">{t('systemSettings.plans.tierIdCannotChange')}</p>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.planName')} *</label>
                      <input
                        type="text"
                        placeholder={t('systemSettings.plans.planNamePlaceholder')}
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.description')}</label>
                      <textarea
                        placeholder={t('systemSettings.plans.descriptionPlaceholder')}
                        value={editingPlan.description}
                        onChange={(e) => setEditingPlan({...editingPlan, description: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.featuresDragHelp')}</label>
                      <div className="space-y-2">
                        {editingPlan.features.map((feature, idx) => {
                          let touchStartY = 0;
                          let draggedElement = null;
                          
                          return (
                            <div 
                              key={idx} 
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', idx.toString());
                                e.currentTarget.style.opacity = '0.5';
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'));
                                if (draggedIdx !== idx) {
                                  const updated = [...editingPlan.features];
                                  const [removed] = updated.splice(draggedIdx, 1);
                                  updated.splice(idx, 0, removed);
                                  setEditingPlan({...editingPlan, features: updated});
                                }
                              }}
                              onTouchStart={(e) => {
                                touchStartY = e.touches[0].clientY;
                                draggedElement = e.currentTarget;
                                draggedElement.style.opacity = '0.5';
                              }}
                              onTouchMove={(e) => {
                                if (!draggedElement) return;
                                e.preventDefault();
                                const touchY = e.touches[0].clientY;
                                const elements = Array.from(e.currentTarget.parentElement.children);
                                const overElement = elements.find(el => {
                                  const rect = el.getBoundingClientRect();
                                  return touchY >= rect.top && touchY <= rect.bottom && el !== draggedElement;
                                });
                                
                                if (overElement) {
                                  const draggedIdx = elements.indexOf(draggedElement);
                                  const overIdx = elements.indexOf(overElement);
                                  if (draggedIdx !== overIdx) {
                                    const updated = [...editingPlan.features];
                                    const [removed] = updated.splice(draggedIdx, 1);
                                    updated.splice(overIdx, 0, removed);
                                    setEditingPlan({...editingPlan, features: updated});
                                  }
                                }
                              }}
                              onTouchEnd={(e) => {
                                if (draggedElement) {
                                  draggedElement.style.opacity = '1';
                                  draggedElement = null;
                                }
                              }}
                              className="flex items-center gap-2 cursor-move hover:bg-gray-700 active:bg-gray-700 rounded p-1 transition-colors touch-none"
                            >
                              <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <input
                                type="text"
                                value={feature}
                                onChange={(e) => {
                                  const updated = [...editingPlan.features];
                                  updated[idx] = e.target.value;
                                  setEditingPlan({...editingPlan, features: updated});
                                }}
                                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const updated = editingPlan.features.filter((_, i) => i !== idx);
                                  setEditingPlan({...editingPlan, features: updated});
                                }}
                                className="text-red-400 border-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a feature..."
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && newFeature.trim()) {
                                setEditingPlan({...editingPlan, features: [...editingPlan.features, newFeature.trim()]});
                                setNewFeature('');
                              }
                            }}
                            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (newFeature.trim()) {
                                setEditingPlan({...editingPlan, features: [...editingPlan.features, newFeature.trim()]});
                                setNewFeature('');
                              }
                            }}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.sortOrder')}</label>
                      <input
                        type="number"
                        value={editingPlan.sort_order}
                        onChange={(e) => setEditingPlan({...editingPlan, sort_order: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                      <p className="text-gray-500 text-xs mt-1">{t('systemSettings.plans.sortOrderHelp')}</p>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6 flex gap-3">
                    <Button
                      onClick={() => {
                        updatePlan(selectedPlan.tier, {
                          name: editingPlan.name,
                          description: editingPlan.description,
                          features: editingPlan.features,
                          sort_order: editingPlan.sort_order
                        });
                        setShowEditPlanModal(false);
                      }}
                      className="flex-1 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white"
                    >
                      Save Changes
                    </Button>
                    <Button
                      onClick={() => setShowEditPlanModal(false)}
                      variant="outline"
                      className="flex-1 text-gray-300 border-gray-600"
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* Create Variation Modal */}
            {showCreateVariationModal && selectedPlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="bg-gray-800 border-gray-700 w-full max-w-lg">
                  <CardHeader>
                    <CardTitle className="text-white">{t('systemSettings.plans.addPricingVariation')}</CardTitle>
                    <CardDescription className="text-gray-400">
                      Add a new pricing option for {selectedPlan.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.variationIdRequired')}</label>
                      <input
                        type="text"
                        placeholder={t('systemSettings.plans.variationIdPlaceholder')}
                        value={newVariation.plan_id}
                        onChange={(e) => setNewVariation({...newVariation, plan_id: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.displayNameRequired')}</label>
                      <input
                        type="text"
                        placeholder={t('systemSettings.plans.displayNamePlaceholder')}
                        value={newVariation.name}
                        onChange={(e) => setNewVariation({...newVariation, name: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">{t('systemSettings.plans.priceRequired')}</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('systemSettings.plans.pricePlaceholder')}
                        value={newVariation.price}
                        onChange={(e) => setNewVariation({...newVariation, price: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-300 mb-2">{t('systemSettings.plans.billingIntervalRequired')}</label>
                        <select
                          value={newVariation.interval}
                          onChange={(e) => setNewVariation({...newVariation, interval: e.target.value})}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        >
                          <option value="month">{t('systemSettings.plans.monthly')}</option>
                          <option value="year">{t('systemSettings.plans.yearly')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-300 mb-2">{t('systemSettings.plans.intervalCount')}</label>
                        <input
                          type="number"
                          min="1"
                          value={newVariation.interval_count}
                          onChange={(e) => setNewVariation({...newVariation, interval_count: parseInt(e.target.value) || 1})}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        />
                      </div>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6 flex gap-3">
                    <Button
                      onClick={createVariation}
                      className="flex-1 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white"
                    >
                      Create Variation
                    </Button>
                    <Button
                      onClick={() => setShowCreateVariationModal(false)}
                      variant="outline"
                      className="flex-1 text-gray-300 border-gray-600"
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>


          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <div className="text-gray-400 text-sm mb-4">
              {t('systemSettings.coupons.description')}
            </div>
            
            {/* Create Coupon Card */}
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700 mb-6">
              <CardHeader>
                <h3 className="text-white font-semibold text-lg">{t('systemSettings.coupons.addCoupon')}</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Coupon Code */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.couponCode')} *</label>
                    <input
                      type="text"
                      placeholder={t('systemSettings.coupons.couponCodePlaceholder')}
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                      style={{ textTransform: 'uppercase' }}
                    />
                    <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.couponCodeHelp')}</p>
                  </div>
                  
                  {/* Coupon Name */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.displayNameRequired')}</label>
                    <input
                      type="text"
                      placeholder={t('systemSettings.coupons.displayNamePlaceholder')}
                      value={newCoupon.name}
                      onChange={(e) => setNewCoupon({...newCoupon, name: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    />
                  </div>
                  
                  {/* Discount Type */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.discountType')} *</label>
                    <select 
                      value={newCoupon.type}
                      onChange={(e) => setNewCoupon({...newCoupon, type: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    >
                      <option value="percentage">{t('systemSettings.coupons.percentage')} ({t('systemSettings.coupons.percentageOff')})</option>
                      <option value="fixed">{t('systemSettings.coupons.fixedAmount')} ({t('systemSettings.coupons.amountOff')})</option>
                    </select>
                  </div>
                  
                  {/* Discount Value */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.discountValue')} *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="20"
                      value={newCoupon.value}
                      onChange={(e) => setNewCoupon({...newCoupon, value: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    />
                    <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.discountValueHelp')}</p>
                  </div>
                  
                  {/* Max Uses */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.maxUses')}</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="100"
                      value={newCoupon.max_uses}
                      onChange={(e) => setNewCoupon({...newCoupon, max_uses: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    />
                    <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.maxUsesPlaceholder')}</p>
                  </div>
                  
                  {/* Expiration Date */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.expiryDate')}</label>
                    <input
                      type="datetime-local"
                      value={newCoupon.expires_at}
                      onChange={(e) => setNewCoupon({...newCoupon, expires_at: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    />
                    <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.expiryPlaceholder')}</p>
                  </div>
                  
                  {/* Applies To */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.appliesTo')}</label>
                    <select 
                      value={newCoupon.applies_to}
                      onChange={(e) => setNewCoupon({...newCoupon, applies_to: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    >
                      <option value="all">{t('systemSettings.coupons.allPurchases')}</option>
                      <option value="subscriptions">{t('systemSettings.coupons.subscriptionsOnly')}</option>
                      <option value="one_time">{t('systemSettings.coupons.oneTimePurchases')}</option>
                    </select>
                    <p className="text-gray-500 text-xs mt-1">
                      💡 Select "Subscriptions Only" to specify which plans this coupon applies to
                    </p>
                  </div>

                  {/* Minimum Purchase Amount */}
                  <div>
                    <label className="block text-gray-300 mb-2">Minimum Purchase Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={newCoupon.min_purchase_amount}
                      onChange={(e) => setNewCoupon({...newCoupon, min_purchase_amount: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                    />
                    <p className="text-gray-500 text-xs mt-1">Minimum amount required to use coupon</p>
                  </div>
                </div>

                {/* Specific Plans (full width section, shown for subscriptions) */}
                {newCoupon.applies_to === 'subscriptions' && (
                  <div className="mt-4 border-t border-gray-600 pt-4">
                    <label className="block text-white mb-2 font-semibold text-lg">🎯 Specific Subscription Plans (Optional)</label>
                    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <p className="text-gray-400 text-sm mb-4">
                        Select which subscription plans this coupon applies to. Leave all unchecked to apply to ALL subscription plans.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availablePlans.map(plan => (
                          <label key={plan.id} className="flex items-center space-x-3 text-gray-300 cursor-pointer hover:text-white p-2 rounded hover:bg-gray-600/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={newCoupon.specific_plans.includes(plan.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewCoupon({
                                    ...newCoupon,
                                    specific_plans: [...newCoupon.specific_plans, plan.id]
                                  });
                                } else {
                                  setNewCoupon({
                                    ...newCoupon,
                                    specific_plans: newCoupon.specific_plans.filter(p => p !== plan.id)
                                  });
                                }
                              }}
                              className="w-5 h-5 text-teal-600 bg-gray-600 border-gray-500 rounded focus:ring-teal-500 focus:ring-2"
                            />
                            <span className="text-sm font-medium">{plan.name}</span>
                          </label>
                        ))}
                      </div>
                      {newCoupon.specific_plans.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <p className="text-sm text-teal-400">
                            ✓ Selected {newCoupon.specific_plans.length} plan(s)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={createCoupon}
                    className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white"
                  >
                    Create Coupon
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Active Coupons List */}
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <h3 className="text-white font-semibold text-lg">
                  {showDisabledCoupons ? 'All Coupons' : 'Active Coupons'}
                </h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowDisabledCoupons(!showDisabledCoupons)}
                  className="text-gray-400 border-gray-600 hover:bg-gray-700"
                >
                  {showDisabledCoupons ? 'Hide Disabled' : 'Show Disabled'}
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCoupons ? (
                  <div className="text-gray-400 text-center py-8">{t('systemSettings.coupons.loadingCoupons')}</div>
                ) : coupons.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No coupons created yet. Create your first coupon above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {coupons.map((coupon) => (
                      <div 
                        key={coupon.code}
                        className={`p-4 rounded-lg border ${
                          coupon.enabled 
                            ? 'border-gray-600 bg-gray-700/50' 
                            : 'border-gray-700 bg-gray-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <code className="text-lg font-mono text-[#32D3FF]">{coupon.code}</code>
                              {!coupon.enabled && (
                                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">
                                  Disabled
                                </span>
                              )}
                              {coupon.max_uses && (
                                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                  {coupon.current_uses || 0}/{coupon.max_uses} uses
                                </span>
                              )}
                            </div>
                            <p className="text-white font-medium mb-1">{coupon.name}</p>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                              <span>
                                <strong className="text-white">
                                  {coupon.type === 'percentage' 
                                    ? `${coupon.value}%` 
                                    : `$${coupon.value}`
                                  }
                                </strong> off
                              </span>
                              <span>•</span>
                              <span>
                                {coupon.applies_to === 'all' ? 'All purchases' : 
                                 coupon.applies_to === 'subscriptions' ? 'Subscriptions only' : 
                                 'One-time only'}
                              </span>
                              {coupon.expires_at && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Expires: {new Date(coupon.expires_at).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                              {coupon.min_purchase_amount && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Min: ${coupon.min_purchase_amount}
                                  </span>
                                </>
                              )}
                            </div>
                            {coupon.specific_plans && coupon.specific_plans.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                <span className="text-xs text-gray-400">{t('systemSettings.coupons.validFor')}:</span>
                                {coupon.specific_plans.map(planId => {
                                  const plan = availablePlans.find(p => p.id === planId);
                                  return plan ? (
                                    <span key={planId} className="text-xs px-2 py-1 bg-teal-500/20 text-teal-400 rounded">
                                      {plan.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleCoupon(coupon.code, coupon.enabled)}
                              className="text-gray-400 border-gray-600 hover:bg-gray-700"
                            >
                              {coupon.enabled ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteCoupon(coupon.code)}
                              className="text-red-400 border-red-600 hover:bg-red-900/20"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <StatisticsTab
              athleteId={athleteId}
              subscriberStats={statsHook.subscriberStats}
              selectedPeriod={statsHook.selectedPeriod}
              compareEnabled={statsHook.compareEnabled}
              chartData={statsHook.chartData}
              chartOptions={statsHook.chartOptions}
              isLoading={statsHook.isLoading}
              onChangePeriod={statsHook.changePeriod}
              onToggleCompare={statsHook.toggleCompare}
            />
          </TabsContent>


          {/* Cookies Tab */}
          <TabsContent value="cookies">
            <CookiesTab
              cookieSettings={cookieHook.cookieSettings}
              isLoading={cookieHook.isLoading}
              isScanning={cookieHook.isScanning}
              onUpdateSettings={cookieHook.updateSettings}
              onScanCookies={cookieHook.scanCookies}
              onSave={cookieHook.saveCookieSettings}
              isSaving={cookieHook.isSaving}
            />
          </TabsContent>


          {/* Plans Tab */}
          <TabsContent value="plans">
            <PlansTab
              planSettings={planHook.planSettings}
              onUpdatePlanField={planHook.updatePlanField}
              onAddFeature={planHook.addFeature}
              onRemoveFeature={planHook.removeFeature}
              onUpdateFeature={planHook.updateFeature}
              onSavePlanSettings={planHook.savePlanSettings}
              dragHandlers={{
                handleFeatureDragStart: planHook.handleFeatureDragStart,
                handleFeatureDragOver: planHook.handleFeatureDragOver,
                handleFeatureDrop: planHook.handleFeatureDrop,
                handleFeatureDragEnd: planHook.handleFeatureDragEnd
              }}
              isSaving={planHook.isSaving}
            />
          </TabsContent>


          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <CouponsTab
              coupons={couponHook.coupons}
              newCoupon={couponHook.newCoupon}
              showDisabledCoupons={couponHook.showDisabledCoupons}
              isLoading={couponHook.isLoading}
              availablePlans={couponHook.availablePlans}
              onUpdateNewCoupon={couponHook.updateNewCoupon}
              onCreateCoupon={couponHook.createCoupon}
              onToggleCoupon={couponHook.toggleCoupon}
              onDeleteCoupon={couponHook.deleteCoupon}
              onToggleShowDisabled={couponHook.toggleShowDisabled}
            />
          </TabsContent>


          {/* Waiting List Tab */}
          <TabsContent value="waitinglist">
            <WaitingListTab
              waitingListEntries={waitingListHook.filteredEntries}
              filter={waitingListHook.filter}
              isLoading={waitingListHook.isLoading}
              onFilterChange={waitingListHook.changeFilter}
              onExport={waitingListHook.exportToCSV}
              onUpdateStatus={waitingListHook.updateEntryStatus}
              onDeleteEntry={waitingListHook.deleteEntry}
            />
          </TabsContent>


          {/* Advanced Tab */}
          <TabsContent value="advanced">
            <AdvancedTab
              advancedSettings={advancedHook.advancedSettings}
              onUpdateSEOSetting={advancedHook.updateSEOSetting}
              onUpdateSimpleSetting={advancedHook.updateSimpleSetting}
              onUpdateStripeMode={advancedHook.updateStripeMode}
              onUpdateStripeCredentials={advancedHook.updateStripeCredentials}
              onUpdateIntegration={advancedHook.updateIntegration}
              onToggleVisibility={advancedHook.toggleVisibility}
              onUploadSEOImage={advancedHook.uploadSEOImage}
              onSaveAdvancedSettings={advancedHook.saveAdvancedSettings}
              isSaving={advancedHook.isSaving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemSettings;
