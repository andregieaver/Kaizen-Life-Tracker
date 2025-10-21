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
  EyeOff
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
    showKey: false
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
    growth_30_days: 0,
    growth_percentage: 0,
    time_series: []
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSystemSettings();
  }, [athleteId]);

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
      
      // Load advanced settings (OpenAI key)
      if (response.data.advanced) {
        setAdvancedSettings({
          openaiApiKey: response.data.advanced.openaiApiKey || '',
          showKey: false
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading system settings:', error);
      setLoading(false);
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
          openaiApiKey: advancedSettings.openaiApiKey
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
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
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
          <TabsList className="grid w-full grid-cols-5 mb-8 bg-gray-800 border border-gray-700 p-1.5 h-auto">
            <TabsTrigger value="seo" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>SEO</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Modules</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="text-xs md:text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
              <span>Plan Editor</span>
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
            <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Plan Editor</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure subscription plan details and features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Free Plan */}
                <div className="border border-gray-700 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Free Plan</h3>
                  
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

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <div className="space-y-6">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Users */}
                <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Total Users</p>
                        <p className="text-2xl font-bold text-white">{statisticsData.totalUsers.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-blue-500/20 rounded-full">
                        <Users className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="flex items-center mt-4">
                      <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                      <span className="text-sm text-green-400">+12.5%</span>
                      <span className="text-sm text-gray-400 ml-2">from last month</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Active Users */}
                <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Active Users</p>
                        <p className="text-2xl font-bold text-white">{statisticsData.activeUsers.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-green-500/20 rounded-full">
                        <TrendingUp className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                    <div className="flex items-center mt-4">
                      <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                      <span className="text-sm text-green-400">+8.2%</span>
                      <span className="text-sm text-gray-400 ml-2">from last month</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Workouts */}
                <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Total Workouts</p>
                        <p className="text-2xl font-bold text-white">{statisticsData.totalWorkouts.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-purple-500/20 rounded-full">
                        <TrendingUp className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                    <div className="flex items-center mt-4">
                      <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                      <span className="text-sm text-green-400">+15.3%</span>
                      <span className="text-sm text-gray-400 ml-2">from last month</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Avg Workouts per User */}
                <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Avg Workouts/User</p>
                        <p className="text-2xl font-bold text-white">{statisticsData.avgWorkoutsPerUser}</p>
                      </div>
                      <div className="p-3 bg-orange-500/20 rounded-full">
                        <TrendingDown className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                    <div className="flex items-center mt-4">
                      <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
                      <span className="text-sm text-red-400">-2.1%</span>
                      <span className="text-sm text-gray-400 ml-2">from last month</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Growth Chart */}
                <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">User Growth</CardTitle>
                    <CardDescription className="text-gray-400">
                      Monthly user registration trends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ChartLine
                        data={{
                          labels: statisticsData.userGrowth.map(item => item.month),
                          datasets: [
                            {
                              label: 'Total Users',
                              data: statisticsData.userGrowth.map(item => item.users),
                              borderColor: '#00C2A8',
                              backgroundColor: 'rgba(0, 194, 168, 0.1)',
                              fill: true,
                              tension: 0.4,
                              pointBackgroundColor: '#00C2A8',
                              pointBorderColor: '#00C2A8',
                              pointHoverBackgroundColor: '#00a890',
                              pointHoverBorderColor: '#00a890',
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false
                            }
                          },
                          scales: {
                            x: {
                              grid: {
                                color: 'rgba(75, 85, 99, 0.3)'
                              },
                              ticks: {
                                color: '#9CA3AF'
                              }
                            },
                            y: {
                              grid: {
                                color: 'rgba(75, 85, 99, 0.3)'
                              },
                              ticks: {
                                color: '#9CA3AF'
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Workout Trends Chart */}
                <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Workout Trends</CardTitle>
                    <CardDescription className="text-gray-400">
                      Monthly workout completion trends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ChartLine
                        data={{
                          labels: statisticsData.workoutTrends.map(item => item.month),
                          datasets: [
                            {
                              label: 'Workouts Completed',
                              data: statisticsData.workoutTrends.map(item => item.workouts),
                              borderColor: '#8B5CF6',
                              backgroundColor: 'rgba(139, 92, 246, 0.1)',
                              fill: true,
                              tension: 0.4,
                              pointBackgroundColor: '#8B5CF6',
                              pointBorderColor: '#8B5CF6',
                              pointHoverBackgroundColor: '#7C3AED',
                              pointHoverBorderColor: '#7C3AED',
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false
                            }
                          },
                          scales: {
                            x: {
                              grid: {
                                color: 'rgba(75, 85, 99, 0.3)'
                              },
                              ticks: {
                                color: '#9CA3AF'
                              }
                            },
                            y: {
                              grid: {
                                color: 'rgba(75, 85, 99, 0.3)'
                              },
                              ticks: {
                                color: '#9CA3AF'
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Statistics */}
              <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">System Health</CardTitle>
                  <CardDescription className="text-gray-400">
                    Current system status and performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400 mb-2">99.9%</div>
                      <div className="text-sm text-gray-400">Uptime</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400 mb-2">45ms</div>
                      <div className="text-sm text-gray-400">Avg Response Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400 mb-2">2.1GB</div>
                      <div className="text-sm text-gray-400">Database Size</div>
                    </div>
                  </div>
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
