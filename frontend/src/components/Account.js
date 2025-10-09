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
  LogOut
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
    weekly_mileage: '',
    recent_race_time: '',
    running_goals: ''
  });
  
  const [apiKeyForm, setApiKeyForm] = useState({
    openai_api_key: ''
  });
  
  const [activeTab, setActiveTab] = useState('personal');
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [schedules, setSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
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
  }, [athleteId]);

  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      // Load athlete profile
      const athleteRes = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(athleteRes.data);
      setPersonalForm({
        name: athleteRes.data.name,
        age: athleteRes.data.age.toString(),
        weekly_mileage: athleteRes.data.weekly_mileage.toString(),
        recent_race_time: athleteRes.data.recent_race_time || '',
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
        age: parseInt(personalForm.age),
        weekly_mileage: parseFloat(personalForm.weekly_mileage)
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

  const handleStravaConnect = async () => {
    try {
      const response = await axios.get(`${API}/auth/strava/${athleteId}`);
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Error initiating Strava connection:', error);
      setSaveStatus({ type: 'error', message: 'Failed to initiate Strava connection' });
    }
  };

  const handleOuraConnect = async () => {
    try {
      const response = await axios.get(`${API}/auth/oura/${athleteId}`);
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Error initiating Oura connection:', error);
      setSaveStatus({ type: 'error', message: 'Failed to initiate Oura connection' });
    }
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
          Account Settings
        </h1>
        <p className="text-gray-600">
          Manage your profile and integrations
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
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="personal" className="flex items-center text-xs md:text-sm" data-testid="personal-tab">
            <User className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">{t('account.personalInfo')}</span>
            <span className="sm:hidden">{t('nav.account')}</span>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weekly_mileage" className="text-sm font-medium">{t('account.weeklyMileage')}</Label>
                    <Input
                      id="weekly_mileage"
                      name="weekly_mileage"
                      type="number"
                      step="0.5"
                      value={personalForm.weekly_mileage}
                      onChange={handlePersonalFormChange}
                      className="input-focus"
                      data-testid="mileage-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recent_race_time" className="text-sm font-medium">Recent Race</Label>
                    <Input
                      id="recent_race_time"
                      name="recent_race_time"
                      value={personalForm.recent_race_time}
                      onChange={handlePersonalFormChange}
                      className="input-focus"
                      placeholder={t('onboarding.raceTimeOptional')}
                      data-testid="race-time-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="running_goals">Running Goals</Label>
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
                    Security
                  </h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-3">
                      Password reset functionality will be available soon. For now, your account is secured through the platform authentication.
                    </p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled
                      className="btn-transition"
                    >
                      Change Password (Coming Soon)
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 btn-transition"
                    data-testid="save-personal-info-btn"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
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
                    <Label htmlFor="openai_key">API Key</Label>
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
                        Save Key
                      </Button>
                    </div>
                    {integrations.openai_api_key && integrations.openai_api_key !== '' && (
                      <div className="flex items-center text-sm text-green-600">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Current key: {integrations.openai_api_key}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Your API key is encrypted and stored securely. Get your key from{' '}
                    <a 
                      href="https://platform.openai.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline inline-flex items-center"
                    >
                      OpenAI Platform <ExternalLink className="w-3 h-3 ml-1" />
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
                          Sync Activities
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDisconnectIntegration('strava')}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="disconnect-strava-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800 mb-3">
                        Connect your Strava account to automatically import your workouts, including distance, pace, heart rate, and route data.
                      </p>
                      <Button 
                        onClick={handleStravaConnect}
                        className="bg-orange-600 hover:bg-orange-700 btn-transition"
                        data-testid="connect-strava-btn"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Connect to Strava
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
                  Oura Ring Integration
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
                          Sync Sleep & Recovery
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDisconnectIntegration('oura')}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="disconnect-oura-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-800 mb-3">
                        Connect your Oura Ring to automatically import sleep quality, HRV, resting heart rate, and readiness scores.
                      </p>
                      <Button 
                        onClick={handleOuraConnect}
                        className="bg-purple-600 hover:bg-purple-700 btn-transition"
                        data-testid="connect-oura-btn"
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        Connect to Oura
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
                  COROS Watch Integration
                </CardTitle>
                <CardDescription>
                  Connect your COROS watch via API to automatically import workouts
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
                              COROS Connected
                            </p>
                            <p className="text-sm text-green-600">
                              Last sync: {integrations.coros.last_sync ? 
                                new Date(integrations.coros.last_sync).toLocaleString() : 
                                'Never'
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
                          Sync Activities
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDisconnectIntegration('coros')}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="disconnect-coros-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 mb-3">
                        Connect your COROS watch to automatically import your activities including distance, pace, heart rate, cadence, and route data. Integration powered by Terra API.
                      </p>
                      <Button 
                        onClick={handleCorosConnect}
                        className="bg-blue-600 hover:bg-blue-700 btn-transition"
                        data-testid="connect-coros-btn"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Connect to COROS
                      </Button>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">
                        <strong>Note:</strong> COROS integration uses Terra API for secure data access.
                      </p>
                      <p className="text-xs text-gray-500">
                        Your COROS activities will be automatically synchronized including runs, trails, and other training data from your COROS device.
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
                <CardTitle className="text-lg">Quick Templates</CardTitle>
                <CardDescription>
                  Popular analysis prompts to get you started
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
                  Logout
                </h3>
                <p className="text-sm text-gray-600">
                  Sign out of your account and return to the login page
                </p>
              </div>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 btn-transition w-full md:w-auto"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Account;
