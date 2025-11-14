import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, Trophy, Target, TrendingUp, Award, Users, Calendar, Clock } from 'lucide-react';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';

const ChallengeDetailModal = ({ challengeData, loading, athleteId, onClose, onJoin, onLeave, onDelete, onAddComment }) => {
  const { t } = useTranslation();
  const [commentText, setCommentText] = useState('');

  if (loading || !challengeData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-8">
          <RefreshCw className="w-8 h-8 text-[#00C2A8] animate-spin mx-auto" />
          <p className="text-white mt-4">{t('community.challenge.loadingChallenge')}</p>
        </div>
      </div>
    );
  }

  const progress = challengeData.user_progress || 0;
  const goalValue = challengeData.goal_value;
  const percentage = Math.min((progress / goalValue) * 100, 100);
  const isCreator = challengeData.creator_id === athleteId;
  const hasJoined = challengeData.has_joined;

  const now = new Date();
  const endDate = new Date(challengeData.end_date);
  const isActive = endDate > now;

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(challengeData.id, commentText);
      setCommentText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{challengeData.title}</h2>
                <p className="text-gray-400 text-sm">
                  {t('community.challenge.createdBy')} {challengeData.creator_name}
                  {challengeData.is_recurring && <RefreshCw className="w-4 h-4 inline ml-2 text-blue-400" title={t('community.actions.recurringChallenge')} />}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Cover Photo */}
          {challengeData.cover_photo && (
            <img src={challengeData.cover_photo} alt={challengeData.title} className="w-full h-48 object-cover rounded-lg mb-4" />
          )}

          {/* Challenge Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  <Target className="w-5 h-5 mr-2 text-[#00C2A8]" />
                  <span className="font-semibold">{t('community.challenge.goal')}</span>
                </div>
                <p className="text-gray-300 text-lg">
                  {goalValue} {challengeData.goal_unit}
                </p>
                <p className="text-gray-400 text-sm capitalize">
                  {t(`community.challenge.type${challengeData.challenge_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`)}
                </p>
              </div>
            </div>

            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  <Calendar className="w-5 h-5 mr-2 text-[#00C2A8]" />
                  <span className="font-semibold">{t('community.challenge.duration')}</span>
                </div>
                <p className="text-gray-300 text-sm">
                  {new Date(challengeData.start_date).toLocaleDateString()} - {new Date(challengeData.end_date).toLocaleDateString()}
                </p>
                <p className={`text-sm mt-1 ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                  {isActive ? t('community.challenge.active') : t('community.challenge.completed')}
                </p>
              </div>
            </div>

            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  <UsersIcon className="w-5 h-5 mr-2 text-[#00C2A8]" />
                  <span className="font-semibold">{t('community.challenge.participants')}</span>
                </div>
                <p className="text-gray-300 text-2xl">
                  {challengeData.participants_count || 0}
                </p>
              </div>
            </div>

            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  {challengeData.visibility === 'public' ? <Globe className="w-5 h-5 mr-2 text-[#00C2A8]" /> : <Lock className="w-5 h-5 mr-2 text-[#00C2A8]" />}
                  <span className="font-semibold">{t('community.challenge.visibility')}</span>
                </div>
                <p className="text-gray-300 capitalize">
                  {t(`community.challenge.${challengeData.visibility}`)} / {t(`community.challenge.${challengeData.competition_type}`)}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {challengeData.description && (
            <div className="border-0 bg-gray-800 mb-6" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <h3 className="text-white font-semibold mb-2">{t('community.challenge.description')}</h3>
                <p className="text-gray-300">{challengeData.description}</p>
              </div>
            </div>
          )}

          {/* User Progress */}
          {hasJoined && (
            <div className="border-0 bg-gradient-to-r from-[#00C2A8]/20 to-green-500/20 mb-6" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-semibold">{t('community.challenge.yourProgress')}</h3>
                  <span className="text-[#00C2A8] font-bold text-lg">
                    {progress.toFixed(1)} / {goalValue} {challengeData.goal_unit}
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-3 mb-2">
                  <div 
                    className="bg-gradient-to-r from-[#00C2A8] to-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-right text-gray-300 text-sm">{percentage.toFixed(1)}% {t('community.challenge.complete')}</p>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {challengeData.leaderboard && challengeData.leaderboard.length > 0 && (
            <div className="border-0 bg-gray-800 mb-6" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  {t('community.challenge.leaderboard')}
                </h3>
                <div className="space-y-2">
                  {challengeData.leaderboard.slice(0, 10).map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                          #{index + 1}
                        </span>
                        <div className="relative">
                          {participant.athlete_profile_picture ? (
                            <>
                              <img src={participant.athlete_profile_picture} alt={participant.athlete_name} className="w-8 h-8 rounded-full" />
                              <FlagIcon nationality={participant.nationality} />
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm">{participant.athlete_name.charAt(0)}</span>
                              </div>
                              <FlagIcon nationality={participant.nationality} />
                            </>
                          )}
                        </div>
                        <span className="text-white flex items-center">
                          {participant.athlete_name}
                          <SubscriptionBadge subscriptionTier={participant.subscription_tier} />
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[#00C2A8] font-semibold">
                          {participant.current_progress.toFixed(1)} {challengeData.goal_unit}
                        </p>
                        <p className="text-gray-400 text-xs">{participant.percentage_complete.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="border-0 bg-gray-800 mb-6" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4" className="p-4">
              <h3 className="text-white font-semibold mb-4">{t('community.challenge.comments')}</h3>
              
              {/* Add Comment */}
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder={t('community.challenge.addComment')}
                />
                <button
                  onClick={handleAddComment}
                  className="px-4 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {challengeData.comments && challengeData.comments.length > 0 ? (
                  challengeData.comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3 py-2">
                      {comment.athlete_profile_picture ? (
                        <img src={comment.athlete_profile_picture} alt={comment.athlete_name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">{comment.athlete_name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium text-sm flex items-center">
                            {comment.athlete_name}
                            <SubscriptionBadge subscriptionTier={comment.subscription_tier} />
                          </span>
                          <span className="text-gray-500 text-xs">{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-300 text-sm mt-1">{comment.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">{t('community.challenge.noCommentsYet')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex space-x-2">
              {!isCreator && (
                hasJoined ? (
                  <button
                    onClick={onLeave}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    {t('community.challenge.leaveChallenge')}
                  </button>
                ) : (
                  <button
                    onClick={onJoin}
                    className="px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors"
                  >
                    <Trophy className="w-4 h-4 inline mr-2" />
                    {t('community.challenge.joinChallenge')}
                  </button>
                )
              )}
            </div>
            {isCreator && (
              <button
                onClick={onDelete}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 inline mr-2" />
                {t('community.challenge.deleteChallenge')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// EditChallengeModal Component


export default ChallengeDetailModal;
