import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Percent,
  Zap,
  MessageSquare,
  Heart,
  UserCheck,
  Activity,
  UserPlus,
  Gift,
  Target
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
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize active tab from localStorage, URL hash, or default to 'seo'
  const [activeTab, setActiveTab] = useState(() => {
    // First try localStorage
    const savedTab = localStorage.getItem('systemSettings_activeTab');
    console.log('🔍 Loading tab from localStorage:', savedTab);
    if (savedTab && ['seo', 'modules', 'plans', 'statistics', 'advanced'].includes(savedTab)) {
      // Also update hash to match
      window.location.hash = savedTab;
      return savedTab;
    }
    // Then try URL hash
    const hash = location.hash.replace('#', '');
    console.log('🔍 Loading tab from hash:', hash);
    if (['seo', 'modules', 'plans', 'statistics', 'advanced'].includes(hash)) {
      return hash;
    }
    // Default to 'seo'
    console.log('🔍 Using default tab: seo');
    return 'seo';
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
    openaiApiKey: '',
    showKey: false,
    stripe: {
      live: {
        apiKey: '',
        webhookSecret: ''
      },
      sandbox: {
        apiKey: '',
        webhookSecret: ''
      }
    },
    showStripeLiveKey: false,
    showStripeLiveWebhook: false,
    showStripeSandboxKey: false,
    showStripeSandboxWebhook: false
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
  const [newPlan, setNewPlan] = useState({
    tier: '',
    name: '',
    description: '',
    features: [],
    sort_order: 0
  });
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
      
      // Load advanced settings (OpenAI key and Stripe)
      if (response.data.advanced) {
        setAdvancedSettings(prev => ({
          ...prev,
          openaiApiKey: response.data.advanced.openaiApiKey || '',
          showKey: false,
          stripe: {
            live: {
              apiKey: response.data.advanced.stripe?.live?.apiKey || '',
              webhookSecret: response.data.advanced.stripe?.live?.webhookSecret || ''
            },
            sandbox: {
              apiKey: response.data.advanced.stripe?.sandbox?.apiKey || '',
              webhookSecret: response.data.advanced.stripe?.sandbox?.webhookSecret || ''
            }
          },
          showStripeLiveKey: false,
          showStripeLiveWebhook: false,
          showStripeSandboxKey: false,
          showStripeSandboxWebhook: false
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
          openaiApiKey: advancedSettings.openaiApiKey,
          stripe: {
            live: {
              apiKey: advancedSettings.stripe.live.apiKey,
              webhookSecret: advancedSettings.stripe.live.webhookSecret
            },
            sandbox: {
              apiKey: advancedSettings.stripe.sandbox.apiKey,
              webhookSecret: advancedSettings.stripe.sandbox.webhookSecret
            }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
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
              <h1 className="text-3xl font-display font-bold text-white">System Settings</h1>
            </div>
            <Button
              onClick={() => navigate('/dashboard/account')}
              className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-4 py-2 rounded-lg flex items-center gap-2 flex-shrink-0"
              title="Account Settings"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline font-semibold">Account Settings</span>
            </Button>
          </div>
          <p className="text-gray-300">
            Super Admin Dashboard - Monitor and manage system-wide settings
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
          <TabsList className="grid w-full grid-cols-6 mb-8 bg-gray-800 border border-gray-700 p-1.5 h-auto">
            <TabsTrigger value="seo" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>SEO</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Modules</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Plan Editor</span>
            </TabsTrigger>
            <TabsTrigger value="coupons" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Coupons</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Statistics</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Advanced</span>
            </TabsTrigger>
          </TabsList>

          {/* SEO Tab */}
          <TabsContent value="seo">
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">SEO Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure search engine optimization settings for your site
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSeoSettings} className="space-y-6">
                  {/* Site Title */}
                  <div className="space-y-2">
                    <Label htmlFor="siteTitle" className="text-sm font-medium text-white">
                      Site Title
                    </Label>
                    <Input
                      id="siteTitle"
                      type="text"
                      value={seoSettings.siteTitle}
                      onChange={(e) => handleSeoChange('siteTitle', e.target.value)}
                      placeholder="Enter your site title"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-500">
                      This appears in the browser tab and search results
                    </p>
                  </div>

                  {/* Favicon Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="favicon" className="text-sm font-medium text-white">
                      Favicon
                    </Label>
                    <div className="flex items-center gap-4">
                      {faviconPreview && (
                        <div className="w-16 h-16 border-2 border-gray-700 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
                          <img 
                            src={faviconPreview} 
                            alt="Favicon preview" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <label htmlFor="favicon" className="cursor-pointer">
                          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
                            <Upload className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">
                              {seoSettings.favicon ? seoSettings.favicon.name : 'Choose favicon file'}
                            </span>
                          </div>
                          <input
                            id="favicon"
                            type="file"
                            accept="image/x-icon,image/png,image/svg+xml"
                            onChange={handleFaviconUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Recommended: 32x32px or 16x16px (.ico, .png, or .svg)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Meta Title */}
                  <div className="space-y-2">
                    <Label htmlFor="metaTitle" className="text-sm font-medium text-white">
                      Meta Title
                    </Label>
                    <Input
                      id="metaTitle"
                      type="text"
                      value={seoSettings.metaTitle}
                      onChange={(e) => handleSeoChange('metaTitle', e.target.value)}
                      placeholder="Enter meta title"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      maxLength={60}
                    />
                    <p className="text-xs text-gray-500">
                      {seoSettings.metaTitle.length}/60 characters - Displayed in search engine results
                    </p>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-2">
                    <Label htmlFor="metaDescription" className="text-sm font-medium text-white">
                      Meta Description
                    </Label>
                    <textarea
                      id="metaDescription"
                      value={seoSettings.metaDescription}
                      onChange={(e) => handleSeoChange('metaDescription', e.target.value)}
                      placeholder="Enter meta description"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00C2A8] resize-none"
                      rows={4}
                      maxLength={160}
                    />
                    <p className="text-xs text-gray-500">
                      {seoSettings.metaDescription.length}/160 characters - Brief description for search results
                    </p>
                  </div>

                  {/* Focus Keyword */}
                  <div className="space-y-2">
                    <Label htmlFor="focusKeyword" className="text-sm font-medium text-white">
                      Focus Keyword
                    </Label>
                    <Input
                      id="focusKeyword"
                      type="text"
                      value={seoSettings.focusKeyword}
                      onChange={(e) => handleSeoChange('focusKeyword', e.target.value)}
                      placeholder="Enter primary keyword or phrase"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-500">
                      Main keyword you want to rank for in search engines
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save SEO Settings
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Module Management</CardTitle>
                <CardDescription className="text-gray-400">
                  Enable or disable system modules and features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Affiliate Program Module */}
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          Affiliate Program
                        </h3>
                        <p className="text-sm text-gray-400">
                          Enable referral system and gift icon in header
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
                          {moduleSettings.affiliateProgram.enabled ? 'Enabled' : 'Disabled'}
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
            <div className="text-gray-400 text-sm mb-4">
              Manage subscription plans and pricing. Plans are synced with Stripe automatically.
            </div>

            {/* Create Plan Button */}
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700 mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Subscription Plans</CardTitle>
                  <CardDescription className="text-gray-400">
                    Create and manage subscription tiers with multiple pricing variations
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setShowCreatePlanModal(true)}
                  className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Plan
                </Button>
              </CardHeader>
              <CardContent>
                {loadingPlans ? (
                  <div className="text-center py-8 text-gray-400">Loading plans...</div>
                ) : subscriptionPlans.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No subscription plans yet. Create your first plan above.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {subscriptionPlans.map((plan) => (
                      <Card key={plan.tier} className="border-gray-600 bg-gray-700/50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                              <CardDescription className="text-gray-400 mt-1">
                                {plan.description || 'No description'}
                              </CardDescription>
                              <div className="mt-2">
                                <span className="text-xs px-2 py-1 bg-teal-500/20 text-teal-400 rounded">
                                  Tier: {plan.tier}
                                </span>
                                {plan.stripe_product_id && (
                                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded ml-2">
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
                                  setShowEditPlanModal(true);
                                }}
                                className="text-gray-300 border-gray-600"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deletePlan(plan.tier)}
                                className="text-red-400 border-red-600"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Pricing Variations */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-white font-semibold">Pricing Variations</h4>
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
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Variation
                              </Button>
                            </div>
                            
                            {plan.variations && plan.variations.length > 0 ? (
                              <div className="space-y-2">
                                {plan.variations.map((variation) => (
                                  <div
                                    key={variation.plan_id}
                                    className="flex items-center justify-between p-3 bg-gray-600/50 rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <span className="text-white font-medium">{variation.name}</span>
                                        <span className="text-teal-400 font-bold text-lg">
                                          ${variation.price}
                                        </span>
                                        <span className="text-gray-400 text-sm">
                                          / {variation.interval_count > 1 ? `${variation.interval_count} ` : ''}
                                          {variation.interval}
                                          {variation.interval_count > 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        ID: {variation.plan_id}
                                        {variation.stripe_price_id && (
                                          <span className="ml-2">• Stripe: {variation.stripe_price_id}</span>
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
                                            updateVariation(variation.plan_id, { price: parseFloat(newPrice) });
                                          }
                                        }}
                                        className="text-gray-300 border-gray-500"
                                      >
                                        Edit Price
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => deleteVariation(variation.plan_id)}
                                        className="text-red-400 border-red-600"
                                      >
                                        Delete
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
                      <label className="block text-gray-300 mb-2">Plan Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Professional, Premium"
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Description</label>
                      <textarea
                        placeholder="Plan description..."
                        value={newPlan.description}
                        onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
                        rows={3}
                      />
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
                    <input
                      type="text"
                      placeholder="SUMMER2025"
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
                      placeholder="Summer Sale 2025"
                      value={newCoupon.name}
                      onChange={(e) => setNewCoupon({...newCoupon, name: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    />
                  </div>
                  
                  {/* Discount Type */}
                  <div>
                    <label className="block text-gray-300 mb-2">Discount Type *</label>
                    <select 
                      value={newCoupon.type}
                      onChange={(e) => setNewCoupon({...newCoupon, type: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  
                  {/* Discount Value */}
                  <div>
                    <label className="block text-gray-300 mb-2">Discount Value *</label>
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
                    <label className="block text-gray-300 mb-2">Maximum Uses</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="100"
                      value={newCoupon.max_uses}
                      onChange={(e) => setNewCoupon({...newCoupon, max_uses: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#00C2A8]"
                    />
                    <p className="text-gray-500 text-xs mt-1">Leave empty for unlimited uses</p>
                  </div>
                  
                  {/* Expiration Date */}
                  <div>
                    <label className="block text-gray-300 mb-2">Expiration Date</label>
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

          {/* Advanced Tab */}
          <TabsContent value="advanced">
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Advanced Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure system-wide integrations and API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                  <div>
                    <Label className="text-sm font-medium text-white">
                      Stripe Configuration
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Configure Stripe API keys and webhooks for payment processing
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
