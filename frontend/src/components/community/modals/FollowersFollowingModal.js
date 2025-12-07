import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';
import OnlineStatusIndicator from '../../OnlineStatusIndicator';
import axios from 'axios';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const FollowersFollowingModal = ({ athleteId, athleteName, initialTab = 'followers', onClose, onViewProfile, t }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [followersRes, followingRes] = await Promise.all([
        axios.get(`${API}/community/athletes/${athleteId}/followers`),
        axios.get(`${API}/community/athletes/${athleteId}/following`)
      ]);
      
      setFollowers(followersRes.data.followers || []);
      setFollowing(followingRes.data.following || []);
    } catch (error) {
      console.error('Error loading followers/following:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFollower = async (followerId) => {
    if (!window.confirm(t('community.confirmRemoveFollower'))) return;
    
    setActionLoading(followerId);
    try {
      await axios.delete(`${API}/community/follow`, {
        params: {
          follower_id: followerId,
          following_id: athleteId
        }
      });
      
      // Remove from local state
      setFollowers(prev => prev.filter(f => f.id !== followerId));
    } catch (error) {
      console.error('Error removing follower:', error);
      alert(t('community.errorRemovingFollower'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfollow = async (followingId) => {
    if (!window.confirm(t('community.confirmUnfollow'))) return;
    
    setActionLoading(followingId);
    try {
      await axios.delete(`${API}/community/follow`, {
        params: {
          follower_id: athleteId,
          following_id: followingId
        }
      });
      
      // Remove from local state
      setFollowing(prev => prev.filter(f => f.id !== followingId));
    } catch (error) {
      console.error('Error unfollowing:', error);
      alert(t('community.errorUnfollowing'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockUser = async (userId) => {
    if (!window.confirm(t('community.confirmBlockUser'))) return;
    
    setActionLoading(userId);
    try {
      await axios.post(`${API}/community/block`, {
        blocker_id: athleteId,
        blocked_id: userId
      });
      
      // Remove from followers list
      setFollowers(prev => prev.filter(f => f.id !== userId));
      alert(t('community.userBlocked'));
    } catch (error) {
      console.error('Error blocking user:', error);
      alert(t('community.errorBlockingUser'));
    } finally {
      setActionLoading(null);
    }
  };

  const currentList = activeTab === 'followers' ? followers : following;
  
  const filteredList = currentList.filter(athlete => {
    const name = athlete.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-2 md:p-4" onClick={onClose}>
      <div className="rounded-none md:rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              {athleteName}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('followers');
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                activeTab === 'followers'
                  ? 'bg-[#32D3FF] text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('community.followers')} ({followers.length})
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('following');
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                activeTab === 'following'
                  ? 'bg-[#32D3FF] text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('community.following')} ({following.length})
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('community.searchUsers')}
                className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-600 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
              />
            </div>
          </div>

          {/* Athletes List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-[#32D3FF] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  {searchQuery 
                    ? t('community.noUsersFound')
                    : activeTab === 'followers' 
                      ? t('community.noFollowers')
                      : t('community.noFollowing')
                  }
                </p>
              </div>
            ) : (
              filteredList.map(athlete => (
                <div
                  key={athlete.id}
                  className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-colors"
                >
                  <div 
                    className="flex items-center space-x-4 flex-1 cursor-pointer"
                    onClick={() => {
                      onViewProfile(athlete.id);
                      onClose();
                    }}
                  >
                    <div className="relative">
                      {athlete.profile_picture ? (
                        <>
                          <img
                            src={athlete.profile_picture}
                            alt={athlete.name}
                            className="w-14 h-14 rounded-full object-cover"
                          />
                          <FlagIcon nationality={athlete.nationality} size="medium" />
                          <OnlineStatusIndicator last_active_at={athlete.last_active_at} size="medium" />
                        </>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-xl font-bold text-white">
                            {athlete.name ? athlete.name.charAt(0).toUpperCase() : '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-white">{athlete.name}</h3>
                        <SubscriptionBadge tier={athlete.subscription_tier} />
                      </div>
                      {athlete.bio && (
                        <p className="text-sm text-gray-400 line-clamp-1">{athlete.bio}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    {activeTab === 'followers' ? (
                      <>
                        <Button
                          onClick={() => handleRemoveFollower(athlete.id)}
                          variant="outline"
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white border-0"
                        >
                          {t('community.removeFollower')}
                        </Button>
                        <Button
                          onClick={() => handleBlockUser(athlete.id)}
                          variant="outline"
                          size="sm"
                          className="bg-gray-800 hover:bg-gray-900 text-white border-gray-600"
                        >
                          {t('community.blockUser')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleUnfollow(athlete.id)}
                        variant="outline"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white border-0"
                      >
                        {t('community.unfollowUser')}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowersFollowingModal;
