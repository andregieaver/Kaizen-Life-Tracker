import React from 'react';
import { useTranslation } from 'react-i18next';
import EventCard from '../cards/EventCard';
import PostCard from '../cards/PostCard';

/**
 * FeedTab - Displays the main community feed with posts and events
 * Supports nationality filtering
 */
const FeedTab = ({
  posts,
  isLoading,
  nationalityFilter,
  onNationalityFilterChange,
  getUniqueNationalities,
  getFilteredPosts,
  // Event handlers
  onRSVP,
  onEditEvent,
  onDeleteEvent,
  onOpenEventDetail,
  // Post handlers  
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
  // Post action handlers
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
  onSelectCommentMention
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Nationality Filter */}
      <div>
        <div className="flex items-center space-x-3 p-3 rounded-none sm:rounded-lg" style={{ background: '#0B1220' }}>
          <label className="text-white text-sm font-semibold whitespace-nowrap">
            {t('community.post.filterByNationality')}:
          </label>
          <select
            value={nationalityFilter}
            onChange={(e) => onNationalityFilterChange(e.target.value)}
            className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none text-sm"
          >
            <option value="all">{t('community.post.allNationalities')}</option>
            {getUniqueNationalities().map(nationality => (
              <option key={nationality} value={nationality}>{nationality}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Posts and Events Feed */}
      <div className="space-y-0 sm:space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-12 text-center">
              <p className="text-gray-400 text-lg mb-2">{t('community.emptyStates.noPostsYet')}</p>
              <p className="text-gray-500 text-sm">{t('community.emptyStates.beFirstToShare')}</p>
            </div>
          </div>
        ) : (
          getFilteredPosts(posts).map(item => {
            if (item.type === 'event') {
              return (
                <EventCard
                  key={item.id}
                  event={item}
                  athleteId={athleteId}
                  onRSVP={onRSVP}
                  onEdit={onEditEvent}
                  onDelete={onDeleteEvent}
                  onClick={onOpenEventDetail}
                />
              );
            } else {
              // Use PostCard component for rendering individual posts
              return (
                <PostCard
                  key={item.id}
                  post={item}
                  athleteId={athleteId}
                  isSuperAdmin={isSuperAdmin}
                  editingPost={editingPost}
                  editContent={editContent}
                  editVisibility={editVisibility}
                  editMedia={editMedia}
                  isUploadingEditMedia={isUploadingEditMedia}
                  draggedIndex={draggedIndex}
                  expandedPosts={expandedPosts}
                  showComments={showComments}
                  commentText={commentText}
                  commentRefs={commentRefs}
                  showMentionDropdown={showMentionDropdown}
                  mentionResults={mentionResults}
                  onLoadAthleteProfile={onLoadAthleteProfile}
                  onStartEditPost={onStartEditPost}
                  onDeletePost={onDeletePost}
                  onEditMediaSelect={onEditMediaSelect}
                  onRemoveEditMedia={onRemoveEditMedia}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragEnd={onDragEnd}
                  onSetEditContent={onSetEditContent}
                  onSetEditVisibility={onSetEditVisibility}
                  onSetEditingPost={onSetEditingPost}
                  onSetEditMedia={onSetEditMedia}
                  onEditPost={onEditPost}
                  onToggleExpandPost={onToggleExpandPost}
                  onToggleLike={onToggleLike}
                  onToggleComments={onToggleComments}
                  onSharePost={onSharePost}
                  onCommentContentChange={onCommentContentChange}
                  onAddComment={onAddComment}
                  onSelectCommentMention={onSelectCommentMention}
                />
              );
            }
          })
        )}
      </div>
    </>
  );
};

export default FeedTab;
