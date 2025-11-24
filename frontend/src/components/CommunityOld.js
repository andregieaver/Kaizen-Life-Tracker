import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Heart, MessageCircle, Share2, Send, Edit2, Trash2, Camera, X, Bell } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Community = ({ athleteId }) => {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadPosts();
    loadNotifications();
  }, [athleteId]);

  const loadPosts = async () => {
    try {
      const response = await axios.get(`${API}/community/posts/${athleteId}`);
      setPosts(response.data.posts);
      setIsLoading(false);
    } catch (error) {
      logger.error(null, 'Error loading posts:', error);
      setIsLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await axios.get(`${API}/community/notifications/${athleteId}`);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.notifications.filter(n => !n.read).length);
    } catch (error) {
      logger.error(null, 'Error loading notifications:', error);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPostImage(reader.result);
        setNewPostImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      const postData = {
        content: newPostContent,
        image_data: newPostImage
      };

      await axios.post(`${API}/community/posts?athlete_id=${athleteId}`, postData);
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePreview(null);
      loadPosts();
    } catch (error) {
      logger.error(null, 'Error creating post:', error);
      alert('Failed to create post');
    }
  };

  const handleEditPost = async (postId) => {
    try {
      const postData = {
        content: editContent
      };

      await axios.put(`${API}/community/posts/${postId}?athlete_id=${athleteId}`, postData);
      setEditingPost(null);
      setEditContent('');
      loadPosts();
    } catch (error) {
      logger.error(null, 'Error editing post:', error);
      alert('Failed to edit post');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await axios.delete(`${API}/community/posts/${postId}?athlete_id=${athleteId}`);
      loadPosts();
    } catch (error) {
      logger.error(null, 'Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const response = await axios.post(`${API}/community/posts/${postId}/like?athlete_id=${athleteId}`);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, liked_by_user: response.data.liked, likes_count: response.data.likes_count }
          : post
      ));
    } catch (error) {
      logger.error(null, 'Error toggling like:', error);
    }
  };

  const handleAddComment = async (postId) => {
    const content = commentText[postId];
    if (!content?.trim()) return;

    try {
      await axios.post(`${API}/community/posts/${postId}/comment?athlete_id=${athleteId}`, {
        content: content
      });
      setCommentText({ ...commentText, [postId]: '' });
      loadComments(postId);
      loadPosts(); // Refresh to update comment count
    } catch (error) {
      logger.error(null, 'Error adding comment:', error);
    }
  };

  const loadComments = async (postId) => {
    try {
      const response = await axios.get(`${API}/community/posts/${postId}/comments`);
      setPosts(posts.map(post =>
        post.id === postId
          ? { ...post, comments: response.data.comments }
          : post
      ));
    } catch (error) {
      logger.error(null, 'Error loading comments:', error);
    }
  };

  const handleSharePost = async (postId) => {
    try {
      await axios.post(`${API}/community/posts/${postId}/share?athlete_id=${athleteId}`);
      loadPosts(); // Refresh to update share count
      alert('Post shared successfully!');
    } catch (error) {
      logger.error(null, 'Error sharing post:', error);
      alert('Failed to share post');
    }
  };

  const toggleComments = (postId) => {
    if (!showComments[postId]) {
      loadComments(postId);
    }
    setShowComments({ ...showComments, [postId]: !showComments[postId] });
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await axios.put(`${API}/community/notifications/${notificationId}/read`);
      loadNotifications();
    } catch (error) {
      logger.error(null, 'Error marking notification as read:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[#32D3FF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      {/* Header with Notifications */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Community</h1>
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
          >
            <Bell className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-white font-semibold">Notifications</h3>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-gray-400 text-center">
                  No notifications
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
                      !notification.read ? 'bg-gray-700/50' : ''
                    }`}
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <p className="text-white text-sm">{notification.content}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Post Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
        <CardContent className="p-6">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-gray-600 text-white rounded-lg p-4 border border-gray-500 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none resize-none"
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
                <Camera className="w-5 h-5 text-[#32D3FF]" />
                <span className="text-white text-sm">Add Photo</span>
              </div>
            </label>
            
            <Button
              onClick={handleCreatePost}
              disabled={!newPostContent.trim()}
              className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 mr-2" />
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.map(post => (
          <Card key={post.id} className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {post.athlete_profile_picture ? (
                    <img
                      src={post.athlete_profile_picture}
                      alt={post.athlete_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-[#32D3FF] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {post.athlete_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold">{post.athlete_name}</p>
                    <p className="text-gray-400 text-xs">
                      {new Date(post.created_at).toLocaleString()}
                      {post.is_edited && ' (edited)'}
                    </p>
                  </div>
                </div>
                
                {/* Edit/Delete buttons for own posts */}
                {post.athlete_id === athleteId && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingPost(post.id);
                        setEditContent(post.content);
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
            </CardHeader>
            
            <CardContent>
              {editingPost === post.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-gray-600 text-white rounded-lg p-3 border border-gray-500 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none resize-none"
                    rows="3"
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleEditPost(post.id)}
                      className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white px-4 py-2 rounded-lg"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingPost(null);
                        setEditContent('');
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-white mb-4">{post.content}</p>
                  
                  {post.image_data && (
                    <img src={post.image_data} alt="Post" className="w-full rounded-lg mb-4" />
                  )}
                  
                  {/* Interaction Buttons */}
                  <div className="flex items-center justify-between border-t border-gray-600 pt-3 mt-3">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        post.liked_by_user
                          ? 'bg-red-500/20 text-red-400'
                          : 'hover:bg-gray-600 text-gray-400'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${post.liked_by_user ? 'fill-current' : ''}`} />
                      <span>{post.likes_count}</span>
                    </button>
                    
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-600 rounded-lg transition-colors text-gray-400"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{post.comments_count}</span>
                    </button>
                    
                    <button
                      onClick={() => handleSharePost(post.id)}
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-600 rounded-lg transition-colors text-gray-400"
                    >
                      <Share2 className="w-5 h-5" />
                      <span>{post.shares_count}</span>
                    </button>
                  </div>
                  
                  {/* Comments Section */}
                  {showComments[post.id] && (
                    <div className="mt-4 border-t border-gray-600 pt-4 space-y-4">
                      {/* Existing Comments */}
                      {post.comments?.map(comment => (
                        <div key={comment.id} className="flex space-x-3">
                          {comment.athlete_profile_picture ? (
                            <img
                              src={comment.athlete_profile_picture}
                              alt={comment.athlete_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-[#32D3FF] rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm font-bold">
                                {comment.athlete_name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 bg-gray-600 rounded-lg p-3">
                            <p className="text-white font-semibold text-sm">{comment.athlete_name}</p>
                            <p className="text-gray-300 text-sm mt-1">{comment.content}</p>
                            <p className="text-gray-400 text-xs mt-1">
                              {new Date(comment.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add Comment */}
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={commentText[post.id] || ''}
                          onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          placeholder="Write a comment..."
                          className="flex-1 bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
                        />
                        <Button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!commentText[post.id]?.trim()}
                          className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
          <CardContent className="p-12 text-center">
            <p className="text-gray-400 text-lg">No posts yet. Be the first to share something!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Community;
