import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, Send, Calendar, Clock, MapPin, Trash2 } from 'lucide-react';
import EmojiPickerButton from '../../EmojiPickerButton';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';

const EventDetailModal = ({ eventData, loading, onClose, athleteId, isSuperAdmin, loadAthleteProfile, onAddComment, commentText, setCommentText, onEmojiSelect, formatMentions, onDeleteComment }) => {
  const { t, i18n } = useTranslation();
  
  if (loading || !eventData) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
        onClick={onClose}
      >
        <div className="bg-gray-800 rounded-lg p-8 text-white">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#32D3FF]"></div>
            <p>{t('community.event.loadingEventDetails')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Photo Banner */}
        {eventData.cover_photo && (
          <div className="relative h-48 sm:h-64">
            <img src={eventData.cover_photo} alt={eventData.name} className="w-full h-full object-cover rounded-t-lg" />
          </div>
        )}

        <div className="p-4 sm:p-6">
          {/* Header with Title and Close Button */}
          <div className="flex items-start justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-3 sm:space-x-4 flex-1">
              {eventData.profile_image ? (
                <img src={eventData.profile_image} alt={eventData.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#32D3FF] rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
              )}
              
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{eventData.name}</h2>
                <div className="space-y-1">
                  <div className="flex items-center text-gray-300 text-xs sm:text-sm">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    <span className="break-words">{new Date(eventData.event_date).toLocaleDateString(i18n.language === 'no' ? 'nb-NO' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} {t('community.event.at')} {eventData.event_time}</span>
                  </div>
                  {eventData.location && (
                    <div className="flex items-center text-gray-300 text-xs sm:text-sm">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      <span className="break-words">{eventData.location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm mt-2">
                    <span className="text-[#32D3FF] font-semibold">{eventData.going_count || 0} {t('community.event.going')}</span>
                    <span className="text-yellow-400 font-semibold">{eventData.interested_count || 0} {t('community.event.interested')}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-600 rounded-full transition-colors ml-2 sm:ml-4"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          </div>

          {/* Description */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{t('community.event.aboutThisEvent')}</h3>
            <p className="text-gray-300 text-sm sm:text-base whitespace-pre-wrap">{eventData.description}</p>
          </div>

          {/* Participants Going */}
          {eventData.going_users && eventData.going_users.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">{t('community.event.going')} ({eventData.going_count || 0})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {eventData.going_users.map((user) => (
                  <div 
                    key={user.athlete_id} 
                    className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-600/50 transition-colors"
                    onClick={() => {
                      onClose();
                      loadAthleteProfile(user.athlete_id);
                    }}
                  >
                    <div className="relative">
                      {user.athlete_profile_picture ? (
                        <>
                          <img
                            src={user.athlete_profile_picture}
                            alt={user.athlete_name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                          />
                          <FlagIcon nationality={user.nationality} />
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#32D3FF] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-semibold text-xs sm:text-sm">
                              {user.athlete_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                            </span>
                          </div>
                          <FlagIcon nationality={user.nationality} />
                        </>
                      )}
                    </div>
                    <span className="text-white font-medium text-sm sm:text-base truncate flex items-center">
                      {user.athlete_name || 'Unknown'}
                      <SubscriptionBadge subscriptionTier={user.subscription_tier} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants Interested */}
          {eventData.interested_users && eventData.interested_users.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">{t('community.event.interested')} ({eventData.interested_count || 0})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {eventData.interested_users.map((user) => (
                  <div 
                    key={user.athlete_id} 
                    className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-600/50 transition-colors"
                    onClick={() => {
                      onClose();
                      loadAthleteProfile(user.athlete_id);
                    }}
                  >
                    {user.athlete_profile_picture ? (
                      <img
                        src={user.athlete_profile_picture}
                        alt={user.athlete_name}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-xs sm:text-sm">
                          {user.athlete_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <span className="text-white font-medium text-sm sm:text-base truncate flex items-center">
                      {user.athlete_name || 'Unknown'}
                      <SubscriptionBadge subscriptionTier={user.subscription_tier} />
                      <FlagIcon nationality={user.nationality} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state if no participants */}
          {(!eventData.going_users || eventData.going_users.length === 0) && 
           (!eventData.interested_users || eventData.interested_users.length === 0) && (
            <div className="text-center py-4 sm:py-6">
              <p className="text-gray-400 text-sm sm:text-base">{t('community.event.noParticipantsYet')}</p>
            </div>
          )}


          {/* Comments Section */}
          <div className="border-t border-gray-600 pt-4 sm:pt-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{t('community.challenge.comments')} ({eventData.comments_count || 0})</h3>
            
            {/* Comments List */}
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 max-h-48 sm:max-h-60 overflow-y-auto">
              {eventData.comments && eventData.comments.length > 0 ? (
                eventData.comments.map(comment => (
                  <div key={comment.id} className="flex items-start space-x-2 sm:space-x-3">
                    <div
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => {
                        onClose();
                        loadAthleteProfile(comment.athlete_id);
                      }}
                    >
                      {comment.athlete_profile_picture ? (
                        <img
                          src={comment.athlete_profile_picture}
                          alt={comment.athlete_name}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#32D3FF] rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">
                            {comment.athlete_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-700 rounded-lg p-2 sm:p-3 relative group">
                      {(comment.athlete_id === athleteId || isSuperAdmin) && (
                        <button
                          onClick={() => onDeleteComment(eventData.id, comment.id)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title={t('community.actions.deleteComment')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <p 
                        className="text-white font-semibold text-xs sm:text-sm cursor-pointer hover:underline"
                        onClick={() => {
                          onClose();
                          loadAthleteProfile(comment.athlete_id);
                        }}
                      >
                        {comment.athlete_name}
                      </p>
                      <p className="text-gray-300 text-xs sm:text-sm mt-1">{formatMentions(comment.content)}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-3 sm:py-4 text-sm sm:text-base">{t('community.event.noCommentsYet')}</p>
              )}
            </div>

            {/* Add Comment Input */}
            <div className="flex items-center space-x-2">
              <EmojiPickerButton onEmojiSelect={(emoji) => onEmojiSelect(emoji)} />
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t('community.event.writeComment')}
                className="flex-1 bg-gray-700 text-white rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-600 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
                onKeyPress={(e) => e.key === 'Enter' && onAddComment()}
              />
              <Button
                onClick={onAddComment}
                className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white p-2 sm:px-4 sm:py-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>


          {/* Close Button */}
          <div className="mt-4 sm:mt-6">
            <Button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base py-2 sm:py-3">
              {t('common.close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;