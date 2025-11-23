import React, { useState } from 'react';
import { CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PollCard = ({ post, athleteId, onVote, translatedPosts, translatingPosts, onTranslatePost }) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);

  if (!post.poll_data) return null;

  const { question, options, total_votes, end_date, is_active } = post.poll_data;
  
  // Check if user has already voted
  const userVote = options.find(opt => opt.voters && opt.voters.includes(athleteId));
  const userHasVoted = !!userVote || hasVoted;
  
  // Check if poll has ended
  const endDate = new Date(end_date);
  const hasEnded = new Date() > endDate || !is_active;
  
  // Calculate time remaining
  const timeRemaining = () => {
    if (hasEnded) return t('community.poll.pollEnded');
    
    const now = new Date();
    const diff = endDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return t('community.poll.daysLeft', { count: days });
    if (hours > 0) return t('community.poll.hoursLeft', { count: hours });
    return t('community.poll.lessThanHourLeft');
  };

  const handleVote = async (optionId) => {
    if (hasEnded || userHasVoted) return;
    
    setSelectedOption(optionId);
    setHasVoted(true);
    
    if (onVote) {
      await onVote(post.id, optionId);
    }
  };

  const getPercentage = (votes) => {
    if (total_votes === 0) return 0;
    return Math.round((votes / total_votes) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Poll Question */}
      <div>
        <div className="text-white font-semibold text-lg">
          {translatedPosts?.[post.id]?.isTranslated 
            ? translatedPosts[post.id].translated_text 
            : question}
        </div>
        {/* Translation Button */}
        {onTranslatePost && (
          <button
            onClick={() => onTranslatePost(post.id, question)}
            disabled={translatingPosts?.[post.id]}
            className="text-[#00FFFF] hover:text-[#00d4d4] text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 mt-2"
          >
            {translatingPosts?.[post.id] ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                {t('community.post.translating')}
              </>
            ) : translatedPosts?.[post.id]?.isTranslated ? (
              t('community.post.seeOriginal')
            ) : (
              t('community.post.seeTranslation')
            )}
          </button>
        )}
      </div>

      {/* Poll Options */}
      <div className="space-y-2">
        {options.map((option, index) => {
          const percentage = getPercentage(option.votes);
          const isSelected = userVote?.id === option.id || selectedOption === option.id;
          const showResults = userHasVoted || hasEnded;

          return (
            <div key={option.id}>
              {showResults ? (
                // Show results
                <div className="relative">
                  <div 
                    className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'border-[#00C2A8] bg-[#00C2A8]/10' 
                        : 'border-gray-600 bg-gray-700/50'
                    }`}
                  >
                    {/* Progress bar */}
                    <div 
                      className="absolute inset-y-0 left-0 bg-[#00C2A8]/20 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    
                    {/* Content */}
                    <div className="relative flex items-center justify-between px-4 py-3">
                      <div className="flex items-center space-x-2 flex-1">
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-[#00C2A8] flex-shrink-0" />
                        )}
                        <span className={`text-sm ${isSelected ? 'text-white font-semibold' : 'text-gray-300'}`}>
                          {option.text}
                        </span>
                      </div>
                      <span className="text-white font-bold text-sm ml-2">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                // Show voting buttons
                <button
                  onClick={() => handleVote(option.id)}
                  disabled={hasEnded}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    hasEnded
                      ? 'border-gray-600 bg-gray-700/50 cursor-not-allowed opacity-50'
                      : 'border-gray-600 bg-gray-700/50 hover:border-[#00C2A8] hover:bg-[#00C2A8]/10'
                  }`}
                >
                  <span className="text-white text-sm">{option.text}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Poll Footer */}
      <div className="flex items-center justify-between text-gray-400 text-sm pt-2 border-t border-gray-700">
        <span>
          {total_votes} {total_votes === 1 ? 'vote' : 'votes'}
        </span>
        <div className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>{timeRemaining()}</span>
        </div>
      </div>
    </div>
  );
};

export default PollCard;
