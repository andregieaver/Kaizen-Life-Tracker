import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Heart, MessageCircle, Share2, Send, Edit2, Edit3, Trash2, Camera, X, Bell, UserPlus, UserMinus, Users as UsersIcon, Lock, Globe, Crown, Shield, Search, Home, UserCheck, ThumbsUp, ThumbsDown, Calendar, Clock, MapPin, Star, RefreshCw, Video, Image as ImageIcon, GripVertical, Trophy, Target, TrendingUp, Award, PlusCircle, Smile } from 'lucide-react';
import { compressPostImage, compressThumbnail, compressBannerImage } from '../utils/imageCompression';
import { findMentionTrigger, insertMention, formatMentions } from '../utils/mentionUtils';
import EmojiPickerButton from './EmojiPickerButton';
import ConfirmationModal from './ConfirmationModal';
import ImageCarousel from './ImageCarousel';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import SubscriptionBadge from './SubscriptionBadge';
import FlagIcon from './FlagIcon';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Community = ({ athleteId, athlete, showNotifications: externalShowNotifications, setShowNotifications: externalSetShowNotifications, setCommunityUnreadCount: externalSetCommunityUnreadCount }) => {
  const { t } = useTranslation();
  
  // Check if current user is super admin
  const isSuperAdmin = athlete?.is_super_admin || false;
  
  // Initialize activeTab from localStorage or default to 'feed'
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('communityActiveTab');
    return (savedTab && ['feed', 'following', 'groups', 'mygroups', 'events', 'challenges'].includes(savedTab)) ? savedTab : 'feed';
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
  // Multi-media support (images + videos)
  const [selectedMedia, setSelectedMedia] = useState([]); // Array of media objects: {type, file, preview, url, thumbnail}
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [editMedia, setEditMedia] = useState([]); // Media being edited
  const [isUploadingEditMedia, setIsUploadingEditMedia] = useState(false);
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
  const [showNotifications, setShowNotifications] = useState(externalShowNotifications !== undefined ? externalShowNotifications : false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Use external controls if provided
  const effectiveShowNotifications = externalShowNotifications !== undefined ? externalShowNotifications : showNotifications;
  const effectiveSetShowNotifications = externalSetShowNotifications || setShowNotifications;
  
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
  const [showWritePostEmojiPicker, setShowWritePostEmojiPicker] = useState(false);
  const writePostTextareaRef = useRef(null);
  const [youtubePreview, setYoutubePreview] = useState(null);
  const [urlPreview, setUrlPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  
  // Share post modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePostData, setSharePostData] = useState(null);
  const [shareCommentary, setShareCommentary] = useState('');
  const shareTextareaRef = useRef(null);
  
  // Full-size image modal state
  const [showFullSizeImage, setShowFullSizeImage] = useState(false);
  const [fullSizeImageUrl, setFullSizeImageUrl] = useState('');
  
  // Nationality filter state (persisted in localStorage)
  const [nationalityFilter, setNationalityFilter] = useState(() => {
    return localStorage.getItem('communityNationalityFilter') || 'all';
  });
  
  // Athletes modal state
  const [showAthletes, setShowAthletes] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [athletesSearch, setAthletesSearch] = useState('');
  const [athletesLoading, setAthletesLoading] = useState(false);
  
  // Scroll animation state for FAB
  const [scrollDirection, setScrollDirection] = useState('none');
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Groups state
  const [groups, setGroups] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [myGroupsLoaded, setMyGroupsLoaded] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupPosts, setGroupPosts] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
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

  // Challenges state
  const [challenges, setChallenges] = useState([]);
  const [challengesLoaded, setChallengesLoaded] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState('all'); // all, active, completed, joined
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showChallengeDetail, setShowChallengeDetail] = useState(false);
  const [challengeDetailData, setChallengeDetailData] = useState(null);
  const [challengeDetailLoading, setChallengeDetailLoading] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [newChallengeData, setNewChallengeData] = useState({
    title: '',
    description: '',
    challenge_type: 'distance',
    goal_value: '',
    goal_unit: 'km',
    time_period: 'total', // 'total', 'daily', 'weekly', 'monthly'
    start_date: '',
    end_date: '',
    visibility: 'public',
    competition_type: 'individual',
    cover_photo: null,
    trophy_image: null,
    is_recurring: false,
    recurrence_frequency: 'weekly',
    recurrence_count: 4
  });
  const [showEditChallenge, setShowEditChallenge] = useState(false);
  const [editChallengeData, setEditChallengeData] = useState({
    id: '',
    title: '',
    description: '',
    cover_photo: null,
    trophy_image: null,
    end_date: '',
    visibility: 'public',
    goal_value: ''
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
    } else if (activeTab === 'challenges' && !challengesLoaded) {
      loadChallenges(challengeFilter);
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

  // Scroll animation effect for FAB
  useEffect(() => {
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;

      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }

      if (scrollY > lastScrollY && scrollY > 80) {
        // Scrolling down - hide FAB
        setScrollDirection('down');
      } else if (scrollY < lastScrollY) {
        // Scrolling up - show FAB
        setScrollDirection('up');
      }

      setLastScrollY(scrollY > 0 ? scrollY : 0);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, [lastScrollY]);

  // Listen for profile picture updates and refresh posts/comments
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const { athleteId: updatedAthleteId, profilePictureUpdated } = event.detail;
      
      // If profile picture was updated and it's the current user, reload community data
      if (profilePictureUpdated && updatedAthleteId === athleteId) {
        console.log('[Community] Profile picture updated, refreshing community data...');
        
        // Reload posts to show updated profile pictures
        if (activeTab === 'feed' && postsLoaded) {
          loadPosts(true); // Force reload
        } else if (activeTab === 'following' && followingPostsLoaded) {
          loadFollowingPosts();
        }
        
        // Reload groups if user is on groups tab
        if (activeTab === 'groups' && groupsLoaded) {
          loadAllGroups();
        } else if (activeTab === 'mygroups' && myGroupsLoaded) {
          loadMyGroups();
        }
        
        // Reload events if user is on events tab
        if (activeTab === 'events' && eventsLoaded) {
          loadEvents();
        }
        
        // Reload challenges if user is on challenges tab
        if (activeTab === 'challenges' && challengesLoaded) {
          loadChallenges(challengeFilter);
        }
        
        // If viewing a specific group, reload group posts
        if (selectedGroup) {
          loadGroupDetails(selectedGroup.id);
        }
        
        // If viewing a specific challenge, reload challenge details
        if (selectedChallenge) {
          loadChallengeDetails(selectedChallenge.id);
        }
      }
    };

    window.addEventListener('athleteProfileUpdated', handleProfileUpdate);

    return () => window.removeEventListener('athleteProfileUpdated', handleProfileUpdate);
  }, [athleteId, activeTab, postsLoaded, followingPostsLoaded, groupsLoaded, myGroupsLoaded, eventsLoaded, challengesLoaded, challengeFilter, selectedGroup, selectedChallenge]);

  // Prevent body scroll when notifications modal is open on mobile
  useEffect(() => {
    if (effectiveShowNotifications && window.innerWidth < 768) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Prevent scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [effectiveShowNotifications]);

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

  // Handle nationality filter change
  const handleNationalityFilterChange = (value) => {
    setNationalityFilter(value);
    localStorage.setItem('communityNationalityFilter', value);
  };

  // Get filtered posts based on nationality
  const getFilteredPosts = (postsArray) => {
    if (nationalityFilter === 'all') {
      return postsArray;
    }
    return postsArray.filter(post => post.nationality === nationalityFilter);
  };

  // Get unique nationalities from posts for filter dropdown
  const getUniqueNationalities = () => {
    const allPosts = activeTab === 'feed' ? posts : followingPosts;
    const nationalities = allPosts
      .map(post => post.nationality)
      .filter(n => n) // Remove null/undefined
      .filter((n, i, arr) => arr.indexOf(n) === i); // Unique values
    return nationalities.sort();
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
      const count = response.data.notifications.filter(n => !n.read).length;
      setUnreadCount(count);
      if (externalSetCommunityUnreadCount) {
        externalSetCommunityUnreadCount(count);
      }
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
      alert(t('community.messages.failedToLoadProfile'));
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
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  // Handle mixed media selection (images + videos)
  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Max 5 media items total (images + videos), but max 1 video
    const currentVideoCount = selectedMedia.filter(m => m.type === 'video').length;
    const newVideos = files.filter(f => f.type.startsWith('video/'));
    
    if (currentVideoCount > 0 && newVideos.length > 0) {
      alert(t('community.messages.oneVideoPerPost'));
      return;
    }
    
    if (newVideos.length > 1) {
      alert(t('community.messages.oneVideoPerPost'));
      return;
    }

    const currentCount = selectedMedia.length;
    const newCount = currentCount + files.length;

    if (newCount > 5) {
      alert(t('community.messages.maxMediaItems', { count: currentCount }));
      return;
    }

    setIsUploadingMedia(true);

    try {
      const newMedia = [];

      for (const file of files) {
        const mediaItem = {
          id: `temp-${Date.now()}-${Math.random()}`,
          file: file,
          preview: URL.createObjectURL(file),
          url: null,
          thumbnail: null,
          uploading: true
        };

        if (file.type.startsWith('video/')) {
          mediaItem.type = 'video';
          
          // Upload video
          const formData = new FormData();
          formData.append('file', file);

          const response = await axios.post(`${API}/upload/video`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          mediaItem.url = response.data.video_url;
          mediaItem.thumbnail = response.data.thumbnail_url;
          mediaItem.uploading = false;
        } else if (file.type.startsWith('image/')) {
          mediaItem.type = 'image';
          
          // Upload image
          const formData = new FormData();
          formData.append('files', file);

          const response = await axios.post(`${API}/upload/images?max_files=1`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          mediaItem.url = response.data.urls[0];
          mediaItem.uploading = false;
        } else {
          continue; // Skip unsupported files
        }

        newMedia.push(mediaItem);
      }

      setSelectedMedia(prev => [...prev, ...newMedia]);
    } catch (error) {
      console.error('Error uploading media:', error);
      alert(`Failed to upload media: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Remove media from selection
  const handleRemoveMedia = (index) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  // Handle drag end for reordering (HTML5)
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const items = Array.from(selectedMedia);
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(dropIndex, 0, draggedItem);

    setSelectedMedia(items);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Edit media handlers
  const handleEditMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const currentVideoCount = editMedia.filter(m => m.type === 'video').length;
    const newVideos = files.filter(f => f.type.startsWith('video/'));
    
    if (currentVideoCount > 0 && newVideos.length > 0) {
      alert('You can only have 1 video per post');
      return;
    }
    
    if (newVideos.length > 1) {
      alert(t('community.messages.oneVideoPerPost'));
      return;
    }

    const currentCount = editMedia.length;
    const newCount = currentCount + files.length;

    if (newCount > 5) {
      alert(`Maximum 5 media items. You currently have ${currentCount}.`);
      return;
    }

    setIsUploadingEditMedia(true);

    try {
      const newMedia = [];

      for (const file of files) {
        const mediaItem = {
          id: `temp-${Date.now()}-${Math.random()}`,
          file: file,
          preview: URL.createObjectURL(file),
          url: null,
          thumbnail: null,
          uploading: true
        };

        if (file.type.startsWith('video/')) {
          mediaItem.type = 'video';
          const formData = new FormData();
          formData.append('file', file);
          const response = await axios.post(`${API}/upload/video`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          mediaItem.url = response.data.video_url;
          mediaItem.thumbnail = response.data.thumbnail_url;
          mediaItem.uploading = false;
        } else if (file.type.startsWith('image/')) {
          mediaItem.type = 'image';
          const formData = new FormData();
          formData.append('files', file);
          const response = await axios.post(`${API}/upload/images?max_files=1`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          mediaItem.url = response.data.urls[0];
          mediaItem.uploading = false;
        } else {
          continue;
        }

        newMedia.push(mediaItem);
      }

      setEditMedia(prev => [...prev, ...newMedia]);
    } catch (error) {
      console.error('Error uploading edit media:', error);
      alert(`Failed to upload: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsUploadingEditMedia(false);
    }
  };

  const handleRemoveEditMedia = (index) => {
    setEditMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditMediaDragEnd = (result) => {
    if (draggedIndex === null || draggedIndex === result) return;
    const items = Array.from(editMedia);
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(result, 0, draggedItem);
    setEditMedia(items);
    setDraggedIndex(null);
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

  const handleEmojiSelectForWritePost = (emoji) => {
    // Insert emoji at cursor position
    const textarea = writePostTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = writePostContent;
      const before = text.substring(0, start);
      const after = text.substring(end);
      setWritePostContent(before + emoji + after);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setWritePostContent(prev => prev + emoji);
    }
    setShowWritePostEmojiPicker(false);
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
      // Build media array from selectedMedia
      const media = selectedMedia.map(item => ({
        type: item.type,
        url: item.url,
        thumbnail: item.thumbnail
      }));

      const postData = {
        content: newPostContent,
        image_data: newPostImage,
        media: media.length > 0 ? media : [],
        // Keep image_urls for backward compatibility
        image_urls: selectedMedia.filter(m => m.type === 'image').map(m => m.url)
      };

      await axios.post(`${API}/community/posts?athlete_id=${athleteId}`, postData);
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePreview(null);
      // Clear media state
      setSelectedMedia([]);
      setPostsLoaded(false); // Reset cache to reload posts
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

  // Detect URLs in text and fetch previews
  const detectAndFetchPreviews = async (text) => {
    if (!text || fetchingPreview) return;
    
    // YouTube URL regex
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/i;
    const youtubeMatch = text.match(youtubeRegex);
    
    // General URL regex (not YouTube)
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = text.match(urlRegex);
    
    try {
      setFetchingPreview(true);
      let urlToRemove = null;
      
      // Fetch YouTube preview
      if (youtubeMatch && !youtubePreview) {
        try {
          const response = await axios.post(`${API}/community/fetch-youtube-metadata`, {
            url: youtubeMatch[0]
          });
          setYoutubePreview(response.data);
          urlToRemove = youtubeMatch[0];
        } catch (error) {
          console.error('Error fetching YouTube metadata:', error);
        }
      }
      
      // Fetch URL preview (first non-YouTube URL)
      if (urls && !urlPreview && !urlToRemove) {
        const nonYoutubeUrl = urls.find(url => !url.match(youtubeRegex));
        if (nonYoutubeUrl) {
          try {
            const response = await axios.post(`${API}/community/fetch-url-preview`, {
              url: nonYoutubeUrl
            });
            setUrlPreview(response.data);
            urlToRemove = nonYoutubeUrl;
          } catch (error) {
            console.error('Error fetching URL preview:', error);
          }
        }
      }
      
      // Remove the URL from content after successful preview fetch
      if (urlToRemove) {
        const newContent = text.replace(urlToRemove, '').trim();
        setWritePostContent(newContent);
      }
    } finally {
      setFetchingPreview(false);
    }
  };

  // Handle content change with URL detection
  const handleWritePostContentChange = (e) => {
    const newContent = e.target.value;
    setWritePostContent(newContent);
    
    // Debounce URL detection
    if (window.urlDetectionTimeout) {
      clearTimeout(window.urlDetectionTimeout);
    }
    
    window.urlDetectionTimeout = setTimeout(() => {
      detectAndFetchPreviews(newContent);
    }, 1000);
  };

  const handleWritePost = async () => {
    if (!writePostContent.trim()) return;

    try {
      // Build media array from selectedMedia
      const media = selectedMedia.map(item => ({
        type: item.type,
        url: item.url,
        thumbnail: item.thumbnail
      }));

      const postData = {
        content: writePostContent,
        image_data: writePostImage,
        visibility: writePostVisibility,
        media: media.length > 0 ? media : [],
        // Keep image_urls for backward compatibility
        image_urls: selectedMedia.filter(m => m.type === 'image').map(m => m.url),
        youtube_data: youtubePreview,
        url_preview: urlPreview
      };

      const response = await axios.post(`${API}/community/posts?athlete_id=${athleteId}`, postData);
      
      // Clear modal state
      setWritePostContent('');
      setWritePostImage(null);
      setWritePostImagePreview(null);
      setWritePostVisibility('public');
      setShowWritePostModal(false);
      // Clear media state
      setSelectedMedia([]);
      // Clear preview states
      setYoutubePreview(null);
      setUrlPreview(null);
      
      // Reload appropriate feed
      if (activeTab === 'feed') {
        setPostsLoaded(false);
        loadPosts();
      } else if (activeTab === 'following') {
        setFollowingPostsLoaded(false);
        loadFollowingPosts();
      }
    } catch (error) {
      console.error('Error creating post:', error);
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
      // Build media array from editMedia
      const media = editMedia.map(item => ({
        type: item.type,
        url: item.url,
        thumbnail: item.thumbnail
      }));

      const postData = {
        content: editContent,
        visibility: editVisibility,
        media: media.length > 0 ? media : [],
        image_urls: editMedia.filter(m => m.type === 'image').map(m => m.url)
      };

      await axios.put(`${API}/community/posts/${postId}?athlete_id=${athleteId}`, postData);
      setEditingPost(null);
      setEditContent('');
      setEditVisibility('public');
      setEditMedia([]);
      
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

  const handleSharePost = (post) => {
    // Open share modal with post data
    setSharePostData(post);
    setShareCommentary('');
    setShowShareModal(true);
  };
  
  const submitSharePost = async () => {
    if (!sharePostData) return;
    
    try {
      const response = await axios.post(
        `${API}/community/posts/${sharePostData.id}/share?athlete_id=${athleteId}`,
        { content: shareCommentary.trim() }
      );
      
      // Update shares_count in feeds
      setPosts(posts.map(post => 
        post.id === sharePostData.id 
          ? { ...post, shares_count: response.data.shares_count }
          : post
      ));
      
      setFollowingPosts(followingPosts.map(post => 
        post.id === sharePostData.id 
          ? { ...post, shares_count: response.data.shares_count }
          : post
      ));
      
      // Close modal
      setShowShareModal(false);
      setSharePostData(null);
      setShareCommentary('');
      
      // Reload feeds to show the new shared post
      if (activeTab === 'feed') {
        setPostsLoaded(false);
        loadPosts(true);
      } else if (activeTab === 'following') {
        setFollowingPostsLoaded(false);
        loadFollowingPosts();
      }
      
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
        const response = await axios.get(`${API}/community/posts/${postId}/comments?athlete_id=${athleteId}`);
        
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

  const handleToggleCommentLike = async (commentId, postId) => {
    try {
      const response = await axios.post(`${API}/community/comments/${commentId}/like?athlete_id=${athleteId}`);
      
      // Update comments in both feeds
      const updateComments = (comments) => 
        comments.map(comment => 
          comment.id === commentId
            ? { ...comment, liked_by_user: response.data.liked, likes_count: response.data.likes_count }
            : comment
        );
      
      // Update main feed posts
      setPosts(currentPosts => currentPosts.map(p => 
        p.id === postId && p.comments
          ? { ...p, comments: updateComments(p.comments) }
          : p
      ));
      
      // Update following feed posts
      setFollowingPosts(currentPosts => currentPosts.map(p => 
        p.id === postId && p.comments
          ? { ...p, comments: updateComments(p.comments) }
          : p
      ));
      
      // Update selected post if in modal
      if (selectedPostForComments && selectedPostForComments.id === postId) {
        setSelectedPostForComments(prev => ({
          ...prev,
          comments: updateComments(prev.comments)
        }));
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      alert('Failed to like/unlike comment. Please try again.');
    }
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
    effectiveSetShowNotifications(false);
    
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

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API}/community/groups/${groupId}?athlete_id=${athleteId}`);
      
      // If we're viewing the group details, go back to groups list
      if (selectedGroup && selectedGroup.id === groupId) {
        setSelectedGroup(null);
      }
      
      // Reload groups list
      loadGroups();
      loadMyGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      if (error.response?.status === 403) {
        alert('Only group admins and super admins can delete groups');
      } else {
        alert(error.response?.data?.detail || 'Failed to delete group');
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

  // ============================================================================
  // CHALLENGES FUNCTIONS
  // ============================================================================

  const loadChallenges = async (filter = 'all') => {
    try {
      const response = await axios.get(`${API}/community/challenges?athlete_id=${athleteId}&filter_type=${filter}&limit=20`);
      setChallenges(response.data.challenges);
      setChallengesLoaded(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading challenges:', error);
      setIsLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    console.log('🔍 DEBUG: handleCreateChallenge called');
    console.log('🔍 DEBUG: athleteId:', athleteId);
    console.log('🔍 DEBUG: newChallengeData:', JSON.stringify(newChallengeData, null, 2));
    
    if (!newChallengeData.title.trim()) {
      alert('Challenge title is required');
      return;
    }
    if (!newChallengeData.goal_value || parseFloat(newChallengeData.goal_value) <= 0) {
      alert('Goal value must be greater than 0');
      return;
    }
    if (!newChallengeData.start_date || !newChallengeData.end_date) {
      alert('Start and end dates are required');
      return;
    }

    console.log('🔍 DEBUG: Validation passed, sending request to:', `${API}/community/challenges?athlete_id=${athleteId}`);
    console.log('🔍 DEBUG: Request payload:', newChallengeData);

    try {
      const response = await axios.post(`${API}/community/challenges?athlete_id=${athleteId}`, newChallengeData);
      console.log('✅ DEBUG: Challenge created successfully:', response.data);
      setShowCreateChallenge(false);
      setNewChallengeData({
        title: '', description: '', challenge_type: 'distance', goal_value: '', goal_unit: 'km',
        start_date: '', end_date: '', visibility: 'public', competition_type: 'individual',
        cover_photo: null, trophy_image: null, is_recurring: false, recurrence_frequency: 'weekly', recurrence_count: 4
      });
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
    } catch (error) {
      console.error('❌ DEBUG: Error creating challenge:', error);
      console.error('❌ DEBUG: Error response:', error.response?.data);
      console.error('❌ DEBUG: Error status:', error.response?.status);
      console.error('❌ DEBUG: Error headers:', error.response?.headers);
      alert(`Failed to create challenge: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleOpenEditChallenge = (challenge) => {
    setEditChallengeData({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      cover_photo: challenge.cover_photo,
      trophy_image: challenge.trophy_image,
      end_date: challenge.end_date,
      visibility: challenge.visibility,
      goal_value: challenge.goal_value
    });
    setShowEditChallenge(true);
  };

  const handleEditChallenge = async () => {
    try {
      await axios.put(`${API}/community/challenges/${editChallengeData.id}?athlete_id=${athleteId}`, editChallengeData);
      setShowEditChallenge(false);
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
      if (showChallengeDetail && challengeDetailData?.id === editChallengeData.id) {
        handleOpenChallengeDetail(editChallengeData.id);
      }
    } catch (error) {
      console.error('Error editing challenge:', error);
      alert('Failed to edit challenge');
    }
  };

  const handleJoinChallenge = async (challengeId) => {
    console.log('🔍 DEBUG: Joining challenge:', challengeId);
    console.log('🔍 DEBUG: AthleteId:', athleteId);
    try {
      const response = await axios.post(`${API}/community/challenges/${challengeId}/join?athlete_id=${athleteId}`);
      console.log('✅ DEBUG: Successfully joined challenge:', response.data);
      alert('Successfully joined challenge!');
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
      if (showChallengeDetail && challengeDetailData?.id === challengeId) {
        handleOpenChallengeDetail(challengeId);
      }
    } catch (error) {
      console.error('❌ DEBUG: Error joining challenge:', error);
      console.error('❌ DEBUG: Error response:', error.response?.data);
      alert(error.response?.data?.detail || 'Failed to join challenge');
    }
  };

  const handleLeaveChallenge = async (challengeId) => {
    if (!window.confirm('Are you sure you want to leave this challenge?')) return;

    console.log('🔍 DEBUG: Leaving challenge:', challengeId);
    console.log('🔍 DEBUG: AthleteId:', athleteId);
    try {
      const response = await axios.post(`${API}/community/challenges/${challengeId}/leave?athlete_id=${athleteId}`);
      console.log('✅ DEBUG: Successfully left challenge:', response.data);
      alert('Successfully left challenge!');
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
      if (showChallengeDetail && challengeDetailData?.id === challengeId) {
        handleOpenChallengeDetail(challengeId);
      }
    } catch (error) {
      console.error('❌ DEBUG: Error leaving challenge:', error);
      console.error('❌ DEBUG: Error response:', error.response?.data);
      alert('Failed to leave challenge');
    }
  };

  const handleDeleteChallenge = async (challengeId) => {
    if (!window.confirm('Are you sure you want to delete this challenge?')) return;

    try {
      await axios.delete(`${API}/community/challenges/${challengeId}?athlete_id=${athleteId}`);
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
      setShowChallengeDetail(false);
    } catch (error) {
      console.error('Error deleting challenge:', error);
      alert('Failed to delete challenge');
    }
  };

  const handleOpenChallengeDetail = async (challengeId) => {
    setChallengeDetailLoading(true);
    setShowChallengeDetail(true);
    try {
      const response = await axios.get(`${API}/community/challenges/${challengeId}?athlete_id=${athleteId}`);
      
      // Load comments for the challenge
      try {
        const commentsResponse = await axios.get(`${API}/community/challenges/${challengeId}/comments`);
        response.data.comments = commentsResponse.data.comments;
      } catch (commentError) {
        console.error('Error loading challenge comments:', commentError);
        response.data.comments = [];
      }
      
      setChallengeDetailData(response.data);
    } catch (error) {
      console.error('Error loading challenge details:', error);
      alert('Failed to load challenge details');
      setShowChallengeDetail(false);
    } finally {
      setChallengeDetailLoading(false);
    }
  };

  const handleAddChallengeComment = async (challengeId, content) => {
    if (!content.trim()) return;

    try {
      await axios.post(`${API}/community/challenges/${challengeId}/comments?athlete_id=${athleteId}`, {
        content: content.trim()
      });
      // Reload challenge details to show new comment
      handleOpenChallengeDetail(challengeId);
    } catch (error) {
      console.error('Error adding challenge comment:', error);
      alert('Failed to add comment');
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
      className="min-h-screen max-w-5xl mx-auto space-y-0 sm:space-y-6 p-2 md:p-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with Tabs and Notifications */}
      <div className={`fixed top-16 left-0 right-0 z-30 md:relative md:top-auto space-y-0 sm:space-y-3 mb-0 sm:mb-6 transition-all duration-300 ease-in-out ${
        scrollDirection === 'down' ? '-translate-y-[calc(100%+4rem)]' : 'translate-y-0'
      } md:translate-y-0`}>
        {/* Main Navigation Tabs - Full width with no gaps on mobile */}
        <div className="flex justify-between w-full gap-0 sm:gap-2 p-0 md:p-2">
          <button
            onClick={() => {
              setActiveTab('feed');
              setSelectedGroup(null);
            }}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className={`flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all ${
              activeTab === 'feed'
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
            {...(activeTab === 'feed' && { style: { ...{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }, background: 'var(--grad-surface)' } })}
            title={t('community.tabs.feed')}
          >
            <Home className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
          <button
            onClick={() => {
              setActiveTab('following');
              setSelectedGroup(null);
            }}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className={`flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all ${
              activeTab === 'following'
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
            {...(activeTab === 'following' && { style: { ...{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }, background: 'var(--grad-surface)' } })}
            title={t('community.tabs.following')}
          >
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
          <button
            onClick={() => {
              setActiveTab('groups');
              setSelectedGroup(null);
            }}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className={`flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all ${
              activeTab === 'groups'
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
            {...(activeTab === 'groups' && { style: { ...{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }, background: 'var(--grad-surface)' } })}
            title={t('community.tabs.allGroups')}
          >
            <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
          <button
            onClick={() => {
              setActiveTab('mygroups');
              setSelectedGroup(null);
            }}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className={`flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all ${
              activeTab === 'mygroups'
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
            {...(activeTab === 'mygroups' && { style: { ...{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }, background: 'var(--grad-surface)' } })}
            title={t('community.tabs.myGroups')}
          >
            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
          <button
            onClick={() => {
              setActiveTab('events');
              setSelectedGroup(null);
            }}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className={`flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all ${
              activeTab === 'events'
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
            {...(activeTab === 'events' && { style: { ...{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }, background: 'var(--grad-surface)' } })}
            title={t('community.tabs.events')}
          >
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
          <button
            onClick={() => {
              setActiveTab('challenges');
              setSelectedGroup(null);
            }}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className={`flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all ${
              activeTab === 'challenges'
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
            {...(activeTab === 'challenges' && { style: { ...{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }, background: 'var(--grad-surface)' } })}
            title={t('community.tabs.challenges')}
          >
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
          <button
            onClick={handleOpenAthletes}
            style={{ paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
            className="flex-1 px-2 sm:px-3 rounded-none md:rounded-2xl transition-all text-gray-400 hover:bg-gray-700/50 hover:text-white"
            title={t('community.tabs.findAthletes')}
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
          </button>
        </div>
      </div>

      {/* Feed Tab */}
      {activeTab === 'feed' && !selectedGroup && (
        <>
          {/* Nationality Filter */}
          <div className="mb-4 pt-12 md:pt-0">
            <div className="flex items-center space-x-3 bg-gray-800 p-3 rounded-none sm:rounded-lg">
              <label className="text-white text-sm font-semibold whitespace-nowrap">{t('community.post.filterByNationality')}:</label>
              <select
                value={nationalityFilter}
                onChange={(e) => handleNationalityFilterChange(e.target.value)}
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
                <div className="p-4" className="p-12 text-center">
                  <p className="text-gray-400 text-lg mb-2">{t('community.emptyStates.noPostsYet')}</p>
                  <p className="text-gray-500 text-sm">{t('community.emptyStates.beFirstToShare')}</p>
                </div>
              </div>
            ) : (
              getFilteredPosts(posts).map(item => {
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
                  <div key={post.id} className="border-0 border-b border-b-gray-700 sm:border-b-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl mx-0 sm:mx-auto" style={{ background: 'var(--grad-surface)' }}>
                    <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }} className="pb-3 px-3 pt-3 sm:px-6 sm:pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
                          onClick={() => loadAthleteProfile(post.athlete_id)}
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
                                // Load existing media for editing
                                if (post.media && post.media.length > 0) {
                                  setEditMedia(post.media.map((m, i) => ({
                                    id: `existing-${i}`,
                                    type: m.type,
                                    url: m.url,
                                    thumbnail: m.thumbnail,
                                    preview: m.type === 'video' ? m.thumbnail : m.url,
                                    uploading: false
                                  })));
                                } else if (post.image_urls && post.image_urls.length > 0) {
                                  setEditMedia(post.image_urls.map((url, i) => ({
                                    id: `existing-img-${i}`,
                                    type: 'image',
                                    url: url,
                                    preview: url,
                                    uploading: false
                                  })));
                                } else {
                                  setEditMedia([]);
                                }
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

                    <div className="p-4" className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                      {editingPost === post.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-gray-600 text-white rounded-lg p-3 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
                            rows="3"
                          />
                          
                          {/* Edit Media Preview with Drag-and-Drop */}
                          {editMedia.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-white text-sm font-semibold">
                                  Media ({editMedia.length}/5)
                                </span>
                                {isUploadingEditMedia && (
                                  <span className="text-[#00C2A8] text-sm flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Uploading...
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {editMedia.map((item, index) => (
                                  <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      if (draggedIndex === null || draggedIndex === index) return;
                                      const items = Array.from(editMedia);
                                      const [draggedItem] = items.splice(draggedIndex, 1);
                                      items.splice(index, 0, draggedItem);
                                      setEditMedia(items);
                                      setDraggedIndex(null);
                                    }}
                                    onDragEnd={handleDragEnd}
                                    className={`relative aspect-square cursor-move ${draggedIndex === index ? 'opacity-50' : ''}`}
                                  >
                                    <div className="absolute top-1 left-1 p-1 bg-black/70 rounded-full z-10">
                                      <GripVertical className="w-4 h-4 text-white" />
                                    </div>

                                    {item.type === 'video' ? (
                                      <div className="relative w-full h-full">
                                        <video src={item.preview} className="w-full h-full object-cover rounded-lg" muted />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                                          <Video className="w-8 h-8 text-white" />
                                        </div>
                                      </div>
                                    ) : (
                                      <img src={item.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                                    )}

                                    <button
                                      onClick={() => handleRemoveEditMedia(index)}
                                      disabled={isUploadingEditMedia || item.uploading}
                                      className="absolute top-1 right-1 p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors disabled:opacity-50 z-10"
                                    >
                                      <X className="w-4 h-4 text-white" />
                                    </button>

                                    {item.uploading && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                        <RefreshCw className="w-6 h-6 text-white animate-spin" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Add Media Button */}
                          {editMedia.length < 5 && (
                            <div>
                              <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                onChange={handleEditMediaSelect}
                                className="hidden"
                                id={`edit-media-${post.id}`}
                                disabled={isUploadingEditMedia || editMedia.length >= 5}
                              />
                              <label
                                htmlFor={`edit-media-${post.id}`}
                                className="inline-flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors text-white text-sm"
                              >
                                <Camera className="w-4 h-4" />
                                <span>Add Media</span>
                              </label>
                            </div>
                          )}
                          
                          {/* Visibility Toggle in Edit Mode */}
                          <div className="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
                            <span className="text-white text-sm font-semibold">{t('community.post.visibility')}:</span>
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
                                setEditMedia([]);
                              }}
                              className="bg-gray-600 hover:bg-gray-500 text-white"
                            >
                              {t('common.cancel')}
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
                          
                          {/* Display media (images and videos) */}
                          {(() => {
                            console.log('🔍 Post media check:', {
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
                        </>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-600 -mx-3 sm:mx-0">
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
                          onClick={() => handleSharePost(post)}
                          className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-[#00C2A8] transition-colors"
                        >
                          <Share2 className="w-5 h-5" />
                          <span className="text-sm">{post.shares_count || 0}</span>
                        </button>
                      </div>

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
                                onChange={(e) => handleCommentContentChange(post.id, e)}
                                placeholder={t('community.post.writeCommentMention')}
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
                    </div>
                  </div>
                );
              }
            }))}
          </div>
        </>
      )}


      {/* Following Feed Tab */}
      {activeTab === 'following' && !selectedGroup && (
        <>
          {/* Nationality Filter */}
          <div className="mb-4 pt-12 md:pt-0">
            <div className="flex items-center space-x-3 bg-gray-800 p-3 rounded-none sm:rounded-lg">
              <label className="text-white text-sm font-semibold whitespace-nowrap">{t('community.post.filterByNationality')}:</label>
              <select
                value={nationalityFilter}
                onChange={(e) => handleNationalityFilterChange(e.target.value)}
                className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none text-sm"
              >
                <option value="all">{t('community.post.allNationalities')}</option>
                {getUniqueNationalities().map(nationality => (
                  <option key={nationality} value={nationality}>{nationality}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Posts from people you follow */}
          <div className="space-y-0 sm:space-y-6">
            {isLoading ? (
              <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800 rounded-none sm:rounded-lg" style={{ background: 'var(--grad-surface)' }}>
                <div className="p-4" className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-400 mt-4">{t('community.emptyStates.loadingPosts')}</p>
                </div>
              </div>
            ) : followingPosts.length === 0 ? (
              <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800 rounded-none sm:rounded-lg" style={{ background: 'var(--grad-surface)' }}>
                <div className="p-4" className="p-12 text-center">
                  <p className="text-gray-400 text-lg mb-2">{t('community.emptyStates.noFollowingPosts')}</p>
                  <p className="text-gray-500 text-sm">{t('community.emptyStates.followOthers')}</p>
                </div>
              </div>
            ) : (
              getFilteredPosts(followingPosts).map(post => (
                <div key={post.id} className="border-0 border-b border-b-gray-700 sm:border-b-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl mx-0 sm:mx-auto" style={{ background: 'var(--grad-surface)' }}>
                  <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }} className="pb-3 px-3 pt-3 sm:px-6 sm:pt-6">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
                        onClick={() => loadAthleteProfile(post.athlete_id)}
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
                      
                      {/* Edit/Delete buttons for own posts or super admin */}
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
                  <div className="p-4" className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
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
                                <p className="text-white whitespace-pre-wrap">{formatMentions(post.content)}</p>
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
                            
                            {/* Display media (images and videos) */}
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
                          </>
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
                    </div>

                    {/* Comments Section */}
                    {showComments[post.id] && (
                      <div className="mt-4 space-y-4 border-t border-gray-600 pt-4">
                        {post.comments && post.comments.length > 0 && (
                          <div className="space-y-3">
                            {post.comments.map(comment => (
                              <div key={comment.id} className="flex items-start space-x-3">
                                <div
                                  className="cursor-pointer hover:opacity-80 relative"
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
                                      <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold text-xs">
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
                                  <p className="text-gray-300 text-sm mt-1">{formatMentions(comment.content)}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <p className="text-gray-400 text-xs">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </p>
                                    <button
                                      onClick={() => handleToggleCommentLike(comment.id, post.id)}
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
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <input
                              ref={(el) => commentRefs.current[post.id] = el}
                              type="text"
                              value={commentText[post.id] || ''}
                              onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                              placeholder={t('community.post.writeCommentMention')}
                              className="w-full bg-gray-600 text-white rounded-lg pl-4 pr-12 py-2 border border-gray-500 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
                              onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                            />
                            {/* Emoji Button - Inside Input on Right */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <EmojiPickerButton onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, post.id)} />
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAddComment(post.id)}
                            className="bg-[#00C2A8] hover:bg-[#00a890] text-white p-2"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && !selectedGroup && (
        <div className="space-y-6 pt-12 md:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                athleteId={athleteId}
                onJoin={handleJoinGroup}
                onEdit={handleOpenEditGroup}
                onDelete={handleDeleteGroup}
                onClick={() => loadGroupDetails(group.id)}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {/* My Groups Tab */}
      {activeTab === 'mygroups' && !selectedGroup && (
        <div className="space-y-6 pt-12 md:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                athleteId={athleteId}
                isMember={true}
                onEdit={handleOpenEditGroup}
                onDelete={handleDeleteGroup}
                onClick={() => loadGroupDetails(group.id)}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>
        </div>
      )}


      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-6 pt-12 md:pt-0">
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
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>

          {events.length === 0 && (
            <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-12 text-center">
                <p className="text-gray-400 text-lg">No events yet. Create the first event!</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Challenges Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-0 md:space-y-6 pt-12 md:pt-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-0 sm:gap-4">
            {/* Filter buttons */}
            <div className="flex gap-0 md:gap-2 w-full sm:w-auto">
              {['all', 'active', 'completed', 'joined'].map(filter => (
                <button
                  key={filter}
                  onClick={() => {
                    setChallengeFilter(filter);
                    setChallengesLoaded(false);
                    loadChallenges(filter);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-none md:rounded-lg text-sm font-medium transition-all ${
                    challengeFilter === filter
                      ? 'bg-[#00C2A8] text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                athleteId={athleteId}
                onJoin={() => handleJoinChallenge(challenge.id)}
                onLeave={() => handleLeaveChallenge(challenge.id)}
                onDelete={() => handleDeleteChallenge(challenge.id)}
                onEdit={handleOpenEditChallenge}
                onClick={() => handleOpenChallengeDetail(challenge.id)}
                isSuperAdmin={isSuperAdmin}
                t={t}
              />
            ))}
          </div>

          {challenges.length === 0 && (
            <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">
                  {challengeFilter === 'all' && 'No challenges yet. Create the first challenge!'}
                  {challengeFilter === 'active' && 'No active challenges'}
                  {challengeFilter === 'completed' && 'No completed challenges'}
                  {challengeFilter === 'joined' && "You haven't joined any challenges yet"}
                </p>
              </div>
            </div>
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
          isSuperAdmin={isSuperAdmin}
          loadAthleteProfile={loadAthleteProfile}
          onAddComment={() => handleAddEventComment(eventDetailData?.id)}
          commentText={commentText[eventDetailData?.id] || ''}
          setCommentText={(text) => setCommentText({ ...commentText, [eventDetailData?.id]: text })}
          onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, eventDetailData?.id)}
          formatMentions={formatMentions}
          onDeleteComment={handleDeleteEventComment}
        />
      )}

      {/* Create Challenge Modal */}
      {showCreateChallenge && (
        <CreateChallengeModal
          challengeData={newChallengeData}
          setChallengeData={setNewChallengeData}
          onClose={() => setShowCreateChallenge(false)}
          onCreate={handleCreateChallenge}
        />
      )}

      {/* Edit Challenge Modal */}
      {showEditChallenge && (
        <EditChallengeModal
          challengeData={editChallengeData}
          setChallengeData={setEditChallengeData}
          onClose={() => setShowEditChallenge(false)}
          onSave={handleEditChallenge}
        />
      )}

      {/* Challenge Detail Modal */}
      {showChallengeDetail && (
        <ChallengeDetailModal
          challengeData={challengeDetailData}
          loading={challengeDetailLoading}
          athleteId={athleteId}
          onClose={() => setShowChallengeDetail(false)}
          onJoin={() => handleJoinChallenge(challengeDetailData.id)}
          onLeave={() => handleLeaveChallenge(challengeDetailData.id)}
          onDelete={() => handleDeleteChallenge(challengeDetailData.id)}
          onAddComment={handleAddChallengeComment}
        />
      )}


      {/* Athlete Profile Modal */}
      {showProfile && profileData && (
        <AthleteProfileModal
          profile={profileData}
          onClose={() => setShowProfile(false)}
          onFollowToggle={handleFollowToggle}
          loading={profileLoading}
          athleteId={athleteId}
          loadAthleteProfile={loadAthleteProfile}
          handleLike={handleToggleLike}
          handleShare={handleSharePost}
          setFullSizeImageUrl={setFullSizeImageUrl}
          setShowFullSizeImage={setShowFullSizeImage}
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
          t={t}
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
          isSuperAdmin={isSuperAdmin}
          formatMentions={formatMentions}
          loadAthleteProfile={loadAthleteProfile}
          onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, selectedPostForComments.id)}
          onDeleteComment={handleDeletePostComment}
          onToggleCommentLike={handleToggleCommentLike}
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
          isSuperAdmin={isSuperAdmin}
          formatMentions={formatMentions}
          loadAthleteProfile={loadAthleteProfile}
          onEmojiSelect={(emoji) => handleEmojiSelectForComment(emoji, selectedEventForComments.id)}
          onDeleteComment={handleDeleteEventComment}
          onToggleCommentLike={handleToggleCommentLike}
        />
      )}

      {/* Floating Action Button - Bottom Right */}
      <button
        onClick={() => setShowCreateMenu(!showCreateMenu)}
        className={`fixed bottom-20 right-4 z-50 w-14 h-14 bg-gradient-to-br from-[#00C2A8] to-[#00a890] hover:from-[#00a890] hover:to-[#00C2A8] rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          showCreateMenu ? 'rotate-45 scale-110' : 'rotate-0'
        } ${scrollDirection === 'down' ? 'translate-y-32' : 'translate-y-0'}`}
        aria-label="Create"
      >
        <PlusCircle className="w-7 h-7 text-white" />
      </button>

      {/* Backdrop when menu is open */}
      {showCreateMenu && (
        <div 
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setShowCreateMenu(false)}
        />
      )}

      {/* Fan Menu - Individual FABs with Bigger Radius */}
      {/* Challenge Button - 180° (9 o'clock - straight left) */}
      <button
        onClick={() => {
          setShowCreateChallenge(true);
          setShowCreateMenu(false);
        }}
        className={`fixed bottom-20 right-4 z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          showCreateMenu 
            ? 'opacity-100 translate-x-0 translate-y-0' 
            : 'opacity-0 scale-0 pointer-events-none'
        }`}
        style={{
          transform: showCreateMenu 
            ? `translate(${-110}px, 0px)` // 180° (9 o'clock - straight left)
            : 'translate(0, 0) scale(0)',
          transitionDelay: showCreateMenu ? '50ms' : '0ms'
        }}
        title={t('community.actions.createChallenge')}
      >
        <Trophy className="w-5 h-5 text-white" />
      </button>

      {/* Post Button - 150° (10 o'clock position) */}
      <button
        onClick={() => {
          setShowWritePostModal(true);
          setShowCreateMenu(false);
        }}
        className={`fixed bottom-20 right-4 z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          showCreateMenu 
            ? 'opacity-100 translate-x-0 translate-y-0' 
            : 'opacity-0 scale-0 pointer-events-none'
        }`}
        style={{
          transform: showCreateMenu 
            ? `translate(${Math.cos(5 * Math.PI / 6) * 110}px, ${-Math.sin(5 * Math.PI / 6) * 110}px)` // 150° (10 o'clock)
            : 'translate(0, 0) scale(0)',
          transitionDelay: showCreateMenu ? '100ms' : '0ms'
        }}
        title={t('community.actions.createPost')}
      >
        <Edit3 className="w-5 h-5 text-white" />
      </button>

      {/* Event Button - 120° (11 o'clock position) */}
      <button
        onClick={() => {
          setShowCreateEvent(true);
          setShowCreateMenu(false);
        }}
        className={`fixed bottom-20 right-4 z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          showCreateMenu 
            ? 'opacity-100 translate-x-0 translate-y-0' 
            : 'opacity-0 scale-0 pointer-events-none'
        }`}
        style={{
          transform: showCreateMenu 
            ? `translate(${Math.cos(2 * Math.PI / 3) * 110}px, ${-Math.sin(2 * Math.PI / 3) * 110}px)` // 120° (11 o'clock)
            : 'translate(0, 0) scale(0)',
          transitionDelay: showCreateMenu ? '150ms' : '0ms'
        }}
        title={t('community.actions.createEvent')}
      >
        <Calendar className="w-5 h-5 text-white" />
      </button>

      {/* Group Button - 90° (12 o'clock - straight up) */}
      <button
        onClick={() => {
          setShowCreateGroup(true);
          setShowCreateMenu(false);
        }}
        className={`fixed bottom-20 right-4 z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          showCreateMenu 
            ? 'opacity-100 translate-x-0 translate-y-0' 
            : 'opacity-0 scale-0 pointer-events-none'
        }`}
        style={{
          transform: showCreateMenu 
            ? `translate(0px, ${-110}px)` // 90° (12 o'clock - straight up)
            : 'translate(0, 0) scale(0)',
          transitionDelay: showCreateMenu ? '200ms' : '0ms'
        }}
        title={t('community.actions.createGroup')}
      >
        <UsersIcon className="w-5 h-5 text-white" />
      </button>


      {/* Write Post Modal */}
      {showWritePostModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-2 md:p-4"
          onClick={() => setShowWritePostModal(false)}
        >
          <div 
            className="rounded-none md:rounded-3xl max-w-2xl w-full shadow-2xl border-0 overflow-hidden"
            style={{ background: 'var(--grad-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('community.modals.createPost')}</h3>
                <button
                  onClick={() => setShowWritePostModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Textarea with Emoji Button */}
              <div className="relative">
                <textarea
                  ref={writePostTextareaRef}
                  value={writePostContent}
                  onChange={handleWritePostContentChange}
                  placeholder={t('community.post.whatsOnMind')}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 pr-12 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none min-h-[120px] resize-vertical"
                />
                
                {/* Emoji Button - Bottom Right Inside Textarea */}
                <button
                  type="button"
                  onClick={() => setShowWritePostEmojiPicker(!showWritePostEmojiPicker)}
                  className="absolute bottom-3 right-3 p-1.5 hover:bg-gray-600/50 rounded-full transition-colors"
                  title="Add emoji"
                >
                  <Smile className="w-5 h-5 text-[#00C2A8]" />
                </button>

                {/* Emoji Picker */}
                {showWritePostEmojiPicker && (
                  <>
                    {/* Backdrop to close picker */}
                    <div 
                      className="fixed inset-0 z-[75]"
                      onClick={() => setShowWritePostEmojiPicker(false)}
                    />
                    
                    {/* Picker - Centered on mobile, positioned on desktop */}
                    <div className="fixed md:absolute bottom-1/2 md:bottom-14 left-1/2 md:left-auto md:right-0 transform -translate-x-1/2 translate-y-1/2 md:translate-x-0 md:translate-y-0 z-[80]">
                      <div className="bg-gray-800 rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden">
                        <Picker
                          data={data}
                          onEmojiSelect={(emojiData) => handleEmojiSelectForWritePost(emojiData.native)}
                          theme="dark"
                          previewPosition="none"
                          skinTonePosition="none"
                          set="native"
                          emojiSize={20}
                          emojiButtonSize={36}
                          maxFrequentRows={2}
                          perLine={8}
                          style={{
                            width: '320px',
                            backgroundColor: '#1f2937',
                            border: 'none',
                            '--rgb-background': '31, 41, 55',
                            '--rgb-accent': '0, 194, 168',
                            '--rgb-input': '55, 65, 81',
                            '--rgb-color': '255, 255, 255',
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

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

              {/* Mixed Media Preview with Drag-and-Drop */}
              {selectedMedia.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-semibold">
                      Selected Media ({selectedMedia.length}/5) {selectedMedia.filter(m => m.type === 'video').length > 0 && '🎥'}
                    </span>
                    {isUploadingMedia && (
                      <span className="text-[#00C2A8] text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading...
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedMedia.map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`relative aspect-square cursor-move ${draggedIndex === index ? 'opacity-50' : ''}`}
                      >
                        {/* Drag Handle */}
                        <div className="absolute top-1 left-1 p-1 bg-black/70 rounded-full z-10">
                          <GripVertical className="w-4 h-4 text-white" />
                        </div>

                        {/* Media Preview */}
                        {item.type === 'video' ? (
                          <div className="relative w-full h-full">
                            <video
                              src={item.preview}
                              className="w-full h-full object-cover rounded-lg"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                              <Video className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={item.preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveMedia(index)}
                          disabled={isUploadingMedia || item.uploading}
                          className="absolute top-1 right-1 p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors disabled:opacity-50 z-10"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>

                        {/* Uploading indicator */}
                        {item.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                            <RefreshCw className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube Preview */}
              {youtubePreview && (
                <div className="relative bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
                  <div className="relative">
                    <img 
                      src={youtubePreview.thumbnail} 
                      alt={youtubePreview.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1"></div>
                      </div>
                    </div>
                    <button
                      onClick={() => setYoutubePreview(null)}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors z-10"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-white font-semibold text-sm line-clamp-2">{youtubePreview.title}</p>
                    <p className="text-gray-400 text-xs mt-1">{youtubePreview.author}</p>
                  </div>
                </div>
              )}

              {/* URL Preview */}
              {urlPreview && !youtubePreview && (
                <div className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden relative">
                  {urlPreview.image && (
                    <img 
                      src={urlPreview.image} 
                      alt={urlPreview.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-3">
                    <p className="text-white font-semibold text-sm line-clamp-2">{urlPreview.title}</p>
                    {urlPreview.description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{urlPreview.description}</p>
                    )}
                    {urlPreview.site_name && (
                      <p className="text-gray-500 text-xs mt-1">{urlPreview.site_name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setUrlPreview(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
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
                      <span className="text-sm">{t('community.post.public')}</span>
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
                      <span className="text-sm">{t('community.post.private')}</span>
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
                  {/* Mixed media input - images and videos */}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaSelect}
                    className="hidden"
                    id="write-post-media"
                    disabled={isUploadingMedia || selectedMedia.length >= 5}
                  />
                  <label
                    htmlFor="write-post-media"
                    className={`p-2 rounded-full cursor-pointer transition-colors ${
                      isUploadingMedia || selectedMedia.length >= 5
                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    title={selectedMedia.length >= 5 ? 'Maximum 5 media items' : 'Add images or video (max 5, 1 video)'}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </label>
                  
                  {/* Show media count */}
                  {selectedMedia.length > 0 && (
                    <span className="text-sm text-white bg-[#00C2A8] px-2 py-1 rounded-full">
                      {selectedMedia.length}/5
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => {
                      setShowWritePostModal(false);
                      // Clear media state when closing
                      setSelectedMedia([]);
                    }}
                    className="flex-1 sm:flex-none bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleWritePost}
                    disabled={!writePostContent.trim() || isUploadingMedia}
                    className="flex-1 sm:flex-none bg-[#00C2A8] hover:bg-[#00a890] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingMedia ? 'Uploading...' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Post Modal */}
      {showShareModal && sharePostData && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">{t('community.modals.sharePost')}</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Commentary Input */}
            <div className="space-y-4">
              <textarea
                ref={shareTextareaRef}
                value={shareCommentary}
                onChange={(e) => setShareCommentary(e.target.value)}
                placeholder={t('community.post.addThoughts')}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none min-h-[100px] resize-vertical"
              />

              {/* Original Post Preview (Twitter-style embedded quote) */}
              <div className="border border-gray-600 rounded-lg p-4 bg-gray-900/50">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="relative">
                    {sharePostData.athlete_profile_picture ? (
                      <>
                        <img
                          src={sharePostData.athlete_profile_picture}
                          alt={sharePostData.athlete_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <FlagIcon nationality={sharePostData.nationality} />
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-[#00C2A8] flex items-center justify-center text-white font-semibold">
                          {sharePostData.athlete_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <FlagIcon nationality={sharePostData.nationality} />
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm flex items-center">
                      {sharePostData.athlete_name}
                      <SubscriptionBadge subscriptionTier={sharePostData.subscription_tier} />
                    </p>
                    <p className="text-gray-400 text-xs">
                      {sharePostData.created_at ? new Date(sharePostData.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>

                {/* Original Post Content */}
                <p className="text-gray-300 text-sm mb-3 whitespace-pre-wrap">{sharePostData.content}</p>

                {/* Original Post Media Preview */}
                {sharePostData.media && sharePostData.media.length > 0 && (
                  <div className="rounded-lg overflow-hidden">
                    {sharePostData.media[0].type === 'image' && (
                      <img
                        src={sharePostData.media[0].url}
                        alt="Post media"
                        className="w-full max-h-48 object-cover"
                      />
                    )}
                    {sharePostData.media[0].type === 'video' && (
                      <video
                        src={sharePostData.media[0].url}
                        className="w-full max-h-48 object-cover"
                        controls={false}
                      />
                    )}
                    {sharePostData.media.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        +{sharePostData.media.length - 1} more
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setShowShareModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={submitSharePost}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  {t('common.share')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Size Image Modal */}
      {showFullSizeImage && fullSizeImageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[80] p-4"
          onClick={() => setShowFullSizeImage(false)}
        >
          <div className="relative max-w-6xl w-full max-h-[90vh] flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={() => setShowFullSizeImage(false)}
              className="absolute top-4 right-4 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-full transition-colors z-10"
              title="Close"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {/* Full-size image */}
            <img
              src={fullSizeImageUrl}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
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

      {/* Notifications Modal - Fullscreen on mobile, dropdown on desktop */}
      {effectiveShowNotifications && (
        <>
          {/* Mobile: Fullscreen Modal */}
          <div className="md:hidden fixed top-0 left-0 right-0 bottom-0 z-[9999] flex flex-col overflow-hidden" style={{ background: 'var(--grad-page)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Notifications</h3>
              <button
                onClick={() => effectiveSetShowNotifications(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-2">
              {notifications.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg" style={{ color: 'var(--text-med)' }}>No notifications</p>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>You're all caught up!</p>
                  </div>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`mb-2 rounded-none md:rounded-3xl hover:opacity-90 active:opacity-80 cursor-pointer transition-all overflow-hidden ${
                      !notification.read ? 'ring-2 ring-[#00C2A8]/30' : ''
                    }`}
                    style={{ background: 'var(--grad-surface)' }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="p-4">
                      <p className="text-sm" style={{ color: 'var(--text-hi)' }}>{notification.message || notification.content}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Desktop: Dropdown */}
          <div className="hidden md:block fixed top-16 right-4 z-50 sm:absolute sm:right-0 sm:mt-2">
            <div className="relative">
              <div className="absolute right-0 mt-2 w-80 rounded-3xl shadow-xl z-50 max-h-96 overflow-y-auto overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
                <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Notifications</h3>
                    <button
                      onClick={() => effectiveSetShowNotifications(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p style={{ color: 'var(--text-med)' }}>No notifications</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-700/30 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-gray-700/20' : ''
                      }`}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <p className="text-sm" style={{ color: 'var(--text-hi)' }}>{notification.message || notification.content}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
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
                            <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
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
const GroupCard = ({ group, athleteId, isMember, onJoin, onEdit, onDelete, onClick, isSuperAdmin = false }) => {
  const { t } = useTranslation();
  const isAdmin = group.member_role === 'admin';
  const canEditDelete = isAdmin || isSuperAdmin;
  
  return (
    <div 
      className="border-0 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all rounded-none md:rounded-3xl" 
      style={{ background: 'var(--grad-surface)' }}
      onClick={onClick}
    >
      <div className="p-4" className="p-0 sm:p-6">
        {group.cover_photo && (
          <div className="mb-4 sm:mb-4">
            <img src={group.cover_photo} alt={group.name} className="w-full h-48 object-cover rounded-none sm:rounded-lg" />
          </div>
        )}
        
        <div className="px-3 sm:px-0">
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
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{group.name}</h3>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                  {group.privacy === 'private' ? (
                    <Lock className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Globe className="w-5 h-5 text-gray-400" />
                  )}
                  {canEditDelete && onEdit && onDelete && (
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(group);
                        }}
                        className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(group.id);
                        }}
                        className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">{group.description}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pb-3 sm:pb-0">
            <span className="text-gray-400 text-sm">{group.members_count} {t('community.group.members')}</span>
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
        </div>
      </div>
    </div>
  );
};

// CreateGroupModal Component
const CreateGroupModal = ({ groupData, setGroupData, onClose, onCreate }) => {
  const { t } = useTranslation();
  
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
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={(e) => {
        // Prevent closing when clicking on backdrop (only close with Cancel button)
        e.stopPropagation();
      }}
    >
      <div 
        className="rounded-none md:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden"
        style={{ background: 'var(--grad-surface)' }}
        onClick={(e) => {
          // Prevent backdrop click from propagating
          e.stopPropagation();
        }}
      >
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('community.modals.createGroup')}</h2>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupProfileImage')}</label>
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
                  {groupData.profile_image ? t('common.changeImage') : t('common.uploadImage')}
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
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.bannerImage')}</label>
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
                {groupData.cover_photo ? t('common.changeBanner') : t('common.uploadBanner')}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupName')}</label>
            <input
              type="text"
              value={groupData.name}
              onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
              placeholder={t('community.group.enterGroupName')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.description')}</label>
            <textarea
              value={groupData.description}
              onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
              placeholder={t('community.group.describeGroup')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="3"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.privacy')}</label>
            <select
              value={groupData.privacy}
              onChange={(e) => setGroupData({ ...groupData, privacy: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="public">{t('community.group.privacyPublic')}</option>
              <option value="private">{t('community.group.privacyPrivate')}</option>
            </select>
          </div>
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupRules')}</label>
            <textarea
              value={groupData.rules}
              onChange={(e) => setGroupData({ ...groupData, rules: e.target.value })}
              placeholder={t('community.group.enterGroupRules')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="4"
            />
            <p className="text-gray-400 text-xs mt-1">{t('community.group.rulesHelpText')}</p>
          </div>
        </div>
        
        <div className="p-6 pt-4 flex space-x-3">
          <Button
            onClick={onCreate}
            className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
          >
            {t('community.modals.createGroup')}
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

// EditGroupModal Component (same as CreateGroupModal but for editing)
const EditGroupModal = ({ groupData, setGroupData, onClose, onSave }) => {
  const { t } = useTranslation();
  
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
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
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
        <h2 className="text-2xl font-bold text-white mb-4">{t('community.modals.editGroup')}</h2>
        
        <div className="space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupProfileImage')}</label>
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
                  {groupData.profile_image ? t('common.changeImage') : t('common.uploadImage')}
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
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.bannerImage')}</label>
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
                {groupData.cover_photo ? t('common.changeBanner') : t('common.uploadBanner')}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupName')}</label>
            <input
              type="text"
              value={groupData.name}
              onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
              placeholder={t('community.group.enterGroupName')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.description')}</label>
            <textarea
              value={groupData.description}
              onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
              placeholder={t('community.group.describeGroup')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="3"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.privacy')}</label>
            <select
              value={groupData.privacy}
              onChange={(e) => setGroupData({ ...groupData, privacy: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="public">{t('community.group.privacyPublic')}</option>
              <option value="private">{t('community.group.privacyPrivate')}</option>
            </select>
          </div>
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupRules')}</label>
            <textarea
              value={groupData.rules}
              onChange={(e) => setGroupData({ ...groupData, rules: e.target.value })}
              placeholder={t('community.group.enterGroupRules')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="4"
            />
            <p className="text-gray-400 text-xs mt-1">{t('community.group.rulesHelpText')}</p>
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
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

// AthleteProfileModal Component
const AthleteProfileModal = ({ profile, onClose, onFollowToggle, loading, athleteId, loadAthleteProfile, handleLike, handleShare, setFullSizeImageUrl, setShowFullSizeImage }) => {
  const { t } = useTranslation();
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

  // Translate interest names using account settings translations
  const translateInterest = (interest) => {
    // Map interest names to translation keys
    const interestKeyMap = {
      'Running': 'account.interestRunning',
      'Cycling': 'account.interestCycling',
      'Swimming': 'account.interestSwimming',
      'Triathlon': 'account.interestTriathlon',
      'Marathon': 'account.interestMarathon',
      'Ultramarathon': 'account.interestUltramarathon',
      'Trail Running': 'account.interestTrailRunning',
      'Strength Training': 'account.interestStrengthTraining',
      'Yoga': 'account.interestYoga',
      'CrossFit': 'account.interestCrossFit',
      'Hiking': 'account.interestHiking',
      'Basketball': 'account.interestBasketball',
      'Tennis': 'account.interestTennis',
      'Rock Climbing': 'account.interestRockClimbing',
      'Fitness': 'account.interestFitness',
      'Nutrition': 'account.interestNutrition'
    };

    const key = interestKeyMap[interest];
    return key ? t(key) : interest; // Fallback to original if no translation found
  };

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
      setUserPosts(response.data.posts || []);
    } catch (error) {
      console.error('Error loading user posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4" onClick={onClose}>
      <div className="rounded-none md:rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }} onClick={(e) => e.stopPropagation()}>
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
            <div className="p-6">
            <div className="flex items-center space-x-4 mb-6">
              <div 
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (profile.profile_picture) {
                    setFullSizeImageUrl(profile.profile_picture);
                    setShowFullSizeImage(true);
                  }
                }}
                title="Click to view full size"
              >
                {profile.profile_picture ? (
                  <>
                    <img
                      src={profile.profile_picture}
                      alt={profile.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <FlagIcon nationality={profile.nationality} size="large" />
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-[#00C2A8] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">
                        {profile.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <FlagIcon nationality={profile.nationality} size="large" />
                  </>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  {profile.name}
                  <SubscriptionBadge subscriptionTier={profile.subscription_tier} />
                </h2>
                {age && <p className="text-gray-400 text-sm">{t('community.yearsOld', { age })}</p>}
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
                {t('community.about')}
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'posts'
                    ? 'text-[#00C2A8] border-b-2 border-[#00C2A8]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('community.posts')} ({profile.posts_count || 0})
              </button>
            </div>

            {/* About Tab Content */}
            {activeTab === 'about' && (
              <>
                {/* Bio Section */}
                {profile.bio && profile.share_bio && (
                  <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">{t('community.about')}</h3>
                    <p className="text-gray-300 text-sm">{profile.bio}</p>
                  </div>
                )}

                {/* Health/Training Goals Section */}
                {profile.running_goals && profile.share_goals && (
                  <div className="mb-6 p-4 bg-gray-700/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">{t('community.healthTrainingGoals')}</h3>
                    <p className="text-gray-300 text-sm">{profile.running_goals}</p>
                    {profile.health_goals && profile.health_goals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.health_goals.map((goal, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs"
                          >
                            {goal.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Interests Section */}
                {profile.interests && profile.interests.length > 0 && profile.share_interests && (
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-2">{t('community.interests')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-[#00C2A8]/20 text-[#00C2A8] rounded-full text-sm"
                        >
                          {translateInterest(interest)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.posts_count || 0}</p>
                    <p className="text-gray-400 text-sm">{t('community.posts')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.followers_count || 0}</p>
                    <p className="text-gray-400 text-sm">{t('community.followers')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00C2A8]">{profile.following_count || 0}</p>
                    <p className="text-gray-400 text-sm">{t('community.following')}</p>
                  </div>
                </div>
              </>
            )}

            {/* Posts Tab Content */}
            {activeTab === 'posts' && (
              <div className="space-y-4">
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
                          <p className="text-white font-semibold flex items-center">
                            {post.athlete_name}
                            <SubscriptionBadge subscriptionTier={post.subscription_tier} />
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(post.created_at).toLocaleString()}
                            {post.is_edited && <span className="ml-2">(edited)</span>}
                          </p>
                        </div>
                      </div>

                      {/* Post Content */}
                      <p className="text-white whitespace-pre-wrap mb-3">{formatMentions(post.content)}</p>
                      
                      {/* Display media (images and videos) */}
                      {post.media && post.media.length > 0 ? (
                        <div className="mb-3">
                          <ImageCarousel media={post.media} alt="Post media" />
                        </div>
                      ) : post.image_urls && post.image_urls.length > 0 ? (
                        <div className="mb-3">
                          <ImageCarousel images={post.image_urls} alt="Post images" />
                        </div>
                      ) : post.image_data ? (
                        <img 
                          src={post.image_data} 
                          alt="Post" 
                          className="w-full rounded-lg max-h-96 object-cover mb-3" 
                        />
                      ) : null}

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
        </div>
      </div>
    )}

    {/* Members List (admin/manager only) */}
    {group.members && group.member_role && ['admin', 'manager'].includes(group.member_role) && (
      <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4" className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Group Members</h3>
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
                  {console.log(`[Group Posts] Rendering comment count for post ${post.id}:`, post.comments_count) || (post.comments_count || 0)}
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

// AthletesModal Component
const AthletesModal = ({ athletes, loading, searchQuery, onSearchChange, onClose, onFollowToggle, onViewProfile, t }) => {
  const [nationalityFilter, setNationalityFilter] = React.useState('all');
  
  // Get unique nationalities
  const uniqueNationalities = React.useMemo(() => {
    return [...new Set(athletes.map(a => a.nationality).filter(n => n))].sort();
  }, [athletes]);
  
  // Filter athletes by nationality
  const filteredAthletes = React.useMemo(() => {
    if (nationalityFilter === 'all') return athletes;
    return athletes.filter(a => a.nationality === nationalityFilter);
  }, [athletes, nationalityFilter]);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4">
      <div className="rounded-none md:rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Find Athletes</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={t('community.group.searchByName')}
              className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
        </div>

        {/* Nationality Filter */}
        <div className="mb-4">
          <select
            value={nationalityFilter}
            onChange={(e) => setNationalityFilter(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none text-sm"
          >
            <option value="all">{t('community.post.allNationalities')}</option>
            {uniqueNationalities.map(nationality => (
              <option key={nationality} value={nationality}>{nationality}</option>
            ))}
          </select>
        </div>

        {/* Athletes List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredAthletes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No athletes found</p>
            </div>
          ) : (
            filteredAthletes.map(athlete => (
              <div
                key={athlete.id}
                className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div
                    className="cursor-pointer relative"
                    onClick={() => {
                      onViewProfile(athlete.id);
                      onClose();
                    }}
                  >
                    {athlete.profile_picture ? (
                      <>
                        <img
                          src={athlete.profile_picture}
                          alt={athlete.name}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        <FlagIcon nationality={athlete.nationality} size="medium" />
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xl">
                            {athlete.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <FlagIcon nationality={athlete.nationality} size="medium" />
                      </>
                    )}
                  </div>
                  
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      onViewProfile(athlete.id);
                      onClose();
                    }}
                  >
                    <p className="text-white font-semibold hover:underline flex items-center">
                      {athlete.name}
                      <SubscriptionBadge subscriptionTier={athlete.subscription_tier} />
                    </p>
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
                    } text-white text-sm p-2`}
                    title={athlete.is_following ? 'Unfollow' : 'Follow'}
                  >
                    {athlete.is_following ? (
                      <UserMinus className="w-5 h-5" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4">
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
                {t('common.cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


// EventCard Component
// ChallengeCard Component
const ChallengeCard = ({ challenge, athleteId, onJoin, onLeave, onDelete, onEdit, onClick, isSuperAdmin = false, t }) => {
  const progress = challenge.user_progress || 0;
  const goalValue = challenge.goal_value;
  const percentage = Math.min((progress / goalValue) * 100, 100);
  const isCreator = challenge.creator_id === athleteId;
  const hasJoined = challenge.has_joined;
  
  // Debug logging
  console.log('🔍 ChallengeCard DEBUG:', {
    challengeTitle: challenge.title,
    athleteId,
    creatorId: challenge.creator_id,
    isCreator,
    hasJoined,
    challenge
  });
  
  // Check if challenge is active
  const now = new Date();
  const endDate = new Date(challenge.end_date);
  const isActive = endDate > now;
  
  // Get challenge type icon and label
  const getChallengeIcon = () => {
    switch (challenge.challenge_type) {
      case 'distance': return <Target className="w-8 h-8 text-gray-400" />;
      case 'activity_count': return <TrendingUp className="w-8 h-8 text-gray-400" />;
      case 'duration': return <Clock className="w-8 h-8 text-gray-400" />;
      default: return <Trophy className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div 
      className="border-0 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow rounded-none md:rounded-3xl"
      style={{ background: 'var(--grad-surface)' }}
      onClick={() => onClick(challenge.id)}
    >
      <div className="p-4" className="p-0 sm:p-6">
        {challenge.cover_photo && (
          <div className="mb-4 sm:mb-4 relative">
            <img src={challenge.cover_photo} alt={challenge.title} className="w-full h-48 object-cover rounded-none sm:rounded-lg" />
            
            {/* Trophy Icon - Positioned on Banner */}
            <div className="absolute bottom-3 left-3">
              {challenge.trophy_image ? (
                <img src={challenge.trophy_image} alt="Trophy" className="w-16 h-16 rounded-full object-cover border-4 border-gray-800 shadow-lg" />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-lg">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="px-3 sm:px-0">
          <div className="mb-3">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white truncate">{challenge.title}</h3>
                {isCreator && (
                  <Crown className="w-5 h-5 text-yellow-400 flex-shrink-0" title={t('community.actions.challengeCreator')} />
                )}
              </div>
              {(isCreator || isSuperAdmin) && (
                <div className="flex space-x-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(challenge);
                    }}
                    className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(challenge.id);
                    }}
                    className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-gray-300 text-sm line-clamp-2 mb-2">{challenge.description}</p>
          </div>

          {/* Challenge Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center text-gray-400 text-sm">
              {getChallengeIcon()}
              <span className="ml-2">
                Goal: {goalValue} {challenge.goal_unit}
              </span>
              {challenge.is_recurring && (
                <RefreshCw className="w-4 h-4 ml-2 text-blue-400" title={t('community.actions.recurringChallenge')} />
              )}
            </div>
            <div className="flex items-center text-gray-400 text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-gray-400">{challenge.participants_count || 0} participants</span>
              <span className={`px-2 py-1 rounded text-xs ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
                {isActive ? 'Active' : 'Completed'}
              </span>
              {challenge.visibility === 'private' && (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Progress Bar (if joined) */}
          {hasJoined && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Your Progress</span>
                <span className="text-[#00C2A8] font-semibold">
                  {progress.toFixed(1)} / {goalValue} {challenge.goal_unit}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-[#00C2A8] to-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-400 mt-1">
                {percentage.toFixed(1)}% complete
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pb-3 sm:pb-0">
            {hasJoined ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLeave();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Leave Challenge
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-[#00C2A8] hover:bg-[#00a890] text-white transition-colors"
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Join Challenge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EventCard = ({ event, athleteId, onRSVP, onEdit, onDelete, onClick, isSuperAdmin = false }) => (
  <div 
    className="border-0 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow rounded-none md:rounded-3xl"
    style={{ background: 'var(--grad-surface)' }}
    onClick={() => onClick(event.id)}
  >
    <div className="p-4" className="p-0 sm:p-6">
      {event.cover_photo && (
        <div className="mb-4 sm:mb-4 relative">
          <img src={event.cover_photo} alt={event.name} className="w-full h-48 object-cover rounded-none sm:rounded-lg" />
          
          {/* Event Icon - Positioned on Banner */}
          <div className="absolute bottom-3 left-3">
            {event.profile_image ? (
              <img src={event.profile_image} alt={event.name} className="w-16 h-16 rounded-full object-cover border-4 border-gray-800 shadow-lg" />
            ) : (
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-lg">
                <Calendar className="w-8 h-8 text-[#00C2A8]" />
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="px-3 sm:px-0">
        <div className="mb-3">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-xl font-bold text-white truncate">{event.name}</h3>
            {(event.creator_id === athleteId || isSuperAdmin) && (
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
        
        <div className="flex space-x-2 mt-4 pb-3 sm:pb-0">
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
      </div>
    </div>
  </div>
);

// CreateChallengeModal Component
const CreateChallengeModal = ({ challengeData, setChallengeData, onClose, onCreate }) => {
  const { t } = useTranslation();
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressBannerImage(file);
        setChallengeData({ ...challengeData, cover_photo: compressed });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  const handleChallengeTypeChange = (type) => {
    let unit = 'km';
    if (type === 'activity_count') unit = 'activities';
    if (type === 'duration') unit = 'minutes';
    
    setChallengeData({ ...challengeData, challenge_type: type, goal_unit: unit });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="rounded-none md:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Trophy className="w-6 h-6 mr-2 text-[#00C2A8]" />
              {t('common.createChallenge')}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.title')}</label>
              <input
                type="text"
                value={challengeData.title}
                onChange={(e) => setChallengeData({ ...challengeData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                placeholder={t('community.challenge.enterChallengeName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">{t('common.description')}</label>
              <textarea
                value={challengeData.description}
                onChange={(e) => setChallengeData({ ...challengeData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                rows="3"
                placeholder={t('community.challenge.describeChallenge')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.challengeType')}</label>
                <select
                  value={challengeData.challenge_type}
                  onChange={(e) => handleChallengeTypeChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="distance">{t('community.challenge.typeDistance')}</option>
                  <option value="activity_count">{t('community.challenge.typeActivityCount')}</option>
                  <option value="duration">{t('community.challenge.typeDuration')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.goalValue')}</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={challengeData.goal_value}
                    onChange={(e) => setChallengeData({ ...challengeData, goal_value: e.target.value })}
                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    placeholder={t('community.challenge.targetValue')}
                    step="any"
                  />
                  <span className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400">
                    {challengeData.goal_unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.timePeriod')}</label>
                <select
                  value={challengeData.time_period}
                  onChange={(e) => setChallengeData({ ...challengeData, time_period: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="total">{t('community.challenge.periodTotal')}</option>
                  <option value="daily">{t('community.challenge.periodDaily')}</option>
                  <option value="weekly">{t('community.challenge.periodWeekly')}</option>
                  <option value="monthly">{t('community.challenge.periodMonthly')}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {t('community.challenge.timePeriodHelp')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.startDate')}</label>
                <input
                  type="date"
                  value={challengeData.start_date}
                  onChange={(e) => setChallengeData({ ...challengeData, start_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.endDate')}</label>
                <input
                  type="date"
                  value={challengeData.end_date}
                  onChange={(e) => setChallengeData({ ...challengeData, end_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.visibility')}</label>
                <select
                  value={challengeData.visibility}
                  onChange={(e) => setChallengeData({ ...challengeData, visibility: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="public">{t('community.challenge.visibilityPublic')}</option>
                  <option value="private">{t('community.challenge.visibilityPrivate')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.competitionType')}</label>
                <select
                  value={challengeData.competition_type}
                  onChange={(e) => setChallengeData({ ...challengeData, competition_type: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="individual">{t('community.challenge.typeIndividual')}</option>
                  <option value="team">{t('community.challenge.typeTeam')}</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={challengeData.is_recurring}
                  onChange={(e) => setChallengeData({ ...challengeData, is_recurring: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-white">{t('community.challenge.recurringChallenge')}</label>
              </div>

              {challengeData.is_recurring && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                    <select
                      value={challengeData.recurrence_frequency}
                      onChange={(e) => setChallengeData({ ...challengeData, recurrence_frequency: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Repeat Count</label>
                    <input
                      type="number"
                      value={challengeData.recurrence_count}
                      onChange={(e) => setChallengeData({ ...challengeData, recurrence_count: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                      min="1"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.coverPhoto')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#00C2A8] file:text-white hover:file:bg-[#00a890]"
                />
                {challengeData.cover_photo && (
                  <img src={challengeData.cover_photo} alt="Cover preview" className="mt-2 w-full h-32 object-cover rounded-lg" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.trophyBadge')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      try {
                        const compressed = await compressBannerImage(file);
                        setChallengeData({ ...challengeData, trophy_image: compressed });
                      } catch (error) {
                        console.error('Error compressing trophy image:', error);
                        alert('Failed to process trophy image');
                      }
                    }
                  }}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
                />
                {challengeData.trophy_image && (
                  <img src={challengeData.trophy_image} alt="Trophy preview" className="mt-2 w-32 h-32 object-cover rounded-lg mx-auto" />
                )}
                <p className="text-xs text-gray-400 mt-1">{t('community.challenge.trophyHelp')}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={onCreate}
                className="px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors"
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Create Challenge
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ChallengeDetailModal Component
const ChallengeDetailModal = ({ challengeData, loading, athleteId, onClose, onJoin, onLeave, onDelete, onAddComment }) => {
  const { t } = useTranslation();
  const [commentText, setCommentText] = useState('');

  if (loading || !challengeData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-8">
          <RefreshCw className="w-8 h-8 text-[#00C2A8] animate-spin mx-auto" />
          <p className="text-white mt-4">{t('community.challenge.loadingChallenge')}</p>
        </div>
      </div>
    );
  }

  const progress = challengeData.user_progress || 0;
  const goalValue = challengeData.goal_value;
  const percentage = Math.min((progress / goalValue) * 100, 100);
  const isCreator = challengeData.creator_id === athleteId;
  const hasJoined = challengeData.has_joined;

  const now = new Date();
  const endDate = new Date(challengeData.end_date);
  const isActive = endDate > now;

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(challengeData.id, commentText);
      setCommentText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{challengeData.title}</h2>
                <p className="text-gray-400 text-sm">
                  {t('community.challenge.createdBy')} {challengeData.creator_name}
                  {challengeData.is_recurring && <RefreshCw className="w-4 h-4 inline ml-2 text-blue-400" title={t('community.actions.recurringChallenge')} />}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Cover Photo */}
          {challengeData.cover_photo && (
            <img src={challengeData.cover_photo} alt={challengeData.title} className="w-full h-48 object-cover rounded-lg mb-4" />
          )}

          {/* Challenge Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  <Target className="w-5 h-5 mr-2 text-[#00C2A8]" />
                  <span className="font-semibold">{t('community.challenge.goal')}</span>
                </div>
                <p className="text-gray-300 text-lg">
                  {goalValue} {challengeData.goal_unit}
                </p>
                <p className="text-gray-400 text-sm capitalize">
                  {challengeData.challenge_type.replace('_', ' ')}
                </p>
              </div>
            </div>

            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  <Calendar className="w-5 h-5 mr-2 text-[#00C2A8]" />
                  <span className="font-semibold">{t('community.challenge.duration')}</span>
                </div>
                <p className="text-gray-300 text-sm">
                  {new Date(challengeData.start_date).toLocaleDateString()} - {new Date(challengeData.end_date).toLocaleDateString()}
                </p>
                <p className={`text-sm mt-1 ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                  {isActive ? t('community.challenge.active') : t('community.challenge.completed')}
                </p>
              </div>
            </div>

            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  <UsersIcon className="w-5 h-5 mr-2 text-[#00C2A8]" />
                  <span className="font-semibold">{t('community.challenge.participants')}</span>
                </div>
                <p className="text-gray-300 text-2xl">
                  {challengeData.participants_count || 0}
                </p>
              </div>
            </div>

            <div className="border-0 bg-gray-800" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex items-center text-white mb-2">
                  {challengeData.visibility === 'public' ? <Globe className="w-5 h-5 mr-2 text-[#00C2A8]" /> : <Lock className="w-5 h-5 mr-2 text-[#00C2A8]" />}
                  <span className="font-semibold">{t('community.challenge.visibility')}</span>
                </div>
                <p className="text-gray-300 capitalize">
                  {challengeData.visibility} / {challengeData.competition_type}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {challengeData.description && (
            <div className="border-0 bg-gray-800 mb-6" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <h3 className="text-white font-semibold mb-2">{t('community.challenge.description')}</h3>
                <p className="text-gray-300">{challengeData.description}</p>
              </div>
            </div>
          )}

          {/* User Progress */}
          {hasJoined && (
            <div className="border-0 bg-gradient-to-r from-[#00C2A8]/20 to-green-500/20 mb-6" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-semibold">{t('community.challenge.yourProgress')}</h3>
                  <span className="text-[#00C2A8] font-bold text-lg">
                    {progress.toFixed(1)} / {goalValue} {challengeData.goal_unit}
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-3 mb-2">
                  <div 
                    className="bg-gradient-to-r from-[#00C2A8] to-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-right text-gray-300 text-sm">{percentage.toFixed(1)}% {t('community.challenge.complete')}</p>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {challengeData.leaderboard && challengeData.leaderboard.length > 0 && (
            <div className="border-0 bg-gray-800 mb-6" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4" className="p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  {t('community.challenge.leaderboard')}
                </h3>
                <div className="space-y-2">
                  {challengeData.leaderboard.slice(0, 10).map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between py-2 border-b border-gray-700">
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                          #{index + 1}
                        </span>
                        <div className="relative">
                          {participant.athlete_profile_picture ? (
                            <>
                              <img src={participant.athlete_profile_picture} alt={participant.athlete_name} className="w-8 h-8 rounded-full" />
                              <FlagIcon nationality={participant.nationality} />
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm">{participant.athlete_name.charAt(0)}</span>
                              </div>
                              <FlagIcon nationality={participant.nationality} />
                            </>
                          )}
                        </div>
                        <span className="text-white flex items-center">
                          {participant.athlete_name}
                          <SubscriptionBadge subscriptionTier={participant.subscription_tier} />
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[#00C2A8] font-semibold">
                          {participant.current_progress.toFixed(1)} {challengeData.goal_unit}
                        </p>
                        <p className="text-gray-400 text-xs">{participant.percentage_complete.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="border-0 bg-gray-800 mb-6" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4" className="p-4">
              <h3 className="text-white font-semibold mb-4">{t('community.challenge.comments')}</h3>
              
              {/* Add Comment */}
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  placeholder={t('community.challenge.addComment')}
                />
                <button
                  onClick={handleAddComment}
                  className="px-4 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {challengeData.comments && challengeData.comments.length > 0 ? (
                  challengeData.comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3 py-2">
                      {comment.athlete_profile_picture ? (
                        <img src={comment.athlete_profile_picture} alt={comment.athlete_name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">{comment.athlete_name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium text-sm flex items-center">
                            {comment.athlete_name}
                            <SubscriptionBadge subscriptionTier={comment.subscription_tier} />
                          </span>
                          <span className="text-gray-500 text-xs">{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-300 text-sm mt-1">{comment.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">{t('community.challenge.noCommentsYet')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex space-x-2">
              {!isCreator && (
                hasJoined ? (
                  <button
                    onClick={onLeave}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    {t('community.challenge.leaveChallenge')}
                  </button>
                ) : (
                  <button
                    onClick={onJoin}
                    className="px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors"
                  >
                    <Trophy className="w-4 h-4 inline mr-2" />
                    {t('community.challenge.joinChallenge')}
                  </button>
                )
              )}
            </div>
            {isCreator && (
              <button
                onClick={onDelete}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 inline mr-2" />
                {t('community.challenge.deleteChallenge')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// EditChallengeModal Component
const EditChallengeModal = ({ challengeData, setChallengeData, onClose, onSave }) => {
  const { t } = useTranslation();
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressBannerImage(file);
        setChallengeData({ ...challengeData, [type]: compressed });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Edit2 className="w-6 h-6 mr-2 text-[#00C2A8]" />
              Edit Challenge
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Title</label>
              <input
                type="text"
                value={challengeData.title}
                onChange={(e) => setChallengeData({ ...challengeData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">{t('common.description')}</label>
              <textarea
                value={challengeData.description}
                onChange={(e) => setChallengeData({ ...challengeData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Goal Value</label>
                <input
                  type="number"
                  value={challengeData.goal_value}
                  onChange={(e) => setChallengeData({ ...challengeData, goal_value: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">End Date</label>
                <input
                  type="date"
                  value={challengeData.end_date}
                  onChange={(e) => setChallengeData({ ...challengeData, end_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Visibility</label>
              <select
                value={challengeData.visibility}
                onChange={(e) => setChallengeData({ ...challengeData, visibility: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.coverPhoto')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'cover_photo')}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#00C2A8] file:text-white hover:file:bg-[#00a890]"
                />
                {challengeData.cover_photo && (
                  <img src={challengeData.cover_photo} alt="Cover preview" className="mt-2 w-full h-32 object-cover rounded-lg" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.trophyBadge')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'trophy_image')}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
                />
                {challengeData.trophy_image && (
                  <img src={challengeData.trophy_image} alt="Trophy preview" className="mt-2 w-32 h-32 object-cover rounded-lg mx-auto" />
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={onSave}
                className="px-6 py-2 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg transition-colors"
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// CreateEventModal Component
const CreateEventModal = ({ eventData, setEventData, onClose, onCreate, myGroups, onEmojiSelect }) => {
  const { t } = useTranslation();
  
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
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="rounded-none md:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden"
        style={{ background: 'var(--grad-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('community.modals.createEvent')}</h2>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.eventIcon')}</label>
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
                  {eventData.profile_image ? t('common.change') : t('common.upload')}
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
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.banner')}</label>
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
                {eventData.cover_photo ? t('common.change') : t('common.upload')}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.eventName')}</label>
            <input
              type="text"
              value={eventData.name}
              onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
              placeholder={t('community.event.enterEventName')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.description')}</label>
            <div className="relative">
              <textarea
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                placeholder={t('community.event.describeEvent')}
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
              <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.date')}</label>
              <input
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.time')}</label>
              <input
                type="time"
                value={eventData.event_time}
                onChange={(e) => setEventData({ ...eventData, event_time: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.location')}</label>
            <input
              type="text"
              value={eventData.location}
              onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
              placeholder={t('community.event.eventLocation')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.visibility')}</label>
            <select
              value={eventData.visibility}
              onChange={(e) => setEventData({ ...eventData, visibility: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="open">{t('community.event.visibilityOpen')}</option>
              <option value="private">{t('community.event.visibilityPrivate')}</option>
            </select>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.connectToGroup')}</label>
            <select
              value={eventData.group_id || ''}
              onChange={(e) => setEventData({ ...eventData, group_id: e.target.value || null })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="">{t('community.event.noGroup')}</option>
              {myGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">{t('community.event.groupNotificationHelp')}</p>
          </div>
        </div>
        
        <div className="p-6 pt-4 flex space-x-3">
          <Button onClick={onCreate} className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white">
            {t('common.createEvent')}
          </Button>
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

// EditEventModal Component (similar to Create but for editing)
const EditEventModal = ({ eventData, setEventData, onClose, onSave, myGroups }) => {
  const { t } = useTranslation();
  
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
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
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
                  {eventData.profile_image ? t('common.change') : t('common.upload')}
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
                {eventData.cover_photo ? t('common.change') : t('common.upload')}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.eventName')}</label>
            <input
              type="text"
              value={eventData.name}
              onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.description')}</label>
            <textarea
              value={eventData.description}
              onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.date')}</label>
              <input
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.time')}</label>
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
            {t('common.saveChanges')}
          </Button>
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

// EventDetailModal Component
const EventDetailModal = ({ eventData, loading, onClose, athleteId, isSuperAdmin, loadAthleteProfile, onAddComment, commentText, setCommentText, onEmojiSelect, formatMentions, onDeleteComment }) => {
  const { t } = useTranslation();
  
  if (loading || !eventData) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
        onClick={onClose}
      >
        <div className="bg-gray-800 rounded-lg p-8 text-white">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00C2A8]"></div>
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
                    <span className="text-[#00C2A8] font-semibold">{eventData.going_count || 0} {t('community.event.going')}</span>
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
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00C2A8] rounded-full flex items-center justify-center flex-shrink-0">
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
              {t('common.close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// CommentsModal Component
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


export default Community;
