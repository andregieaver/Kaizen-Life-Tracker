import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gift, Copy, Check, Twitter, Facebook, Mail, ExternalLink, TrendingUp, Users as UsersIcon, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

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
      // For now, generate a simple code based on athlete ID
      // In production, this would call backend API
      const code = `TRAIN${athleteId.substring(0, 8).toUpperCase()}`;
      setReferralCode(code);
      
      // Mock stats for MVP
      setStats({
        totalClicks: 0,
        totalConversions: 0,
        conversionRate: 0,
        pendingReferrals: 0,
        totalRewards: 0,
        availableRewards: [],
        referralLink: `${window.location.origin}/?ref=${code}`
      });
      
      setLoading(false);
    } catch (err) {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Gift className="w-8 h-8 text-[#00C2A8] mr-3" />
            <h1 className="text-3xl font-bold text-white">Referral Rewards</h1>
          </div>
          <p className="text-gray-400 ml-11">
            Share TrainSmart with friends and earn rewards! Get 20% off for each friend who signs up.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Clicks</p>
                  <p className="text-3xl font-bold text-white">{stats.totalClicks}</p>
                </div>
                <ExternalLink className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Conversions</p>
                  <p className="text-3xl font-bold text-white">{stats.totalConversions}</p>
                </div>
                <UsersIcon className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Conversion Rate</p>
                  <p className="text-3xl font-bold text-white">
                    {stats.conversionRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Rewards Earned</p>
                  <p className="text-3xl font-bold text-white">{stats.totalRewards}</p>
                </div>
                <Award className="w-8 h-8 text-[#00C2A8] opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link Section */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl">Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Referral Code Display */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Your Referral Code</p>
                <p className="text-2xl font-bold text-[#00C2A8] tracking-wider">
                  {referralCode}
                </p>
              </div>

              {/* Link Copy Section */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stats.referralLink}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
                />
                <Button
                  onClick={copyReferralLink}
                  className="px-6 py-3 bg-[#00C2A8] text-white rounded-lg hover:bg-[#00a890] transition-colors flex items-center gap-2"
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy
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
                  <Twitter className="w-5 h-5" />
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
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#00C2A8]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-[#00C2A8] font-bold text-xl">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Share Your Link</h3>
                <p className="text-gray-400 text-sm">
                  Share your unique referral link with friends via social media, email, or direct message.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#00C2A8]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-[#00C2A8] font-bold text-xl">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Friend Signs Up</h3>
                <p className="text-gray-400 text-sm">
                  When they sign up using your link, they get 20% off their first month.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-[#00C2A8]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-[#00C2A8] font-bold text-xl">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">You Get Rewarded</h3>
                <p className="text-gray-400 text-sm">
                  You'll receive a 20% discount code to use on your next subscription renewal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rewards Section */}
        {stats.availableRewards.length > 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-xl">Your Available Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.availableRewards.map((reward, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 bg-green-900/20 border border-green-700 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-green-400">
                        {reward.discount}% Discount Code
                      </p>
                      <p className="text-sm text-gray-400">
                        Expires: {new Date(reward.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="px-3 py-1 bg-gray-900 border border-green-700 rounded font-mono text-sm text-green-400">
                        {reward.code}
                      </code>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(reward.code);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Copy Code
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-12 text-center">
              <Gift className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-white text-xl font-semibold mb-2">No Rewards Yet</h3>
              <p className="text-gray-400 mb-6">
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
