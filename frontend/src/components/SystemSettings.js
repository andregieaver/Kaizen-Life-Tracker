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
    console.log('🔍 Loading tab from localStorage:', savedTab);
    if (savedTab && ['modules', 'plans', 'coupons', 'waitinglist', 'statistics', 'cookies', 'advanced'].includes(savedTab)) {
      // Also update hash to match
      window.location.hash = savedTab;
      return savedTab;
    }
    // Then try URL hash
    const hash = location.hash.replace('#', '');
    console.log('🔍 Loading tab from hash:', hash);
    if (['modules', 'plans', 'coupons', 'waitinglist', 'statistics', 'cookies', 'advanced'].includes(hash)) {
      return hash;
    }
    // Default to 'modules'
    console.log('🔍 Using default tab: modules');
    return 'modules';
  });
  const [loading, setLoading] = useState(true);
  
  // Drag state for feature reordering
  const [draggedFeature, setDraggedFeature] = useState({ plan: null, index: null });
  
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
  useEffect(() => {
    loadSystemSettings();
    loadSubscriberStats();
  }, [athleteId]);

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
      console.error('Error loading subscriber stats:', error);
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
          showStravaSecret: false,
          showStravaVerifyToken: false
        }));
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading system settings:', error);
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
      console.error('Error loading coupons:', error);
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
      console.error('Error creating coupon:', error);
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
      console.error('Error toggling coupon:', error);
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
      console.error('Error deleting coupon:', error);
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
      console.error('Error loading subscription plans:', error);
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
      console.error('Error creating plan:', error);
      alert(error.response?.data?.detail || 'Failed to create plan');
    }
  };

  const updatePlan = async (tier, updates) => {
    try {
      console.log('Updating plan:', tier, 'with updates:', updates);
      await axios.put(`${API}/subscription-plans/${tier}?athlete_id=${athleteId}`, updates);
      alert('Plan updated successfully');
      loadSubscriptionPlans();
    } catch (error) {
      console.error('Error updating plan:', error);
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
      console.error('Error deleting plan:', error);
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
      console.error('Error creating variation:', error);
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
      console.error('Error updating variation:', error);
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
      console.error('Error deleting variation:', error);
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
      console.error('Error in quick setup:', error);
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
      console.error('Error syncing with Stripe:', error);
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
      console.error('Error syncing to Stripe:', error);
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
      console.error('Error resetting Stripe IDs:', error);
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
      console.error('Error loading waiting list:', error);
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
      console.error('Error exporting waiting list:', error);
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
      console.error('Error updating entry:', error);
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
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  const handleTabChange = (value) => {
    console.log('📝 Saving tab to localStorage:', value);
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
      console.error('Error saving SEO settings:', error);
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
      console.error('Error saving module settings:', error);
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
      console.error('Error saving plan settings:', error);
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
      console.error('Error saving advanced settings:', error);
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
      console.log('🍪 Scanning for cookies...');
      
      const response = await axios.post(`${API}/cookies/scan?athlete_id=${athleteId}`);
      
      console.log('🍪 Cookie scan result:', response.data);
      
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
      console.error('Error scanning cookies:', error);
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
      console.log('💾 Saving cookie settings...');
      
      await axios.post(`${API}/cookies/settings?athlete_id=${athleteId}`, cookieSettings);
      
      setSaveStatus({
        message: 'Cookie settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Error saving cookie settings:', error);
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
      console.log('📥 Loading cookie settings...');
      const response = await axios.get(`${API}/cookies/settings?athlete_id=${athleteId}`);
      console.log('📥 Cookie settings loaded:', response.data);
      
      setCookieSettings(response.data);
    } catch (error) {
      console.error('Error loading cookie settings:', error);
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
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
              <Settings className="w-8 h-8 text-[#00C2A8] mr-3" />
              <h1 className="text-3xl font-display font-bold text-white">{t('systemSettings.title')}</h1>
            </div>
            <Button
              onClick={() => navigate('/dashboard/account')}
              className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
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
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">{t('systemSettings.modules.title')}</CardTitle>
                <CardDescription className="text-gray-400">
                  {t('systemSettings.modules.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Affiliate Program Module */}
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {t('systemSettings.modules.affiliateProgram.title')}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {t('systemSettings.modules.affiliateProgram.description')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => toggleModule('affiliateProgram')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C2A8] focus:ring-offset-2 focus:ring-offset-gray-900 ${
                            moduleSettings.affiliateProgram.enabled 
                              ? 'bg-[#00C2A8]' 
                              : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              moduleSettings.affiliateProgram.enabled 
                                ? 'translate-x-6' 
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-sm font-medium text-white min-w-[60px]">
                          {moduleSettings.affiliateProgram.enabled ? t('common.connect') : t('common.disconnect')}
                        </span>
                        {moduleSettings.affiliateProgram.enabled && (
                          <button
                            type="button"
                            onClick={() => toggleModuleExpansion('affiliateProgram')}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                          >
                            {moduleSettings.affiliateProgram.expanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {moduleSettings.affiliateProgram.enabled && moduleSettings.affiliateProgram.expanded && (
                    <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                      <p className="text-gray-400 text-sm">
                        Configuration options for Affiliate Program will appear here...
                      </p>
                    </div>
                  )}
                </div>

                {/* Community Module */}
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          Community
                        </h3>
                        <p className="text-sm text-gray-400">
                          Enable community features and icon in header
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => toggleModule('community')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C2A8] focus:ring-offset-2 focus:ring-offset-gray-900 ${
                            moduleSettings.community.enabled 
                              ? 'bg-[#00C2A8]' 
                              : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              moduleSettings.community.enabled 
                                ? 'translate-x-6' 
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-sm font-medium text-white min-w-[60px]">
                          {moduleSettings.community.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {moduleSettings.community.enabled && (
                          <button
                            type="button"
                            onClick={() => toggleModuleExpansion('community')}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                          >
                            {moduleSettings.community.expanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {moduleSettings.community.enabled && moduleSettings.community.expanded && (
                    <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                      <p className="text-gray-400 text-sm">
                        Configuration options for Community will appear here...
                      </p>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSaveModuleSettings}
                    className="w-full sm:w-auto px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Module Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                    className="text-[#00C2A8] border-[#00C2A8] hover:bg-[#00C2A8]/10 w-full sm:w-auto"
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
                    className="bg-[#00C2A8] hover:bg-[#00a890] text-white w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Custom Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPlans ? (
                  <div className="text-center py-8 text-gray-400">Loading plans...</div>
                ) : subscriptionPlans.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      No subscription plans yet.
                    </div>
                    <div className="text-gray-500 text-sm space-y-2">
                      <p>👆 Click <strong className="text-purple-400">"Quick Setup"</strong> to create Free, Pro, Premium tiers</p>
                      <p>or</p>
                      <p>Click <strong className="text-teal-400">"Create Custom Plan"</strong> to build from scratch</p>
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
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deletePlan(plan.tier)}
                                className="text-red-400 border-red-600"
                              >
                                <Trash2 className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Pricing Variations */}
                          <div className="mb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                              <h4 className="text-white font-semibold text-sm sm:text-base">Pricing Variations</h4>
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
                                Add Variation
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
                                        <span className="hidden sm:inline">Edit Price</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => deleteVariation(variation.id)}
                                        className="text-red-400 border-red-600 flex-1 sm:flex-none"
                                      >
                                        <Trash2 className="w-4 h-4 sm:mr-1" />
                                        <span className="hidden sm:inline">Delete</span>
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
                              <h4 className="text-white font-semibold mb-2">Features</h4>
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
                    <CardTitle className="text-white">Create New Subscription Plan</CardTitle>
                    <CardDescription className="text-gray-400">
                      This will create a Stripe Product and sync it to your database
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Tier ID *</label>
                      <input
                        type="text"
                        placeholder="e.g., pro, premium, enterprise"
                        value={newPlan.tier}
                        onChange={(e) => setNewPlan({...newPlan, tier: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                      <p className="text-gray-500 text-xs mt-1">Unique identifier (lowercase, no spaces)</p>
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
                      <label className="block text-gray-300 mb-2">Sort Order</label>
                      <input
                        type="number"
                        value={newPlan.sort_order}
                        onChange={(e) => setNewPlan({...newPlan, sort_order: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                      <p className="text-gray-500 text-xs mt-1">Lower numbers appear first</p>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6 flex gap-3">
                    <Button
                      onClick={createPlan}
                      className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
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
                    <CardTitle className="text-white">Edit Plan: {selectedPlan.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      Update plan details (Stripe product will be updated)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Tier ID</label>
                      <input
                        type="text"
                        value={selectedPlan.tier}
                        disabled
                        className="w-full bg-gray-600 text-gray-400 px-4 py-2 rounded border border-gray-600 cursor-not-allowed"
                      />
                      <p className="text-gray-500 text-xs mt-1">Cannot change tier ID</p>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Plan Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Professional, Premium"
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Description</label>
                      <textarea
                        placeholder="Plan description..."
                        value={editingPlan.description}
                        onChange={(e) => setEditingPlan({...editingPlan, description: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Features</label>
                      <div className="space-y-2">
                        {editingPlan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
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
                        ))}
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
                      <label className="block text-gray-300 mb-2">Sort Order</label>
                      <input
                        type="number"
                        value={editingPlan.sort_order}
                        onChange={(e) => setEditingPlan({...editingPlan, sort_order: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                      <p className="text-gray-500 text-xs mt-1">Lower numbers appear first</p>
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
                      className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
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
                    <CardTitle className="text-white">Add Pricing Variation</CardTitle>
                    <CardDescription className="text-gray-400">
                      Add a new pricing option for {selectedPlan.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Variation ID *</label>
                      <input
                        type="text"
                        placeholder="e.g., pro_monthly, premium_annual"
                        value={newVariation.plan_id}
                        onChange={(e) => setNewVariation({...newVariation, plan_id: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Display Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Pro Monthly, Premium Annual"
                        value={newVariation.name}
                        onChange={(e) => setNewVariation({...newVariation, name: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Price (USD) *</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="49.99"
                        value={newVariation.price}
                        onChange={(e) => setNewVariation({...newVariation, price: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-300 mb-2">Billing Interval *</label>
                        <select
                          value={newVariation.interval}
                          onChange={(e) => setNewVariation({...newVariation, interval: e.target.value})}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        >
                          <option value="month">Monthly</option>
                          <option value="year">Yearly</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-300 mb-2">Interval Count</label>
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
                      className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
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
              Manage discount coupons for subscriptions and one-time purchases. Coupons can be percentage-based or fixed amount discounts.
            </div>
            
            {/* Create Coupon Card */}
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700 mb-6">
              <CardHeader>
                <h3 className="text-white font-semibold text-lg">Create New Coupon</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Coupon Code */}
                  <div>
                    <label className="block text-gray-300 mb-2">Coupon Code *</label>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="free-title" className="text-sm font-medium text-white">
                        Plan Title
                      </Label>
                      <Input
                        id="free-title"
                        type="text"
                        value={planSettings.free.title}
                        onChange={(e) => handlePlanChange('free', 'title', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="free-description" className="text-sm font-medium text-white">
                        Plan Description
                      </Label>
                      <Input
                        id="free-description"
                        type="text"
                        value={planSettings.free.description}
                        onChange={(e) => handlePlanChange('free', 'description', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">
                        Features (drag to reorder)
                      </Label>
                      {planSettings.free.features.map((feature, index) => (
                        <div 
                          key={index} 
                          draggable
                          onDragStart={(e) => handleFeatureDragStart(e, 'free', index)}
                          onDragOver={handleFeatureDragOver}
                          onDrop={(e) => handleFeatureDrop(e, 'free', index)}
                          onDragEnd={handleFeatureDragEnd}
                          className={`flex gap-2 items-center select-none ${
                            draggedFeature.plan === 'free' && draggedFeature.index === index 
                              ? 'opacity-50' 
                              : ''
                          }`}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                          onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                        >
                          <div className="cursor-move p-2 text-gray-400 hover:text-white">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <Input
                            type="text"
                            value={feature}
                            onChange={(e) => handleFeatureChange('free', index, e.target.value)}
                            placeholder="Enter feature"
                            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                          />
                          <Button
                            type="button"
                            onClick={() => handleRemoveFeature('free', index)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        onClick={() => handleAddFeature('free')}
                        className="bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Add Feature
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Pro Plan */}
                <div className="border border-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Pro Plan</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pro-title" className="text-sm font-medium text-white">
                        Plan Title
                      </Label>
                      <Input
                        id="pro-title"
                        type="text"
                        value={planSettings.pro.title}
                        onChange={(e) => handlePlanChange('pro', 'title', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pro-description" className="text-sm font-medium text-white">
                        Plan Description
                      </Label>
                      <Input
                        id="pro-description"
                        type="text"
                        value={planSettings.pro.description}
                        onChange={(e) => handlePlanChange('pro', 'description', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">
                        Features (drag to reorder)
                      </Label>
                      {planSettings.pro.features.map((feature, index) => (
                        <div 
                          key={index}
                          draggable
                          onDragStart={(e) => handleFeatureDragStart(e, 'pro', index)}
                          onDragOver={handleFeatureDragOver}
                          onDrop={(e) => handleFeatureDrop(e, 'pro', index)}
                          onDragEnd={handleFeatureDragEnd}
                          className={`flex gap-2 items-center select-none ${
                            draggedFeature.plan === 'pro' && draggedFeature.index === index 
                              ? 'opacity-50' 
                              : ''
                          }`}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                          onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                        >
                          <div className="cursor-move p-2 text-gray-400 hover:text-white">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <Input
                            type="text"
                            value={feature}
                            onChange={(e) => handleFeatureChange('pro', index, e.target.value)}
                            placeholder="Enter feature"
                            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                          />
                          <Button
                            type="button"
                            onClick={() => handleRemoveFeature('pro', index)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        onClick={() => handleAddFeature('pro')}
                        className="bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Add Feature
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Premium Plan */}
                <div className="border border-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Premium Plan</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="premium-title" className="text-sm font-medium text-white">
                        Plan Title
                      </Label>
                      <Input
                        id="premium-title"
                        type="text"
                        value={planSettings.premium.title}
                        onChange={(e) => handlePlanChange('premium', 'title', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="premium-description" className="text-sm font-medium text-white">
                        Plan Description
                      </Label>
                      <Input
                        id="premium-description"
                        type="text"
                        value={planSettings.premium.description}
                        onChange={(e) => handlePlanChange('premium', 'description', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-white">
                        Features
                      </Label>
                      {planSettings.premium.features.map((feature, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="text"
                            value={feature}
                            onChange={(e) => handleFeatureChange('premium', index, e.target.value)}
                            placeholder="Enter feature"
                            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                          />
                          <Button
                            type="button"
                            onClick={() => handleRemoveFeature('premium', index)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        onClick={() => handleAddFeature('premium')}
                        className="bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Add Feature
                      </Button>
                    </div>
                  </div>
                </div>
                </div> {/* End of three column grid */}

                {/* Save Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSavePlanSettings}
                    className="w-full sm:w-auto px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Plan Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                      style={{ textTransform: 'uppercase' }}
                    />
                    <p className="text-gray-500 text-xs mt-1">Letters and numbers only, automatically uppercase</p>
                  </div>
                  
                  {/* Coupon Name */}
                  <div>
                    <label className="block text-gray-300 mb-2">Display Name *</label>
                    <input
                      type="text"
                      placeholder={t('systemSettings.couponName')}
                      value={newCoupon.name}
                      onChange={(e) => setNewCoupon({...newCoupon, name: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    />
                  </div>
                  
                  {/* Discount Type */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.discountType')} *</label>
                    <select 
                      value={newCoupon.type}
                      onChange={(e) => setNewCoupon({...newCoupon, type: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
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
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    />
                    <p className="text-gray-500 text-xs mt-1">For percentage: 0-100, For fixed: amount in USD</p>
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
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    />
                    <p className="text-gray-500 text-xs mt-1">Leave empty for {t('systemSettings.coupons.unlimited').toLowerCase()} uses</p>
                  </div>
                  
                  {/* Expiration Date */}
                  <div>
                    <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.expiryDate')}</label>
                    <input
                      type="datetime-local"
                      value={newCoupon.expires_at}
                      onChange={(e) => setNewCoupon({...newCoupon, expires_at: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    />
                    <p className="text-gray-500 text-xs mt-1">Leave empty for no expiration</p>
                  </div>
                  
                  {/* Applies To */}
                  <div>
                    <label className="block text-gray-300 mb-2">Applies To</label>
                    <select 
                      value={newCoupon.applies_to}
                      onChange={(e) => setNewCoupon({...newCoupon, applies_to: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    >
                      <option value="all">All Purchases</option>
                      <option value="subscriptions">Subscriptions Only</option>
                      <option value="one_time">One-Time Purchases Only</option>
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
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
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
                    className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
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
                  <div className="text-gray-400 text-center py-8">Loading coupons...</div>
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
                              <code className="text-lg font-mono text-[#00C2A8]">{coupon.code}</code>
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
                                <span className="text-xs text-gray-400">Valid for:</span>
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

          {/* Waiting List Tab */}
          <TabsContent value="waitinglist">
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-col gap-4">
                <div>
                  <CardTitle className="text-white text-lg sm:text-xl flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-[#00C2A8]" />
                    {t('systemSettings.waitingList.entries')}
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-sm mt-1">
                    {t('systemSettings.waitingList.description')}
                  </CardDescription>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={waitingListFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setWaitingListFilter('all')}
                      className={waitingListFilter === 'all' ? 'bg-[#00C2A8]' : 'text-gray-300 border-gray-600'}
                    >
                      {t('systemSettings.waitingList.all')}
                    </Button>
                    <Button
                      size="sm"
                      variant={waitingListFilter === 'pending' ? 'default' : 'outline'}
                      onClick={() => setWaitingListFilter('pending')}
                      className={waitingListFilter === 'pending' ? 'bg-[#00C2A8]' : 'text-gray-300 border-gray-600'}
                    >
                      {t('systemSettings.waitingList.pending')}
                    </Button>
                    <Button
                      size="sm"
                      variant={waitingListFilter === 'contacted' ? 'default' : 'outline'}
                      onClick={() => setWaitingListFilter('contacted')}
                      className={waitingListFilter === 'contacted' ? 'bg-[#00C2A8]' : 'text-gray-300 border-gray-600'}
                    >
                      {t('systemSettings.waitingList.contacted')}
                    </Button>
                    <Button
                      size="sm"
                      variant={waitingListFilter === 'converted' ? 'default' : 'outline'}
                      onClick={() => setWaitingListFilter('converted')}
                      className={waitingListFilter === 'converted' ? 'bg-[#00C2A8]' : 'text-gray-300 border-gray-600'}
                    >
                      {t('systemSettings.waitingList.converted')}
                    </Button>
                  </div>
                  
                  <Button
                    onClick={exportWaitingListCSV}
                    disabled={waitingListEntries.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto sm:ml-auto"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('systemSettings.waitingList.exportCSV')}
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {loadingWaitingList ? (
                  <div className="text-center py-8 text-gray-400">{t('systemSettings.waitingList.loadingEntries')}</div>
                ) : waitingListEntries.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {t('systemSettings.waitingList.noEntries')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700 border-b border-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.waitingList.name')}</th>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.waitingList.email')}</th>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden md:table-cell">{t('systemSettings.waitingList.nationality')}</th>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden lg:table-cell">{t('systemSettings.waitingList.source')}</th>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.waitingList.status')}</th>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden lg:table-cell">{t('systemSettings.waitingList.created')}</th>
                          <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.waitingList.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {waitingListEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 text-white text-sm">{entry.name}</td>
                            <td className="px-4 py-3 text-gray-300 text-sm">{entry.email}</td>
                            <td className="px-4 py-3 text-gray-300 text-sm hidden md:table-cell">{entry.nationality}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{entry.source}</td>
                            <td className="px-4 py-3">
                              <select
                                value={entry.status}
                                onChange={(e) => updateWaitingListStatus(entry.id, e.target.value)}
                                className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600"
                              >
                                <option value="pending">Pending</option>
                                <option value="contacted">Contacted</option>
                                <option value="converted">Converted</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteWaitingListEntry(entry.id)}
                                className="text-red-400 border-red-600 hover:bg-red-600 hover:text-white"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="mt-4 text-sm text-gray-400 text-center">
                      Total entries: {waitingListEntries.length}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <div className="space-y-6">
              {/* Subscriber Statistics Card */}
              <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center">
                        <Users className="w-6 h-6 mr-2 text-[#00C2A8]" />
                        Subscribers
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-2">
                        Overview of all platform subscribers
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className="text-center text-gray-400 py-8">Loading statistics...</div>
                  ) : (
                    <div className="space-y-6">
                      {/* Filter Controls */}
                      <div className="flex flex-col gap-4 pb-4 border-b border-gray-700">
                        {/* Period Selector */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <Label className="text-sm font-medium text-white">Period:</Label>
                          </div>
                          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                            {[
                              { value: '7d', label: '7 Days' },
                              { value: '30d', label: '30 Days' },
                              { value: '90d', label: '90 Days' },
                              { value: '1y', label: '1 Year' },
                              { value: 'all', label: 'All Time' }
                            ].map((period) => (
                              <Button
                                key={period.value}
                                onClick={() => handlePeriodChange(period.value)}
                                variant="outline"
                                size="sm"
                                className={`text-xs sm:text-sm ${
                                  selectedPeriod === period.value
                                    ? 'bg-[#00C2A8] text-white border-[#00C2A8] hover:bg-[#00a890]'
                                    : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                }`}
                              >
                                {period.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Compare Toggle */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <ArrowLeftRight className="w-5 h-5 text-gray-400" />
                            <Label className="text-sm font-medium text-white">Compare:</Label>
                          </div>
                          <Button
                            onClick={handleCompareToggle}
                            variant="outline"
                            size="sm"
                            className={`w-full sm:w-auto ${
                              compareEnabled
                                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                                : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {compareEnabled ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                      </div>

                      {/* Comparison Alert */}
                      {compareEnabled && subscriberStats.comparison && (
                        <div className="p-4 rounded-lg border" style={{ 
                          backgroundColor: subscriberStats.comparison.change >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          borderColor: subscriberStats.comparison.change >= 0 ? '#22c55e' : '#ef4444'
                        }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">Period Comparison</p>
                              <p className="text-xs text-gray-400 mt-1">vs previous {selectedPeriod === '7d' ? '7 days' : selectedPeriod === '30d' ? '30 days' : selectedPeriod === '90d' ? '90 days' : selectedPeriod === '1y' ? 'year' : 'period'}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                {subscriberStats.comparison.change >= 0 ? (
                                  <TrendingUp className="w-5 h-5 text-green-400" />
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-red-400" />
                                )}
                                <span className={`text-2xl font-bold ${subscriberStats.comparison.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {subscriberStats.comparison.change >= 0 ? '+' : ''}{subscriberStats.comparison.change}
                                </span>
                              </div>
                              <p className={`text-sm mt-1 ${subscriberStats.comparison.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {subscriberStats.comparison.change_percentage >= 0 ? '+' : ''}{subscriberStats.comparison.change_percentage}% change
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Key Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Total Subscribers */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400">Total Subscribers</p>
                          <p className="text-3xl font-bold text-white mt-2">{subscriberStats.total_subscribers.toLocaleString()}</p>
                          <div className="flex items-center mt-3">
                            {subscriberStats.growth_percentage >= 0 ? (
                              <>
                                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                                <span className="text-sm text-green-400">+{subscriberStats.growth_percentage}%</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
                                <span className="text-sm text-red-400">{subscriberStats.growth_percentage}%</span>
                              </>
                            )}
                            <span className="text-sm text-gray-400 ml-2">
                              in {selectedPeriod === '7d' ? 'last 7 days' : selectedPeriod === '30d' ? 'last 30 days' : selectedPeriod === '90d' ? 'last 90 days' : selectedPeriod === '1y' ? 'last year' : 'all time'}
                            </span>
                          </div>
                        </div>

                        {/* Paid Subscribers */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400">Paid Subscribers</p>
                          <p className="text-3xl font-bold text-white mt-2">{subscriberStats.paid_subscribers.toLocaleString()}</p>
                          <div className="flex items-center mt-3 space-x-2">
                            <Badge className="bg-blue-600 text-white text-xs">Pro: {subscriberStats.pro_subscribers}</Badge>
                            <Badge className="bg-purple-600 text-white text-xs">Premium: {subscriberStats.premium_subscribers}</Badge>
                          </div>
                        </div>

                        {/* Free Subscribers */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400">Free Subscribers</p>
                          <p className="text-3xl font-bold text-white mt-2">{subscriberStats.free_subscribers.toLocaleString()}</p>
                          <div className="flex items-center mt-3">
                            <span className="text-sm text-gray-400">
                              {subscriberStats.total_subscribers > 0 
                                ? Math.round((subscriberStats.free_subscribers / subscriberStats.total_subscribers) * 100)
                                : 0}% of total
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Subscriber Growth Chart */}
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Subscriber Growth Over Time</h3>
                        <div style={{ height: '350px', position: 'relative' }}>
                          <ChartLine
                            data={{
                              labels: subscriberStats.time_series.map(item => {
                                const date = new Date(item.date);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              }),
                              datasets: [{
                                label: 'Total Subscribers',
                                data: subscriberStats.time_series.map(item => item.count),
                                borderColor: '#00C2A8',
                                backgroundColor: (context) => {
                                  const ctx = context.chart.ctx;
                                  const gradient = ctx.createLinearGradient(0, 0, 0, 350);
                                  gradient.addColorStop(0, 'rgba(0, 194, 168, 0.4)');
                                  gradient.addColorStop(1, 'rgba(0, 194, 168, 0)');
                                  return gradient;
                                },
                                borderWidth: 3,
                                fill: true,
                                tension: 0.4,
                                pointBackgroundColor: '#00C2A8',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 3,
                                pointRadius: 5,
                                pointHoverRadius: 8,
                                pointHoverBackgroundColor: '#00C2A8',
                                pointHoverBorderColor: '#fff',
                                pointHoverBorderWidth: 3,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: {
                                intersect: false,
                                mode: 'index',
                              },
                              plugins: {
                                legend: {
                                  display: true,
                                  position: 'bottom',
                                  labels: {
                                    color: '#ffffff',
                                    font: {
                                      size: 13,
                                      weight: '500'
                                    },
                                    padding: 20,
                                    usePointStyle: true,
                                    pointStyle: 'circle'
                                  }
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                  titleColor: '#ffffff',
                                  bodyColor: '#00C2A8',
                                  borderColor: '#00C2A8',
                                  borderWidth: 1,
                                  borderRadius: 12,
                                  padding: 16,
                                  titleFont: {
                                    size: 13,
                                    weight: '600'
                                  },
                                  bodyFont: {
                                    size: 14,
                                    weight: '500'
                                  },
                                  callbacks: {
                                    label: function(context) {
                                      return `Subscribers: ${context.parsed.y.toLocaleString()}`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                x: {
                                  grid: {
                                    color: 'rgba(255, 255, 255, 0.1)',
                                    drawTicks: false,
                                    drawBorder: true,
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    borderWidth: 2
                                  },
                                  ticks: {
                                    color: '#ffffff',
                                    font: {
                                      size: 12,
                                      weight: '500'
                                    },
                                    padding: 8
                                  }
                                },
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(255, 255, 255, 0.1)',
                                    drawTicks: false,
                                    drawBorder: true,
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    borderWidth: 2
                                  },
                                  ticks: {
                                    color: '#ffffff',
                                    font: {
                                      size: 12,
                                      weight: '500'
                                    },
                                    padding: 8,
                                    callback: function(value) {
                                      return value.toLocaleString();
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Business Metrics Card */}
              <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <DollarSign className="w-6 h-6 mr-2 text-[#00C2A8]" />
                    Business Metrics
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-2">
                    Revenue and conversion analytics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className="text-center text-gray-400 py-8">Loading metrics...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Monthly Recurring Revenue */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">MRR</p>
                            <DollarSign className="w-5 h-5 text-green-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            €{subscriberStats.business_metrics?.mrr?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Monthly Recurring Revenue</p>
                        </div>

                        {/* Annual Recurring Revenue */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">ARR</p>
                            <DollarSign className="w-5 h-5 text-blue-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            €{subscriberStats.business_metrics?.arr?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Annual Recurring Revenue</p>
                        </div>

                        {/* Conversion Rate */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Conversion Rate</p>
                            <Percent className="w-5 h-5 text-purple-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.business_metrics?.conversion_rate || '0'}%
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Free to Paid</p>
                        </div>

                        {/* Customer Lifetime Value */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">LTV</p>
                            <Zap className="w-5 h-5 text-yellow-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            €{subscriberStats.business_metrics?.ltv?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Customer Lifetime Value</p>
                        </div>
                      </div>

                      {/* Additional Metrics Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {/* ARPU */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-400 mb-1">ARPU</p>
                              <p className="text-xl font-bold text-white">
                                €{subscriberStats.business_metrics?.arpu?.toFixed(2) || '0.00'}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">Average Revenue Per User</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-400 mb-1">ARPPU</p>
                              <p className="text-xl font-bold text-white">
                                €{subscriberStats.business_metrics?.arppu?.toFixed(2) || '0.00'}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">Per Paid User</p>
                            </div>
                          </div>
                        </div>

                        {/* Plan Distribution */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400 mb-3">Paid Plan Distribution</p>
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-300">Pro</span>
                                <span className="text-sm font-semibold text-white">
                                  {subscriberStats.business_metrics?.pro_percentage || '0'}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full" 
                                  style={{ width: `${subscriberStats.business_metrics?.pro_percentage || 0}%` }}
                                ></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-300">Premium</span>
                                <span className="text-sm font-semibold text-white">
                                  {subscriberStats.business_metrics?.premium_percentage || '0'}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-purple-500 h-2 rounded-full" 
                                  style={{ width: `${subscriberStats.business_metrics?.premium_percentage || 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Community Metrics Card */}
              <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <MessageSquare className="w-6 h-6 mr-2 text-[#00C2A8]" />
                    Community Metrics
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-2">
                    User engagement and activity statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className="text-center text-gray-400 py-8">Loading community data...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Posts */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Total Posts</p>
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.community_metrics?.total_posts?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            in {selectedPeriod === '7d' ? 'last 7 days' : selectedPeriod === '30d' ? 'last 30 days' : selectedPeriod === '90d' ? 'last 90 days' : selectedPeriod === '1y' ? 'last year' : 'all time'}
                          </p>
                        </div>

                        {/* Active Posters */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Active Posters</p>
                            <UserCheck className="w-5 h-5 text-green-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.community_metrics?.unique_posters?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Unique contributors</p>
                        </div>

                        {/* Total Engagement */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Total Engagement</p>
                            <Activity className="w-5 h-5 text-purple-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {((subscriberStats.community_metrics?.total_likes || 0) + (subscriberStats.community_metrics?.total_comments || 0)).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Likes + Comments</p>
                        </div>

                        {/* Engagement Rate */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Engagement Rate</p>
                            <Percent className="w-5 h-5 text-orange-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.community_metrics?.engagement_rate || '0'}%
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Active vs Total Users</p>
                        </div>
                      </div>

                      {/* Engagement Details Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {/* Likes & Comments Breakdown */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400 mb-3">Average Engagement Per Post</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Heart className="w-4 h-4 text-red-400" />
                                <span className="text-sm text-gray-300">Likes per Post</span>
                              </div>
                              <span className="text-lg font-semibold text-white">
                                {subscriberStats.community_metrics?.avg_likes_per_post?.toFixed(1) || '0.0'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-400" />
                                <span className="text-sm text-gray-300">Comments per Post</span>
                              </div>
                              <span className="text-lg font-semibold text-white">
                                {subscriberStats.community_metrics?.avg_comments_per_post?.toFixed(1) || '0.0'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Activity Summary */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400 mb-3">Community Activity</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">Total Likes</span>
                              <div className="flex items-center gap-2">
                                <Heart className="w-4 h-4 text-red-400" />
                                <span className="text-lg font-semibold text-white">
                                  {subscriberStats.community_metrics?.total_likes?.toLocaleString() || '0'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">Total Comments</span>
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-400" />
                                <span className="text-lg font-semibold text-white">
                                  {subscriberStats.community_metrics?.total_comments?.toLocaleString() || '0'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Referral Metrics Card */}
              <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <UserPlus className="w-6 h-6 mr-2 text-[#00C2A8]" />
                    Referral Metrics
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-2">
                    Referral program performance and rewards
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className="text-center text-gray-400 py-8">Loading referral data...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Referrals */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Total Referrals</p>
                            <UserPlus className="w-5 h-5 text-blue-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.referral_metrics?.total_referrals?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            in {selectedPeriod === '7d' ? 'last 7 days' : selectedPeriod === '30d' ? 'last 30 days' : selectedPeriod === '90d' ? 'last 90 days' : selectedPeriod === '1y' ? 'last year' : 'all time'}
                          </p>
                        </div>

                        {/* Successful Conversions */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Conversions</p>
                            <Target className="w-5 h-5 text-green-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.referral_metrics?.successful_referrals?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Successful sign-ups</p>
                        </div>

                        {/* Conversion Rate */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Conversion Rate</p>
                            <Percent className="w-5 h-5 text-purple-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {subscriberStats.referral_metrics?.referral_conversion_rate || '0'}%
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Referral to sign-up</p>
                        </div>

                        {/* Total Rewards */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-400">Rewards Paid</p>
                            <Gift className="w-5 h-5 text-yellow-400" />
                          </div>
                          <p className="text-2xl font-bold text-white">
                            €{subscriberStats.referral_metrics?.total_rewards?.toLocaleString() || '0'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">Total distributed</p>
                        </div>
                      </div>

                      {/* Additional Referral Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {/* Active Referrers */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400 mb-3">Referrer Activity</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">Active Referrers</span>
                              <span className="text-xl font-bold text-white">
                                {subscriberStats.referral_metrics?.unique_referrers?.toLocaleString() || '0'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">Participation Rate</span>
                              <span className="text-xl font-bold text-white">
                                {subscriberStats.referral_metrics?.referral_participation || '0'}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                              <span className="text-sm text-gray-300">Avg Referrals per User</span>
                              <span className="text-xl font-bold text-white">
                                {subscriberStats.referral_metrics?.avg_referrals_per_user || '0'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Performance Summary */}
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111827', borderColor: '#374151', border: '1px solid' }}>
                          <p className="text-sm font-medium text-gray-400 mb-3">Program Performance</p>
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-300">Success Rate</span>
                                <span className="text-sm font-semibold text-white">
                                  {subscriberStats.referral_metrics?.referral_conversion_rate || '0'}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full" 
                                  style={{ width: `${Math.min(subscriberStats.referral_metrics?.referral_conversion_rate || 0, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-300">User Participation</span>
                                <span className="text-sm font-semibold text-white">
                                  {subscriberStats.referral_metrics?.referral_participation || '0'}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full" 
                                  style={{ width: `${Math.min(subscriberStats.referral_metrics?.referral_participation || 0, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          {/* Cookies Tab */}
          <TabsContent value="cookies">
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Cookie className="w-5 h-5" />
                  {t('systemSettings.cookies.title')}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {t('systemSettings.cookies.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cookie Banner Enabled */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                    <div>
                      <Label className="text-white font-medium">{t('systemSettings.cookies.enableCookieConsent')}</Label>
                      <p className="text-xs text-gray-400 mt-1">
                        Show cookie consent banner to visitors (Google Consent Mode v2 compliant)
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={cookieSettings.enabled}
                      onChange={(e) => setCookieSettings({
                        ...cookieSettings,
                        enabled: e.target.checked
                      })}
                      className="w-5 h-5 rounded border-gray-600 text-[#00C2A8] focus:ring-[#00C2A8]"
                    />
                  </div>

                  {/* Auto-Scan Settings */}
                  <div className="p-4 bg-gray-900 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white font-medium">{t('systemSettings.cookies.autoScanEnabled')}</Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Automatically scan for new cookies every week (Monday 2 AM)
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={cookieSettings.auto_scan_enabled}
                        onChange={(e) => setCookieSettings({
                          ...cookieSettings,
                          auto_scan_enabled: e.target.checked
                        })}
                        className="w-5 h-5 rounded border-gray-600 text-[#00C2A8] focus:ring-[#00C2A8]"
                      />
                    </div>

                    {/* Manual Scan Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                      <div>
                        <Label className="text-white font-medium">{t('systemSettings.cookies.scanCookies')}</Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Scan for cookies from frontend, backend, and third-party services
                        </p>
                        {cookieSettings.last_scan && (
                          <p className="text-xs text-gray-500 mt-1">
                            Last scan: {new Date(cookieSettings.last_scan.scanned_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handleScanCookies}
                        disabled={scanningCookies}
                        className="bg-[#00C2A8] hover:bg-[#00a892] text-white"
                      >
                        {scanningCookies ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            {t('systemSettings.cookies.scanningCookies')}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t('systemSettings.cookies.scanCookies')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Detected Cookies */}
                  {cookieSettings?.detected_cookies?.length > 0 && (
                    <div className="p-4 bg-gray-900 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-white font-medium">
                          Detected Cookies ({cookieSettings.detected_cookies.length})
                        </Label>
                        <Badge variant="secondary" className="bg-[#00C2A8] text-white">
                          {cookieSettings.last_scan?.scanned_at ? 
                            `Scanned ${new Date(cookieSettings.last_scan.scanned_at).toLocaleDateString()}` 
                            : 'Not scanned yet'}
                        </Badge>
                      </div>

                      {/* Cookie Categories */}
                      <div className="space-y-3">
                        {['necessary', 'analytics', 'marketing', 'functional'].map(category => {
                          const categoryCookies = (cookieSettings.detected_cookies || []).filter(
                            c => c.category === category
                          );
                          
                          if (categoryCookies.length === 0) return null;
                          
                          return (
                            <div key={category} className="border border-gray-700 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-[#00C2A8]" />
                                <span className="text-white font-medium capitalize">
                                  {category} ({categoryCookies.length})
                                </span>
                              </div>
                              <div className="space-y-2">
                                {categoryCookies.map((cookie, idx) => (
                                  <div 
                                    key={idx} 
                                    className="flex items-start justify-between text-xs p-2 bg-gray-800 rounded"
                                  >
                                    <div className="flex-1">
                                      <div className="text-white font-mono">{cookie.name}</div>
                                      <div className="text-gray-400 mt-1">{cookie.description}</div>
                                      <div className="flex gap-4 mt-1 text-gray-500">
                                        <span>Domain: {cookie.domain}</span>
                                        <span>Expiry: {cookie.expiry}</span>
                                        <span>Source: {cookie.source}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Banner Text Customization */}
                  <div className="p-4 bg-gray-900 rounded-lg space-y-4">
                    <Label className="text-white font-medium">Cookie Banner Customization</Label>
                    <p className="text-xs text-gray-400">
                      Customize the text displayed in the cookie consent banner
                    </p>

                    {/* Banner Title */}
                    <div>
                      <Label className="text-gray-300 text-sm">Banner Title</Label>
                      <Input
                        value={cookieSettings?.consent_texts?.banner_title || ''}
                        onChange={(e) => setCookieSettings({
                          ...cookieSettings,
                          consent_texts: {
                            ...cookieSettings.consent_texts,
                            banner_title: e.target.value
                          }
                        })}
                        className="bg-gray-800 border-gray-700 text-white mt-1"
                        placeholder="We value your privacy"
                      />
                    </div>

                    {/* Banner Description */}
                    <div>
                      <Label className="text-gray-300 text-sm">Banner Description</Label>
                      <Textarea
                        value={cookieSettings?.consent_texts?.banner_description || ''}
                        onChange={(e) => setCookieSettings({
                          ...cookieSettings,
                          consent_texts: {
                            ...cookieSettings.consent_texts,
                            banner_description: e.target.value
                          }
                        })}
                        className="bg-gray-800 border-gray-700 text-white mt-1"
                        rows={3}
                        placeholder="We use cookies to enhance your browsing experience..."
                      />
                    </div>

                    {/* Button Labels */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm">Accept All Button</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.accept_all_button || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              accept_all_button: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm">Reject All Button</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.reject_all_button || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              reject_all_button: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm">Customize Button</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.customize_button || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              customize_button: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm">Save Preferences Button</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.save_preferences_button || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              save_preferences_button: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>
                    </div>

                    {/* Cookie Policy Link */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 text-sm">Cookie Policy Text</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.cookie_policy_text || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              cookie_policy_text: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm">Cookie Policy Link</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.cookie_policy_link || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              cookie_policy_link: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1"
                          placeholder="/cookie-policy"
                        />
                      </div>
                    </div>

                    {/* Category Descriptions */}
                    <div className="space-y-4 pt-4 border-t border-gray-700">
                      <Label className="text-white font-medium">Cookie Category Descriptions</Label>
                      
                      {/* Necessary */}
                      <div>
                        <Label className="text-gray-300 text-sm">Necessary Cookies Title</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.necessary_title || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              necessary_title: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1 mb-2"
                        />
                        <Textarea
                          value={cookieSettings?.consent_texts?.necessary_description || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              necessary_description: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white"
                          rows={2}
                        />
                      </div>

                      {/* Analytics */}
                      <div>
                        <Label className="text-gray-300 text-sm">Analytics Cookies Title</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.analytics_title || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              analytics_title: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1 mb-2"
                        />
                        <Textarea
                          value={cookieSettings?.consent_texts?.analytics_description || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              analytics_description: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white"
                          rows={2}
                        />
                      </div>

                      {/* Marketing */}
                      <div>
                        <Label className="text-gray-300 text-sm">Marketing Cookies Title</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.marketing_title || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              marketing_title: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1 mb-2"
                        />
                        <Textarea
                          value={cookieSettings?.consent_texts?.marketing_description || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              marketing_description: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white"
                          rows={2}
                        />
                      </div>

                      {/* Functional */}
                      <div>
                        <Label className="text-gray-300 text-sm">Functional Cookies Title</Label>
                        <Input
                          value={cookieSettings?.consent_texts?.functional_title || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              functional_title: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white mt-1 mb-2"
                        />
                        <Textarea
                          value={cookieSettings?.consent_texts?.functional_description || ''}
                          onChange={(e) => setCookieSettings({
                            ...cookieSettings,
                            consent_texts: {
                              ...cookieSettings.consent_texts,
                              functional_description: e.target.value
                            }
                          })}
                          className="bg-gray-800 border-gray-700 text-white"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GTM Integration Settings */}
                  <div className="p-4 bg-gray-900 rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-white font-medium">Google Consent Mode v2 Integration</Label>
                      <Badge variant="secondary" className="bg-blue-600 text-white text-xs">
                        GTM
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      Integrates with Google Tag Manager for consent management. Make sure you've added your GTM snippet in the Advanced tab.
                    </p>
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                      <div>
                        <Label className="text-gray-300 text-sm">Enable GTM Consent Mode</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Sends consent signals to GTM container
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={cookieSettings.gtm_integration.enabled}
                        onChange={(e) => setCookieSettings({
                          ...cookieSettings,
                          gtm_integration: {
                            ...cookieSettings.gtm_integration,
                            enabled: e.target.checked
                          }
                        })}
                        className="w-5 h-5 rounded border-gray-600 text-[#00C2A8] focus:ring-[#00C2A8]"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                    <Button
                      onClick={handleSaveCookieSettings}
                      disabled={loadingCookieSettings}
                      className="bg-[#00C2A8] hover:bg-[#00a892] text-white"
                    >
                      {loadingCookieSettings ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Cookie Settings
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced">
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">{t('systemSettings.advanced.title')}</CardTitle>
                <CardDescription className="text-gray-400">
                  {t('systemSettings.advanced.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* SEO Settings Section */}
                <div className="space-y-4 pb-6 border-b border-gray-700">
                  <div>
                    <Label className="text-sm font-medium text-white">
                      {t('systemSettings.advanced.branding')}
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Configure site title, favicon, and logo for your application
                    </p>
                  </div>

                  {/* Site Title */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      {t('systemSettings.advanced.appName')}
                    </Label>
                    <Input
                      type="text"
                      value={advancedSettings.seo.siteTitle}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        seo: {
                          ...prev.seo,
                          siteTitle: e.target.value
                        }
                      }))}
                      placeholder={t('systemSettings.advanced.appNamePlaceholder')}
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-400">
                      Appears in browser tabs, headers, and footers
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      Meta Description
                    </Label>
                    <textarea
                      value={advancedSettings.seo.metaDescription}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        seo: {
                          ...prev.seo,
                          metaDescription: e.target.value
                        }
                      }))}
                      placeholder="A brief description of your site for search engines and social media"
                      rows="3"
                      className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00C2A8]"
                    />
                    <p className="text-xs text-gray-400">
                      Displayed in search results and social media shares (recommended: 150-160 characters)
                    </p>
                  </div>

                  {/* Favicon Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      {t('systemSettings.advanced.favicon')} (16x16 or 32x32 recommended)
                    </Label>
                    <div className="flex items-center gap-4">
                      {advancedSettings.seo.faviconUrl && (
                        <div className="w-12 h-12 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                          <img
                            src={`${BACKEND_URL}${advancedSettings.seo.faviconUrl}`}
                            alt={t('systemSettings.faviconPreview')}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSEOImageUpload('favicon', e.target.files[0])}
                          className="hidden"
                          id="favicon-upload"
                        />
                        <label
                          htmlFor="favicon-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {t('systemSettings.advanced.uploadFavicon')}
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      Small icon that appears in browser tabs
                    </p>
                  </div>

                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      {t('systemSettings.advanced.logo')} (Square format recommended)
                    </Label>
                    <div className="flex items-center gap-4">
                      {advancedSettings.seo.logoUrl && (
                        <div className="w-16 h-16 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                          <img
                            src={`${BACKEND_URL}${advancedSettings.seo.logoUrl}`}
                            alt={t('systemSettings.logoPreview')}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSEOImageUpload('logo', e.target.files[0])}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {t('systemSettings.advanced.uploadLogo')}
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      Appears in headers and footers throughout the site
                    </p>
                  </div>

                  {/* OG Image Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      Open Graph Image (1200x630 recommended)
                    </Label>
                    <div className="flex items-center gap-4">
                      {advancedSettings.seo.ogImage && (
                        <div className="w-32 h-16 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                          <img
                            src={`${BACKEND_URL}${advancedSettings.seo.ogImage}`}
                            alt="OG Image preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSEOImageUpload('og_image', e.target.files[0])}
                          className="hidden"
                          id="og-image-upload"
                        />
                        <label
                          htmlFor="og-image-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload OG Image
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      Displayed when sharing your site on social media (Facebook, Twitter, LinkedIn, etc.)
                    </p>
                  </div>
                </div>

                {/* OpenAI API Key */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">
                    OpenAI API Key
                  </Label>
                  <p className="text-xs text-gray-400 mb-2">
                    Global OpenAI API key used for all AI Coach features across all users
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type={advancedSettings.showKey ? 'text' : 'password'}
                      value={advancedSettings.openaiApiKey}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        openaiApiKey: e.target.value
                      }))}
                      placeholder="sk-..."
                      className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                    />
                    <Button
                      type="button"
                      onClick={() => setAdvancedSettings(prev => ({
                        ...prev,
                        showKey: !prev.showKey
                      }))}
                      className="bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      {advancedSettings.showKey ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">OpenAI Platform</a>
                  </p>
                </div>

                {/* Stripe Configuration */}
                <div className="space-y-4 pt-6 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium text-white">
                        Stripe Configuration
                      </Label>
                      <p className="text-xs text-gray-400 mt-1">
                        Configure Stripe API keys and webhooks for payment processing
                      </p>
                    </div>
                    
                    {/* Mode Toggle Switch */}
                    <div className="flex items-center gap-3 bg-gray-900 px-4 py-2 rounded-full border border-gray-700">
                      <span className={`text-sm font-medium transition-colors ${advancedSettings.stripe.mode === 'test' ? 'text-yellow-400' : 'text-gray-500'}`}>
                        Test
                      </span>
                      <button
                        type="button"
                        onClick={() => setAdvancedSettings(prev => ({
                          ...prev,
                          stripe: {
                            ...prev.stripe,
                            mode: prev.stripe.mode === 'live' ? 'test' : 'live'
                          }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          advancedSettings.stripe.mode === 'live' ? 'bg-green-600' : 'bg-yellow-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            advancedSettings.stripe.mode === 'live' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className={`text-sm font-medium transition-colors ${advancedSettings.stripe.mode === 'live' ? 'text-green-400' : 'text-gray-500'}`}>
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Active Mode Indicator */}
                  <div className={`p-3 rounded-lg border ${
                    advancedSettings.stripe.mode === 'live' 
                      ? 'bg-green-900/20 border-green-700' 
                      : 'bg-yellow-900/20 border-yellow-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        advancedSettings.stripe.mode === 'live' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                      <p className={`text-sm font-medium ${
                        advancedSettings.stripe.mode === 'live' ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        Currently using {advancedSettings.stripe.mode === 'live' ? 'LIVE' : 'TEST'} mode credentials
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 ml-4">
                      {advancedSettings.stripe.mode === 'live' 
                        ? 'Real payments will be processed. Use with caution in production.'
                        : 'Test mode - No real charges will be made. Safe for development and testing.'
                      }
                    </p>
                  </div>

                  {/* Live Mode */}
                  <div className="space-y-3 p-4 bg-gray-900 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <Label className="text-sm font-semibold text-white">
                        Live Mode
                      </Label>
                    </div>

                    {/* Live Publishable Key */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-300">
                        Publishable Key
                      </Label>
                      <Input
                        type="text"
                        value={advancedSettings.stripe.live.publishableKey || ''}
                        onChange={(e) => setAdvancedSettings(prev => ({
                          ...prev,
                          stripe: {
                            ...prev.stripe,
                            live: {
                              ...prev.stripe.live,
                              publishableKey: e.target.value
                            }
                          }
                        }))}
                        placeholder="pk_live_..."
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                      />
                    </div>

                    {/* Live API Key */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-300">
                        API Secret Key
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type={advancedSettings.showStripeLiveKey ? 'text' : 'password'}
                          value={advancedSettings.stripe.live.apiKey}
                          onChange={(e) => setAdvancedSettings(prev => ({
                            ...prev,
                            stripe: {
                              ...prev.stripe,
                              live: {
                                ...prev.stripe.live,
                                apiKey: e.target.value
                              }
                            }
                          }))}
                          placeholder="sk_live_..."
                          className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                        />
                        <Button
                          type="button"
                          onClick={() => setAdvancedSettings(prev => ({
                            ...prev,
                            showStripeLiveKey: !prev.showStripeLiveKey
                          }))}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3"
                        >
                          {advancedSettings.showStripeLiveKey ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>

                    {/* Live Webhook Secret */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-300">
                        Webhook Signing Secret
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type={advancedSettings.showStripeLiveWebhook ? 'text' : 'password'}
                          value={advancedSettings.stripe.live.webhookSecret}
                          onChange={(e) => setAdvancedSettings(prev => ({
                            ...prev,
                            stripe: {
                              ...prev.stripe,
                              live: {
                                ...prev.stripe.live,
                                webhookSecret: e.target.value
                              }
                            }
                          }))}
                          placeholder="whsec_..."
                          className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                        />
                        <Button
                          type="button"
                          onClick={() => setAdvancedSettings(prev => ({
                            ...prev,
                            showStripeLiveWebhook: !prev.showStripeLiveWebhook
                          }))}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3"
                        >
                          {advancedSettings.showStripeLiveWebhook ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Test/Sandbox Mode */}
                  <div className="space-y-3 p-4 bg-gray-900 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <Label className="text-sm font-semibold text-white">
                        Test Mode (Sandbox)
                      </Label>
                    </div>

                    {/* Sandbox Publishable Key */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-300">
                        Publishable Key
                      </Label>
                      <Input
                        type="text"
                        value={advancedSettings.stripe.sandbox.publishableKey || ''}
                        onChange={(e) => setAdvancedSettings(prev => ({
                          ...prev,
                          stripe: {
                            ...prev.stripe,
                            sandbox: {
                              ...prev.stripe.sandbox,
                              publishableKey: e.target.value
                            }
                          }
                        }))}
                        placeholder="pk_test_..."
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                      />
                    </div>

                    {/* Sandbox API Key */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-300">
                        API Secret Key
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type={advancedSettings.showStripeSandboxKey ? 'text' : 'password'}
                          value={advancedSettings.stripe.sandbox.apiKey}
                          onChange={(e) => setAdvancedSettings(prev => ({
                            ...prev,
                            stripe: {
                              ...prev.stripe,
                              sandbox: {
                                ...prev.stripe.sandbox,
                                apiKey: e.target.value
                              }
                            }
                          }))}
                          placeholder="sk_test_..."
                          className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                        />
                        <Button
                          type="button"
                          onClick={() => setAdvancedSettings(prev => ({
                            ...prev,
                            showStripeSandboxKey: !prev.showStripeSandboxKey
                          }))}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3"
                        >
                          {advancedSettings.showStripeSandboxKey ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>

                    {/* Sandbox Webhook Secret */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-300">
                        Webhook Signing Secret
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type={advancedSettings.showStripeSandboxWebhook ? 'text' : 'password'}
                          value={advancedSettings.stripe.sandbox.webhookSecret}
                          onChange={(e) => setAdvancedSettings(prev => ({
                            ...prev,
                            stripe: {
                              ...prev.stripe,
                              sandbox: {
                                ...prev.stripe.sandbox,
                                webhookSecret: e.target.value
                              }
                            }
                          }))}
                          placeholder="whsec_..."
                          className="flex-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
                        />
                        <Button
                          type="button"
                          onClick={() => setAdvancedSettings(prev => ({
                            ...prev,
                            showStripeSandboxWebhook: !prev.showStripeSandboxWebhook
                          }))}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3"
                        >
                          {advancedSettings.showStripeSandboxWebhook ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400">
                    Get your Stripe API keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">Stripe Dashboard → Developers → API keys</a>
                    <br />
                    Configure webhooks at <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">Stripe Dashboard → Developers → Webhooks</a>
                  </p>
                </div>

                {/* SendGrid Configuration */}
                <div className="space-y-4 pt-6 border-t border-gray-700">
                  <div>
                    <Label className="text-sm font-medium text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#00C2A8]" />
                      {t('systemSettings.advanced.emailSettings')}
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Configure SendGrid API for transactional emails (password resets, notifications, etc.)
                    </p>
                  </div>

                  {/* SendGrid API Key */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      SendGrid API Key
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type={advancedSettings.showSendgridKey ? 'text' : 'password'}
                        value={advancedSettings.sendgrid.apiKey}
                        onChange={(e) => setAdvancedSettings(prev => ({
                          ...prev,
                          sendgrid: {
                            ...prev.sendgrid,
                            apiKey: e.target.value
                          }
                        }))}
                        placeholder="SG...."
                        className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-sm"
                      />
                      <Button
                        type="button"
                        onClick={() => setAdvancedSettings(prev => ({
                          ...prev,
                          showSendgridKey: !prev.showSendgridKey
                        }))}
                        className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3"
                      >
                        {advancedSettings.showSendgridKey ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">SendGrid Dashboard → Settings → API Keys</a>
                    </p>
                  </div>

                  {/* Sender Email */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      {t('systemSettings.advanced.emailFromAddress')}
                    </Label>
                    <Input
                      type="email"
                      value={advancedSettings.sendgrid.senderEmail}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        sendgrid: {
                          ...prev.sendgrid,
                          senderEmail: e.target.value
                        }
                      }))}
                      placeholder={t('systemSettings.advanced.emailFromAddressPlaceholder')}
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Must be a verified sender in SendGrid. Configure at <a href="https://app.sendgrid.com/settings/sender_auth" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">Sender Authentication</a>
                    </p>
                  </div>

                  {/* Sender Name */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-300">
                      {t('systemSettings.emailFromName')}
                    </Label>
                    <Input
                      type="text"
                      value={advancedSettings.sendgrid.senderName}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        sendgrid: {
                          ...prev.sendgrid,
                          senderName: e.target.value
                        }
                      }))}
                      placeholder="TrainSmart"
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      The name that will appear in the "From" field of emails
                    </p>
                  </div>

                  <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                    <p className="text-xs text-blue-200">
                      <strong>Note:</strong> Make sure you have completed domain authentication in SendGrid to ensure high email deliverability. After saving, test email functionality with a password reset or notification.
                    </p>
                  </div>
                </div>

                {/* Google Tag Manager Configuration */}
                <div className="space-y-4 pt-6 border-t border-gray-700">
                  <div>
                    <Label className="text-sm font-medium text-white">
                      Google Tag Manager
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Add your Google Tag Manager (GTM) tracking codes
                    </p>
                  </div>

                  {/* GTM Head Code */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">
                      GTM Head Code
                    </Label>
                    <p className="text-xs text-gray-400">
                      Paste the GTM code that should be placed in the <code className="bg-gray-900 px-1 py-0.5 rounded text-[#00C2A8]">&lt;head&gt;</code> section
                    </p>
                    <Textarea
                      value={advancedSettings.googleTagManager.headCode}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        googleTagManager: {
                          ...prev.googleTagManager,
                          headCode: e.target.value
                        }
                      }))}
                      placeholder="<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->"
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-xs font-mono h-32"
                    />
                  </div>

                  {/* GTM Body Code */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">
                      GTM Body Code
                    </Label>
                    <p className="text-xs text-gray-400">
                      Paste the GTM code that should be placed at the opening of the <code className="bg-gray-900 px-1 py-0.5 rounded text-[#00C2A8]">&lt;body&gt;</code> tag
                    </p>
                    <Textarea
                      value={advancedSettings.googleTagManager.bodyCode}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        googleTagManager: {
                          ...prev.googleTagManager,
                          bodyCode: e.target.value
                        }
                      }))}
                      placeholder="<!-- Google Tag Manager (noscript) -->
<noscript><iframe src='https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX'...></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->"
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-xs font-mono h-32"
                    />
                  </div>

                  <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                    <p className="text-xs text-blue-200">
                      <strong>Note:</strong> Get your GTM container code from <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">Google Tag Manager</a>. After saving, the codes will be automatically injected into your site's HTML.
                    </p>
                  </div>
                </div>

                {/* Microsoft Clarity Section */}
                <div className="space-y-4 p-6 bg-gray-700/30 rounded-lg border border-gray-600">
                  <div>
                    <Label className="text-base font-semibold text-white flex items-center">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <rect width="24" height="24" rx="4" fill="#0078D4"/>
                        <path d="M7 7h10v10H7z" fill="white"/>
                      </svg>
                      Microsoft Clarity
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Add your Microsoft Clarity tracking script for session recording and heatmaps
                    </p>
                  </div>

                  {/* Clarity Script Code */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">
                      Clarity Tracking Script
                    </Label>
                    <p className="text-xs text-gray-400">
                      Paste your complete Microsoft Clarity tracking script (including <code className="bg-gray-900 px-1 py-0.5 rounded text-[#00C2A8]">&lt;script&gt;</code> tags)
                    </p>
                    <Textarea
                      value={advancedSettings.microsoftClarity.scriptCode}
                      onChange={(e) => setAdvancedSettings(prev => ({
                        ...prev,
                        microsoftClarity: {
                          scriptCode: e.target.value
                        }
                      }))}
                      placeholder='<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "YOUR_PROJECT_ID");
</script>'
                      className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-xs font-mono h-40"
                    />
                  </div>

                  <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                    <p className="text-xs text-blue-200">
                      <strong>Note:</strong> Get your tracking script from <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-[#00C2A8] hover:underline">Microsoft Clarity</a>. Go to your project → Settings → Setup → Copy the tracking code. After saving, the script will be automatically injected into your site's <code className="bg-gray-900 px-1 py-0.5 rounded text-[#00C2A8]">&lt;head&gt;</code> section.
                    </p>
                  </div>
                </div>

                {/* Strava API Integration Section */}
                <div className="space-y-4 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#FC4C02]/20 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-[#FC4C02]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Strava API Integration
                      </h3>
                      <p className="text-sm text-gray-400">
                        Configure Strava API credentials for fitness activity synchronization
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Client ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Client ID
                      </label>
                      <input
                        type="text"
                        placeholder="Enter your Strava Client ID"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FC4C02] focus:border-transparent"
                        value={advancedSettings.strava.clientId}
                        onChange={(e) => setAdvancedSettings(prev => ({
                          ...prev,
                          strava: { ...prev.strava, clientId: e.target.value }
                        }))}
                      />
                    </div>

                    {/* Callback Domain */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Authorization Callback Domain
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., multilingual-app-27.preview.emergentagent.com or kaizenlifetracker.com"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FC4C02] focus:border-transparent"
                        value={advancedSettings.strava.callbackDomain}
                        onChange={(e) => setAdvancedSettings(prev => ({
                          ...prev,
                          strava: { ...prev.strava, callbackDomain: e.target.value }
                        }))}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Enter the domain without https:// (for development: use your preview domain, for production: kaizenlifetracker.com)
                      </p>
                    </div>

                    {/* Client Secret */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Client Secret
                      </label>
                      <div className="relative">
                        <input
                          type={advancedSettings.showStravaSecret ? "text" : "password"}
                          placeholder="Enter your Strava Client Secret"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FC4C02] focus:border-transparent pr-10"
                          value={advancedSettings.strava.clientSecret}
                          onChange={(e) => setAdvancedSettings(prev => ({
                            ...prev,
                            strava: { ...prev.strava, clientSecret: e.target.value }
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => setAdvancedSettings(prev => ({ ...prev, showStravaSecret: !prev.showStravaSecret }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {advancedSettings.showStravaSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Webhook Verify Token */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Webhook Verify Token
                      </label>
                      <div className="relative">
                        <input
                          type={advancedSettings.showStravaVerifyToken ? "text" : "password"}
                          placeholder="Enter webhook verification token"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FC4C02] focus:border-transparent pr-10"
                          value={advancedSettings.strava.webhookVerifyToken}
                          onChange={(e) => setAdvancedSettings(prev => ({
                            ...prev,
                            strava: { ...prev.strava, webhookVerifyToken: e.target.value }
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => setAdvancedSettings(prev => ({ ...prev, showStravaVerifyToken: !prev.showStravaVerifyToken }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {advancedSettings.showStravaVerifyToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-900/20 border border-orange-700/50 rounded-lg">
                    <p className="text-xs text-orange-200">
                      <strong>Setup Instructions:</strong>
                    </p>
                    <ol className="text-xs text-orange-200 mt-2 space-y-1 ml-4 list-decimal">
                      <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-[#FC4C02] hover:underline">Strava API Settings</a></li>
                      <li>Create an application or use an existing one</li>
                      <li>Set the Authorization Callback Domain in Strava to match the domain you entered above</li>
                      <li>Copy your Client ID and Client Secret from Strava</li>
                      <li>Generate a secure Webhook Verify Token (use a random string generator)</li>
                      <li>Save these settings, then athletes can connect their Strava accounts from Account Settings</li>
                    </ol>
                    <div className="mt-3 pt-3 border-t border-orange-700/50">
                      <p className="text-xs text-orange-200">
                        <strong>Development:</strong> Use your preview domain (e.g., multilingual-app-27.preview.emergentagent.com)
                      </p>
                      <p className="text-xs text-orange-200 mt-1">
                        <strong>Production:</strong> Use kaizenlifetracker.com
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                  <div>
                    {saveStatus.message && (
                      <p className={`text-sm ${saveStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {saveStatus.message}
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={handleSaveAdvancedSettings}
                    className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Advanced Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemSettings;
