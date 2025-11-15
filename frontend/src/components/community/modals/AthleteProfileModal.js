import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, UserPlus, UserMinus, Heart, Share2, MapPin, Calendar, MessageCircle } from 'lucide-react';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';
import ImageCarousel from '../../ImageCarousel';
import axios from 'axios';
import { logger } from '../../../utils/logger';
import { formatMentions } from '../../../utils/mentionUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AthleteProfileModal = ({ profile, onClose, onFollowToggle, loading, athleteId, loadAthleteProfile, handleLike, handleShare, handleToggleComments, setFullSizeImageUrl, setShowFullSizeImage }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('about'); // 'about' or 'posts'
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  
  // Calculate age from date of birth
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;

  // Translate interest names using account settings translations
  const translateInterest = (interest) => {
    // Map interest names to translation keys
    const interestKeyMap = {
      'Running': 'account.interestRunning',
      'Cycling': 'account.interestCycling',
      'Swimming': 'account.interestSwimming',
      'Triathlon': 'account.interestTriathlon',
      'Marathon': 'account.interestMarathon',
      'Ultramarathon': 'account.interestUltramarathon',
      'Trail Running': 'account.interestTrailRunning',
      'Strength Training': 'account.interestStrengthTraining',
      'Yoga': 'account.interestYoga',
      'CrossFit': 'account.interestCrossFit',
      'Hiking': 'account.interestHiking',
      'Basketball': 'account.interestBasketball',
      'Tennis': 'account.interestTennis',
      'Rock Climbing': 'account.interestRockClimbing',
      'Fitness': 'account.interestFitness',
      'Nutrition': 'account.interestNutrition'
    };

    const key = interestKeyMap[interest];
    return key ? t(key) : interest; // Fallback to original if no translation found
  };

  // Load user posts when Posts tab is clicked
  useEffect(() => {
    if (activeTab === 'posts' && profile?.id) {
      loadUserPosts();
    }
  }, [activeTab, profile?.id]);

  const loadUserPosts = async () => {
    if (!profile?.id) return;
    
    setPostsLoading(true);
    try {
      const response = await axios.get(`${API}/community/user/${profile.id}/posts?viewer_athlete_id=${athleteId}&limit=20`);
      setUserPosts(response.data.posts || []);
    } catch (error) {
      logger.error(null, 'Error loading user posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4" onClick={onClose}>
      <div className="rounded-none md:rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }} onClick={(e) => e.stopPropagation()}>
        {/* Close button - X icon in top-right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-700 rounded-full transition-colors z-10"
          title="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="p-6">
            <div className="flex items-center space-x-4 mb-6">
              <div 
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (profile.profile_picture) {
                    setFullSizeImageUrl(profile.profile_picture);
                    setShowFullSizeImage(true);
                  }
                }}
                title="Click to view full size"
              >
                {profile.profile_picture ? (
                  <>
                    <img
                      src={profile.profile_picture}
                      alt={profile.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <FlagIcon nationality={profile.nationality} size="large" />
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-[#00C2A8] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">
                        {profile.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <FlagIcon nationality={profile.nationality} size="large" />
                  </>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  {profile.name}
                  <SubscriptionBadge subscriptionTier={profile.subscription_tier} />
                </h2>
                {age && <p className="text-gray-400 text-sm">{t('community.yearsOld', { age })}</p>}
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-2 mb-6 border-b border-gray-700">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'about'
                    ? 'text-[#00C2A8] border-b-2 border-[#00C2A8]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('community.about')}
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'posts'
                    ? 'text-[#00C2A8] border-b-2 border-[#00C2A8]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('community.posts')} ({profile.posts_count || 0})
              </button>
            </div>

            {/* About Tab Content */}
            {activeTab === 'about' && (
              <>
                {/* Bio Section */}
                {profile.bio && profile.share_bio && (
                  <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">{t('community.about')}</h3>
                    <p className="text-gray-300 text-sm">{profile.bio}</p>
                  </div>
                )}

                {/* Health/Training Goals Section */}
                {profile.running_goals && profile.share_goals && (
                  <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">{t('community.healthTrainingGoals')}</h3>
                    <p className="text-gray-300 text-sm">{profile.running_goals}</p>
                    {profile.health_goals && profile.health_goals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.health_goals.map((goal, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs"
                          >
                            {goal.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Interests Section */}
                {profile.interests && profile.interests.length > 0 && profile.share_interests && (
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-2">{t('community.interests')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-[#00C2A8]/20 text-[#00C2A8] rounded-full text-sm"
                        >
                          {translateInterest(interest)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.posts_count || 0}</p>
                    <p className="text-gray-400 text-sm">{t('community.posts')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.followers_count || 0}</p>
                    <p className="text-gray-400 text-sm">{t('community.followers')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.following_count || 0}</p>
                    <p className="text-gray-400 text-sm">{t('community.following')}</p>
                  </div>
                </div>
              </>
            )}

            {/* Posts Tab Content */}
            {activeTab === 'posts' && (
              <div className="space-y-4">
                {postsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : userPosts.length > 0 ? (
                  userPosts.map(post => (
                    <div key={post.id} className="bg-gray-700/50 rounded-lg p-4">
                      {/* Post Header */}
                      <div className="flex items-center space-x-3 mb-3">
                        {post.athlete_profile_picture ? (
                          <img
                            src={post.athlete_profile_picture}
                            alt={post.athlete_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-[#00C2A8] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {post.athlete_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-white font-semibold flex items-center">
                            {post.athlete_name}
                            <SubscriptionBadge subscriptionTier={post.subscription_tier} />
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(post.created_at).toLocaleString()}
                            {post.is_edited && <span className="ml-2">(edited)</span>}
                          </p>
                        </div>
                      </div>

                      {/* Post Content */}
                      <p className="text-white whitespace-pre-wrap mb-3 pt-3">{formatMentions(post.content)}</p>
                      
                      {/* Display media (images and videos) */}
                      {post.media && post.media.length > 0 ? (
                        <div className="mb-3">
                          <ImageCarousel media={post.media} alt="Post media" />
                        </div>
                      ) : post.image_urls && post.image_urls.length > 0 ? (
                        <div className="mb-3">
                          <ImageCarousel images={post.image_urls} alt="Post images" />
                        </div>
                      ) : post.image_data ? (
                        <img 
                          src={post.image_data} 
                          alt="Post" 
                          className="w-full rounded-lg max-h-96 object-cover mb-3" 
                        />
                      ) : null}

                      {/* Post Actions */}
                      <div className="flex items-center space-x-6 text-gray-400">
                        <button
                          onClick={() => handleLike(post.id)}
                          className="flex items-center space-x-2 hover:text-red-500 transition-colors"
                        >
                          <Heart className={`w-5 h-5 ${post.liked_by_user ? 'fill-red-500 text-red-500' : ''}`} />
                          <span className="text-sm">{post.likes_count || 0}</span>
                        </button>
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="w-5 h-5" />
                          <span className="text-sm">{post.comments_count || 0}</span>
                        </div>
                        <button
                          onClick={() => handleShare(post.id)}
                          className="flex items-center space-x-2 hover:text-[#00C2A8] transition-colors"
                        >
                          <Share2 className="w-5 h-5" />
                          <span className="text-sm">{post.shares_count || 0}</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-12">No posts yet</p>
                )}
              </div>
            )}
            
            <div className="flex space-x-3 mt-6">
              {!profile.is_own_profile && (
                <Button
                  onClick={onFollowToggle}
                  className={`flex-1 ${
                    profile.is_following
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-[#00C2A8] hover:bg-[#00a890]'
                  } text-white`}
                >
                  {profile.is_following ? (
                    <>
                      <UserMinus className="w-4 h-4 mr-2" />
                      {t('athlete.unfollow')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t('athlete.follow')}
                    </>
                  )}
                </Button>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AthleteProfileModal;
