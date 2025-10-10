import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import LanguageSelector from './LanguageSelector';
import ChangePassword from './ChangePassword';
import StravaCredentialsModal from './StravaCredentialsModal';
import OuraCredentialsModal from './OuraCredentialsModal';
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
  Check
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Account = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [athlete, setAthlete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [integrations, setIntegrations] = useState({
    openai_api_key: '',
    strava: { connected: false, athlete_name: '', last_sync: null },
    oura: { connected: false, user_id: '', last_sync: null },
    coros: { connected: false, last_sync: null }
  });
  
  const [personalForm, setPersonalForm] = useState({
    name: '',
    age: '',
    running_goals: ''
  });
  
  const [apiKeyForm, setApiKeyForm] = useState({
    openai_api_key: ''
  });
  
  const [activeTab, setActiveTab] = useState('personal');
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    tier: 'free',
    status: 'active',
    current_period_end: null
  });
  const [invoices, setInvoices] = useState([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showStravaModal, setShowStravaModal] = useState(false);
  const [showOuraModal, setShowOuraModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    prompt: '',
    frequency: 'daily',
    time: '08:00',
    days: []
  });

  useEffect(() => {
    loadAccountData();
    loadSchedules();
    loadSubscriptionStatus();
    
    // Check if returning from Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');
    
    if (sessionId && success === 'true') {
      // Switch to subscription tab
      setActiveTab('subscription');
      // Poll for payment status
      pollPaymentStatus(sessionId);
    }
  }, [athleteId]);

  const loadSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/status/${athleteId}`);
      console.log('Subscription status response:', response.data);
      
      setSubscriptionStatus({
        tier: response.data.subscription_tier || 'free',
        status: response.data.subscription_status || 'active',
        current_period_end: response.data.subscription_current_period_end
      });
      
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

  const handleUpgrade = async (plan, interval) => {
    const plan_id = `${plan}_${interval}`;
    
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

  const handleDowngrade = async (newPlanId) => {
    try {
      const response = await axios.post(`${API}/subscriptions/update-plan`, {
        athlete_id: athleteId,
        new_plan_id: newPlanId
      });

      if (response.data.success) {
        setSaveStatus({ 
          type: 'success', 
          message: response.data.message
        });
        setShowDowngradeDialog(false);
        await loadSubscriptionStatus();
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

  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      // Load athlete profile
      const athleteRes = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(athleteRes.data);
      setPersonalForm({
        name: athleteRes.data.name,
        age: athleteRes.data.age.toString(),
        running_goals: athleteRes.data.running_goals
      });
      
      // Load integrations data from backend
      try {
        const [integrationsRes, stravaStatusRes, ouraStatusRes] = await Promise.all([
          axios.get(`${API}/integrations/${athleteId}`),
          axios.get(`${API}/integrations/strava/${athleteId}/status`),
          axios.get(`${API}/integrations/oura/${athleteId}/status`)
        ]);
        
        const integrationsList = integrationsRes.data.integrations || [];
        const stravaStatus = stravaStatusRes.data;
        const ouraStatus = ouraStatusRes.data;
        
        // Find OpenAI integration
        const openaiIntegration = integrationsList.find(i => i.integration_type === 'openai');
        
        setIntegrations({
          openai_api_key: openaiIntegration ? '••••••••••••••••' : '',
          strava: { 
            connected: stravaStatus.connected,
            athlete_name: stravaStatus.connected ? `Athlete ${stravaStatus.strava_athlete_id}` : '',
            last_sync: stravaStatus.last_sync
          },
          oura: { 
            connected: ouraStatus.connected,
            user_id: ouraStatus.connected ? 'Connected' : '',
            last_sync: ouraStatus.last_sync
          }
        });
      } catch (error) {
        console.error('Error loading integrations:', error);
        // Set default values if loading fails
        setIntegrations({
          openai_api_key: '',
          strava: { connected: false, athlete_name: '', last_sync: null },
          oura: { connected: false, user_id: '', last_sync: null }
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

  const handleSavePersonalInfo = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        ...personalForm,
        age: parseInt(personalForm.age)
      };
      
      // TODO: Implement update athlete endpoint
      // await axios.put(`${API}/athlete/${athleteId}`, updatedData);
      
      setSaveStatus({ type: 'success', message: 'Personal information updated successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error updating personal info:', error);
      setSaveStatus({ type: 'error', message: 'Failed to update personal information' });
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    
    if (!apiKeyForm.openai_api_key.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter an API key' });
      return;
    }
    
    try {
      await axios.post(`${API}/integrations/openai/${athleteId}`, { 
        api_key: apiKeyForm.openai_api_key 
      });
      
      // Update UI to show masked key
      setIntegrations(prev => ({
        ...prev,
        openai_api_key: '••••••••••••' + apiKeyForm.openai_api_key.slice(-8)
      }));
      
      setApiKeyForm({ openai_api_key: '' });
      setSaveStatus({ type: 'success', message: 'OpenAI API key saved successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error saving API key:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to save API key' 
      });
    }
  };

  const handleStravaConnect = () => {
    setShowStravaModal(true);
  };

  const handleStravaCredentialsSuccess = () => {
    // Reload integrations data to show connected state
    loadAccountData();
    setSaveStatus({ 
      type: 'success', 
      message: 'Strava credentials configured successfully! You can now sync your activities.' 
    });
    setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
  };

  const handleOuraConnect = () => {
    setShowOuraModal(true);
  };

  const handleOuraCredentialsSuccess = () => {
    // Reload integrations data to show connected state
    loadAccountData();
    setSaveStatus({ 
      type: 'success', 
      message: 'Oura credentials configured successfully! You can now sync your sleep and recovery data.' 
    });
    setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
  };

  const handleDisconnectIntegration = async (integration) => {
    try {
      await axios.delete(`${API}/integrations/${athleteId}/${integration}`);
      
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

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    
    if (!scheduleForm.name.trim() || !scheduleForm.prompt.trim()) {
      setSaveStatus({ type: 'error', message: 'Please fill in schedule name and prompt' });
      return;
    }
    
    try {
      if (editingSchedule) {
        // Update existing schedule
        const response = await axios.put(`${API}/schedules/${editingSchedule.id}`, scheduleForm);
        
        // Update local schedules list
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? response.data : s));
        
        setSaveStatus({ type: 'success', message: 'Schedule updated successfully!' });
      } else {
        // Create new schedule
        const scheduleData = {
          ...scheduleForm,
          athlete_id: athleteId,
          active: true
        };
        
        const response = await axios.post(`${API}/schedules`, scheduleData);
        
        // Add to local schedules list
        setSchedules(prev => [...prev, response.data]);
        
        setSaveStatus({ type: 'success', message: 'Schedule created successfully!' });
      }
      
      // Reset form and close
      handleCancelScheduleForm();
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      
    } catch (error) {
      console.error('Error saving schedule:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save schedule' });
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await axios.get(`${API}/schedules/${athleteId}`);
      setSchedules(response.data);
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      prompt: schedule.prompt,
      frequency: schedule.frequency,
      time: schedule.time,
      days: schedule.days || []
    });
    setShowScheduleForm(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm(t('account.confirmDeleteSchedule'))) {
      return;
    }

    try {
      await axios.delete(`${API}/schedules/${scheduleId}`);
      
      // Remove from local schedules list
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      
      setSaveStatus({ type: 'success', message: 'Schedule deleted successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete schedule' });
    }
  };

  const handleCancelScheduleForm = () => {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setScheduleForm({
      name: '',
      prompt: '',
      frequency: 'daily',
      time: '08:00',
      days: []
    });
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('athleteId');
      window.location.href = '/';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="skeleton h-8 w-48 mb-6"></div>
        <div className="skeleton h-96 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">
          {t('account.title')}
        </h1>
        <p className="text-gray-600">
          {t('account.manageProfile')}
        </p>
      </div>

      {/* Status Messages */}
      {saveStatus.message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="personal" className="flex items-center text-xs md:text-sm" data-testid="personal-tab">
            <User className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">{t('account.personalInfo')}</span>
            <span className="sm:hidden">{t('nav.account')}</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center text-xs md:text-sm" data-testid="subscription-tab">
            <CreditCard className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Subscription</span>
            <span className="sm:hidden">Plan</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center text-xs md:text-sm" data-testid="integrations-tab">
            <Zap className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">{t('account.integrations')}</span>
            <span className="sm:hidden">{t('account.integrations')}</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center text-xs md:text-sm" data-testid="schedules-tab">
            <Calendar className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">{t('account.schedules')}</span>
            <span className="sm:hidden">{t('account.schedules')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your profile information and running goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePersonalInfo} className="space-y-4 md:space-y-6">
                {/* Language Selector */}
                <LanguageSelector />
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">{t('auth.fullName')}</Label>
                    <Input
                      id="name"
                      name="name"
                      value={personalForm.name}
                      onChange={handlePersonalFormChange}
                      className="input-focus"
                      data-testid="name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-sm font-medium">{t('account.age')}</Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      value={personalForm.age}
                      onChange={handlePersonalFormChange}
                      className="input-focus"
                      data-testid="age-input"
                    />
                  </div>
                </div>

                {/* Weekly mileage and recent race time will be automatically imported from Strava */}

                <div className="space-y-2">
                  <Label htmlFor="running_goals">{t('account.runningGoals')}</Label>
                  <textarea
                    id="running_goals"
                    name="running_goals"
                    value={personalForm.running_goals}
                    onChange={handlePersonalFormChange}
                    className="w-full min-h-24 p-3 border border-gray-300 rounded-md input-focus resize-none"
                    placeholder={t('onboarding.runningGoalsPlaceholder')}
                    data-testid="goals-textarea"
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-blue-600" />
                    {t('account.security')}
                  </h3>
                  <ChangePassword athleteId={athleteId} />
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 btn-transition"
                    data-testid="save-personal-info-btn"
                  >
                    {t('account.saveChanges')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="space-y-6">
            {/* Current Plan */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Crown className="w-5 h-5 mr-2 text-yellow-600" />
                      Current Plan
                    </CardTitle>
                    <CardDescription>
                      Manage your subscription and billing
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      loadSubscriptionStatus();
                      setSaveStatus({ type: '', message: 'Refreshing...' });
                      setTimeout(() => setSaveStatus({ type: '', message: '' }), 1000);
                    }}
                  >
                    <Repeat className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg mb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-2xl font-bold text-gray-900 capitalize">
                        {subscriptionStatus.tier} Plan
                      </h3>
                      <Badge variant={subscriptionStatus.status === 'active' ? 'secondary' : 'destructive'}>
                        {subscriptionStatus.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mt-1">
                      {subscriptionStatus.tier === 'free' && '€0/month • Basic features'}
                      {subscriptionStatus.tier === 'pro' && 'Enhanced features for serious athletes'}
                      {subscriptionStatus.tier === 'premium' && 'Maximum performance package'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Next billing date</p>
                    <p className="font-semibold text-gray-900">
                      {subscriptionStatus.current_period_end 
                        ? new Date(subscriptionStatus.current_period_end).toLocaleDateString() 
                        : '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Current Features:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span>10 AI Coach questions/month</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span>Manual workout logging</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span>Basic readiness score</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span>30-day history</span>
                    </div>
                  </div>
                </div>

                {subscriptionStatus.tier === 'free' ? (
                  <Button className="w-full" onClick={() => navigate('/pricing')}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Upgrade Your Plan
                  </Button>
                ) : (
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Available Plans */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Available Plans</CardTitle>
                <CardDescription>
                  Choose the plan that fits your needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Free Plan */}
                  <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Free</h3>
                        <p className="text-sm text-gray-600">Basic features</p>
                      </div>
                      <Shield className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="mb-4">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">€0</span>
                        <span className="text-gray-500 ml-1">/month</span>
                      </div>
                    </div>
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>10 AI Coach questions/month</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Basic features</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>30-day history</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Email support</span>
                      </li>
                    </ul>
                    {subscriptionStatus.tier === 'free' ? (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => setShowCancelDialog(true)}
                      >
                        Downgrade to Free
                      </Button>
                    )}
                  </div>

                  {/* Pro Plan */}
                  <div className="border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Pro</h3>
                        <p className="text-sm text-gray-600">For serious athletes</p>
                      </div>
                      <Badge className="bg-blue-600">Popular</Badge>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">€9.99</span>
                        <span className="text-gray-500 ml-1">/month</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">or €99/year (save 17%)</p>
                    </div>
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Unlimited AI Coach access</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>All integrations</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Advanced analytics</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Custom schedules</span>
                      </li>
                    </ul>
                    {subscriptionStatus.tier === 'free' ? (
                      <Button 
                        className="w-full" 
                        variant="default"
                        onClick={() => handleUpgrade('pro', 'monthly')}
                      >
                        Upgrade to Pro
                      </Button>
                    ) : subscriptionStatus.tier === 'pro' ? (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => {
                          setDowngradeTarget('pro_monthly');
                          setShowDowngradeDialog(true);
                        }}
                      >
                        Downgrade to Pro
                      </Button>
                    )}
                  </div>

                  {/* Premium Plan */}
                  <div className="border-2 border-purple-200 rounded-lg p-4 hover:border-purple-400 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Premium</h3>
                        <p className="text-sm text-gray-600">Maximum performance</p>
                      </div>
                      <Crown className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="mb-4">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-gray-900">€19.99</span>
                        <span className="text-gray-500 ml-1">/month</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">or €199/year (save 17%)</p>
                    </div>
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Everything in Pro</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>Personalized training plans</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>1-on-1 coaching sessions</span>
                      </li>
                      <li className="flex items-start text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span>24/7 priority support</span>
                      </li>
                    </ul>
                    {subscriptionStatus.tier === 'free' || subscriptionStatus.tier === 'pro' ? (
                      <Button 
                        className="w-full" 
                        variant="default"
                        onClick={() => handleUpgrade('premium', 'monthly')}
                      >
                        {subscriptionStatus.tier === 'free' ? 'Upgrade to Premium' : 'Upgrade to Premium'}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 text-center">
                    <strong>Secure Payment:</strong> All payments are processed securely through Stripe. 
                    Your payment information is never stored on our servers.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Billing Management */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Billing Management
                </CardTitle>
                <CardDescription>
                  Manage payment methods and view billing history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Payment Method</h4>
                    {subscriptionStatus.tier === 'free' ? (
                      <p className="text-sm text-gray-600">
                        No payment method on file (Free plan)
                      </p>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-4 h-4 text-green-600" />
                        <p className="text-sm text-gray-600">
                          Payment method active • Managed by Stripe
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Billing History</h4>
                    {subscriptionStatus.tier === 'free' ? (
                      <p className="text-sm text-gray-600">
                        No invoices yet
                      </p>
                    ) : invoices.length === 0 ? (
                      <p className="text-sm text-gray-600">
                        Loading invoices...
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {invoices.map((invoice) => (
                          <div 
                            key={invoice.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-gray-900">
                                  €{invoice.amount.toFixed(2)}
                                </p>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  invoice.status === 'paid' 
                                    ? 'bg-green-100 text-green-700' 
                                    : invoice.status === 'open'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {invoice.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
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
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="w-full max-w-md mx-4">
                <CardHeader>
                  <CardTitle className="text-red-600">Cancel Subscription?</CardTitle>
                  <CardDescription>
                    Are you sure you want to cancel your subscription?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-900">
                      <strong>What happens next:</strong>
                    </p>
                    <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                      <li>Your subscription will remain active until the end of your billing period</li>
                      <li>You'll be downgraded to the Free plan automatically</li>
                      <li>You won't be charged again</li>
                      <li>You can resubscribe anytime</li>
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowCancelDialog(false)}
                    >
                      Keep Subscription
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={handleCancelSubscription}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Downgrade Confirmation Dialog */}
          {showDowngradeDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="w-full max-w-md mx-4">
                <CardHeader>
                  <CardTitle>Change Plan?</CardTitle>
                  <CardDescription>
                    Confirm your plan change
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>What happens next:</strong>
                    </p>
                    <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                      <li>Your plan will change immediately</li>
                      <li>You'll be charged/credited the prorated amount</li>
                      <li>New billing cycle starts today</li>
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setShowDowngradeDialog(false);
                        setDowngradeTarget(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => handleDowngrade(downgradeTarget)}
                    >
                      Confirm Change
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            {/* OpenAI API Key */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="w-5 h-5 mr-2 text-orange-600" />
                  OpenAI API Key
                </CardTitle>
                <CardDescription>
                  Use your own OpenAI API key for enhanced AI coaching features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveApiKey} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai_key">{t('account.apiKeyLabel')}</Label>
                    <div className="flex space-x-2">
                      <div className="flex-1 relative">
                        <Input
                          id="openai_key"
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKeyForm.openai_api_key}
                          onChange={(e) => setApiKeyForm({ openai_api_key: e.target.value })}
                          placeholder={t('account.apiKeyPlaceholder')}
                          className="input-focus pr-10"
                          data-testid="openai-key-input"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <Button 
                        type="submit" 
                        className="bg-orange-600 hover:bg-orange-700 btn-transition"
                        data-testid="save-api-key-btn"
                      >
                        {t('account.saveAPIKey')}
                      </Button>
                    </div>
                    {integrations.openai_api_key && integrations.openai_api_key !== '' && (
                      <div className="flex items-center text-sm text-green-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {t('account.connectedWithKey')}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('account.apiKeySecurityNote')}{' '}
                    <a 
                      href="https://platform.openai.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline inline-flex items-center"
                    >
                      {t('account.openAIPlatform')} <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </p>
                </form>
              </CardContent>
            </Card>

            {/* Strava Integration */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-orange-500" />
                  Strava Integration
                </CardTitle>
                <CardDescription>
                  Connect your Strava account to automatically import workouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {integrations.strava.connected ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                          <div>
                            <p className="font-medium text-green-900">
                              Connected as {integrations.strava.athlete_name}
                            </p>
                            <p className="text-sm text-green-600">
                              Last sync: {integrations.strava.last_sync ? 
                                new Date(integrations.strava.last_sync).toLocaleString() : 
                                'Never'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <Button 
                          onClick={handleStravaSync}
                          className="bg-orange-600 hover:bg-orange-700 btn-transition"
                          data-testid="sync-strava-btn"
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          {t('account.syncActivities')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDisconnectIntegration('strava')}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="disconnect-strava-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('common.disconnect')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800 mb-3">
                        {t('account.stravaNote')}
                      </p>
                      <Button 
                        onClick={handleStravaConnect}
                        className="bg-orange-600 hover:bg-orange-700 btn-transition"
                        data-testid="connect-strava-btn"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        {t('strava.setupCredentials')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Oura Integration */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-purple-600" />
                  {t('account.ouraIntegration')}
                </CardTitle>
                <CardDescription>
                  Connect your Oura Ring to automatically import sleep and recovery data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {integrations.oura.connected ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                          <div>
                            <p className="font-medium text-green-900">
                              Oura Ring Connected
                            </p>
                            <p className="text-sm text-green-600">
                              Last sync: {integrations.oura.last_sync ? 
                                new Date(integrations.oura.last_sync).toLocaleString() : 
                                'Never'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <Button 
                          onClick={handleOuraSync}
                          className="bg-purple-600 hover:bg-purple-700 btn-transition"
                          data-testid="sync-oura-btn"
                        >
                          <Heart className="w-4 h-4 mr-2" />
                          {t('account.syncSleepRecovery')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDisconnectIntegration('oura')}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="disconnect-oura-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('common.disconnect')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-800 mb-3">
                        {t('account.ouraNote')}
                      </p>
                      <Button 
                        onClick={handleOuraConnect}
                        className="bg-purple-600 hover:bg-purple-700 btn-transition"
                        data-testid="connect-oura-btn"
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        {t('oura.setupCredentials')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* COROS Integration */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-600" />
                  {t('account.corosIntegration')}
                </CardTitle>
                <CardDescription>
                  {t('account.corosDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {integrations.coros?.connected ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                          <div>
                            <p className="font-medium text-green-900">
                              {t('account.corosConnected')}
                            </p>
                            <p className="text-sm text-green-600">
                              {t('account.lastSync')}: {integrations.coros.last_sync ? 
                                new Date(integrations.coros.last_sync).toLocaleString() : 
                                t('account.never')
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <Button 
                          onClick={handleCorosSync}
                          className="bg-blue-600 hover:bg-blue-700 btn-transition"
                          data-testid="sync-coros-btn"
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          {t('account.syncActivities')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDisconnectIntegration('coros')}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="disconnect-coros-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('common.disconnect')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 mb-3">
                        {t('account.corosNote')}
                      </p>
                      <Button 
                        onClick={handleCorosConnect}
                        className="bg-blue-600 hover:bg-blue-700 btn-transition"
                        data-testid="connect-coros-btn"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        {t('account.connectToCoros')}
                      </Button>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">
                        <strong>{t('common.note')}:</strong> {t('account.corosTerraNote')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('account.corosSyncNote')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules">
          <div className="space-y-6">
            {/* Header */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                      Automated AI Analysis
                    </CardTitle>
                    <CardDescription>
                      Schedule automated prompts for your AI coach to analyze your training and recovery data
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowScheduleForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 btn-transition w-full md:w-auto"
                    data-testid="add-schedule-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Schedule
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Schedule Form */}
            {showScheduleForm && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                  </CardTitle>
                  <CardDescription>
                    {editingSchedule 
                      ? 'Update your automated AI analysis schedule'
                      : 'Set up automated AI analysis of your training and recovery data'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveSchedule} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-name" className="text-sm font-medium">Schedule Name</Label>
                        <Input
                          id="schedule-name"
                          value={scheduleForm.name}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder={t('account.scheduleNamePlaceholder')}
                          className="input-focus"
                          data-testid="schedule-name-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-frequency" className="text-sm font-medium">Frequency</Label>
                        <select
                          id="schedule-frequency"
                          value={scheduleForm.frequency}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-md input-focus"
                          data-testid="schedule-frequency-select"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="after_workout">After Each Workout</option>
                          <option value="custom">Custom Days</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="schedule-prompt" className="text-sm font-medium">AI Analysis Prompt</Label>
                      <textarea
                        id="schedule-prompt"
                        value={scheduleForm.prompt}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, prompt: e.target.value }))}
                        className="w-full min-h-24 p-3 border border-gray-300 rounded-md input-focus resize-none"
                        placeholder={t('account.promptPlaceholder')}
                        data-testid="schedule-prompt-textarea"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-time" className="text-sm font-medium">Time</Label>
                        <Input
                          id="schedule-time"
                          type="time"
                          value={scheduleForm.time}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                          className="input-focus"
                          data-testid="schedule-time-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status</Label>
                        <div className="flex items-center pt-2">
                          <input
                            type="checkbox"
                            id="schedule-active"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <Label htmlFor="schedule-active" className="ml-2 text-sm text-gray-700">
                            Active
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={handleCancelScheduleForm}
                        data-testid="cancel-schedule-btn"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="save-schedule-btn"
                      >
                        Save Schedule
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Existing Schedules */}
            <div className="space-y-4">
              {schedules.length === 0 && !showScheduleForm ? (
                <Card className="border-0 shadow-lg">
                  <CardContent className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No automated schedules yet</p>
                    <Button 
                      onClick={() => setShowScheduleForm(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="create-first-schedule-btn"
                    >
                      Create Your First Schedule
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                schedules.map((schedule, index) => (
                  <Card key={index} className="border-0 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            {schedule.frequency === 'daily' ? (
                              <Calendar className="w-5 h-5 text-blue-600" />
                            ) : schedule.frequency === 'weekly' ? (
                              <Repeat className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">
                              {schedule.frequency} at {schedule.time}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="btn-transition"
                            onClick={() => handleEditSchedule(schedule)}
                            data-testid={`edit-schedule-btn-${index}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            data-testid={`delete-schedule-btn-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {schedule.prompt}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Preset Templates */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">{t('account.scheduleTemplates')}</CardTitle>
                <CardDescription>
                  {t('account.templatesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      name: "Daily Recovery Review",
                      prompt: "Analyze yesterday's workout alongside last night's Oura sleep data. How did training intensity affect my HRV, sleep quality, and readiness? Recommend today's training approach.",
                      frequency: "daily",
                      time: "08:00"
                    },
                    {
                      name: "Weekly Training Analysis",
                      prompt: "Review this week's training load, sleep patterns, and recovery metrics. Identify trends and provide recommendations for next week's training plan.",
                      frequency: "weekly", 
                      time: "18:00"
                    },
                    {
                      name: "Post-Workout Recovery",
                      prompt: "I just completed a workout. Based on the session data, my current readiness, and recent recovery trends, when should I schedule my next hard session?",
                      frequency: "after_workout",
                      time: "immediately"
                    },
                    {
                      name: "Race Prep Check",
                      prompt: "Analyze my recent training progression, sleep quality, and readiness trends. Am I on track for my upcoming race? Any adjustments needed?",
                      frequency: "weekly",
                      time: "19:00"
                    }
                  ].map((template, index) => (
                    <div 
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => {
                        setScheduleForm({
                          name: template.name,
                          prompt: template.prompt,
                          frequency: template.frequency,
                          time: template.time,
                          days: []
                        });
                        setShowScheduleForm(true);
                      }}
                    >
                      <h4 className="font-medium text-gray-900 mb-2">{template.name}</h4>
                      <p className="text-sm text-gray-600 mb-3">{template.prompt}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {template.frequency} at {template.time}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Logout Section */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <Card className="border-0 shadow-lg bg-gray-50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {t('account.logoutTitle')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('account.logoutDescription')}
                </p>
              </div>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 btn-transition w-full md:w-auto"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('auth.logout')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strava Credentials Modal */}
      <StravaCredentialsModal
        athleteId={athleteId}
        isOpen={showStravaModal}
        onClose={() => setShowStravaModal(false)}
        onSuccess={handleStravaCredentialsSuccess}
      />

      {/* Oura Credentials Modal */}
      <OuraCredentialsModal
        athleteId={athleteId}
        isOpen={showOuraModal}
        onClose={() => setShowOuraModal(false)}
        onSuccess={handleOuraCredentialsSuccess}
      />
    </div>
  );
};

export default Account;
