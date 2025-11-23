import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Heart, MessageCircle, Share2, Send, Edit2, Trash2, 
  Globe, Lock, X, Camera, Video, GripVertical, RefreshCw 
} from 'lucide-react';
import { Button } from '../../ui/button';
import ImageCarousel from '../../ImageCarousel';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';
import OnlineStatusIndicator from '../../OnlineStatusIndicator';
import { formatMentions } from '../../../utils/mentionUtils';
import { logger } from '../../../utils/logger';
import AnimatedBookmark from './AnimatedBookmark';
import PollCard from './PollCard';

/**
 * PostCard - Renders an individual community post with all interactions
 * Handles editing, media, comments, likes, shares
 */
const PostCard = ({
  post,
  athleteId,
  isSuperAdmin,
  editingPost,
  editContent,
  editVisibility,
  editMedia,
  isUploadingEditMedia,
  draggedIndex,
  expandedPosts,
  showComments,
  commentText,
  commentRefs,
  showMentionDropdown,
  mentionResults,
  onLoadAthleteProfile,
  onStartEditPost,
  onDeletePost,
  onEditMediaSelect,
  onRemoveEditMedia,
  onDragStart,
  onDragOver,
  onDragEnd,
  onSetEditContent,
  onSetEditVisibility,
  onSetEditingPost,
  onSetEditMedia,
  onEditPost,
  onToggleExpandPost,
  onToggleLike,
  onToggleComments,
  onSharePost,
  onCommentContentChange,
  onAddComment,
  onSelectCommentMention,
  translatedPosts,
  translatingPosts,
  onTranslatePost,
  bookmarkedPostIds,
  onToggleBookmark,
  onVotePoll
}) => {
  const { t } = useTranslation();

  // Debug log
  console.log('PostCard rendering:', { 
    postId: post.id, 
    postType: post.type,
    hasPollData: !!post.poll_data 
  });

  return (
    <div 
      key={post.id} 
      className="border-0 border-b border-b-gray-700 sm:border-b-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl mx-0 sm:mx-auto" 
      style={{ background: 'var(--grad-surface)' }}
    >
      {/* Post Header */}
      <div className="pb-3 px-3 pt-3 sm:px-6 sm:pt-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
            onClick={() => onLoadAthleteProfile(post.athlete_id)}
          >
            <div className="relative" style={{ width: '40px', height: '40px' }}>
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
              <FlagIcon nationality={post.nationality} />
              <OnlineStatusIndicator last_active_at={post.athlete_last_active_at} size="small" />
            </div>
            <div>
              <p className="text-white font-semibold hover:underline flex items-center">
                {post.athlete_name}
                <SubscriptionBadge subscriptionTier={post.subscription_tier} />
              </p>
              <p className="text-gray-400 text-xs">
                {new Date(post.created_at).toLocaleString()}
                {post.is_edited && ' (edited)'}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {(post.athlete_id === athleteId || isSuperAdmin) && (
              <>
                <button
                  onClick={() => {
                    console.log('Edit button clicked - Edit icon should be cyan #00FFFF');
                    onStartEditPost(post);
                  }}
                  className="p-2 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Edit2 className="w-4 h-4" style={{ color: '#00FFFF' }} />
                </button>
                <button
                  onClick={() => onDeletePost(post.id)}
                  className="p-2 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </>
            )}
            {onToggleBookmark && (
              <div className="p-2">
                <AnimatedBookmark 
                  isBookmarked={bookmarkedPostIds && bookmarkedPostIds.has(post.id)}
                  onClick={() => onToggleBookmark(post.id)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
        {/* Post Content with Show More/Less (hide for polls) */}
        {post.type !== 'poll' && (
          <div className="mb-4">
            <p 
                className={`text-white whitespace-pre-wrap pt-3 ${
                  !expandedPosts[post.id] ? 'line-clamp-2' : ''
                }`}
                style={!expandedPosts[post.id] ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                } : {}}
              >
                {translatedPosts?.[post.id]?.isTranslated 
                  ? translatedPosts[post.id].translated_text
                  : formatMentions(post.content)
                }
              </p>
              <div className="flex items-center gap-3 mt-1">
                {post.content && post.content.length > 100 && (
                  <button
                    onClick={() => onToggleExpandPost(post.id)}
                    className="text-[#00FFFF] hover:text-[#00d4d4] text-sm font-semibold"
                  >
                    {expandedPosts[post.id] ? t('community.post.showLess') : t('community.post.showMore')}
                  </button>
                )}
                {post.content && onTranslatePost && (
                  <button
                    onClick={() => {
                      console.log('Translation button clicked for post:', post.id);
                      onTranslatePost(post.id, post.content);
                    }}
                    disabled={translatingPosts?.[post.id]}
                    className="text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ color: '#00FFFF' }}
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
          </div>
        )}
            
        {/* Poll Display */}
        {post.type === 'poll' && post.poll_data && (
          <div className="pt-3 mb-4">
            <PollCard 
              post={post} 
              athleteId={athleteId}
              onVote={onVotePoll}
              translatedPosts={translatedPosts}
              translatingPosts={translatingPosts}
              onTranslatePost={onTranslatePost}
            />
          </div>
        )}
            
            {/* Display media (images and videos) */}
            {(() => {
              logger.debug(null, '🔍 Post media check:', {
                postId: post.id,
                hasMedia: !!post.media,
                mediaLength: post.media?.length,
                media: post.media,
                hasImageUrls: !!post.image_urls,
                imageUrlsLength: post.image_urls?.length,
                hasImageData: !!post.image_data
              });
              return null;
            })()}
            {post.media && post.media.length > 0 ? (
              <div className="mb-0 -mx-3 sm:mx-0">
                <ImageCarousel media={post.media} alt="Post media" />
              </div>
            ) : post.image_urls && post.image_urls.length > 0 ? (
              <div className="mb-0 -mx-3 sm:mx-0">
                <ImageCarousel images={post.image_urls} alt="Post images" />
              </div>
            ) : post.image_data ? (
              <img src={post.image_data} alt="Post" className="w-full rounded-none sm:rounded-lg max-h-96 object-cover mb-0 -mx-3 sm:mx-0" />
            ) : null}

            {/* YouTube Video Embed */}
            {post.youtube_data && (
              <div className="mb-4 -mx-3 sm:mx-0">
                <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
                  <iframe
                    src={post.youtube_data.embed_url}
                    title={post.youtube_data.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full rounded-none sm:rounded-lg"
                  />
                </div>
                <div className="p-2 bg-gray-700/50 -mx-3 sm:mx-0 sm:rounded-b-lg">
                  <p className="text-white text-sm font-semibold line-clamp-2">{post.youtube_data.title}</p>
                  <p className="text-gray-400 text-xs mt-1">{post.youtube_data.author}</p>
                </div>
              </div>
            )}

            {/* URL Preview Card */}
            {post.url_preview && !post.youtube_data && (
              <a 
                href={post.url_preview.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mb-4 -mx-3 sm:mx-0 border border-gray-600 rounded-none sm:rounded-lg overflow-hidden hover:border-[#00C2A8] transition-colors"
              >
                {post.url_preview.image && (
                  <img 
                    src={post.url_preview.image} 
                    alt={post.url_preview.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-3 bg-gray-700/50">
                  <p className="text-white text-sm font-semibold line-clamp-2">{post.url_preview.title}</p>
                  {post.url_preview.description && (
                    <p className="text-gray-400 text-xs mt-1 line-clamp-2">{post.url_preview.description}</p>
                  )}
                  {post.url_preview.site_name && (
                    <p className="text-gray-500 text-xs mt-1">{post.url_preview.site_name}</p>
                  )}
                </div>
              </a>
            )}

            {/* Embedded Shared Post */}
            {post.shared_post_data && (
              <div 
                className="mb-4 border-2 border-gray-600 rounded-lg overflow-hidden bg-gray-800/50 cursor-pointer hover:border-[#00C2A8] transition-colors"
                onClick={() => onToggleComments(post.shared_post_data.id)}
              >
                {/* Shared Post Header */}
                <div className="p-3 border-b border-gray-600">
                  <div className="flex items-center space-x-2">
                    <div className="relative" style={{ width: '32px', height: '32px' }}>
                      {post.shared_post_data.athlete_profile_picture ? (
                        <img
                          src={post.shared_post_data.athlete_profile_picture}
                          alt={post.shared_post_data.athlete_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {post.shared_post_data.athlete_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <FlagIcon nationality={post.shared_post_data.nationality} />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm flex items-center">
                        {post.shared_post_data.athlete_name}
                        <SubscriptionBadge subscriptionTier={post.shared_post_data.subscription_tier} />
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(post.shared_post_data.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Shared Post Content */}
                <div className="p-3">
                  <p className="text-white text-sm whitespace-pre-wrap mb-2 pt-2">
                    {formatMentions(post.shared_post_data.content)}
                  </p>
                  
                  {/* Shared Post Media */}
                  {post.shared_post_data.media && post.shared_post_data.media.length > 0 ? (
                    <div className="rounded-lg overflow-hidden">
                      <ImageCarousel media={post.shared_post_data.media} alt="Shared post media" />
                    </div>
                  ) : post.shared_post_data.image_urls && post.shared_post_data.image_urls.length > 0 ? (
                    <div className="rounded-lg overflow-hidden">
                      <ImageCarousel images={post.shared_post_data.image_urls} alt="Shared post images" />
                    </div>
                  ) : post.shared_post_data.image_data ? (
                    <img 
                      src={post.shared_post_data.image_data} 
                      alt="Shared post" 
                      className="w-full rounded-lg max-h-64 object-cover"
                    />
                  ) : null}

                  {/* Shared Post Stats */}
                  <div className="flex items-center space-x-4 mt-2 text-gray-400 text-xs">
                    <span className="flex items-center space-x-1">
                      <Heart className="w-3 h-3" />
                      <span>{post.shared_post_data.likes_count || 0}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <MessageCircle className="w-3 h-3" />
                      <span>{post.shared_post_data.comments_count || 0}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

        {/* Post Actions (Like, Comment, Share) */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-600 -mx-3 sm:mx-0">
          <button
            onClick={() => onToggleLike(post.id, post.liked_by_user)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              post.liked_by_user ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart className={`w-5 h-5 ${post.liked_by_user ? 'fill-current' : ''}`} />
            <span className="text-sm">{post.likes_count || 0}</span>
          </button>

          <button
            onClick={() => onToggleComments(post.id)}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-[#00C2A8] transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{post.comments_count || 0}</span>
          </button>

          <button
            onClick={() => onSharePost(post)}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-[#00C2A8] transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-sm">{post.shares_count || 0}</span>
          </button>
        </div>

        {/* Comments Section */}
        {showComments[post.id] && (
          <div className="mt-4 space-y-4 pt-4 border-t border-gray-600">
            {post.comments?.map(comment => (
              <div key={comment.id} className="flex items-start space-x-3">
                <div className="relative w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">
                    {comment.athlete_name?.charAt(0).toUpperCase()}
                  </span>
                  <FlagIcon nationality={comment.nationality} />
                </div>
                <div className="flex-1 bg-gray-600 rounded-lg p-3">
                  <p className="text-white font-semibold text-sm flex items-center">
                    {comment.athlete_name}
                    <SubscriptionBadge subscriptionTier={comment.subscription_tier} />
                  </p>
                  <p className="text-gray-300 text-sm mt-1">{formatMentions(comment.content)}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            <div className="relative flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  ref={(el) => commentRefs.current[post.id] = el}
                  type="text"
                  value={commentText[post.id] || ''}
                  onChange={(e) => onCommentContentChange(post.id, e)}
                  placeholder={t('community.post.writeCommentMention')}
                  className="w-full bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && onAddComment(post.id)}
                />
                
                {/* Mention Dropdown for Comments */}
                {showMentionDropdown === post.id && mentionResults.length > 0 && (
                  <div 
                    className="absolute z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg bottom-full mb-1 max-h-48 overflow-y-auto"
                    style={{ width: '300px' }}
                  >
                    {mentionResults.map((athlete) => (
                      <div
                        key={athlete.id}
                        onClick={() => onSelectCommentMention(post.id, athlete)}
                        className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white flex items-center space-x-2"
                      >
                        <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {athlete.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span>{athlete.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => onAddComment(post.id)}
                className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostCard;
