import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
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
  Trash2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Account = ({ athleteId }) => {
  const [athlete, setAthlete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [integrations, setIntegrations] = useState({
    openai_api_key: '',
    strava: { connected: false, athlete_name: '', last_sync: null },
    oura: { connected: false, user_id: '', last_sync: null }
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

  useEffect(() => {
    loadAccountData();
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
      
      // TODO: Load integrations data from backend
      // For now, using mock data
      setIntegrations({
        openai_api_key: '••••••••••••sk-proj-example',
        strava: { 
          connected: false, 
          athlete_name: '', 
          last_sync: null 
        },
        oura: { 
          connected: false, 
          user_id: '', 
          last_sync: null 
        }
      });
      
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
    try {
      // TODO: Implement API key save endpoint
      // await axios.post(`${API}/integrations/openai`, { api_key: apiKeyForm.openai_api_key });
      
      setIntegrations(prev => ({
        ...prev,
        openai_api_key: '••••••••••••' + apiKeyForm.openai_api_key.slice(-8)
      }));
      
      setApiKeyForm({ openai_api_key: '' });
      setSaveStatus({ type: 'success', message: 'OpenAI API key updated successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error saving API key:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save API key' });
    }
  };

  const handleStravaConnect = () => {
    // TODO: Implement Strava OAuth flow
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin)}/auth/strava&approval_prompt=force&scope=read,activity:read_all`;
    window.location.href = stravaAuthUrl;
  };

  const handleOuraConnect = () => {
    // TODO: Implement Oura OAuth flow
    const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin)}/auth/oura&scope=daily`;
    window.location.href = ouraAuthUrl;
  };

  const handleDisconnectIntegration = async (integration) => {
    try {
      // TODO: Implement disconnect endpoint
      // await axios.delete(`${API}/integrations/${integration}`);
      
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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="skeleton h-8 w-48 mb-6"></div>
        <div className="skeleton h-96 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
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
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="personal" className="flex items-center" data-testid="personal-tab">
            <User className="w-4 h-4 mr-2" />
            Personal Information
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center" data-testid="integrations-tab">
            <Zap className="w-4 h-4 mr-2" />
            Integrations
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
              <form onSubmit={handleSavePersonalInfo} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
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
                    <Label htmlFor="age">Age</Label>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weekly_mileage">Weekly Mileage</Label>
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
                    <Label htmlFor="recent_race_time">Recent Race Time</Label>
                    <Input
                      id="recent_race_time"
                      name="recent_race_time"
                      value={personalForm.recent_race_time}
                      onChange={handlePersonalFormChange}
                      className="input-focus"
                      placeholder="e.g., 5K: 22:30, Marathon: 3:45:00"
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
                    placeholder="Describe your running goals and aspirations"
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
                          placeholder="sk-proj-..."
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
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <p className="font-medium text-green-900">
                            Connected as {integrations.strava.athlete_name}
                          </p>
                          <p className="text-sm text-green-600">
                            Last sync: {integrations.strava.last_sync || 'Never'}
                          </p>
                        </div>
                      </div>
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
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <p className="font-medium text-green-900">
                            Connected (User ID: {integrations.oura.user_id})
                          </p>
                          <p className="text-sm text-green-600">
                            Last sync: {integrations.oura.last_sync || 'Never'}
                          </p>
                        </div>
                      </div>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Account;
