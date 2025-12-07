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
import { logger } from '../utils/logger';
import { 
  User, 
  Key, 
  LogOut,
  CreditCard,
  Shield,
  ExternalLink
} from 'lucide-react';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

const Account = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [athlete, setAthlete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState(null);

  useEffect(() => {
    if (athleteId) {
      loadAthleteData();
      loadSubscriptionData();
    }
  }, [athleteId]);

  const loadAthleteData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(response.data);
    } catch (error) {
      logger.error(null, 'Error loading athlete:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscriptionData = async () => {
    try {
      const response = await axios.get(`${API}/subscription-status/${athleteId}`);
      setSubscriptionData(response.data);
    } catch (error) {
      logger.error(null, 'Error loading subscription:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('athleteId');
    navigate('/login');
  };

  const handleGoToConnections = () => {
    navigate('/dashboard/connections');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Account Settings
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your profile, security, and subscription
          </p>
        </div>
        <Button 
          onClick={handleGoToConnections}
          className="flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Manage Connections
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your basic account information and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={athlete?.name || ''}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={athlete?.email || ''}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Language Preference</Label>
                  <LanguageSelector />
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label htmlFor="created">Account Created</Label>
                  <Input
                    id="created"
                    value={athlete?.created_at ? new Date(athlete.created_at).toLocaleDateString() : ''}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="security" className="space-y-4">
                <ChangePassword athleteId={athleteId} />
                
                <Separator />
                
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <h4 className="font-medium text-red-900">Sign Out</h4>
                    <p className="text-sm text-red-700">
                      Sign out of your account on this device
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription
              </CardTitle>
              <CardDescription>
                Your current plan and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionData ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge className={`${
                      subscriptionData.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {subscriptionData.status}
                    </Badge>
                  </div>
                  
                  {subscriptionData.plan_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Plan</span>
                      <span className="text-sm">{subscriptionData.plan_name}</span>
                    </div>
                  )}
                  
                  {subscriptionData.next_billing_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Next Billing</span>
                      <span className="text-sm">
                        {new Date(subscriptionData.next_billing_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No subscription information</p>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/pricing')}
              >
                Manage Subscription
              </Button>
            </CardContent>
          </Card>

          {/* Integration Hub Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Data & Privacy
              </CardTitle>
              <CardDescription>
                Your data connections and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p>
                  This integration hub connects your wearables and fitness apps 
                  to provide unified data access.
                </p>
                <p className="text-gray-600">
                  Manage your provider connections and data sync preferences 
                  in the Connections tab.
                </p>
              </div>
              
              <Button 
                onClick={handleGoToConnections}
                className="w-full"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Connections
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Account;