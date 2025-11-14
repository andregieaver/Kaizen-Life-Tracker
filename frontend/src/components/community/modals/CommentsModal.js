import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Heart, Trash2, X, Send } from 'lucide-react';
import EmojiPickerButton from '../../EmojiPickerButton';
import ImageCarousel from '../../ImageCarousel';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';

const CommentsModal = ({ post, onClose, onAddComment, commentText, setCommentText, commentRef, athleteId, isSuperAdmin, formatMentions, loadAthleteProfile, onEmojiSelect, onDeleteComment, onToggleCommentLike }) => {
  const { t } = useTranslation();
  
  if (!post) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Comments</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-600 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Post Preview */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <div 
                className="cursor-pointer hover:opacity-80 relative"
                onClick={() => {
                  onClose();
                  loadAthleteProfile(post.athlete_id);
                }}
              >
                {post.athlete_profile_picture ? (
                  <>
                    <img
                      src={post.athlete_profile_picture}
                      alt={post.athlete_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <FlagIcon nationality={post.nationality} />
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-[#00C2A8] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {post.athlete_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <FlagIcon nationality={post.nationality} />
                  </>
                )}
              </div>
              <div>
                <p 
                  className="text-white font-semibold cursor-pointer hover:underline flex items-center"
                  onClick={() => {
                    onClose();
                    loadAthleteProfile(post.athlete_id);
                  }}
                >
                  {post.athlete_name}
                  <SubscriptionBadge subscriptionTier={post.subscription_tier} />
                </p>
                <p className="text-gray-400 text-xs">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            
            {/* Check if this is a shared post */}
            {post.shared_post_id && post.shared_post_data ? (
              <>
                {/* User's Commentary */}
                {post.content && (
                  <p className="text-white whitespace-pre-wrap mb-4">{formatMentions(post.content)}</p>
                )}

                {/* Embedded Original Post */}
                <div className="border border-gray-600 rounded-lg p-3 bg-gray-900/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="relative">
                      {post.shared_post_data.athlete_profile_picture ? (
                        <>
                          <img
                            src={post.shared_post_data.athlete_profile_picture}
                            alt={post.shared_post_data.athlete_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <FlagIcon nationality={post.shared_post_data.nationality} />
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-[#00C2A8] flex items-center justify-center text-white font-semibold text-sm">
                            {post.shared_post_data.athlete_name?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                          <FlagIcon nationality={post.shared_post_data.nationality} />
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm flex items-center">
                        {post.shared_post_data.athlete_name}
                        <SubscriptionBadge subscriptionTier={post.shared_post_data.subscription_tier} />
                      </p>
                      <p className="text-gray-400 text-xs">
                        {post.shared_post_data.created_at ? new Date(post.shared_post_data.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-2 whitespace-pre-wrap">
                    {post.shared_post_data.content}
                  </p>

                  {/* Original Post Media */}
                  {post.shared_post_data.media && post.shared_post_data.media.length > 0 && (
                    <div className="rounded-lg overflow-hidden mt-2">
                      <ImageCarousel media={post.shared_post_data.media} alt="Shared post media" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Regular Post Content */}
                <p className="text-white whitespace-pre-wrap mb-3">{formatMentions(post.content)}</p>
                
                {/* Post Media - Support all formats */}
                {post.media && post.media.length > 0 ? (
                  <div className="rounded-lg overflow-hidden">
                    <ImageCarousel media={post.media} alt="Post media" />
                  </div>
                ) : post.image_urls && post.image_urls.length > 0 ? (
                  <div className="rounded-lg overflow-hidden">
                    <ImageCarousel images={post.image_urls} alt="Post images" />
                  </div>
                ) : post.image_data ? (
                  <img src={post.image_data} alt="Post" className="w-full rounded-lg max-h-64 object-cover" />
                ) : null}
              </>
            )}
          </div>

          {/* Comments List */}
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {post.comments && post.comments.length > 0 ? (
              post.comments.map(comment => (
                <div key={comment.id} className="flex items-start space-x-3">
                  <div
                    className="cursor-pointer hover:opacity-80 relative"
                    onClick={() => {
                      onClose();
                      loadAthleteProfile(comment.athlete_id);
                    }}
                  >
                    {comment.athlete_profile_picture ? (
                      <>
                        <img
                          src={comment.athlete_profile_picture}
                          alt={comment.athlete_name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                        <FlagIcon nationality={comment.nationality} />
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">
                            {comment.athlete_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <FlagIcon nationality={comment.nationality} />
                      </>
                    )}
                  </div>
                  <div className="flex-1 bg-gray-600 rounded-lg p-3 relative group">
                    {(comment.athlete_id === athleteId || isSuperAdmin) && (
                      <button
                        onClick={() => onDeleteComment(post.id, comment.id)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title={t('community.actions.deleteComment')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <p 
                      className="text-white font-semibold text-sm cursor-pointer hover:underline flex items-center"
                      onClick={() => {
                        onClose();
                        loadAthleteProfile(comment.athlete_id);
                      }}
                    >
                      {comment.athlete_name}
                      <SubscriptionBadge subscriptionTier={comment.subscription_tier} />
                    </p>
                    <p className="text-gray-300 text-sm mt-1">{formatMentions(comment.content)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-gray-400 text-xs">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                      <button
                        onClick={() => onToggleCommentLike(comment.id, post.id)}
                        className={`flex items-center space-x-1 text-xs transition-colors ${
                          comment.liked_by_user ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${comment.liked_by_user ? 'fill-current' : ''}`} />
                        <span>{comment.likes_count || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>
            )}
          </div>

          {/* Add Comment Input */}
          <div className="border-t border-gray-600 pt-4">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  ref={commentRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('community.post.writeCommentMention')}
                  className="w-full bg-gray-600 text-white rounded-lg pl-4 pr-12 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && onAddComment()}
                />
                {/* Emoji Button - Inside Input on Right */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <EmojiPickerButton onEmojiSelect={(emoji) => onEmojiSelect(emoji)} />
                </div>
              </div>
              <Button
                onClick={onAddComment}
                className="bg-[#00C2A8] hover:bg-[#00a890] text-white p-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentsModal;
