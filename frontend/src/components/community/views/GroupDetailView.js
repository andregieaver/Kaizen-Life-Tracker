import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Camera, Crown, Users as UsersIcon, Lock, Globe, X, Send } from 'lucide-react';
import EmojiPickerButton from '../../EmojiPickerButton';
import { compressPostImage } from '../../../utils/imageCompression';
import { logger } from '../../../utils/logger';

const GroupDetailView = ({ group, posts, athleteId, newPostContent, newPostImage, newPostImagePreview,
  editingPost, editContent, showComments, commentText, setNewPostContent, setNewPostImage, 
  setNewPostImagePreview, setEditingPost, setEditContent, setCommentText,
  handleCreateGroupPost, handleImageSelect, onBack, onLeave, onEditGroup, loadAthleteProfile }) => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6 pt-12 md:pt-0">
    {/* Group Header */}
    <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
      <div className="p-4" className="p-6">
        <button
          onClick={onBack}
          className="text-[#00C2A8] hover:underline mb-4 flex items-center"
        >
          ← {t('community.group.backToGroups')}
        </button>
        
        {group.cover_photo && (
          <img src={group.cover_photo} alt={group.name} className="w-full h-48 object-cover rounded-lg mb-4" />
        )}
        
        <div className="flex items-start space-x-4">
          {/* Group Profile Image */}
          {group.profile_image ? (
            <img src={group.profile_image} alt={group.name} className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-12 h-12 text-gray-400" />
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h2 className="text-3xl font-bold text-white">{group.name}</h2>
              {group.privacy === 'private' ? (
                <Lock className="w-6 h-6 text-gray-400" />
              ) : (
                <Globe className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <p className="text-gray-300 mb-4">{group.description}</p>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-gray-400">{group.members_count} {t('community.group.members')}</span>
              {group.member_role && (
                <span className="text-[#00C2A8] font-semibold flex items-center">
                  {group.member_role === 'admin' && <Crown className="w-4 h-4 mr-1" />}
                  {group.member_role === 'moderator' && <Shield className="w-4 h-4 mr-1" />}
                  {t(`community.group.${group.member_role}`)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col space-y-2">
            {group.member_role === 'admin' && (
              <button
                onClick={onEditGroup}
                className="p-2 bg-[#00C2A8] hover:bg-[#00a890] rounded-lg transition-colors"
                title={t('community.actions.editGroup')}
              >
                <Edit2 className="w-5 h-5 text-white" />
              </button>
            )}
            {group.is_member && group.member_role !== 'admin' && (
              <Button
                onClick={() => onLeave(group.id)}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Leave Group
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Pending Requests (admin/moderator only) */}
    {group.pending_members && group.pending_members.length > 0 && (
      <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4" className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Pending Join Requests</h3>
          <div className="space-y-3">
            {group.pending_members.map(member => (
              <div key={member.id} className="flex items-center justify-between bg-gray-600 rounded-lg p-4">
                <div 
                  className="flex items-center space-x-3 cursor-pointer"
                  onClick={() => loadAthleteProfile(member.id)}
                >
                  <div className="relative">
                    {member.profile_picture ? (
                      <>
                        <img
                          src={member.profile_picture}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <FlagIcon nationality={member.nationality} />
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {member.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <FlagIcon nationality={member.nationality} />
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold hover:underline flex items-center">
                      {member.name}
                      <SubscriptionBadge subscriptionTier={member.subscription_tier} />
                    </p>
                    <p className="text-gray-400 text-xs">
                      Requested {new Date(member.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={async () => {
                      try {
                        await axios.put(`${API}/community/groups/${group.id}/members/${member.id}?athlete_id=${athleteId}`, {
                          action: 'approve'
                        });
                        window.location.reload(); // Reload to show updated member list
                      } catch (error) {
                        logger.error(null, 'Error approving member:', error);
                        alert('Failed to approve member');
                      }
                    }}
                    className="p-2 bg-[#00C2A8] hover:bg-[#00a890] rounded-lg transition-colors"
                    title="Approve"
                  >
                    <ThumbsUp className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await axios.put(`${API}/community/groups/${group.id}/members/${member.id}?athlete_id=${athleteId}`, {
                          action: 'reject'
                        });
                        window.location.reload(); // Reload to show updated list
                      } catch (error) {
                        logger.error(null, 'Error rejecting member:', error);
                        alert('Failed to reject member');
                      }
                    }}
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <ThumbsDown className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Members List (admin/manager only) */}
    {group.members && group.member_role && ['admin', 'manager'].includes(group.member_role) && (
      <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4" className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">{t('community.group.groupMembers')}</h3>
          <div className="space-y-3">
            {group.members.map(member => (
              <div key={member.id} className="flex items-center justify-between bg-gray-600 rounded-lg p-4">
                <div 
                  className="flex items-center space-x-3 cursor-pointer flex-1"
                  onClick={() => loadAthleteProfile(member.id)}
                >
                  <div className="relative">
                    {member.profile_picture ? (
                      <>
                        <img
                          src={member.profile_picture}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <FlagIcon nationality={member.nationality} />
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {member.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <FlagIcon nationality={member.nationality} />
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold hover:underline flex items-center">
                      {member.name}
                      <SubscriptionBadge subscriptionTier={member.subscription_tier} />
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-semibold ${
                        member.role === 'admin' ? 'text-yellow-400' :
                        member.role === 'manager' ? 'text-blue-400' :
                        member.role === 'moderator' ? 'text-purple-400' :
                        'text-gray-400'
                      }`}>
                        {member.role === 'admin' && <Crown className="w-3 h-3 inline mr-1" />}
                        {member.role === 'manager' && <Shield className="w-3 h-3 inline mr-1" />}
                        {member.role === 'moderator' && <Shield className="w-3 h-3 inline mr-1" />}
                        {member.role.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {member.id !== athleteId && member.role !== 'admin' && (
                  <div className="relative group">
                    <select
                      value={member.role}
                      onChange={async (e) => {
                        try {
                          await axios.put(`${API}/community/groups/${group.id}/members/${member.id}?athlete_id=${athleteId}`, {
                            action: 'change_role',
                            role: e.target.value
                          });
                          window.location.reload();
                        } catch (error) {
                          logger.error(null, 'Error changing role:', error);
                          alert(error.response?.data?.detail || 'Failed to change role');
                        }
                      }}
                      className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="manager">Manager</option>
                      {group.member_role === 'admin' && <option value="admin">Admin</option>}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Create Post (if member) */}
    {group.is_member && (
      <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4" className="p-6">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder={t('community.post.shareWithGroup')}
            className="w-full bg-gray-600 text-white rounded-lg p-4 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
            rows="3"
          />
          
          {newPostImagePreview && (
            <div className="mt-4 relative">
              <img src={newPostImagePreview} alt="Preview" className="w-full rounded-lg max-h-96 object-cover" />
              <button
                onClick={() => {
                  setNewPostImage(null);
                  setNewPostImagePreview(null);
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full p-2 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          <div className="flex justify-between items-center mt-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
                <Camera className="w-5 h-5 text-[#00C2A8]" />
                <span className="text-white text-sm">{t('community.actions.addPhoto')}</span>
              </div>
            </label>
            
            <Button
              onClick={handleCreateGroupPost}
              disabled={!newPostContent.trim()}
              className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 mr-2" />
              Post
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Group Posts - Reuse PostsList but without edit/delete for non-members */}
    <div className="space-y-6">
      {posts.map(post => (
        <div key={post.id} className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }} className="pb-3">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
                onClick={() => loadAthleteProfile(post.athlete_id)}
              >
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
                  <p className="text-white font-semibold hover:underline flex items-center">
                    {post.athlete_name}
                    <SubscriptionBadge subscriptionTier={post.subscription_tier} />
                  </p>
                  <p className="text-gray-400 text-xs">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <p className="text-white mb-4">{post.content}</p>
            {post.image_data && (
              <img src={post.image_data} alt="Post" className="w-full rounded-lg mb-4" />
            )}
            
            <div className="flex items-center space-x-4 border-t border-gray-600 pt-3 mt-3">
              <div className="flex items-center space-x-2 text-gray-400">
                <Heart className="w-5 h-5" />
                <span>{post.likes_count || 0}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <MessageCircle className="w-5 h-5" />
                <span key={`comment-count-${post.id}-${post.comments_count}`}>
                  {logger.debug(null, `[Group Posts] Rendering comment count for post ${post.id}:`, post.comments_count) || (post.comments_count || 0)}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Share2 className="w-5 h-5" />
                <span>{post.shares_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {posts.length === 0 && (
        <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-4" className="p-12 text-center">
            <p className="text-gray-400 text-lg">No posts in this group yet.</p>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};


export default GroupDetailView;
