import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Globe, 
  CreditCard, 
  Calendar, 
  DollarSign,
  MessageSquare,
  FileText,
  CalendarCheck,
  Target,
  Users,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UserProfile = ({ athleteId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract userId from pathname (format: "/dashboard/crm/user/{userId}")
  const userId = location.pathname.split('/').pop();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(`${API}/crm/users/${userId}`, {
        params: { athlete_id: athleteId }
      });
      setUserData(response.data);
    } catch (error) {
      logger.error(null, 'Error fetching user profile:', error);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getPlanBadge = (tier) => {
    const styles = {
      free: 'bg-gray-600 text-white',
      pro: 'bg-blue-600 text-white',
      premium: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
    };
    return styles[tier] || styles.free;
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="text-center text-gray-300 py-12">Loading user profile...</div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <Button
          onClick={() => navigate('/dashboard/crm')}
          className="mb-4 bg-gray-700 hover:bg-gray-600 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to CRM
        </Button>
        <div className="text-center text-red-400 py-12">{error || 'User not found'}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header with Back Button */}
      <Button
        onClick={() => navigate('/dashboard/crm')}
        className="mb-6 bg-gray-700 hover:bg-gray-600 text-white border-0"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to CRM
      </Button>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Column - 70% */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: User Profile Card */}
          <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-white">User Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  {userData.profile_picture ? (
                    <img
                      src={userData.profile_picture}
                      alt={userData.name}
                      className="w-32 h-32 rounded-full object-cover border-4 border-[#32D3FF]"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-[#32D3FF] flex items-center justify-center border-4 border-[#32D3FF]">
                      <span className="text-4xl font-bold text-white">
                        {userData.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* User Info Grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-[#32D3FF] mt-1" />
                    <div>
                      <p className="text-sm text-gray-400">Username</p>
                      <p className="text-white font-medium">{userData.name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-[#32D3FF] mt-1" />
                    <div>
                      <p className="text-sm text-gray-400">Email Address</p>
                      <p className="text-white font-medium break-all">{userData.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-[#32D3FF] mt-1" />
                    <div>
                      <p className="text-sm text-gray-400">Nationality</p>
                      <p className="text-white font-medium">{userData.nationality || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-[#32D3FF] mt-1" />
                    <div>
                      <p className="text-sm text-gray-400">Current Plan</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getPlanBadge(userData.subscription_tier)}>
                          {userData.subscription_tier.charAt(0).toUpperCase() + userData.subscription_tier.slice(1)}
                        </Badge>
                        {userData.subscription_interval && (
                          <span className="text-sm text-gray-300">
                            / {userData.subscription_interval === 'month' ? 'Monthly' : 'Annually'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-[#32D3FF] mt-1" />
                    <div>
                      <p className="text-sm text-gray-400">Member Since</p>
                      <p className="text-white font-medium">{formatDate(userData.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-[#32D3FF] mt-1" />
                    <div>
                      <p className="text-sm text-gray-400">Lifetime Value</p>
                      <p className="text-white font-medium text-lg">{formatCurrency(userData.lifetime_value)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Community Stats */}
          <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-white">Community Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <FileText className="w-8 h-8 text-[#32D3FF] mb-2" />
                  <p className="text-2xl font-bold text-white">{userData.community_stats.posts_added}</p>
                  <p className="text-sm text-gray-400">Posts Added</p>
                </div>

                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <MessageSquare className="w-8 h-8 text-[#32D3FF] mb-2" />
                  <p className="text-2xl font-bold text-white">{userData.community_stats.comments_created}</p>
                  <p className="text-sm text-gray-400">Comments</p>
                </div>

                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <CalendarCheck className="w-8 h-8 text-[#32D3FF] mb-2" />
                  <p className="text-2xl font-bold text-white">{userData.community_stats.events_created}</p>
                  <p className="text-sm text-gray-400">Events Created</p>
                </div>

                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <Target className="w-8 h-8 text-[#32D3FF] mb-2" />
                  <p className="text-2xl font-bold text-white">{userData.community_stats.challenges_done}</p>
                  <p className="text-sm text-gray-400">Challenges Done</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Referrals */}
          <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-white">Referral Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <Users className="w-8 h-8 text-[#32D3FF] mb-2" />
                  <p className="text-2xl font-bold text-white">{userData.referral_stats.referrals_count}</p>
                  <p className="text-sm text-gray-400">Referrals</p>
                </div>

                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <DollarSign className="w-8 h-8 text-green-500 mb-2" />
                  <p className="text-2xl font-bold text-white">{formatCurrency(userData.referral_stats.kickback)}</p>
                  <p className="text-sm text-gray-400">Kickback</p>
                </div>

                <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-blue-500 mb-2" />
                  <p className="text-2xl font-bold text-white">{formatCurrency(userData.referral_stats.generated_revenue)}</p>
                  <p className="text-sm text-gray-400">Generated Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 30% */}
        <div className="lg:col-span-3">
          <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg sticky top-6">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#32D3FF]" />
                Interactions Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userData.interactions && userData.interactions.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {userData.interactions.map((interaction, index) => (
                    <div key={index} className="flex gap-3 pb-4 border-b border-gray-600 last:border-0">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[#32D3FF] mt-2"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{interaction.description}</p>
                        <p className="text-gray-400 text-xs mt-1">{formatDate(interaction.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No interactions recorded yet</p>
                  <p className="text-gray-500 text-xs mt-1">Timeline feature coming soon</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
