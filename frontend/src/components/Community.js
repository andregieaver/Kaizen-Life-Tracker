import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Heart, MessageCircle, Share2, Send, Edit2, Edit3, Trash2, Camera, X, Bell, UserPlus, UserMinus, Users as UsersIcon, Lock, Globe, Crown, Shield, Search, Home, UserCheck, ThumbsUp, ThumbsDown, Calendar, Clock, MapPin, Star, RefreshCw } from 'lucide-react';
import { compressPostImage, compressThumbnail, compressBannerImage } from '../utils/imageCompression';
import { findMentionTrigger, insertMention, formatMentions } from '../utils/mentionUtils';
import EmojiPickerButton from './EmojiPickerButton';
import ConfirmationModal from './ConfirmationModal';
import ImageCarousel from './ImageCarousel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Community = ({ athleteId }) => {
  // Initialize activeTab from localStorage or default to 'feed'
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('communityActiveTab');
    return (savedTab && ['feed', 'following', 'groups', 'mygroups', 'events'].includes(savedTab)) ? savedTab : 'feed';
  });
  
  // Swipe state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;
  
  // Posts state
  const [posts, setPosts] = useState([]);
  const [followingPosts, setFollowingPosts] = useState([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [followingPostsLoaded, setFollowingPostsLoaded] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState(null);
  // Multi-image support
  const [selectedImages, setSelectedImages] = useState([]); // Array of File objects
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]); // Array of URLs from backend
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [selectedEventForComments, setSelectedEventForComments] = useState(null);
  
  // Expanded posts state for "Show more/less"
  const [expandedPosts, setExpandedPosts] = useState({});
  
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const newPostRef = useRef(null);
  const commentRefs = useRef({});
  const newEventDescRef = useRef(null);
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Profile state
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });
  
  // Write post modal state
  const [showWritePostModal, setShowWritePostModal] = useState(false);
  const [writePostContent, setWritePostContent] = useState('');
  const [writePostImage, setWritePostImage] = useState(null);
  const [writePostImagePreview, setWritePostImagePreview] = useState(null);
  const [writePostVisibility, setWritePostVisibility] = useState('public');
  
  // Athletes modal state
  const [showAthletes, setShowAthletes] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [athletesSearch, setAthletesSearch] = useState('');
  const [athletesLoading, setAthletesLoading] = useState(false);
  
  // Groups state
  const [groups, setGroups] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [myGroupsLoaded, setMyGroupsLoaded] = useState(false);
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
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [eventDetailData, setEventDetailData] = useState(null);
  const [eventDetailLoading, setEventDetailLoading] = useState(false);
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
      } else if (activeTab === 'mygroups') {
        setActiveTab('events');
        setSelectedGroup(null);
      }
    }
    
    if (isRightSwipe) {
      // Swipe right - go to previous tab
      if (activeTab === 'events') {
        setActiveTab('mygroups');
        setSelectedGroup(null);
      } else if (activeTab === 'mygroups') {
        setActiveTab('groups');
        setSelectedGroup(null);
      } else if (activeTab === 'groups') {
        setActiveTab('feed');
        setSelectedGroup(null);
      }
    }
  };

  useEffect(() => {
    // Load notifications only once on mount
    if (!notificationsLoaded) {
      loadNotifications();
    }
    
    // DISABLED: Modal restoration triggers extra API calls, slowing down initial load
    // Users can reopen modals manually if needed
  }, [notificationsLoaded]);

  useEffect(() => {
    // Save tab to localStorage when it changes
    localStorage.setItem('communityActiveTab', activeTab);
    
    // Load data based on active tab with caching
    if (activeTab === 'feed' && !postsLoaded) {
      loadPosts();
    } else if (activeTab === 'following' && !followingPostsLoaded) {
      loadFollowingPosts();
    } else if (activeTab === 'groups' && !groupsLoaded) {
      loadAllGroups();
    } else if (activeTab === 'mygroups' && !myGroupsLoaded) {
      loadMyGroups();
    } else if (activeTab === 'events' && !eventsLoaded) {
      loadEvents();
    }
  }, [activeTab]); // Only depend on activeTab, not the loaded flags

  // Persist modal states (only IDs, not full data to avoid quota issues)
  useEffect(() => {
    const modalState = {
      showProfile: showProfile && profileData ? true : false,
      profileAthleteId: showProfile && profileData ? profileData.id : null,
      showEventDetail: showEventDetail && eventDetailData ? true : false,
      eventDetailId: showEventDetail && eventDetailData ? eventDetailData.id : null,
      selectedGroupId: selectedGroup ? selectedGroup.id : null,
      showNotifications: showNotifications
    };
    
    try {
      localStorage.setItem('communityModalState', JSON.stringify(modalState));
    } catch (e) {
      // Quota exceeded, clear old state
      localStorage.removeItem('communityModalState');
    }
  }, [showProfile, profileData, showEventDetail, eventDetailData, selectedGroup, showNotifications]);

  const loadPosts = async (forceReload = false) => {
    try {
      setIsLoading(true);
      // Load 10 posts WITH compressed images
      const response = await axios.get(`${API}/community/feed/${athleteId}?limit=10`);
      console.log('Posts loaded:', response.data);
      console.log('First post full data:', JSON.stringify(response.data.posts?.[0], null, 2));
      console.log('First post comments_count:', response.data.posts?.[0]?.comments_count);
      
      if (response.data && response.data.posts) {
        setPosts(response.data.posts.map(p => ({ ...p, type: 'post' })));
      } else {
        console.error('No posts in response:', response.data);
        setPosts([]);
      }
      
      setPostsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading posts:', error);
      console.error('Error details:', error.response?.data);
      setPosts([]);
      setIsLoading(false);
    }
  };

  const loadFollowingPosts = async (forceReload = false) => {
    try {
      setIsLoading(true);
      // Load posts from people the user follows
      const response = await axios.get(`${API}/community/following-feed/${athleteId}?limit=10`);
      console.log('Following posts loaded:', response.data);
      
      if (response.data && response.data.posts) {
        setFollowingPosts(response.data.posts.map(p => ({ ...p, type: 'post' })));
      } else {
        console.error('No following posts in response:', response.data);
        setFollowingPosts([]);
      }
      
      setFollowingPostsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading following posts:', error);
      console.error('Error details:', error.response?.data);
      setFollowingPosts([]);
      setIsLoading(false);
    }
  };


  const loadAllGroups = async () => {
    try {
      // Load 15 groups WITH compressed images
      const response = await axios.get(`${API}/community/groups?athlete_id=${athleteId}&limit=15`);
      setGroups(response.data.groups);
      setGroupsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading groups:', error);
      setIsLoading(false);
    }
  };

  const loadMyGroups = async () => {
    try {
      // Load 15 groups WITH compressed images
      const response = await axios.get(`${API}/community/groups/my/${athleteId}?limit=15`);
      setMyGroups(response.data.groups);
      setMyGroupsLoaded(true);
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
      setNotificationsLoaded(true);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleRefresh = () => {
    // Reset all cache flags and reload current tab
    if (activeTab === 'feed') {
      setPostsLoaded(false);
      loadPosts();
    } else if (activeTab === 'following') {
      setFollowingPostsLoaded(false);
      loadFollowingPosts();
    } else if (activeTab === 'groups') {
      setGroupsLoaded(false);
      loadAllGroups();
    } else if (activeTab === 'mygroups') {
      setMyGroupsLoaded(false);
      loadMyGroups();
    } else if (activeTab === 'events') {
      setEventsLoaded(false);
      loadEvents();
    }
    // Also refresh notifications
    setNotificationsLoaded(false);
    loadNotifications();
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


  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image to WebP format
        const compressed = await compressPostImage(file);
        setNewPostImage(compressed);
        setNewPostImagePreview(compressed);
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process image');
      }
    }
  };

  // Handle multiple image selection
  const handleMultipleImagesSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Check max limit (5 images)
    const maxImages = 5;
    const currentCount = selectedImages.length;
    const newCount = currentCount + files.length;

    if (newCount > maxImages) {
      alert(`You can only upload a maximum of ${maxImages} images. You currently have ${currentCount} image(s).`);
      return;
    }

    // Add files to selected images
    setSelectedImages(prev => [...prev, ...files]);

    // Upload images to backend
    setIsUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await axios.post(`${API}/upload/images?max_files=${maxImages}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Add URLs to state
      setUploadedImageUrls(prev => [...prev, ...response.data.urls]);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
      // Remove the files that failed to upload
      setSelectedImages(prev => prev.slice(0, currentCount));
    } finally {
      setIsUploadingImages(false);
    }
  };

  // Remove image from selection
  const handleRemoveImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setUploadedImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Mention handling functions
  const searchAthletes = async (searchText) => {
    if (!searchText || searchText.length < 1) {
      setMentionResults([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/community/athletes/search?q=${searchText}`);
      setMentionResults(response.data.athletes || []);
    } catch (error) {
      console.error('Error searching athletes:', error);
      setMentionResults([]);
    }
  };

  const handlePostContentChange = (e) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setNewPostContent(text);
    
    // Check for mention trigger
    const mentionTrigger = findMentionTrigger(text, cursorPosition);
    
    if (mentionTrigger.triggered) {
      setShowMentionDropdown(true);
      setMentionSearchText(mentionTrigger.searchText);
      searchAthletes(mentionTrigger.searchText);
      
      // Calculate dropdown position
      const textarea = e.target;
      const rect = textarea.getBoundingClientRect();
      setMentionPosition({
        top: rect.bottom,
        left: rect.left
      });
    } else {
      setShowMentionDropdown(false);
      setMentionResults([]);
    }
  };

  const handleSelectMention = (athlete) => {
    const textarea = newPostRef.current;
    const cursorPosition = textarea.selectionStart;
    
    const result = insertMention(newPostContent, cursorPosition, athlete.id, athlete.name);
    setNewPostContent(result.text);
    setShowMentionDropdown(false);
    setMentionResults([]);
    
    // Set cursor position after mention
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = result.cursorPosition;
      textarea.selectionEnd = result.cursorPosition;
    }, 0);
  };

  const handleCommentContentChange = (postId, e) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setCommentText({ ...commentText, [postId]: text });
    
    // Check for mention trigger
    const mentionTrigger = findMentionTrigger(text, cursorPosition);
    
    if (mentionTrigger.triggered) {
      setShowMentionDropdown(postId); // Use postId to track which comment box
      setMentionSearchText(mentionTrigger.searchText);
      searchAthletes(mentionTrigger.searchText);
      
      // Calculate dropdown position
      const textarea = e.target;
      const rect = textarea.getBoundingClientRect();
      setMentionPosition({
        top: rect.bottom,
        left: rect.left
      });
    } else {
      if (showMentionDropdown === postId) {
        setShowMentionDropdown(false);
        setMentionResults([]);
      }
    }
  };

  const handleSelectCommentMention = (postId, athlete) => {
    const textarea = commentRefs.current[postId];
    const cursorPosition = textarea.selectionStart;
    const currentText = commentText[postId] || '';
    
    const result = insertMention(currentText, cursorPosition, athlete.id, athlete.name);
    setCommentText({ ...commentText, [postId]: result.text });
    setShowMentionDropdown(false);
    setMentionResults([]);
    
    // Set cursor position after mention
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = result.cursorPosition;
      textarea.selectionEnd = result.cursorPosition;
    }, 0);
  };


  // Emoji handlers
  const handleEmojiSelectForPost = (emoji) => {
    setNewPostContent(prev => prev + emoji);
    if (newPostRef.current) {
      newPostRef.current.focus();
    }
  };

  const handleEmojiSelectForComment = (emoji, postOrEventId) => {
    setCommentText(prev => ({
      ...prev,
      [postOrEventId]: (prev[postOrEventId] || '') + emoji
    }));
  };

  const handleEmojiSelectForEventDesc = (emoji) => {
    setNewEventDesc(prev => prev + emoji);
    if (newEventDescRef.current) {
      newEventDescRef.current.focus();
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      const postData = {
        content: newPostContent,
        image_data: newPostImage,
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : [] // Use array of URLs if available
      };

      await axios.post(`${API}/community/posts?athlete_id=${athleteId}`, postData);
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePreview(null);
      // Clear multi-image state
      setSelectedImages([]);
      setUploadedImageUrls([]);
      setPostsLoaded(false); // Reset cache to reload posts
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

  const handleWritePost = async () => {
    if (!writePostContent.trim()) return;

    try {
      const postData = {
        content: writePostContent,
        image_data: writePostImage,
        visibility: writePostVisibility,
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : [] // Use array of URLs if available
      };

      console.log('📤 POSTING DATA:', JSON.stringify(postData, null, 2));
      console.log('📷 Uploaded Image URLs:', uploadedImageUrls);
      console.log('🖼️ Selected Images Count:', selectedImages.length);

      const response = await axios.post(`${API}/community/posts?athlete_id=${athleteId}`, postData);
      
      console.log('✅ POST CREATED:', response.data);
      
      // Clear modal state
      setWritePostContent('');
      setWritePostImage(null);
      setWritePostImagePreview(null);
      setWritePostVisibility('public');
      setShowWritePostModal(false);
      // Clear multi-image state
      setSelectedImages([]);
      setUploadedImageUrls([]);
      
      // Show success message with image count
      alert(`Post created successfully! ${uploadedImageUrls.length} image(s) uploaded.`);
      
      // Reload appropriate feed
      if (activeTab === 'feed') {
        setPostsLoaded(false);
        loadPosts();
      } else if (activeTab === 'following') {
        setFollowingPostsLoaded(false);
        loadFollowingPosts();
      }
    } catch (error) {
      console.error('❌ Error creating post:', error);
      console.error('Error response:', error.response?.data);
      alert(`Failed to create post: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleWritePostImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressPostImage(file);
      setWritePostImage(compressed);
      setWritePostImagePreview(URL.createObjectURL(file));
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image');
    }
  };


  const handleEditPost = async (postId) => {
    try {
      const postData = {
        content: editContent,
        visibility: editVisibility
      };

      await axios.put(`${API}/community/posts/${postId}?athlete_id=${athleteId}`, postData);
      setEditingPost(null);
      setEditContent('');
      setEditVisibility('public');
      
      // Reload both feeds
      setPostsLoaded(false);
      setFollowingPostsLoaded(false);
      loadPosts();
      loadFollowingPosts();
    } catch (error) {
      console.error('Error editing post:', error);
      alert('Failed to edit post');
    }
  };

  const handleDeletePost = async (postId) => {
    setConfirmModalConfig({
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await axios.delete(`${API}/community/posts/${postId}?athlete_id=${athleteId}`);
          
          // Reload both feeds
          setPostsLoaded(false);
          setFollowingPostsLoaded(false);
          loadPosts();
          loadFollowingPosts();
        } catch (error) {
          console.error('Error deleting post:', error);
          alert('Failed to delete post');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleToggleLike = async (postId) => {
    try {
      const response = await axios.post(`${API}/community/posts/${postId}/like?athlete_id=${athleteId}`);
      
      // Update posts in feed
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, liked_by_user: response.data.liked, likes_count: response.data.likes_count }
          : post
      ));
      
      // Update posts in following feed
      setFollowingPosts(followingPosts.map(post => 
        post.id === postId 
          ? { ...post, liked_by_user: response.data.liked, likes_count: response.data.likes_count }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleAddComment = async (postId) => {
    // Use modal's post if no postId provided
    const targetPostId = postId || selectedPostForComments?.id;
    if (!targetPostId) return;
    
    const content = commentText[targetPostId];
    if (!content || !content.trim()) return;

    try {
      const response = await axios.post(`${API}/community/posts/${targetPostId}/comment?athlete_id=${athleteId}`, {
        content: content
      });

      console.log('Comment added, backend response:', response.data);
      console.log('Updated comments_count from backend:', response.data.comments_count);

      // Reload comments
      const commentsResponse = await axios.get(`${API}/community/posts/${targetPostId}/comments`);
      
      // Update posts with new comments and count - USING FUNCTIONAL UPDATE
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === targetPostId) {
          console.log('Updating post in feed, old count:', post.comments_count, 'new count:', response.data.comments_count);
          return { ...post, comments: commentsResponse.data.comments, comments_count: response.data.comments_count };
        }
        return post;
      }));
      
      // Also update following posts
      setFollowingPosts(currentPosts => currentPosts.map(post => {
        if (post.id === targetPostId) {
          return { ...post, comments: commentsResponse.data.comments, comments_count: response.data.comments_count };
        }
        return post;
      }));

      // Update selected post if modal is open
      if (selectedPostForComments && selectedPostForComments.id === targetPostId) {
        setSelectedPostForComments({
          ...selectedPostForComments,
          comments: commentsResponse.data.comments,
          comments_count: response.data.comments_count
        });
      }

      // Clear comment text
      setCommentText({ ...commentText, [targetPostId]: '' });
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    }
  };

  // Delete comment handlers
  const handleDeletePostComment = (postId, commentId) => {
    setConfirmModalConfig({
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await axios.delete(`${API}/community/posts/${postId}/comment/${commentId}?athlete_id=${athleteId}`);
          
          // Reload comments
          const commentsResponse = await axios.get(`${API}/community/posts/${postId}/comments`);
          
          // Update posts with new comments and count
          setPosts(currentPosts => currentPosts.map(post => {
            if (post.id === postId) {
              return { ...post, comments: commentsResponse.data.comments, comments_count: response.data.comments_count };
            }
            return post;
          }));

          // Update selected post if modal is open
          if (selectedPostForComments && selectedPostForComments.id === postId) {
            setSelectedPostForComments({
              ...selectedPostForComments,
              comments: commentsResponse.data.comments,
              comments_count: response.data.comments_count
            });
          }
        } catch (error) {
          console.error('Error deleting comment:', error);
          alert('Failed to delete comment');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleDeleteEventComment = (eventId, commentId) => {
    setConfirmModalConfig({
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await axios.delete(`${API}/community/events/${eventId}/comment/${commentId}?athlete_id=${athleteId}`);
          
          // Reload comments
          const commentsResponse = await axios.get(`${API}/community/events/${eventId}/comments`);
          
          // Update events with new comments and count
          setEvents(currentEvents => currentEvents.map(event => {
            if (event.id === eventId) {
              return { ...event, comments: commentsResponse.data.comments, comments_count: response.data.comments_count };
            }
            return event;
          }));

          // Update event detail modal if open
          if (eventDetailData && eventDetailData.id === eventId) {
            setEventDetailData({
              ...eventDetailData,
              comments: commentsResponse.data.comments,
              comments_count: response.data.comments_count
            });
          }

          // Update selected event if modal is open
          if (selectedEventForComments && selectedEventForComments.id === eventId) {
            setSelectedEventForComments({
              ...selectedEventForComments,
              comments: commentsResponse.data.comments,
              comments_count: response.data.comments_count
            });
          }
        } catch (error) {
          console.error('Error deleting event comment:', error);
          alert('Failed to delete event comment');
        }
      }
    });
    setShowConfirmModal(true);
  };

  // Event comment handlers
  const handleAddEventComment = async (eventId) => {
    const targetEventId = eventId || selectedEventForComments?.id;
    if (!targetEventId) return;
    
    const content = commentText[targetEventId];
    if (!content || !content.trim()) return;

    try {
      const response = await axios.post(`${API}/community/events/${targetEventId}/comment?athlete_id=${athleteId}`, {
        content: content
      });

      // Reload comments
      const commentsResponse = await axios.get(`${API}/community/events/${targetEventId}/comments`);
      
      // Update events with new comments and count
      setEvents(currentEvents => currentEvents.map(event => {
        if (event.id === targetEventId) {
          return { ...event, comments: commentsResponse.data.comments, comments_count: response.data.comments_count };
        }
        return event;
      }));

      // Update event detail modal if open
      if (eventDetailData && eventDetailData.id === targetEventId) {
        setEventDetailData({
          ...eventDetailData,
          comments: commentsResponse.data.comments,
          comments_count: response.data.comments_count
        });
      }

      // Update selected event if modal is open
      if (selectedEventForComments && selectedEventForComments.id === targetEventId) {
        setSelectedEventForComments({
          ...selectedEventForComments,
          comments: commentsResponse.data.comments,
          comments_count: response.data.comments_count
        });
      }

      // Clear comment text
      setCommentText({ ...commentText, [targetEventId]: '' });
    } catch (error) {
      console.error('Error adding event comment:', error);
      alert('Failed to add comment');
    }
  };

  const toggleEventComments = async (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    // Load comments for this event
    if (!event.comments) {
      try {
        const response = await axios.get(`${API}/community/events/${eventId}/comments`);
        setEvents(currentEvents => currentEvents.map(e => 
          e.id === eventId 
            ? { ...e, comments: response.data.comments, comments_count: response.data.comments.length }
            : e
        ));
        event.comments = response.data.comments;
        event.comments_count = response.data.comments.length;
      } catch (error) {
        console.error('Error loading event comments:', error);
      }
    }
    
    setSelectedEventForComments(event);
    setShowCommentsModal(true);
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
      const response = await axios.post(`${API}/community/posts/${postId}/share?athlete_id=${athleteId}`);
      
      // Update posts in feed
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, shares_count: response.data.shares_count }
          : post
      ));
      
      // Update posts in following feed
      setFollowingPosts(followingPosts.map(post => 
        post.id === postId 
          ? { ...post, shares_count: response.data.shares_count }
          : post
      ));
      
      alert('Post shared successfully!');
    } catch (error) {
      console.error('Error sharing post:', error);
      alert('Failed to share post');
    }
  };

  const toggleComments = async (postId) => {
    // Try to find post in either feed
    let post = posts.find(p => p.id === postId);
    if (!post) {
      post = followingPosts.find(p => p.id === postId);
    }
    if (!post) return;
    
    // Load comments for this post
    if (!post.comments) {
      try {
        const response = await axios.get(`${API}/community/posts/${postId}/comments`);
        
        // Update the post in main feed with comments
        setPosts(currentPosts => currentPosts.map(p => 
          p.id === postId 
            ? { ...p, comments: response.data.comments, comments_count: response.data.comments.length }
            : p
        ));
        
        // Also update in following feed
        setFollowingPosts(currentPosts => currentPosts.map(p => 
          p.id === postId 
            ? { ...p, comments: response.data.comments, comments_count: response.data.comments.length }
            : p
        ));
        
        post.comments = response.data.comments;
        post.comments_count = response.data.comments.length;
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    }
    
    setSelectedPostForComments(post);
    setShowCommentsModal(true);
  };

  const toggleExpandPost = (postId) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };


  const markNotificationRead = async (notificationId) => {
    try {
      await axios.put(`${API}/community/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    await markNotificationRead(notification.id);
    
    // Close notifications dropdown
    setShowNotifications(false);
    
    // Handle different notification types
    if (notification.type === 'mention' && notification.post_id) {
      // Navigate to feed tab
      setActiveTab('feed');
      
      // Load the specific post
      try {
        const response = await axios.get(`${API}/community/posts/${notification.post_id}?athlete_id=${athleteId}`);
        const post = response.data;
        
        // Load comments for the post
        const commentsResponse = await axios.get(`${API}/community/posts/${notification.post_id}/comments`);
        post.comments = commentsResponse.data.comments;
        
        // Check if the mention is in a comment (check if notification has message about comment)
        const isCommentMention = notification.message?.includes('comment');
        
        if (isCommentMention) {
          // Open comments modal directly
          setSelectedPostForComments(post);
          setShowCommentsModal(true);
        } else {
          // Just ensure the post is visible in feed
          // If post not in current feed, add it temporarily at the top
          const postExists = posts.find(p => p.id === notification.post_id);
          if (!postExists) {
            setPosts([{ ...post, type: 'post' }, ...posts]);
          }
        }
      } catch (error) {
        console.error('Error loading post from notification:', error);
        alert('Could not load the post');
      }
    } else if (notification.post_id) {
      // For other notifications with post_id (comments, likes)
      setActiveTab('feed');
      
      try {
        const response = await axios.get(`${API}/community/posts/${notification.post_id}?athlete_id=${athleteId}`);
        const post = response.data;
        const commentsResponse = await axios.get(`${API}/community/posts/${notification.post_id}/comments`);
        post.comments = commentsResponse.data.comments;
        
        // Ensure post is visible
        const postExists = posts.find(p => p.id === notification.post_id);
        if (!postExists) {
          setPosts([{ ...post, type: 'post' }, ...posts]);
        }
      } catch (error) {
        console.error('Error loading post:', error);
      }
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
      setMyGroupsLoaded(false); // Reset cache
      setGroupsLoaded(false); // Reset cache
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
      // Load 10 events WITH compressed images
      const response = await axios.get(`${API}/community/events?athlete_id=${athleteId}&limit=10`);
      setEvents(response.data.events);
      setEventsLoaded(true);
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
      setEventsLoaded(false); // Reset cache
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
      setEventsLoaded(false); // Reset cache
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
      setEventsLoaded(false); // Reset cache
      loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const handleOpenEventDetail = async (eventId) => {
    setEventDetailLoading(true);
    setShowEventDetail(true);
    try {
      // Load event details WITH images for modal display
      const response = await axios.get(`${API}/community/events/${eventId}?athlete_id=${athleteId}`);
      
      // Load comments for the event
      try {
        const commentsResponse = await axios.get(`${API}/community/events/${eventId}/comments`);
        response.data.comments = commentsResponse.data.comments;
      } catch (commentError) {
        console.error('Error loading event comments:', commentError);
        response.data.comments = []; // Set empty array if comments fail to load
      }
      
      setEventDetailData(response.data);
    } catch (error) {
      console.error('Error loading event details:', error);
      alert('Failed to load event details');
      setShowEventDetail(false);
    } finally {
      setEventDetailLoading(false);
    }
  };

  const handleCloseEventDetail = () => {
    setShowEventDetail(false);
    setEventDetailData(null);
  };

  const handleRSVP = async (eventId, status) => {
    try {
      const response = await axios.post(`${API}/community/events/${eventId}/rsvp?athlete_id=${athleteId}`, { status });
      
      // Update event list with new counts from server
      const updatedEvents = events.map(event =>
        event.id === eventId
          ? { 
              ...event, 
              user_status: status === 'not_going' ? null : status, 
              interested_count: response.data.interested_count || 0, 
              going_count: response.data.going_count || 0 
            }
          : event
      );
      
      setEvents(updatedEvents);
      
      // Also update in the combined feed if it's there
      setPosts(posts.map(item => 
        item.id === eventId && item.type === 'event'
          ? {
              ...item,
              user_status: status === 'not_going' ? null : status,
              interested_count: response.data.interested_count || 0,
              going_count: response.data.going_count || 0
            }
          : item
      ));
      
      // If detail modal is open for this event, refresh it to show updated participant list
      if (showEventDetail && eventDetailData && eventDetailData.id === eventId) {
        await handleOpenEventDetail(eventId);
      }
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
              setActiveTab('following');
              setSelectedGroup(null);
            }}
            className={`p-3 rounded-lg transition-all ${
              activeTab === 'following'
                ? 'bg-[#00C2A8] text-white shadow-lg'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            title="Following"
          >
            <UserPlus className="w-6 h-6" />
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
          {/* Write Post Button - Only on Feed and Following tabs */}
          {(activeTab === 'feed' || activeTab === 'following') && (
            <button
              onClick={() => setShowWritePostModal(true)}
              className="p-2 bg-[#00C2A8] hover:bg-[#00a890] rounded-full transition-colors"
              aria-label="Write Post"
              title="Write a post"
            >
              <Edit3 className="w-6 h-6 text-white" />
            </button>
          )}
          
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
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <p className="text-white text-sm">{notification.message || notification.content}</p>
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
          {/* Posts and Events Feed */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : posts.length === 0 ? (
              <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
                <CardContent className="p-12 text-center">
                  <p className="text-gray-400 text-lg mb-2">No posts yet</p>
                  <p className="text-gray-500 text-sm">Be the first to share something!</p>
                </CardContent>
              </Card>
            ) : (
              posts.map(item => {
              if (item.type === 'event') {
                // Render event card
                return (
                  <EventCard
                    key={item.id}
                    event={item}
                    athleteId={athleteId}
                    onRSVP={handleRSVP}
                    onEdit={handleOpenEditEvent}
                    onDelete={handleDeleteEvent}
                    onClick={handleOpenEventDetail}
                  />
                );
              } else {
                // Render post (original PostsList logic for single post)
                const post = item;
                return (
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
                          
                          {/* Visibility Toggle in Edit Mode */}
                          <div className="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
                            <span className="text-white text-sm font-semibold">Visibility:</span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditVisibility('public')}
                                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                                  editVisibility === 'public'
                                    ? 'bg-[#00C2A8] text-white'
                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
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
                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
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
                              className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingPost(null);
                                setEditContent('');
                                setEditVisibility('public');
                              }}
                              className="bg-gray-600 hover:bg-gray-500 text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Post Content with Show More/Less */}
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
                              {formatMentions(post.content)}
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
                          
                          {/* Display images */}
                          {post.image_urls && post.image_urls.length > 0 ? (
                            <div className="mb-4">
                              <ImageCarousel images={post.image_urls} alt="Post images" />
                            </div>
                          ) : post.image_data ? (
                            <img src={post.image_data} alt="Post" className="w-full rounded-lg max-h-96 object-cover mb-4" />
                          ) : null}
                        </>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-600">
                        <button
                          onClick={() => handleToggleLike(post.id, post.liked_by_user)}
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
                          onClick={() => handleSharePost(post.id)}
                          className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-[#00C2A8] transition-colors"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                      </div>

                      {showComments[post.id] && (
                        <div className="mt-4 space-y-4 pt-4 border-t border-gray-600">
                          {post.comments?.map(comment => (
                            <div key={comment.id} className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-xs">
                                  {comment.athlete_name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 bg-gray-600 rounded-lg p-3">
                                <p className="text-white font-semibold text-sm">{comment.athlete_name}</p>
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
                                onChange={(e) => handleCommentContentChange(post.id, e)}
                                placeholder="Write a comment... (Type @ to mention)"
                                className="w-full bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
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
                                      onClick={() => handleSelectCommentMention(post.id, athlete)}
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
                              onClick={() => handleAddComment(post.id)}
                              className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
            }))}
          </div>
        </>
      )}


      {/* Following Feed Tab */}
      {activeTab === 'following' && !selectedGroup && (
        <>
          {/* Posts from people you follow */}
          <div className="space-y-6">
            {isLoading ? (
              <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
                <CardContent className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-400 mt-4">Loading posts from people you follow...</p>
                </CardContent>
              </Card>
            ) : followingPosts.length === 0 ? (
              <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
                <CardContent className="p-12 text-center">
                  <p className="text-gray-400 text-lg mb-2">No posts from people you follow</p>
                  <p className="text-gray-500 text-sm">Follow other athletes to see their posts here!</p>
                </CardContent>
              </Card>
            ) : (
              followingPosts.map(post => (
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
                      
                      {/* Edit/Delete buttons for own posts */}
                      {post.athlete_id === athleteId && (
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
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Edit Mode */}
                    {editingPost === post.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none min-h-[100px]"
                        />
                        
                        {/* Visibility Toggle in Edit Mode */}
                        <div className="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
                          <span className="text-white text-sm font-semibold">Visibility:</span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditVisibility('public')}
                              className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                                editVisibility === 'public'
                                  ? 'bg-[#00C2A8] text-white'
                                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
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
                                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
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
                            className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingPost(null);
                              setEditContent('');
                              setEditVisibility('public');
                            }}
                            className="bg-gray-600 hover:bg-gray-500 text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Post Content with Show More/Less */}
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
                            {formatMentions(post.content)}
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
                        
                        {/* Display images - support both image_urls and image_data */}
                        {post.image_urls && post.image_urls.length > 0 ? (
                          <div className="mb-4">
                            <ImageCarousel images={post.image_urls} alt="Post images" />
                          </div>
                        ) : post.image_data ? (
                          <img src={post.image_data} alt="Post" className="w-full rounded-lg max-h-96 object-cover mb-4" />
                        ) : null}
                      </>
                    )}
                    
                    <div className="flex items-center space-x-6 text-gray-400">
                      <button
                        onClick={() => handleToggleLike(post.id)}
                        className="flex items-center space-x-2 hover:text-red-500 transition-colors"
                      >
                        <Heart className={`w-5 h-5 ${post.liked_by_user ? 'fill-red-500 text-red-500' : ''}`} />
                        <span className="text-sm">{post.likes_count || 0}</span>
                      </button>
                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center space-x-2 hover:text-[#00C2A8] transition-colors"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">{post.comments_count || 0}</span>
                      </button>
                      <button
                        onClick={() => handleSharePost(post.id)}
                        className="flex items-center space-x-2 hover:text-[#00C2A8] transition-colors"
                      >
                        <Share2 className="w-5 h-5" />
                        <span className="text-sm">{post.shares_count || 0}</span>
                      </button>
                    </div>

                    {/* Comments Section */}
                    {showComments[post.id] && (
                      <div className="mt-4 space-y-4 border-t border-gray-600 pt-4">
                        {post.comments && post.comments.length > 0 && (
                          <div className="space-y-3">
                            {post.comments.map(comment => (
                              <div key={comment.id} className="flex items-start space-x-3">
                                <div
                                  className="cursor-pointer hover:opacity-80"
                                  onClick={() => loadAthleteProfile(comment.athlete_id)}
                                >
                                  {comment.athlete_profile_picture ? (
                                    <img
                                      src={comment.athlete_profile_picture}
                                      alt={comment.athlete_name}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center">
                                      <span className="text-white font-bold text-xs">
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
                                  <p className="text-gray-300 text-sm mt-1">{formatMentions(comment.content)}</p>
                                  <p className="text-gray-400 text-xs mt-1">
                                    {new Date(comment.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <EmojiPickerButton onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, post.id)} />
                          <input
                            ref={(el) => commentRefs.current[post.id] = el}
                            type="text"
                            value={commentText[post.id] || ''}
                            onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                            placeholder="Write a comment... (Type @ to mention)"
                            className="flex-1 bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          />
                          <Button
                            onClick={() => handleAddComment(post.id)}
                            className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-4"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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


      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          <Button
            onClick={() => setShowCreateEvent(true)}
            className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Create Event
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map(event => (
              <EventCard
                key={event.id}
                event={event}
                athleteId={athleteId}
                onRSVP={handleRSVP}
                onEdit={handleOpenEditEvent}
                onDelete={handleDeleteEvent}
                onClick={handleOpenEventDetail}
              />
            ))}
          </div>

          {events.length === 0 && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
              <CardContent className="p-12 text-center">
                <p className="text-gray-400 text-lg">No events yet. Create the first event!</p>
              </CardContent>
            </Card>
          )}
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


      {/* Create Event Modal */}
      {showCreateEvent && (
        <CreateEventModal
          eventData={newEventData}
          setEventData={setNewEventData}
          onClose={() => setShowCreateEvent(false)}
          onCreate={handleCreateEvent}
          myGroups={myGroups}
          onEmojiSelect={(emoji) => setNewEventData({ ...newEventData, description: newEventData.description + emoji })}
        />
      )}

      {/* Edit Event Modal */}
      {showEditEvent && (
        <EditEventModal
          eventData={editEventData}
          setEventData={setEditEventData}
          onClose={() => setShowEditEvent(false)}
          onSave={handleEditEvent}
          myGroups={myGroups}
        />
      )}

      {/* Event Detail Modal */}
      {showEventDetail && (
        <EventDetailModal
          eventData={eventDetailData}
          loading={eventDetailLoading}
          onClose={handleCloseEventDetail}
          athleteId={athleteId}
          loadAthleteProfile={loadAthleteProfile}
          onAddComment={() => handleAddEventComment(eventDetailData?.id)}
          commentText={commentText[eventDetailData?.id] || ''}
          setCommentText={(text) => setCommentText({ ...commentText, [eventDetailData?.id]: text })}
          onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, eventDetailData?.id)}
          formatMentions={formatMentions}
          onDeleteComment={handleDeleteEventComment}
        />
      )}


      {/* Athlete Profile Modal */}
      {showProfile && profileData && (
        <>
          <div className="fixed top-4 right-4 bg-orange-900/90 p-3 rounded text-orange-200 text-sm z-[70]">
            🔍 Profile Modal Open
            <div>Profile ID: {profileData.id}</div>
            <div>Your ID: {athleteId}</div>
            <div>Same person: {profileData.id === athleteId ? 'YES' : 'NO'}</div>
          </div>
          <AthleteProfileModal
            profile={profileData}
            onClose={() => setShowProfile(false)}
            onFollowToggle={handleFollowToggle}
            loading={profileLoading}
            athleteId={athleteId}
            loadAthleteProfile={loadAthleteProfile}
            handleLike={handleToggleLike}
            handleShare={handleSharePost}
          />
        </>
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

      {/* Comments Modal */}
      {showCommentsModal && selectedPostForComments && (
        <CommentsModal
          post={selectedPostForComments}
          onClose={() => {
            setShowCommentsModal(false);
            setSelectedPostForComments(null);
          }}
          onAddComment={() => handleAddComment(selectedPostForComments.id)}
          commentText={commentText[selectedPostForComments.id] || ''}
          setCommentText={(text) => setCommentText({ ...commentText, [selectedPostForComments.id]: text })}
          commentRef={(el) => commentRefs.current[selectedPostForComments.id] = el}
          athleteId={athleteId}
          formatMentions={formatMentions}
          loadAthleteProfile={loadAthleteProfile}
          onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, selectedPostForComments.id)}
          onDeleteComment={handleDeletePostComment}
        />
      )}

      {/* Event Comments Modal */}
      {showCommentsModal && selectedEventForComments && (
        <CommentsModal
          post={selectedEventForComments}
          onClose={() => {
            setShowCommentsModal(false);
            setSelectedEventForComments(null);
          }}
          onAddComment={() => handleAddEventComment(selectedEventForComments.id)}
          commentText={commentText[selectedEventForComments.id] || ''}
          setCommentText={(text) => setCommentText({ ...commentText, [selectedEventForComments.id]: text })}
          commentRef={(el) => commentRefs.current[selectedEventForComments.id] = el}
          athleteId={athleteId}
          formatMentions={formatMentions}
          loadAthleteProfile={loadAthleteProfile}
          onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, selectedEventForComments.id)}
          onDeleteComment={handleDeleteEventComment}
        />
      )}


      {/* Write Post Modal */}
      {showWritePostModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
          onClick={() => setShowWritePostModal(false)}
        >
          <div 
            className="bg-gray-800 rounded-lg max-w-2xl w-full p-6 shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">Create Post</h3>
              <button
                onClick={() => setShowWritePostModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Textarea */}
              <textarea
                value={writePostContent}
                onChange={(e) => setWritePostContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none min-h-[120px] resize-vertical"
              />

              {/* Image Preview - Old single image (kept for backward compatibility) */}
              {writePostImagePreview && (
                <div className="relative">
                  <img
                    src={writePostImagePreview}
                    alt="Preview"
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <button
                    onClick={() => {
                      setWritePostImage(null);
                      setWritePostImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}

              {/* Multiple Images Preview */}
              {selectedImages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-semibold">
                      Selected Images ({selectedImages.length}/5)
                    </span>
                    {isUploadingImages && (
                      <span className="text-[#00C2A8] text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading...
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedImages.map((file, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleRemoveImage(index)}
                          disabled={isUploadingImages}
                          className="absolute top-1 right-1 p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visibility Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 p-4 bg-gray-700 rounded-lg">
                <span className="text-white font-semibold text-sm sm:text-base">Visibility:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setWritePostVisibility('public')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors ${
                      writePostVisibility === 'public'
                        ? 'bg-[#00C2A8] text-white'
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">Public</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setWritePostVisibility('private')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors ${
                      writePostVisibility === 'private'
                        ? 'bg-[#00C2A8] text-white'
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Lock className="w-4 h-4" />
                      <span className="text-sm">Private</span>
                    </div>
                  </button>
                </div>
              </div>

              <p className="text-gray-400 text-sm">
                {writePostVisibility === 'public' 
                  ? '🌍 Public posts appear in everyone\'s main feed'
                  : '🔒 Private posts only appear in your following feed and followers\' feeds'
                }
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-600">
                <div className="flex items-center space-x-2">
                  {/* Multiple images input - allows both camera and gallery selection */}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultipleImagesSelect}
                    className="hidden"
                    id="write-post-multi-images"
                    disabled={isUploadingImages || selectedImages.length >= 5}
                  />
                  <label
                    htmlFor="write-post-multi-images"
                    className={`p-2 rounded-full cursor-pointer transition-colors ${
                      isUploadingImages || selectedImages.length >= 5
                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    title={selectedImages.length >= 5 ? 'Maximum 5 images allowed' : 'Add images (max 5)'}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </label>
                  
                  {/* Show image count on mobile */}
                  {selectedImages.length > 0 && (
                    <span className="text-sm text-white bg-[#00C2A8] px-2 py-1 rounded-full">
                      {selectedImages.length}/5
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => {
                      setShowWritePostModal(false);
                      // Clear multi-image state when closing
                      setSelectedImages([]);
                      setUploadedImageUrls([]);
                    }}
                    className="flex-1 sm:flex-none bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleWritePost}
                    disabled={!writePostContent.trim() || isUploadingImages}
                    className="flex-1 sm:flex-none bg-[#00C2A8] hover:bg-[#00a890] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingImages ? 'Uploading...' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          cancelText={confirmModalConfig.cancelText}
          onConfirm={() => {
            confirmModalConfig.onConfirm();
            setShowConfirmModal(false);
          }}
          onClose={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
};

// PostsList Component
const PostsList = ({ posts, athleteId, editingPost, editContent, editVisibility, showComments, commentText,
  setEditingPost, setEditContent, setEditVisibility, setCommentText, handleEditPost, handleDeletePost,
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
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Post Content with Show More/Less */}
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
                  <span key={`comment-count-${post.id}-${post.comments_count}`}>
                    {console.log(`Rendering comment count for post ${post.id}:`, post.comments_count) || (post.comments_count || 0)}
                  </span>
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
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image based on type
        const compressed = type === 'profile_image' 
          ? await compressThumbnail(file)
          : await compressBannerImage(file);
        setGroupData({ ...groupData, [type]: compressed });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process image');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
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
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image based on type
        const compressed = type === 'profile_image' 
          ? await compressThumbnail(file)
          : await compressBannerImage(file);
        setGroupData({ ...groupData, [type]: compressed });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process image');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
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
const AthleteProfileModal = ({ profile, onClose, onFollowToggle, loading, athleteId, loadAthleteProfile, handleLike, handleShare }) => {
  const [activeTab, setActiveTab] = useState('about'); // 'about' or 'posts'
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  
  // Calculate age from date of birth
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;

  // Load user posts when Posts tab is clicked
  useEffect(() => {
    if (activeTab === 'posts' && profile?.id) {
      loadUserPosts();
    }
  }, [activeTab, profile?.id]);

  const loadUserPosts = async () => {
    if (!profile?.id) return;
    
    setPostsLoading(true);
    try {
      const response = await axios.get(`${API}/community/user/${profile.id}/posts?viewer_athlete_id=${athleteId}&limit=20`);
      console.log('📥 Personal feed API response:', response.data);
      console.log('📊 Posts received:', response.data.posts?.length);
      if (response.data.posts && response.data.posts.length > 0) {
        console.log('📷 First post image_urls:', response.data.posts[0].image_urls);
        console.log('🖼️ First post image_data:', response.data.posts[0].image_data ? 'present' : 'null');
      }
      setUserPosts(response.data.posts || []);
    } catch (error) {
      console.error('Error loading user posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
        {/* Close button - X icon in top-right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-700 rounded-full transition-colors z-10"
          title="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

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
                {age && <p className="text-gray-400 text-sm">{age} years old</p>}
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-2 mb-6 border-b border-gray-700">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'about'
                    ? 'text-[#00C2A8] border-b-2 border-[#00C2A8]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'posts'
                    ? 'text-[#00C2A8] border-b-2 border-[#00C2A8]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Posts ({profile.posts_count || 0})
              </button>
            </div>

            {/* About Tab Content */}
            {activeTab === 'about' && (
              <>
                {/* Bio Section */}
                {profile.bio && (
                  <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">About</h3>
                    <p className="text-gray-300 text-sm">{profile.bio}</p>
                  </div>
                )}

                {/* Interests Section */}
                {profile.interests && profile.interests.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-2">Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-[#00C2A8]/20 text-[#00C2A8] rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.posts_count || 0}</p>
                    <p className="text-gray-400 text-sm">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.followers_count || 0}</p>
                    <p className="text-gray-400 text-sm">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.following_count || 0}</p>
                    <p className="text-gray-400 text-sm">Following</p>
                  </div>
                </div>
              </>
            )}

            {/* Posts Tab Content */}
            {activeTab === 'posts' && (
              <div className="space-y-4">
                {/* Debug Banner */}
                <div className="bg-purple-900/50 p-3 rounded text-purple-200 text-sm">
                  <div>🔍 Personal Feed Debug</div>
                  <div>📊 userPosts.length: {userPosts.length}</div>
                  <div>⏳ postsLoading: {postsLoading ? 'true' : 'false'}</div>
                  {userPosts.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div>First post has image_urls: {userPosts[0]?.image_urls ? 'YES' : 'NO'}</div>
                      <div>First post has image_data: {userPosts[0]?.image_data ? 'YES' : 'NO'}</div>
                    </div>
                  )}
                </div>
                
                {postsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : userPosts.length > 0 ? (
                  userPosts.map(post => (
                    <div key={post.id} className="bg-gray-700/50 rounded-lg p-4">
                      {/* Post Header */}
                      <div className="flex items-center space-x-3 mb-3">
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
                          <p className="text-white font-semibold">{post.athlete_name}</p>
                          <p className="text-gray-400 text-xs">
                            {new Date(post.created_at).toLocaleString()}
                            {post.is_edited && <span className="ml-2">(edited)</span>}
                          </p>
                        </div>
                      </div>

                      {/* Post Content */}
                      <p className="text-white whitespace-pre-wrap mb-3">{formatMentions(post.content)}</p>
                      
                      {/* Display images - support both image_urls and image_data */}
                      <div className="mb-3 bg-blue-900/20 border border-blue-700/50 p-2 rounded text-xs text-blue-200">
                        DEBUG: image_urls={post.image_urls ? `[${post.image_urls.length}]` : 'null'}, 
                        image_data={post.image_data ? 'present' : 'null'}
                      </div>
                      {post.image_urls && post.image_urls.length > 0 ? (
                        <div className="mb-3">
                          <div className="bg-green-900/20 p-2 text-green-200 text-xs mb-2">
                            Rendering ImageCarousel with {post.image_urls.length} images
                          </div>
                          <ImageCarousel images={post.image_urls} alt="Post images" />
                        </div>
                      ) : post.image_data ? (
                        <img 
                          src={post.image_data} 
                          alt="Post" 
                          className="w-full rounded-lg max-h-96 object-cover mb-3" 
                        />
                      ) : (
                        <div className="mb-3 text-gray-400 text-xs">No images to display</div>
                      )}

                      {/* Post Actions */}
                      <div className="flex items-center space-x-6 text-gray-400">
                        <button
                          onClick={() => handleLike(post.id)}
                          className="flex items-center space-x-2 hover:text-red-500 transition-colors"
                        >
                          <Heart className={`w-5 h-5 ${post.liked_by_user ? 'fill-red-500 text-red-500' : ''}`} />
                          <span className="text-sm">{post.likes_count || 0}</span>
                        </button>
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="w-5 h-5" />
                          <span className="text-sm">{post.comments_count || 0}</span>
                        </div>
                        <button
                          onClick={() => handleShare(post.id)}
                          className="flex items-center space-x-2 hover:text-[#00C2A8] transition-colors"
                        >
                          <Share2 className="w-5 h-5" />
                          <span className="text-sm">{post.shares_count || 0}</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-12">No posts yet</p>
                )}
              </div>
            )}
            
            <div className="flex space-x-3 mt-6">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};

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
                <span>{post.likes_count || 0}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <MessageCircle className="w-5 h-5" />
                <span key={`comment-count-${post.id}-${post.comments_count}`}>
                  {console.log(`[Group Posts] Rendering comment count for post ${post.id}:`, post.comments_count) || (post.comments_count || 0)}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Share2 className="w-5 h-5" />
                <span>{post.shares_count || 0}</span>
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
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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


// EventCard Component
const EventCard = ({ event, athleteId, onRSVP, onEdit, onDelete, onClick }) => (
  <Card 
    className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800 cursor-pointer hover:shadow-xl transition-shadow"
    onClick={() => onClick(event.id)}
  >
    <CardContent className="p-6">
      {event.cover_photo && (
        <img src={event.cover_photo} alt={event.name} className="w-full h-32 object-cover rounded-lg mb-4" />
      )}
      
      <div className="flex items-start space-x-3 mb-3">
        {event.profile_image ? (
          <img src={event.profile_image} alt={event.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-xl font-bold text-white truncate">{event.name}</h3>
            {event.creator_id === athleteId && (
              <div className="flex space-x-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(event);
                  }}
                  className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(event.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}
          </div>
          <p className="text-gray-300 text-sm line-clamp-2 mb-2">{event.description}</p>
          
          <div className="space-y-1">
            <div className="flex items-center text-gray-400 text-sm">
              <Clock className="w-4 h-4 mr-2" />
              {new Date(event.event_date).toLocaleDateString()} at {event.event_time}
            </div>
            {event.location && (
              <div className="flex items-center text-gray-400 text-sm">
                <MapPin className="w-4 h-4 mr-2" />
                {event.location}
              </div>
            )}
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-gray-400">{event.interested_count || 0} interested</span>
              <span className="text-gray-400">{event.going_count || 0} going</span>
              <span className="text-gray-400">{event.comments_count || 0} comments</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-2 mt-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRSVP(event.id, event.user_status === 'interested' ? 'not_going' : 'interested');
          }}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            event.user_status === 'interested'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
        >
          <Star className={`w-4 h-4 inline mr-2 ${event.user_status === 'interested' ? 'fill-current' : ''}`} />
          Interested
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRSVP(event.id, event.user_status === 'going' ? 'not_going' : 'going');
          }}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            event.user_status === 'going'
              ? 'bg-[#00C2A8] text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
        >
          I'm Going!
        </button>
      </div>
    </CardContent>
  </Card>
);

// CreateEventModal Component
const CreateEventModal = ({ eventData, setEventData, onClose, onCreate, myGroups, onEmojiSelect }) => {
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image based on type
        const compressed = type === 'profile_image' 
          ? await compressThumbnail(file)
          : await compressBannerImage(file);
        setEventData({ ...eventData, [type]: compressed });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process image');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">Create Event</h2>
        
        <div className="space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Event Icon</label>
            <div className="flex items-center space-x-4">
              {eventData.profile_image ? (
                <img src={eventData.profile_image} alt="Icon" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile_image')} className="hidden" />
                <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm">
                  {eventData.profile_image ? 'Change' : 'Upload'}
                </div>
              </label>
              {eventData.profile_image && (
                <button onClick={() => setEventData({ ...eventData, profile_image: null })} className="p-2 bg-red-500 hover:bg-red-600 rounded-lg">
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Banner */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Banner</label>
            {eventData.cover_photo && (
              <div className="relative mb-2">
                <img src={eventData.cover_photo} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                <button onClick={() => setEventData({ ...eventData, cover_photo: null })} className="absolute top-2 right-2 p-1 bg-red-500 rounded-full">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover_photo')} className="hidden" />
              <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm inline-block">
                {eventData.cover_photo ? 'Change' : 'Upload'}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Event Name</label>
            <input
              type="text"
              value={eventData.name}
              onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
              placeholder="Enter event name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Description</label>
            <div className="relative">
              <textarea
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                placeholder="Describe the event"
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
                rows="3"
              />
              <div className="absolute bottom-2 right-2">
                <EmojiPickerButton onEmojiSelect={onEmojiSelect} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">Date</label>
              <input
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">Time</label>
              <input
                type="time"
                value={eventData.event_time}
                onChange={(e) => setEventData({ ...eventData, event_time: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Location (Optional)</label>
            <input
              type="text"
              value={eventData.location}
              onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
              placeholder="Event location"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Visibility</label>
            <select
              value={eventData.visibility}
              onChange={(e) => setEventData({ ...eventData, visibility: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="open">Open - Appears in main feed</option>
              <option value="private">Private - Only in connected group</option>
            </select>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Connect to Group (Optional)</label>
            <select
              value={eventData.group_id || ''}
              onChange={(e) => setEventData({ ...eventData, group_id: e.target.value || null })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="">No group</option>
              {myGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">If connected, all group members will be notified</p>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <Button onClick={onCreate} className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white">
            Create Event
          </Button>
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

// EditEventModal Component (similar to Create but for editing)
const EditEventModal = ({ eventData, setEventData, onClose, onSave, myGroups }) => {
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image based on type
        const compressed = type === 'profile_image' 
          ? await compressThumbnail(file)
          : await compressBannerImage(file);
        setEventData({ ...eventData, [type]: compressed });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process image');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">Edit Event</h2>
        
        <div className="space-y-4">
          {/* Same fields as CreateEventModal */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Event Icon</label>
            <div className="flex items-center space-x-4">
              {eventData.profile_image ? (
                <img src={eventData.profile_image} alt="Icon" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile_image')} className="hidden" />
                <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm">
                  {eventData.profile_image ? 'Change' : 'Upload'}
                </div>
              </label>
              {eventData.profile_image && (
                <button onClick={() => setEventData({ ...eventData, profile_image: null })} className="p-2 bg-red-500 hover:bg-red-600 rounded-lg">
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Banner</label>
            {eventData.cover_photo && (
              <div className="relative mb-2">
                <img src={eventData.cover_photo} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                <button onClick={() => setEventData({ ...eventData, cover_photo: null })} className="absolute top-2 right-2 p-1 bg-red-500 rounded-full">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover_photo')} className="hidden" />
              <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm inline-block">
                {eventData.cover_photo ? 'Change' : 'Upload'}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Event Name</label>
            <input
              type="text"
              value={eventData.name}
              onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Description</label>
            <textarea
              value={eventData.description}
              onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">Date</label>
              <input
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">Time</label>
              <input
                type="time"
                value={eventData.event_time}
                onChange={(e) => setEventData({ ...eventData, event_time: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Location</label>
            <input
              type="text"
              value={eventData.location}
              onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Visibility</label>
            <select
              value={eventData.visibility}
              onChange={(e) => setEventData({ ...eventData, visibility: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="open">Open</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">Connected Group</label>
            <select
              value={eventData.group_id || ''}
              onChange={(e) => setEventData({ ...eventData, group_id: e.target.value || null })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="">No group</option>
              {myGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <Button onClick={onSave} className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white">
            Save Changes
          </Button>
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

// EventDetailModal Component
const EventDetailModal = ({ eventData, loading, onClose, athleteId, loadAthleteProfile, onAddComment, commentText, setCommentText, onEmojiSelect, formatMentions, onDeleteComment }) => {
  if (loading || !eventData) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
        onClick={onClose}
      >
        <div className="bg-gray-800 rounded-lg p-8 text-white">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00C2A8]"></div>
            <p>Loading event details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
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
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
              )}
              
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{eventData.name}</h2>
                <div className="space-y-1">
                  <div className="flex items-center text-gray-300 text-xs sm:text-sm">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    <span className="break-words">{new Date(eventData.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {eventData.event_time}</span>
                  </div>
                  {eventData.location && (
                    <div className="flex items-center text-gray-300 text-xs sm:text-sm">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      <span className="break-words">{eventData.location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm mt-2">
                    <span className="text-[#00C2A8] font-semibold">{eventData.going_count || 0} Going</span>
                    <span className="text-yellow-400 font-semibold">{eventData.interested_count || 0} Interested</span>
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
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2">About This Event</h3>
            <p className="text-gray-300 text-sm sm:text-base whitespace-pre-wrap">{eventData.description}</p>
          </div>

          {/* Participants Going */}
          {eventData.going_users && eventData.going_users.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Going ({eventData.going_count || 0})</h3>
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
                    {user.athlete_profile_picture ? (
                      <img
                        src={user.athlete_profile_picture}
                        alt={user.athlete_name}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-xs sm:text-sm">
                          {user.athlete_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <span className="text-white font-medium text-sm sm:text-base truncate">{user.athlete_name || 'Unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants Interested */}
          {eventData.interested_users && eventData.interested_users.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Interested ({eventData.interested_count || 0})</h3>
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
                    <span className="text-white font-medium text-sm sm:text-base truncate">{user.athlete_name || 'Unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state if no participants */}
          {(!eventData.going_users || eventData.going_users.length === 0) && 
           (!eventData.interested_users || eventData.interested_users.length === 0) && (
            <div className="text-center py-4 sm:py-6">
              <p className="text-gray-400 text-sm sm:text-base">No participants yet. Be the first to RSVP!</p>
            </div>
          )}


          {/* Comments Section */}
          <div className="border-t border-gray-600 pt-4 sm:pt-6">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Comments ({eventData.comments_count || 0})</h3>
            
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
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">
                            {comment.athlete_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-700 rounded-lg p-2 sm:p-3 relative group">
                      {comment.athlete_id === athleteId && (
                        <button
                          onClick={() => onDeleteComment(eventData.id, comment.id)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete comment"
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
                <p className="text-gray-400 text-center py-3 sm:py-4 text-sm sm:text-base">No comments yet. Be the first to comment!</p>
              )}
            </div>

            {/* Add Comment Input */}
            <div className="flex items-center space-x-2">
              <EmojiPickerButton onEmojiSelect={(emoji) => onEmojiSelect(emoji)} />
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-gray-700 text-white rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                onKeyPress={(e) => e.key === 'Enter' && onAddComment()}
              />
              <Button
                onClick={onAddComment}
                className="bg-[#00C2A8] hover:bg-[#00a890] text-white p-2 sm:px-4 sm:py-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>


          {/* Close Button */}
          <div className="mt-4 sm:mt-6">
            <Button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base py-2 sm:py-3">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// CommentsModal Component
const CommentsModal = ({ post, onClose, onAddComment, commentText, setCommentText, commentRef, athleteId, formatMentions, loadAthleteProfile, onEmojiSelect, onDeleteComment }) => {
  if (!post) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
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
                className="cursor-pointer hover:opacity-80"
                onClick={() => {
                  onClose();
                  loadAthleteProfile(post.athlete_id);
                }}
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
              </div>
              <div>
                <p 
                  className="text-white font-semibold cursor-pointer hover:underline"
                  onClick={() => {
                    onClose();
                    loadAthleteProfile(post.athlete_id);
                  }}
                >
                  {post.athlete_name}
                </p>
                <p className="text-gray-400 text-xs">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-white whitespace-pre-wrap">{formatMentions(post.content)}</p>
            {post.image_data && (
              <img src={post.image_data} alt="Post" className="w-full rounded-lg max-h-64 object-cover mt-3" />
            )}
          </div>

          {/* Comments List */}
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {post.comments && post.comments.length > 0 ? (
              post.comments.map(comment => (
                <div key={comment.id} className="flex items-start space-x-3">
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
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">
                          {comment.athlete_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-gray-600 rounded-lg p-3 relative group">
                    {comment.athlete_id === athleteId && (
                      <button
                        onClick={() => onDeleteComment(post.id, comment.id)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete comment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <p 
                      className="text-white font-semibold text-sm cursor-pointer hover:underline"
                      onClick={() => {
                        onClose();
                        loadAthleteProfile(comment.athlete_id);
                      }}
                    >
                      {comment.athlete_name}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">{formatMentions(comment.content)}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
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
              <EmojiPickerButton onEmojiSelect={(emoji) => onEmojiSelect(emoji)} />
              <input
                ref={commentRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment... (Type @ to mention)"
                className="flex-1 bg-gray-600 text-white rounded-lg px-4 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                onKeyPress={(e) => e.key === 'Enter' && onAddComment()}
              />
              <Button
                onClick={onAddComment}
                className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
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


export default Community;
