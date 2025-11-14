import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Target, Calendar, Users, Edit3, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { logger } from '../../../utils/logger';

const ChallengeCard = ({ challenge, athleteId, onJoin, onLeave, onDelete, onEdit, onClick, isSuperAdmin = false, t }) => {
  const { t: translate } = useTranslation();
  const progress = challenge.user_progress || 0;
  const goalValue = challenge.goal_value;
  const percentage = Math.min((progress / goalValue) * 100, 100);
  const isCreator = challenge.creator_id === athleteId;
  const hasJoined = challenge.has_joined;
  
  // Debug logging
  logger.debug(null, '🔍 ChallengeCard DEBUG:', {
    challengeTitle: challenge.title,
    athleteId,
    creatorId: challenge.creator_id,
    isCreator,
    hasJoined,
    challenge
  });
  
  // Check if challenge is active
  const now = new Date();
  const endDate = new Date(challenge.end_date);
  const isActive = endDate > now;
  
  // Get challenge type icon and label
  const getChallengeIcon = () => {
    switch (challenge.challenge_type) {
      case 'distance': return <Target className="w-8 h-8 text-gray-400" />;
      case 'activity_count': return <TrendingUp className="w-8 h-8 text-gray-400" />;
      case 'duration': return <Clock className="w-8 h-8 text-gray-400" />;
      default: return <Trophy className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div 
      className="border-0 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow rounded-none md:rounded-3xl"
      style={{ background: 'var(--grad-surface)' }}
      onClick={() => onClick(challenge.id)}
    >
      <div className="p-0 sm:p-6">
        {challenge.cover_photo && (
          <div className="mb-4 sm:mb-4 relative">
            <img src={challenge.cover_photo} alt={challenge.title} className="w-full h-48 object-cover rounded-none sm:rounded-lg" />
            
            {/* Trophy Icon - Positioned on Banner */}
            <div className="absolute bottom-3 left-3">
              {challenge.trophy_image ? (
                <img src={challenge.trophy_image} alt="Trophy" className="w-16 h-16 rounded-full object-cover border-4 border-gray-800 shadow-lg" />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-lg">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="px-3 sm:px-0">
          <div className="mb-3">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white truncate">{challenge.title}</h3>
                {isCreator && (
                  <Crown className="w-5 h-5 text-yellow-400 flex-shrink-0" title={t('community.actions.challengeCreator')} />
                )}
              </div>
              {(isCreator || isSuperAdmin) && (
                <div className="flex space-x-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(challenge);
                    }}
                    className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(challenge.id);
                    }}
                    className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-gray-300 text-sm line-clamp-2 mb-2">{challenge.description}</p>
          </div>

          {/* Challenge Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center text-gray-400 text-sm">
              {getChallengeIcon()}
              <span className="ml-2">
                {translate('community.challenge.goal')}: {goalValue} {challenge.goal_unit}
              </span>
              {challenge.is_recurring && (
                <RefreshCw className="w-4 h-4 ml-2 text-blue-400" title={translate('community.actions.recurringChallenge')} />
              )}
            </div>
            <div className="flex items-center text-gray-400 text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-gray-400">{challenge.participants_count || 0} {translate('community.challenge.participants')}</span>
              <span className={`px-2 py-1 rounded text-xs ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
                {isActive ? translate('community.challenge.active') : translate('community.challenge.completed')}
              </span>
              {challenge.visibility === 'private' && (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Progress Bar (if joined) */}
          {hasJoined && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">{translate('community.challenge.yourProgress')}</span>
                <span className="text-[#00C2A8] font-semibold">
                  {progress.toFixed(1)} / {goalValue} {challenge.goal_unit}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-[#00C2A8] to-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-400 mt-1">
                {percentage.toFixed(1)}% {translate('community.challenge.complete')}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pb-3 sm:pb-0">
            {hasJoined ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLeave();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {translate('community.challenge.leaveChallenge')}
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-[#00C2A8] hover:bg-[#00a890] text-white transition-colors"
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                {translate('community.challenge.joinChallenge')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



export default ChallengeCard;
