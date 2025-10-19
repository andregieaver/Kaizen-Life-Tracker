import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Heart, MessageCircle, Share2, Send, Edit2, Trash2, Camera, X, Bell, UserPlus, UserMinus, Users as UsersIcon, Lock, Globe, Crown, Shield, Search, Home, UserCheck, ThumbsUp, ThumbsDown, Calendar, Clock, MapPin, Star } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Community = ({ athleteId }) => {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'groups', 'mygroups', 'events'
  
  // Swipe state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;
  
  // Posts state
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Profile state
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Athletes modal state
  const [showAthletes, setShowAthletes] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [athletesSearch, setAthletesSearch] = useState('');
  const [athletesLoading, setAthletesLoading] = useState(false);
  
  // Groups state
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupPosts, setGroupPosts] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    profile_image: null,
    cover_photo: null,
    rules: ''
  });
  const [editGroupData, setEditGroupData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    profile_image: null,
    cover_photo: null,
    rules: ''
  });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(null);


  // Events state
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    name: '',
    description: '',
    visibility: 'open',
    event_date: '',
    event_time: '',
    location: '',
    profile_image: null,
    cover_photo: null,
    group_id: null
  });
  const [editEventData, setEditEventData] = useState({
    name: '',
    description: '',
    visibility: 'open',
    event_date: '',
    event_time: '',
    location: '',
    profile_image: null,
    cover_photo: null,
    group_id: null
  });


  // Swipe handlers
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Swipe left - go to next tab
      if (activeTab === 'feed') {
        setActiveTab('groups');
        setSelectedGroup(null);
      } else if (activeTab === 'groups') {
        setActiveTab('mygroups');
        setSelectedGroup(null);
      }
    }
    
    if (isRightSwipe) {
      // Swipe right - go to previous tab
      if (activeTab === 'mygroups') {
        setActiveTab('groups');
        setSelectedGroup(null);
      } else if (activeTab === 'groups') {
        setActiveTab('feed');
        setSelectedGroup(null);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      loadPosts();
    } else if (activeTab === 'groups') {
      loadAllGroups();
    } else if (activeTab === 'mygroups') {
      loadMyGroups();
    } else if (activeTab === 'events') {
      loadEvents();
    }
    loadNotifications();
  }, [athleteId, activeTab]);

  const loadPosts = async () => {
    try {
      const response = await axios.get(`${API}/community/posts/${athleteId}`);
      setPosts(response.data.posts);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading posts:', error);
      setIsLoading(false);
    }
  };

  const loadAllGroups = async () => {
    try {
      const response = await axios.get(`${API}/community/groups?athlete_id=${athleteId}`);
      setGroups(response.data.groups);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading groups:', error);
      setIsLoading(false);
    }
  };

  const loadMyGroups = async () => {
    try {
      const response = await axios.get(`${API}/community/groups/my/${athleteId}`);
      setMyGroups(response.data.groups);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading my groups:', error);
      setIsLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await axios.get(`${API}/community/notifications/${athleteId}`);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.notifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadAthleteProfile = async (targetAthleteId) => {
    setProfileLoading(true);
    try {
      const response = await axios.get(`${API}/community/profile/${targetAthleteId}?viewer_athlete_id=${athleteId}`);
      setProfileData(response.data);
      setShowProfile(true);
    } catch (error) {
      console.error('Error loading profile:', error);
      alert('Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    try {
      const response = await axios.post(`${API}/community/follow/${profileData.id}?athlete_id=${athleteId}`);
      setProfileData({
        ...profileData,
        is_following: response.data.following,
        followers_count: response.data.followers_count
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };


  const loadAthletes = async (searchQuery = '') => {
    setAthletesLoading(true);
    try {
      const response = await axios.get(`${API}/community/athletes?viewer_athlete_id=${athleteId}&search=${searchQuery}`);
      setAthletes(response.data.athletes);
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setAthletesLoading(false);
    }
  };

  const handleAthletesFollowToggle = async (targetAthleteId) => {
    try {
      const response = await axios.post(`${API}/community/follow/${targetAthleteId}?athlete_id=${athleteId}`);
      // Update the athlete in the list
      setAthletes(athletes.map(athlete =>
        athlete.id === targetAthleteId
          ? { ...athlete, is_following: response.data.following, followers_count: response.data.followers_count }
          : athlete
      ));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleOpenAthletes = () => {
    setShowAthletes(true);
    loadAthletes('');
  };

  const handleAthletesSearch = (e) => {
    const query = e.target.value;
    setAthletesSearch(query);
    loadAthletes(query);
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
      console.error('Error creating post:', error);
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
      console.error('Error editing post:', error);
      alert('Failed to edit post');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await axios.delete(`${API}/community/posts/${postId}?athlete_id=${athleteId}`);
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
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
      console.error('Error toggling like:', error);
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
      loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
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
      console.error('Error loading comments:', error);
    }
  };

  const handleSharePost = async (postId) => {
    try {
      await axios.post(`${API}/community/posts/${postId}/share?athlete_id=${athleteId}`);
      loadPosts();
      alert('Post shared successfully!');
    } catch (error) {
      console.error('Error sharing post:', error);
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
      console.error('Error marking notification as read:', error);
    }
  };

  // Groups functions
  const handleCreateGroup = async () => {
    if (!newGroupData.name.trim()) {
      alert('Group name is required');
      return;
    }

    try {
      await axios.post(`${API}/community/groups?athlete_id=${athleteId}`, newGroupData);
      setShowCreateGroup(false);
      setNewGroupData({ name: '', description: '', privacy: 'public', profile_image: null, cover_photo: null, rules: '' });
      loadMyGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    }
  };


  const handleEditGroup = async () => {
    if (!editGroupData.name.trim()) {
      alert('Group name is required');
      return;
    }

    try {
      await axios.put(`${API}/community/groups/${selectedGroup.id}?athlete_id=${athleteId}`, editGroupData);
      setShowEditGroup(false);
      loadGroupDetails(selectedGroup.id); // Reload group to show updates
    } catch (error) {
      console.error('Error editing group:', error);
      if (error.response?.status === 403) {
        alert('Only group admins can edit groups');
      } else {
        alert(error.response?.data?.detail || 'Failed to edit group');
      }
    }
  };

  const handleOpenEditGroup = () => {
    setEditGroupData({
      name: selectedGroup.name,
      description: selectedGroup.description,
      privacy: selectedGroup.privacy,
      profile_image: selectedGroup.profile_image,
      cover_photo: selectedGroup.cover_photo,
      rules: selectedGroup.rules || ''
    });
    setShowEditGroup(true);
  };


  const handleJoinGroup = async (groupId, groupRules = null) => {
    // If group has rules, show rules modal first
    if (groupRules) {
      setJoiningGroup(groupId);
      setShowRulesModal(true);
      return;
    }

    try {
      const response = await axios.post(`${API}/community/groups/${groupId}/join?athlete_id=${athleteId}`, {
        rules_accepted: false
      });
      alert(response.data.message);
      loadAllGroups();
    } catch (error) {
      console.error('Error joining group:', error);
      alert(error.response?.data?.detail || 'Failed to join group');
    }
  };

  const confirmJoinGroup = async () => {
    if (!rulesAccepted) {
      alert('You must accept the group rules to join');
      return;
    }

    try {
      const response = await axios.post(`${API}/community/groups/${joiningGroup}/join?athlete_id=${athleteId}`, {
        rules_accepted: true
      });
      alert(response.data.message);
      setShowRulesModal(false);
      setRulesAccepted(false);
      setJoiningGroup(null);
      loadAllGroups();
    } catch (error) {
      console.error('Error joining group:', error);
      alert(error.response?.data?.detail || 'Failed to join group');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;

    try {
      await axios.post(`${API}/community/groups/${groupId}/leave?athlete_id=${athleteId}`);
      setSelectedGroup(null);
      loadMyGroups();
    } catch (error) {
      console.error('Error leaving group:', error);
      alert(error.response?.data?.message || 'Failed to leave group');
    }
  };

  const loadGroupDetails = async (groupId) => {
    try {
      const [groupResponse, postsResponse] = await Promise.all([
        axios.get(`${API}/community/groups/${groupId}?athlete_id=${athleteId}`),
        axios.get(`${API}/community/groups/${groupId}/posts?athlete_id=${athleteId}`)
      ]);
      setSelectedGroup(groupResponse.data);
      setGroupPosts(postsResponse.data.posts);
    } catch (error) {
      console.error('Error loading group details:', error);
      alert('Failed to load group');
    }
  };

  const handleCreateGroupPost = async () => {
    if (!newPostContent.trim() || !selectedGroup) return;

    try {
      await axios.post(`${API}/community/groups/${selectedGroup.id}/posts?athlete_id=${athleteId}`, {
        content: newPostContent,
        image_data: newPostImage
      });
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePreview(null);
      loadGroupDetails(selectedGroup.id);
    } catch (error) {
      console.error('Error creating group post:', error);
      alert('Failed to create post');
    }
  };


  // Events functions
  const loadEvents = async () => {
    try {
      const response = await axios.get(`${API}/community/events?athlete_id=${athleteId}`);
      setEvents(response.data.events);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading events:', error);
      setIsLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventData.name.trim()) {
      alert('Event name is required');
      return;
    }

    try {
      await axios.post(`${API}/community/events?athlete_id=${athleteId}`, newEventData);
      setShowCreateEvent(false);
      setNewEventData({
        name: '', description: '', visibility: 'open', event_date: '', event_time: '',
        location: '', profile_image: null, cover_photo: null, group_id: null
      });
      loadEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    }
  };

  const handleEditEvent = async () => {
    if (!editEventData.name.trim()) {
      alert('Event name is required');
      return;
    }

    try {
      await axios.put(`${API}/community/events/${selectedEvent.id}?athlete_id=${athleteId}`, editEventData);
      setShowEditEvent(false);
      loadEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error editing event:', error);
      alert(error.response?.data?.detail || 'Failed to edit event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      await axios.delete(`${API}/community/events/${eventId}?athlete_id=${athleteId}`);
      loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const handleRSVP = async (eventId, status) => {
    try {
      const response = await axios.post(`${API}/community/events/${eventId}/rsvp?athlete_id=${athleteId}`, { status });
      setEvents(events.map(event =>
        event.id === eventId
          ? { ...event, user_status: status === 'not_going' ? null : status, interested_count: response.data.interested_count, going_count: response.data.going_count }
          : event
      ));
    } catch (error) {
      console.error('Error RSVP:', error);
      alert('Failed to RSVP');
    }
  };

  const handleOpenEditEvent = (event) => {
    setEditEventData({
      name: event.name,
      description: event.description,
      visibility: event.visibility,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location || '',
      profile_image: event.profile_image,
      cover_photo: event.cover_photo,
      group_id: event.group_id
    });
    setSelectedEvent(event);
    setShowEditEvent(true);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div 
      className="max-w-5xl mx-auto space-y-6 py-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with Tabs and Notifications */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setActiveTab('feed');
              setSelectedGroup(null);
            }}
            className={`p-3 rounded-lg transition-all ${
              activeTab === 'feed'
                ? 'bg-[#00C2A8] text-white shadow-lg'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            title="Feed"
          >
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              setActiveTab('groups');
              setSelectedGroup(null);
            }}
            className={`p-3 rounded-lg transition-all ${
              activeTab === 'groups'
                ? 'bg-[#00C2A8] text-white shadow-lg'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            title="All Groups"
          >
            <UsersIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              setActiveTab('mygroups');
              setSelectedGroup(null);
            }}
            className={`p-3 rounded-lg transition-all ${
              activeTab === 'mygroups'
                ? 'bg-[#00C2A8] text-white shadow-lg'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            title="My Groups"
          >
            <UserCheck className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              setActiveTab('events');
              setSelectedGroup(null);
            }}
            className={`p-3 rounded-lg transition-all ${
              activeTab === 'events'
                ? 'bg-[#00C2A8] text-white shadow-lg'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            title="Events"
          >
            <Calendar className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenAthletes}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            aria-label="Find Athletes"
          >
            <Search className="w-6 h-6 text-white" />
          </button>
          
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
      </div>

      {/* Feed Tab */}
      {activeTab === 'feed' && !selectedGroup && (
        <>
          {/* Create Post Card */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
            <CardContent className="p-6">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's on your mind?"
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
                    <span className="text-white text-sm">Add Photo</span>
                  </div>
                </label>
                
                <Button
                  onClick={handleCreatePost}
                  disabled={!newPostContent.trim()}
                  className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts Feed */}
          <PostsList 
            posts={posts}
            athleteId={athleteId}
            editingPost={editingPost}
            editContent={editContent}
            showComments={showComments}
            commentText={commentText}
            setEditingPost={setEditingPost}
            setEditContent={setEditContent}
            setCommentText={setCommentText}
            handleEditPost={handleEditPost}
            handleDeletePost={handleDeletePost}
            handleToggleLike={handleToggleLike}
            toggleComments={toggleComments}
            handleAddComment={handleAddComment}
            handleSharePost={handleSharePost}
            loadAthleteProfile={loadAthleteProfile}
          />
        </>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && !selectedGroup && (
        <div className="space-y-6">
          <Button
            onClick={() => setShowCreateGroup(true)}
            className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
          >
            <UsersIcon className="w-4 h-4 mr-2" />
            Create Group
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                athleteId={athleteId}
                onJoin={handleJoinGroup}
                onClick={() => loadGroupDetails(group.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* My Groups Tab */}
      {activeTab === 'mygroups' && !selectedGroup && (
        <div className="space-y-6">
          <Button
            onClick={() => setShowCreateGroup(true)}
            className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
          >
            <UsersIcon className="w-4 h-4 mr-2" />
            Create Group
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                athleteId={athleteId}
                isMember={true}
                onClick={() => loadGroupDetails(group.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group Detail View */}
      {selectedGroup && (
        <GroupDetailView
          group={selectedGroup}
          posts={groupPosts}
          athleteId={athleteId}
          newPostContent={newPostContent}
          newPostImage={newPostImage}
          newPostImagePreview={newPostImagePreview}
          editingPost={editingPost}
          editContent={editContent}
          showComments={showComments}
          commentText={commentText}
          setNewPostContent={setNewPostContent}
          setNewPostImage={setNewPostImage}
          setNewPostImagePreview={setNewPostImagePreview}
          setEditingPost={setEditingPost}
          setEditContent={setEditContent}
          setCommentText={setCommentText}
          handleCreateGroupPost={handleCreateGroupPost}
          handleImageSelect={handleImageSelect}
          onBack={() => setSelectedGroup(null)}
          onLeave={handleLeaveGroup}
          onEditGroup={handleOpenEditGroup}
          loadAthleteProfile={loadAthleteProfile}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          groupData={newGroupData}
          setGroupData={setNewGroupData}
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {/* Edit Group Modal */}
      {showEditGroup && (
        <EditGroupModal
          groupData={editGroupData}
          setGroupData={setEditGroupData}
          onClose={() => setShowEditGroup(false)}
          onSave={handleEditGroup}
        />
      )}

      {/* Athlete Profile Modal */}
      {showProfile && profileData && (
        <AthleteProfileModal
          profile={profileData}
          onClose={() => setShowProfile(false)}
          onFollowToggle={handleFollowToggle}
          loading={profileLoading}
        />
      )}

      {/* Athletes List Modal */}
      {showAthletes && (
        <AthletesModal
          athletes={athletes}
          loading={athletesLoading}
          searchQuery={athletesSearch}
          onSearchChange={handleAthletesSearch}
          onClose={() => setShowAthletes(false)}
          onFollowToggle={handleAthletesFollowToggle}
          onViewProfile={loadAthleteProfile}
        />
      )}
      {/* Group Rules Modal */}
      {showRulesModal && joiningGroup && (
        <GroupRulesModal
          groupId={joiningGroup}
          onAccept={confirmJoinGroup}
          onCancel={() => {
            setShowRulesModal(false);
            setRulesAccepted(false);
            setJoiningGroup(null);
          }}
          rulesAccepted={rulesAccepted}
          setRulesAccepted={setRulesAccepted}
        />
      )}
    </div>
  );
};

// PostsList Component
const PostsList = ({ posts, athleteId, editingPost, editContent, showComments, commentText,
  setEditingPost, setEditContent, setCommentText, handleEditPost, handleDeletePost,
  handleToggleLike, toggleComments, handleAddComment, handleSharePost, loadAthleteProfile }) => (
  <div className="space-y-6">
    {posts.map(post => (
      <Card key={post.id} className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
        <CardHeader className="pb-3">
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
                <p className="text-white font-semibold hover:underline">{post.athlete_name}</p>
                <p className="text-gray-400 text-xs">
                  {new Date(post.created_at).toLocaleString()}
                  {post.is_edited && ' (edited)'}
                </p>
              </div>
            </div>
            
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
                className="w-full bg-gray-600 text-white rounded-lg p-3 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
                rows="3"
              />
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
              
              {showComments[post.id] && (
                <div className="mt-4 border-t border-gray-600 pt-4 space-y-4">
                  {post.comments?.map(comment => (
                    <div key={comment.id} className="flex space-x-3">
                      <div 
                        className="cursor-pointer"
                        onClick={() => loadAthleteProfile(comment.athlete_id)}
                      >
                        {comment.athlete_profile_picture ? (
                          <img
                            src={comment.athlete_profile_picture}
                            alt={comment.athlete_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-bold">
                              {comment.athlete_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 bg-gray-600 rounded-lg p-3">
                        <p 
                          className="text-white font-semibold text-sm cursor-pointer hover:underline"
                          onClick={() => loadAthleteProfile(comment.athlete_id)}
                        >
                          {comment.athlete_name}
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
                      placeholder="Write a comment..."
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
        </CardContent>
      </Card>
    ))}

    {posts.length === 0 && (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
        <CardContent className="p-12 text-center">
          <p className="text-gray-400 text-lg">No posts yet. Be the first to share something!</p>
        </CardContent>
      </Card>
    )}
  </div>
);

// GroupCard Component
const GroupCard = ({ group, athleteId, isMember, onJoin, onClick }) => (
  <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800 cursor-pointer hover:shadow-xl transition-all" onClick={onClick}>
    <CardContent className="p-6">
      {group.cover_photo && (
        <img src={group.cover_photo} alt={group.name} className="w-full h-32 object-cover rounded-lg mb-4" />
      )}
      <div className="flex items-start space-x-3 mb-3">
        {group.profile_image ? (
          <img src={group.profile_image} alt={group.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
            <UsersIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-xl font-bold text-white truncate">{group.name}</h3>
            {group.privacy === 'private' ? (
              <Lock className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
            ) : (
              <Globe className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
            )}
          </div>
          <p className="text-gray-300 text-sm line-clamp-2">{group.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">{group.members_count} members</span>
        {!isMember && !group.is_member && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onJoin(group.id, group.rules);
            }}
            className="bg-[#00C2A8] hover:bg-[#00a890] text-white text-sm px-4 py-1"
          >
            Join
          </Button>
        )}
        {group.member_role && (
          <span className="text-[#00C2A8] text-sm font-semibold flex items-center">
            {group.member_role === 'admin' && <Crown className="w-4 h-4 mr-1" />}
            {group.member_role === 'manager' && <Shield className="w-4 h-4 mr-1" />}
            {group.member_role === 'moderator' && <Shield className="w-4 h-4 mr-1" />}
            {group.member_role}
          </span>
        )}
      </div>
    </CardContent>
  </Card>
);

// CreateGroupModal Component
const CreateGroupModal = ({ groupData, setGroupData, onClose, onCreate }) => {
  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupData({ ...groupData, [type]: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Prevent closing when clicking on backdrop (only close with Cancel button)
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          // Prevent backdrop click from propagating
          e.stopPropagation();
        }}
      >
        <h2 className="text-2xl font-bold text-white mb-4">Create Group</h2>
        
        <div className="space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Group Profile Image</label>
            <div className="flex items-center space-x-4">
              {groupData.profile_image ? (
                <img src={groupData.profile_image} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'profile_image')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm">
                  {groupData.profile_image ? 'Change Image' : 'Upload Image'}
                </div>
              </label>
              {groupData.profile_image && (
                <button
                  onClick={() => setGroupData({ ...groupData, profile_image: null })}
                  className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Banner Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Banner Image</label>
            {groupData.cover_photo && (
              <div className="relative mb-2">
                <img src={groupData.cover_photo} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => setGroupData({ ...groupData, cover_photo: null })}
                  className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover_photo')}
                className="hidden"
              />
              <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm inline-block">
                {groupData.cover_photo ? 'Change Banner' : 'Upload Banner'}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Group Name</label>
            <input
              type="text"
              value={groupData.name}
              onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
              placeholder="Enter group name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Description</label>
            <textarea
              value={groupData.description}
              onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
              placeholder="Describe your group"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="3"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Privacy</label>
            <select
              value={groupData.privacy}
              onChange={(e) => setGroupData({ ...groupData, privacy: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="public">Public - Anyone can join</option>
              <option value="private">Private - Requires approval</option>
            </select>
          </div>
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Group Rules (Optional)</label>
            <textarea
              value={groupData.rules}
              onChange={(e) => setGroupData({ ...groupData, rules: e.target.value })}
              placeholder="Enter group rules that members must accept to join (optional)"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="4"
            />
            <p className="text-gray-400 text-xs mt-1">If set, users must accept these rules before joining</p>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <Button
            onClick={onCreate}
            className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
          >
            Create Group
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

// EditGroupModal Component (same as CreateGroupModal but for editing)
const EditGroupModal = ({ groupData, setGroupData, onClose, onSave }) => {
  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupData({ ...groupData, [type]: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Prevent closing when clicking on backdrop (only close with Cancel button)
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          // Prevent backdrop click from propagating
          e.stopPropagation();
        }}
      >
        <h2 className="text-2xl font-bold text-white mb-4">Edit Group</h2>
        
        <div className="space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Group Profile Image</label>
            <div className="flex items-center space-x-4">
              {groupData.profile_image ? (
                <img src={groupData.profile_image} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'profile_image')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm">
                  {groupData.profile_image ? 'Change Image' : 'Upload Image'}
                </div>
              </label>
              {groupData.profile_image && (
                <button
                  onClick={() => setGroupData({ ...groupData, profile_image: null })}
                  className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Banner Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Banner Image</label>
            {groupData.cover_photo && (
              <div className="relative mb-2">
                <img src={groupData.cover_photo} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => setGroupData({ ...groupData, cover_photo: null })}
                  className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover_photo')}
                className="hidden"
              />
              <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm inline-block">
                {groupData.cover_photo ? 'Change Banner' : 'Upload Banner'}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Group Name</label>
            <input
              type="text"
              value={groupData.name}
              onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
              placeholder="Enter group name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Description</label>
            <textarea
              value={groupData.description}
              onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
              placeholder="Describe your group"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="3"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Privacy</label>
            <select
              value={groupData.privacy}
              onChange={(e) => setGroupData({ ...groupData, privacy: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="public">Public - Anyone can join</option>
              <option value="private">Private - Requires approval</option>
            </select>
          </div>
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Group Rules (Optional)</label>
            <textarea
              value={groupData.rules}
              onChange={(e) => setGroupData({ ...groupData, rules: e.target.value })}
              placeholder="Enter group rules that members must accept to join (optional)"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="4"
            />
            <p className="text-gray-400 text-xs mt-1">If set, users must accept these rules before joining</p>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <Button
            onClick={onSave}
            className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
          >
            Save Changes
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

// AthleteProfileModal Component
const AthleteProfileModal = ({ profile, onClose, onFollowToggle, loading }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-4 mb-6">
            {profile.profile_picture ? (
              <img
                src={profile.profile_picture}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-[#00C2A8] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {profile.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
              {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#00C2A8]">{profile.posts_count}</p>
              <p className="text-gray-400 text-sm">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#00C2A8]">{profile.followers_count}</p>
              <p className="text-gray-400 text-sm">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#00C2A8]">{profile.following_count}</p>
              <p className="text-gray-400 text-sm">Following</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            {!profile.is_own_profile && (
              <Button
                onClick={onFollowToggle}
                className={`flex-1 ${
                  profile.is_following
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-[#00C2A8] hover:bg-[#00a890]'
                } text-white`}
              >
                {profile.is_following ? (
                  <>
                    <UserMinus className="w-4 h-4 mr-2" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
            >
              Close
            </Button>
          </div>
        </>
      )}
    </div>
  </div>
);

// GroupDetailView Component  
const GroupDetailView = ({ group, posts, athleteId, newPostContent, newPostImage, newPostImagePreview,
  editingPost, editContent, showComments, commentText, setNewPostContent, setNewPostImage, 
  setNewPostImagePreview, setEditingPost, setEditContent, setCommentText,
  handleCreateGroupPost, handleImageSelect, onBack, onLeave, onEditGroup, loadAthleteProfile }) => (
  <div className="space-y-6">
    {/* Group Header */}
    <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
      <CardContent className="p-6">
        <button
          onClick={onBack}
          className="text-[#00C2A8] hover:underline mb-4 flex items-center"
        >
          ← Back to Groups
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
              <span className="text-gray-400">{group.members_count} members</span>
              {group.member_role && (
                <span className="text-[#00C2A8] font-semibold flex items-center">
                  {group.member_role === 'admin' && <Crown className="w-4 h-4 mr-1" />}
                  {group.member_role === 'moderator' && <Shield className="w-4 h-4 mr-1" />}
                  {group.member_role}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col space-y-2">
            {group.member_role === 'admin' && (
              <button
                onClick={onEditGroup}
                className="p-2 bg-[#00C2A8] hover:bg-[#00a890] rounded-lg transition-colors"
                title="Edit Group"
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
      </CardContent>
    </Card>

    {/* Pending Requests (admin/moderator only) */}
    {group.pending_members && group.pending_members.length > 0 && (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Pending Join Requests</h3>
          <div className="space-y-3">
            {group.pending_members.map(member => (
              <div key={member.id} className="flex items-center justify-between bg-gray-600 rounded-lg p-4">
                <div 
                  className="flex items-center space-x-3 cursor-pointer"
                  onClick={() => loadAthleteProfile(member.id)}
                >
                  {member.profile_picture ? (
                    <img
                      src={member.profile_picture}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-[#00C2A8] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {member.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold hover:underline">{member.name}</p>
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
                        console.error('Error approving member:', error);
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
                        console.error('Error rejecting member:', error);
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
        </CardContent>
      </Card>
    )}

    {/* Members List (admin/manager only) */}
    {group.members && group.member_role && ['admin', 'manager'].includes(group.member_role) && (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Group Members</h3>
          <div className="space-y-3">
            {group.members.map(member => (
              <div key={member.id} className="flex items-center justify-between bg-gray-600 rounded-lg p-4">
                <div 
                  className="flex items-center space-x-3 cursor-pointer flex-1"
                  onClick={() => loadAthleteProfile(member.id)}
                >
                  {member.profile_picture ? (
                    <img
                      src={member.profile_picture}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-[#00C2A8] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {member.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white font-semibold hover:underline">{member.name}</p>
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
                          console.error('Error changing role:', error);
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
        </CardContent>
      </Card>
    )}

    {/* Create Post (if member) */}
    {group.is_member && (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
        <CardContent className="p-6">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="Share something with the group..."
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
                <span className="text-white text-sm">Add Photo</span>
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
        </CardContent>
      </Card>
    )}

    {/* Group Posts - Reuse PostsList but without edit/delete for non-members */}
    <div className="space-y-6">
      {posts.map(post => (
        <Card key={post.id} className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
          <CardHeader className="pb-3">
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
                  <p className="text-white font-semibold hover:underline">{post.athlete_name}</p>
                  <p className="text-gray-400 text-xs">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <p className="text-white mb-4">{post.content}</p>
            {post.image_data && (
              <img src={post.image_data} alt="Post" className="w-full rounded-lg mb-4" />
            )}
            
            <div className="flex items-center space-x-4 border-t border-gray-600 pt-3 mt-3">
              <div className="flex items-center space-x-2 text-gray-400">
                <Heart className="w-5 h-5" />
                <span>{post.likes_count}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <MessageCircle className="w-5 h-5" />
                <span>{post.comments_count}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Share2 className="w-5 h-5" />
                <span>{post.shares_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {posts.length === 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
          <CardContent className="p-12 text-center">
            <p className="text-gray-400 text-lg">No posts in this group yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  </div>
);

// AthletesModal Component
const AthletesModal = ({ athletes, loading, searchQuery, onSearchChange, onClose, onFollowToggle, onViewProfile }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Find Athletes</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>
      
      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search by name..."
            className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
          />
        </div>
      </div>

      {/* Athletes List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : athletes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No athletes found</p>
          </div>
        ) : (
          athletes.map(athlete => (
            <div
              key={athlete.id}
              className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    onViewProfile(athlete.id);
                    onClose();
                  }}
                >
                  {athlete.profile_picture ? (
                    <img
                      src={athlete.profile_picture}
                      alt={athlete.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-[#00C2A8] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xl">
                        {athlete.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onViewProfile(athlete.id);
                    onClose();
                  }}
                >
                  <p className="text-white font-semibold hover:underline">{athlete.name}</p>
                  {athlete.bio && (
                    <p className="text-gray-400 text-sm line-clamp-1">{athlete.bio}</p>
                  )}
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-gray-400 text-xs">{athlete.posts_count} posts</span>
                    <span className="text-gray-400 text-xs">{athlete.followers_count} followers</span>
                  </div>
                </div>

                <Button
                  onClick={() => onFollowToggle(athlete.id)}
                  className={`${
                    athlete.is_following
                      ? 'bg-gray-600 hover:bg-gray-500'
                      : 'bg-[#00C2A8] hover:bg-[#00a890]'
                  } text-white text-sm px-4 py-2`}
                >
                  {athlete.is_following ? (
                    <>
                      <UserMinus className="w-4 h-4 mr-1" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Follow
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

// GroupRulesModal Component
const GroupRulesModal = ({ groupId, onAccept, onCancel, rulesAccepted, setRulesAccepted }) => {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroupRules = async () => {
      try {
        const response = await axios.get(`${API}/community/groups/${groupId}`);
        setGroup(response.data);
      } catch (error) {
        console.error('Error loading group rules:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGroupRules();
  }, [groupId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Group Rules</h2>
        
        {group && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-2">{group.name}</h3>
              <p className="text-gray-300 text-sm mb-4">{group.description}</p>
            </div>

            {group.rules && (
              <div className="mb-6">
                <h4 className="text-white font-semibold mb-2">Rules:</h4>
                <div className="bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-gray-300 whitespace-pre-wrap">{group.rules}</p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="w-5 h-5 text-[#00C2A8] bg-gray-700 border-gray-600 rounded focus:ring-[#00C2A8] focus:ring-2"
                />
                <span className="text-white">I agree to follow the group rules</span>
              </label>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={onAccept}
                disabled={!rulesAccepted}
                className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Group
              </Button>
              <Button
                onClick={onCancel}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default Community;
