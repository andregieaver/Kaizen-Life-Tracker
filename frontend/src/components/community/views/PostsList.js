import React from 'react';
import { Heart, Share2, Send, Edit2, Trash2, Lock, Globe, MessageCircle, Bookmark } from 'lucide-react';
import { Button } from '../../ui/button';
import FlagIcon from '../../FlagIcon';
import SubscriptionBadge from '../../SubscriptionBadge';

const PostsList = ({ posts, athleteId, editingPost, editContent, editVisibility, showComments, commentText,
  setEditingPost, setEditContent, setEditVisibility, setCommentText, handleEditPost, handleDeletePost,
  handleToggleLike, toggleComments, handleAddComment, handleSharePost, loadAthleteProfile, bookmarkedPostIds, onToggleBookmark }) => (
  <div className="space-y-6">
    {posts.map(post => (
      <div key={post.id} className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }} className="pb-3">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
              onClick={() => loadAthleteProfile(post.athlete_id)}
            >
              <div className="relative">
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
                    <div className="w-10 h-10 bg-[#32D3FF] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {post.athlete_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <FlagIcon nationality={post.nationality} />
                  </>
                )}
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
            
            {(post.athlete_id === athleteId || isSuperAdmin) && (
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingPost(post.id);
                    setEditContent(post.content);
                    setEditVisibility(post.visibility || 'public');
                  }}
                  className="p-2 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="p-2 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4">
          {editingPost === post.id ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-gray-600 text-white rounded-lg p-3 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
                rows="3"
              />
              
              {/* Visibility Toggle in Edit Mode */}
              <div className="flex items-center space-x-4 p-3 bg-gray-600 rounded-lg">
                <span className="text-white text-sm font-semibold">Visibility:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditVisibility('public')}
                    className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                      editVisibility === 'public'
                        ? 'bg-[#00C2A8] text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Public</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setEditVisibility('private')}
                    className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                      editVisibility === 'private'
                        ? 'bg-[#00C2A8] text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Private</span>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleEditPost(post.id)}
                  className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-4 py-2 rounded-lg"
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setEditingPost(null);
                    setEditContent('');
                    setEditVisibility('public');
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Check if this is a shared post (Twitter-style quote repost) */}
              {post.shared_post_id && post.shared_post_data ? (
                <>
                  {/* User's Commentary */}
                  {post.content && (
                    <div className="mb-4">
                      <p className="text-white whitespace-pre-wrap">{post.content}</p>
                    </div>
                  )}

                  {/* Embedded Original Post (Clickable) */}
                  <div 
                    className="border border-gray-600 rounded-lg p-4 bg-gray-900/50 mb-4 cursor-pointer hover:bg-gray-900/70 transition-colors"
                    onClick={() => {
                      // Open original post in modal
                      setSelectedPostForComments(post.shared_post_data);
                      setShowCommentsModal(true);
                    }}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="relative">
                        {post.shared_post_data.athlete_profile_picture ? (
                          <>
                            <img
                              src={post.shared_post_data.athlete_profile_picture}
                              alt={post.shared_post_data.athlete_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <FlagIcon nationality={post.shared_post_data.nationality} />
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-[#00C2A8] flex items-center justify-center text-white font-semibold">
                              {post.shared_post_data.athlete_name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <FlagIcon nationality={post.shared_post_data.nationality} />
                          </>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm hover:underline flex items-center">
                          {post.shared_post_data.athlete_name}
                          <SubscriptionBadge subscriptionTier={post.shared_post_data.subscription_tier} />
                        </p>
                        <p className="text-gray-400 text-xs">
                          {post.shared_post_data.created_at ? new Date(post.shared_post_data.created_at).toLocaleDateString() : ''}
                        </p>
                      </div>
                    </div>

                    {/* Original Post Content */}
                    <p className="text-gray-300 text-sm mb-3 whitespace-pre-wrap line-clamp-3">
                      {post.shared_post_data.content}
                    </p>

                    {/* Original Post Media Preview */}
                    {post.shared_post_data.media && post.shared_post_data.media.length > 0 && (
                      <div className="relative rounded-lg overflow-hidden">
                        {post.shared_post_data.media[0].type === 'image' && (
                          <img
                            src={post.shared_post_data.media[0].url}
                            alt="Post media"
                            className="w-full max-h-64 object-cover"
                          />
                        )}
                        {post.shared_post_data.media[0].type === 'video' && (
                          <video
                            src={post.shared_post_data.media[0].url}
                            className="w-full max-h-64 object-cover"
                            poster={post.shared_post_data.media[0].thumbnail}
                          />
                        )}
                        {post.shared_post_data.media.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            +{post.shared_post_data.media.length - 1} more
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Original Post Stats */}
                    <div className="flex items-center space-x-4 mt-3 text-gray-400 text-xs">
                      <span>{post.shared_post_data.likes_count || 0} likes</span>
                      <span>{post.shared_post_data.comments_count || 0} comments</span>
                      <span>{post.shared_post_data.shares_count || 0} shares</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Regular Post Content with Show More/Less */}
                  <div className="mb-4">
                    <p 
                      className={`text-white whitespace-pre-wrap ${
                        !expandedPosts[post.id] ? 'line-clamp-2' : ''
                      }`}
                      style={!expandedPosts[post.id] ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      } : {}}
                    >
                      {post.content}
                    </p>
                    {post.content && post.content.length > 100 && (
                      <button
                        onClick={() => toggleExpandPost(post.id)}
                        className="text-[#00C2A8] hover:text-[#00a890] text-sm font-semibold mt-1"
                      >
                        {expandedPosts[post.id] ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                  
                  {post.image_data && (
                    <img src={post.image_data} alt="Post" className="w-full rounded-lg mb-4" />
                  )}
                </>
              )}
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-600 -mx-3 sm:mx-0">
                <button
                  onClick={() => handleToggleLike(post.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    post.liked_by_user ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${post.liked_by_user ? 'fill-current' : ''}`} />
                  <span className="text-sm">{post.likes_count || 0}</span>
                </button>

                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-[#00C2A8] transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{post.comments_count || 0}</span>
                </button>

                <button
                  onClick={() => handleSharePost(post)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-[#00C2A8] transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="text-sm">{post.shares_count || 0}</span>
                </button>

                {onToggleBookmark && (
                  <button
                    onClick={() => onToggleBookmark(post.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      bookmarkedPostIds && bookmarkedPostIds.has(post.id) ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
                    }`}
                  >
                    <Bookmark className={`w-5 h-5 ${bookmarkedPostIds && bookmarkedPostIds.has(post.id) ? 'fill-current' : ''}`} />
                  </button>
                )}
              </div>
              
              {showComments[post.id] && (
                <div className="mt-4 border-t border-gray-600 pt-4 space-y-4">
                  {post.comments?.map(comment => (
                    <div key={comment.id} className="flex space-x-3">
                      <div 
                        className="cursor-pointer relative"
                        onClick={() => loadAthleteProfile(comment.athlete_id)}
                      >
                        {comment.athlete_profile_picture ? (
                          <>
                            <img
                              src={comment.athlete_profile_picture}
                              alt={comment.athlete_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <FlagIcon nationality={comment.nationality} />
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 bg-[#32D3FF] rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm font-bold">
                                {comment.athlete_name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <FlagIcon nationality={comment.nationality} />
                          </>
                        )}
                      </div>
                      <div className="flex-1 bg-gray-600 rounded-lg p-3">
                        <p 
                          className="text-white font-semibold text-sm cursor-pointer hover:underline"
                          onClick={() => loadAthleteProfile(comment.athlete_id)}
                        >
                          <span className="flex items-center">
                            {comment.athlete_name}
                            <SubscriptionBadge subscriptionTier={comment.subscription_tier} />
                          </span>
                        </p>
                        <p className="text-gray-300 text-sm mt-1">{comment.content}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={commentText[post.id] || ''}
                      onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                      placeholder={t('community.post.writeComment')}
                      className="flex-1 bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                    />
                    <Button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!commentText[post.id]?.trim()}
                      className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    ))}

    {posts.length === 0 && (
      <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4" className="p-12 text-center">
          <p className="text-gray-400 text-lg">{t('community.group.noPostsYet')}</p>
        </div>
      </div>
    )}
  </div>
);

// GroupCard Component


export default PostsList;
