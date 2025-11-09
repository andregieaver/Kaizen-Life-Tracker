import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gift, Copy, Check, Facebook, Mail, ExternalLink, TrendingUp, Users as UsersIcon, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Referrals = ({ athleteId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    generateReferralCode();
  }, [athleteId]);

  const generateReferralCode = async () => {
    try {
      setLoading(true);
      
      // Call backend to generate/get referral code
      const codeResponse = await axios.post(`${API}/referrals/generate?athlete_id=${athleteId}`);
      const code = codeResponse.data.referral_code;
      setReferralCode(code);
      
      // Get stats from backend
      const statsResponse = await axios.get(`${API}/referrals/stats/${athleteId}`);
      const data = statsResponse.data;
      
      setStats({
        totalClicks: data.total_clicks,
        totalConversions: data.total_conversions,
        conversionRate: data.conversion_rate,
        pendingReferrals: data.pending_referrals,
        totalRewards: data.rewards.length,
        availableDiscount: data.total_discount_available,
        availableRewards: data.rewards.map(r => ({
          id: r.id,
          discount: r.discount_percentage,
          expires_at: r.expires_at,
          code: `SAVE${r.discount_percentage}`
        })),
        referralLink: codeResponse.data.referral_link
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error generating referral code:', err);
      setError('Failed to generate referral code');
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (stats?.referralLink) {
      navigator.clipboard.writeText(stats.referralLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const shareOnX = () => {
    const text = encodeURIComponent(
      `Join me on TrainSmart and get 20% off your first month! ${stats.referralLink}`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      '_blank'
    );
  };

  const shareOnFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(stats.referralLink)}`,
      '_blank'
    );
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Try TrainSmart with 20% off!');
    const body = encodeURIComponent(
      `I've been using TrainSmart and thought you might like it too!\n\n` +
      `Sign up using my referral link to get 20% off your first month:\n` +
      `${stats.referralLink}\n\n` +
      `Happy training!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your referral dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <Button
            onClick={generateReferralCode}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-2 md:py-10 md:px-8 pt-6 md:pt-10">
      <div className="max-w-6xl mx-auto space-y-2 md:space-y-6">
        {/* Header */}
        <div className="mb-2 md:mb-4">
          <div className="flex items-center mb-2">
            <Gift className="w-6 h-6 md:w-8 md:h-8 mr-3" style={{ color: '#32D3FF' }} />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Referral Rewards</h1>
          </div>
          <p className="text-gray-400 ml-9 md:ml-11 text-sm md:text-base">
            Share TrainSmart with friends and earn rewards! Get 20% off for each friend who signs up.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-4 md:p-6" style={{ 
              background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs md:text-sm mb-1">Total Clicks</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">{stats.totalClicks}</p>
                </div>
                <ExternalLink className="w-6 h-6 md:w-8 md:h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-4 md:p-6" style={{ 
              background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs md:text-sm mb-1">Conversions</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">{stats.totalConversions}</p>
                </div>
                <UsersIcon className="w-6 h-6 md:w-8 md:h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-4 md:p-6" style={{ 
              background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs md:text-sm mb-1">Conversion Rate</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    {stats.conversionRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-4 md:p-6" style={{ 
              background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs md:text-sm mb-1">Available Discount</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">{stats.availableDiscount || 0}%</p>
                </div>
                <Award className="w-6 h-6 md:w-8 md:h-8 opacity-50" style={{ color: '#32D3FF' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link Section */}
        <Card className="border-0 shadow-lg" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <CardHeader>
            <CardTitle className="text-white text-xl">Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Referral Code Display */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Your Referral Code</p>
                <p className="text-xl md:text-2xl font-bold tracking-wider" style={{ color: '#32D3FF' }}>
                  {referralCode}
                </p>
              </div>

              {/* Link Copy Section */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stats.referralLink}
                  readOnly
                  className="flex-1 px-3 py-3 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs sm:text-sm focus:outline-none min-w-0"
                  style={{ 
                    '&:focus': { 
                      boxShadow: '0 0 0 2px rgba(50, 211, 255, 0.5)'
                    }
                  }}
                />
                <Button
                  onClick={copyReferralLink}
                  className="px-3 sm:px-6 py-3 text-white rounded-lg transition-colors flex items-center gap-1 sm:gap-2 flex-shrink-0"
                  style={{ 
                    backgroundColor: '#32D3FF',
                    '&:hover': { backgroundColor: '#1FC1FF' }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span className="hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Social Sharing Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  onClick={shareOnX}
                  className="w-full px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  <img 
                    src="https://customer-assets.emergentagent.com/job_community-coach-1/artifacts/d75fcfph_x-social-media-white-icon.png" 
                    alt="X" 
                    className="w-5 h-5"
                  />
                  Share on X
                </Button>
                <Button
                  onClick={shareOnFacebook}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Facebook className="w-5 h-5" />
                  Share on Facebook
                </Button>
                <Button
                  onClick={shareViaEmail}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Share via Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="border-0 shadow-lg" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <CardHeader>
            <CardTitle className="text-white text-lg md:text-xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(50, 211, 255, 0.2)' }}>
                  <span className="font-bold text-xl" style={{ color: '#32D3FF' }}>1</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm md:text-base">Share Your Link</h3>
                <p className="text-gray-400 text-xs md:text-sm">
                  Share your unique referral link with friends via social media, email, or direct message.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(50, 211, 255, 0.2)' }}>
                  <span className="font-bold text-xl" style={{ color: '#32D3FF' }}>2</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm md:text-base">Friend Signs Up</h3>
                <p className="text-gray-400 text-xs md:text-sm">
                  When they sign up using your link, they get 20% off their first month.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(50, 211, 255, 0.2)' }}>
                  <span className="font-bold text-xl" style={{ color: '#32D3FF' }}>3</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm md:text-base">You Get Rewarded</h3>
                <p className="text-gray-400 text-xs md:text-sm">
                  You'll receive a 20% discount code to use on your next subscription renewal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rewards Section */}
        {stats.availableRewards && stats.availableRewards.length > 0 ? (
          <Card className="border-0 shadow-lg" style={{ 
            background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px'
          }}>
            <CardHeader>
              <CardTitle className="text-white text-lg md:text-xl">Your Available Rewards</CardTitle>
              <p className="text-gray-400 text-xs md:text-sm mt-2">
                You have <span className="font-bold" style={{ color: '#32D3FF' }}>{stats.availableDiscount}%</span> discount available for your next renewal
                {stats.availableDiscount >= 100 && <span className="text-yellow-400 ml-1">(Maximum reached! 🎉)</span>}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.availableRewards.map((reward, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 md:p-4 bg-green-900/20 border border-green-700 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-green-400 text-sm md:text-base">
                        {reward.discount}% Discount
                      </p>
                      <p className="text-xs md:text-sm text-gray-400">
                        Expires: {new Date(reward.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Applied automatically</p>
                      <Badge className="bg-green-600 text-white text-xs">Ready to use</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 md:p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <p className="text-xs md:text-sm text-blue-300">
                  💡 <strong>How it works:</strong> Your {stats.availableDiscount}% discount will be automatically applied at checkout on your next subscription renewal (max 100%).
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg" style={{ 
            background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px'
          }}>
            <CardContent className="p-8 md:p-12 text-center">
              <Gift className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-white text-lg md:text-xl font-semibold mb-2">No Rewards Yet</h3>
              <p className="text-gray-400 mb-6 text-sm md:text-base">
                Start sharing your referral link to earn discount codes!
              </p>
              <Button
                onClick={copyReferralLink}
                className="px-6 py-3 bg-[#00C2A8] text-white rounded-lg hover:bg-[#00a890] transition-colors"
              >
                Copy Referral Link
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Referrals;
