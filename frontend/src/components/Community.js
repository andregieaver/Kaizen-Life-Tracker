import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Heart, MessageCircle, Share2, Send, Edit2, Edit3, Trash2, Camera, X, Bell, UserPlus, UserMinus, Users as UsersIcon, Lock, Globe, Crown, Shield, Search, Home, UserCheck, ThumbsUp, ThumbsDown, Calendar, Clock, MapPin, Star, RefreshCw, Video, Image as ImageIcon, GripVertical, Trophy, Target, TrendingUp, Award, Plus, PlusCircle, Smile } from 'lucide-react';
import { compressPostImage, compressThumbnail, compressBannerImage } from '../utils/imageCompression';
import { findMentionTrigger, insertMention, formatMentions } from '../utils/mentionUtils';
import EmojiPickerButton from './EmojiPickerButton';
import ConfirmationModal from './ConfirmationModal';
import ImageCarousel from './ImageCarousel';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import SubscriptionBadge from './SubscriptionBadge';
import FlagIcon from './FlagIcon';
import CommentsModal from './community/modals/CommentsModal';
import EventDetailModal from './community/modals/EventDetailModal';
import CreateEventModal from './community/modals/CreateEventModal';
import EditEventModal from './community/modals/EditEventModal';
import CreateGroupModal from './community/modals/CreateGroupModal';
import EditGroupModal from './community/modals/EditGroupModal';
import CreateChallengeModal from './community/modals/CreateChallengeModal';
import EditChallengeModal from './community/modals/EditChallengeModal';
import ChallengeDetailModal from './community/modals/ChallengeDetailModal';
import AthleteProfileModal from './community/modals/AthleteProfileModal';
import AthletesModal from './community/modals/AthletesModal';
import GroupRulesModal from './community/modals/GroupRulesModal';
import GroupCard from './community/cards/GroupCard';
import ChallengeCard from './community/cards/ChallengeCard';
import EventCard from './community/cards/EventCard';
import PostsList from './community/views/PostsList';
import GroupDetailView from './community/views/GroupDetailView';
import { CommunityEvents, CommunityChallenges, CommunityGroups, CommunityMyGroups, FeedTab, FollowingTab } from './community/tabs';
import { useMediaUpload, useMentions, usePostActions, useComments, useNotifications } from '../hooks/community';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Community = ({ athleteId, athlete, showNotifications: externalShowNotifications, setShowNotifications: externalSetShowNotifications, setCommunityUnreadCount: externalSetCommunityUnreadCount, headerProgress = 1, footerProgress = 1, onOpenMessages }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  
  // Custom hooks for media upload and mentions
  const mediaUpload = useMediaUpload();
  const {
    selectedMedia,
    setSelectedMedia,
    isUploadingMedia,
    setIsUploadingMedia,
    draggedIndex,
    handleMediaSelect,
    handleRemoveMedia,
    clearMedia: clearMediaUpload,
    uploadMediaFiles,
    dragHandlers
  } = mediaUpload;

  const mentions = useMentions();
  const {
    showMentionDropdown,
    mentionResults,
    mentionSearchText,
    mentionPosition,
    activeMentionContext,
    searchAthletes,
    handleTextChange: handleMentionTextChange,
    selectMention,
    closeMentionDropdown,
    formatMentions,
    MentionDropdown
  } = mentions;
  
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
  
  // Custom hooks for post actions, comments, and notifications
  const postActions = usePostActions(athleteId);
  const {
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    sharePost,
    loadPosts: loadPostsFromHook,
    isCreating,
    isUpdating,
    isDeleting,
    isLiking,
    isSharing
  } = postActions;

  const commentsHook = useComments(athleteId);
  const {
    comments: commentsFromHook,
    loadComments: loadCommentsFromHook,
    addComment,
    deleteComment: deleteCommentFromHook,
    getPostComments,
    clearPostComments,
    isAdding: isAddingComment,
    isDeleting: isDeletingComment
  } = commentsHook;

  const notificationsHook = useNotifications(athleteId, false);
  const {
    notifications: notificationsFromHook,
    unreadCount: unreadCountFromHook,
    loadNotifications: loadNotificationsFromHook,
    markAsRead,
    markAllAsRead,
    isLoading: isLoadingNotifications
  } = notificationsHook;
  
  // Use hook values or manage locally
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(externalShowNotifications !== undefined ? externalShowNotifications : false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Sync hook notifications with local state
  useEffect(() => {
    if (notificationsFromHook.length > 0) {
      setNotifications(notificationsFromHook);
      setUnreadCount(unreadCountFromHook);
      setNotificationsLoaded(true);
    }
  }, [notificationsFromHook, unreadCountFromHook]);
  
  // Use external controls if provided
  const effectiveShowNotifications = externalShowNotifications !== undefined ? externalShowNotifications : showNotifications;
  const effectiveSetShowNotifications = externalSetShowNotifications || setShowNotifications;
  
  // Refs for text areas
  const newPostRef = useRef(null);
  const commentRefs = useRef({});
  const newEventDescRef = useRef(null);
  
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
  // Simple scroll detection for FAB visibility
  useEffect(() => {
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;

      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }

      if (scrollY > lastScrollY && scrollY > 80) {
        setScrollDirection('down');
      } else if (scrollY < lastScrollY) {
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
        logger.debug(null, '[Community] Profile picture updated, refreshing community data...');
        
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
      logger.debug(null, 'Posts loaded:', response.data);
      logger.debug(null, 'First post full data:', JSON.stringify(response.data.posts?.[0], null, 2));
      logger.debug(null, 'First post comments_count:', response.data.posts?.[0]?.comments_count);
      
      if (response.data && response.data.posts) {
        setPosts(response.data.posts.map(p => ({ ...p, type: 'post' })));
      } else {
        logger.error(null, 'No posts in response:', response.data);
        setPosts([]);
      }
      
      setPostsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      logger.error(null, 'Error loading posts:', error);
      logger.error(null, 'Error details:', error.response?.data);
      setPosts([]);
      setIsLoading(false);
    }
  };

  const loadFollowingPosts = async (forceReload = false) => {
    try {
      setIsLoading(true);
      // Load posts from people the user follows
      const response = await axios.get(`${API}/community/following-feed/${athleteId}?limit=10`);
      logger.debug(null, 'Following posts loaded:', response.data);
      
      if (response.data && response.data.posts) {
        setFollowingPosts(response.data.posts.map(p => ({ ...p, type: 'post' })));
      } else {
        logger.error(null, 'No following posts in response:', response.data);
        setFollowingPosts([]);
      }
      
      setFollowingPostsLoaded(true);
      setIsLoading(false);
    } catch (error) {
      logger.error(null, 'Error loading following posts:', error);
      logger.error(null, 'Error details:', error.response?.data);
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
      logger.error(null, 'Error loading groups:', error);
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
      logger.error(null, 'Error loading my groups:', error);
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
      logger.error(null, 'Error loading notifications:', error);
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

  const loadAthleteProfile = async (targetAthleteId, requestContext = null) => {
    // Temporary debugging
    window.alert(`DEBUG: loadAthleteProfile called\nAthleteId: ${targetAthleteId}\nRequestContext: ${JSON.stringify(requestContext)}`);
    console.log('Loading athlete profile:', targetAthleteId, 'requestContext:', requestContext);
    setProfileLoading(true);
    try {
      const response = await axios.get(`${API}/community/profile/${targetAthleteId}?viewer_athlete_id=${athleteId}`);
      const profileWithContext = {
        ...response.data,
        requestContext // Add request context if present (follow_request or message_request)
      };
      console.log('Profile loaded with context:', profileWithContext);
      window.alert(`DEBUG: Profile loaded successfully, about to show modal`);
      setProfileData(profileWithContext);
      setShowProfile(true);
    } catch (error) {
      console.error('Error loading profile:', error);
      logger.error(null, 'Error loading profile:', error);
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
        followers_count: response.data.followers_count,
        follow_request_sent: response.data.request_sent || false
      });
    } catch (error) {
      logger.error(null, 'Error toggling follow:', error);
    }
  };

  const handleAcceptFollowRequest = async (requestId) => {
    try {
      const response = await axios.post(`${API}/community/follow-request/${requestId}/accept?athlete_id=${athleteId}`);
      
      // Check if already accepted
      if (response.data.already_accepted) {
        alert('This follow request has already been accepted');
        setShowProfile(false);
        await loadNotifications();
        return;
      }
      
      // Reload the profile to get updated data
      await loadAthleteProfile(profileData.id);
      // Reload notifications
      await loadNotifications();
      // Close the modal on success
      setShowProfile(false);
    } catch (error) {
      logger.error(null, 'Error accepting follow request:', error);
      alert('Failed to accept follow request');
    }
  };

  const handleDeclineFollowRequest = async (requestId) => {
    try {
      const response = await axios.post(`${API}/community/follow-request/${requestId}/decline?athlete_id=${athleteId}`);
      
      // Check if already handled
      if (response.data.already_declined) {
        alert('This follow request has already been declined');
      } else if (response.data.already_accepted) {
        alert('Cannot decline an already accepted request');
      }
      
      // Close the profile modal
      setShowProfile(false);
      // Reload notifications
      await loadNotifications();
    } catch (error) {
      logger.error(null, 'Error declining follow request:', error);
      alert('Failed to decline follow request');
    }
  };

  const handleAcceptMessageRequest = async (requestId) => {
    try {
      const response = await axios.post(`${API}/messages/request/${requestId}/accept?athlete_id=${athleteId}`);
      
      // Check if already accepted
      if (response.data.already_accepted) {
        alert('This message request has already been accepted');
        setShowProfile(false);
        await loadNotifications();
        return;
      }
      
      // Reload the profile to get updated data
      await loadAthleteProfile(profileData.id);
      // Reload notifications
      await loadNotifications();
      // Close the modal on success
      setShowProfile(false);
    } catch (error) {
      logger.error(null, 'Error accepting message request:', error);
      alert('Failed to accept message request');
    }
  };

  const handleDeclineMessageRequest = async (requestId) => {
    try {
      const response = await axios.post(`${API}/messages/request/${requestId}/decline?athlete_id=${athleteId}`);
      
      // Check if already handled
      if (response.data.already_declined) {
        alert('This message request has already been declined');
      } else if (response.data.already_accepted) {
        alert('Cannot decline an already accepted request');
      }
      
      // Close the profile modal
      setShowProfile(false);
      // Reload notifications
      await loadNotifications();
    } catch (error) {
      logger.error(null, 'Error declining message request:', error);
      alert('Failed to decline message request');
    }
  };

  const handleMessageUser = async (targetUserId, targetPrivacyLevel, messageRequestSent) => {
    // If user is private, do nothing (button should be hidden)
    if (targetPrivacyLevel === 'private') {
      return;
    }
    
    // If user is guarded and no request sent yet, send message request
    if (targetPrivacyLevel === 'guarded' && !messageRequestSent) {
      try {
        await axios.post(`${API}/messages/request?requester_id=${athleteId}&target_id=${targetUserId}`);
        // Update the profile data to show request sent
        if (profileData && profileData.id === targetUserId) {
          setProfileData({
            ...profileData,
            message_request_sent: true
          });
        }
        // Reload athletes list if in find user modal
        if (showAthletes) {
          await loadAthletes(athletesSearch);
        }
      } catch (error) {
        logger.error(null, 'Error sending message request:', error);
        alert('Failed to send message request');
      }
      return;
    }
    
    // If public or guarded with approved request, open messages modal
    if (profileData) {
      setShowProfile(false);
    }
    if (showAthletes) {
      setShowAthletes(false);
    }
    onOpenMessages && onOpenMessages(targetUserId);
  };


  const loadAthletes = async (searchQuery = '') => {
    setAthletesLoading(true);
    try {
      const response = await axios.get(`${API}/community/athletes?viewer_athlete_id=${athleteId}&search=${searchQuery}`);
      setAthletes(response.data.athletes);
    } catch (error) {
      logger.error(null, 'Error loading athletes:', error);
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
      logger.error(null, 'Error toggling follow:', error);
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


  // Media upload and drag handlers now handled by useMediaUpload hook
  const { handleDragStart, handleDragOver, handleDrop, handleDragEnd } = dragHandlers;

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
      logger.error(null, 'Error uploading edit media:', error);
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

  // Mention handling functions - using useMentions hook
  const handlePostContentChange = (e) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setNewPostContent(text);
    handleMentionTextChange(text, cursorPosition, e.target, 'newPost');
  };

  const handleSelectMention = (athlete) => {
    const newText = selectMention(newPostContent, newPostRef.current.selectionStart, athlete, newPostRef);
    setNewPostContent(newText);
  };

  const handleCommentContentChange = (postId, e) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setCommentText({ ...commentText, [postId]: text });
    handleMentionTextChange(text, cursorPosition, e.target, `comment-${postId}`);
  };

  const handleSelectCommentMention = (postId, athlete) => {
    const currentText = commentText[postId] || '';
    const textarea = commentRefs.current[postId];
    const newText = selectMention(currentText, textarea.selectionStart, athlete, { current: textarea });
    setCommentText({ ...commentText, [postId]: newText });
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
      logger.error(null, 'Error creating post:', error);
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
          logger.error(null, 'Error fetching YouTube metadata:', error);
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
            logger.error(null, 'Error fetching URL preview:', error);
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
      logger.error(null, 'Error creating post:', error);
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
      logger.error(null, 'Error processing image:', error);
      alert('Failed to process image');
    }
  };


  const handleStartEditPost = (post) => {
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
      logger.error(null, 'Error editing post:', error);
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
          logger.error(null, 'Error deleting post:', error);
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
      logger.error(null, 'Error toggling like:', error);
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

      logger.debug(null, 'Comment added, backend response:', response.data);
      logger.debug(null, 'Updated comments_count from backend:', response.data.comments_count);

      // Reload comments
      const commentsResponse = await axios.get(`${API}/community/posts/${targetPostId}/comments`);
      
      // Update posts with new comments and count - USING FUNCTIONAL UPDATE
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === targetPostId) {
          logger.debug(null, 'Updating post in feed, old count:', post.comments_count, 'new count:', response.data.comments_count);
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
      logger.error(null, 'Error adding comment:', error);
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
          logger.error(null, 'Error deleting comment:', error);
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
          logger.error(null, 'Error deleting event comment:', error);
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
      logger.error(null, 'Error adding event comment:', error);
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
        logger.error(null, 'Error loading event comments:', error);
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
      logger.error(null, 'Error loading comments:', error);
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
      logger.error(null, 'Error sharing post:', error);
      alert('Failed to share post');
    }
  };

  const toggleComments = async (postId) => {
    // Try to find post in either feed
    let post = posts.find(p => p.id === postId);
    if (!post) {
      post = followingPosts.find(p => p.id === postId);
    }
    
    // If post not found (e.g., it's a shared post), fetch it from API
    if (!post) {
      try {
        const response = await axios.get(`${API}/community/posts/${postId}?athlete_id=${athleteId}`);
        post = response.data;
      } catch (error) {
        logger.error(null, 'Error loading shared post:', error);
        return;
      }
    }
    
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
        logger.error(null, 'Error loading comments:', error);
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
      logger.error(null, 'Error toggling comment like:', error);
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
      logger.error(null, 'Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Temporary debugging - log to both container and create visible alert
    window.alert(`DEBUG: Notification clicked\nType: ${notification.type}\nFrom: ${notification.from_athlete_id}\nAction: ${notification.action_id}`);
    console.log('🔔 Notification clicked - Type:', notification.type, 'From:', notification.from_athlete_id, 'Action:', notification.action_id);
    
    try {
      await markNotificationRead(notification.id);
    } catch (err) {
      logger.error(null, 'Error marking notification as read:', err);
    }
    
    // Handle different notification types
    if (notification.type === 'follow_request' && notification.from_athlete_id) {
      console.log('✅ Opening profile for FOLLOW REQUEST');
      window.alert(`DEBUG: Matched follow_request condition, about to load profile`);
      effectiveSetShowNotifications(false);
      await loadAthleteProfile(notification.from_athlete_id, { 
        requestType: 'follow', 
        requestId: notification.action_id 
      });
    } else if (notification.type === 'message_request' && notification.from_athlete_id) {
      console.log('✅ Opening profile for MESSAGE REQUEST');
      window.alert(`DEBUG: Matched message_request condition, about to load profile`);
      effectiveSetShowNotifications(false);
      await loadAthleteProfile(notification.from_athlete_id, { 
        requestType: 'message', 
        requestId: notification.action_id 
      });
    } else if (notification.type === 'follow' && notification.from_athlete_id) {
      effectiveSetShowNotifications(false);
      await loadAthleteProfile(notification.from_athlete_id);
    } else if (notification.type === 'mention' && notification.post_id) {
      setActiveTab('feed');
      effectiveSetShowNotifications(false);
      
      try {
        const response = await axios.get(`${API}/community/posts/${notification.post_id}?athlete_id=${athleteId}`);
        const post = response.data;
        
        const commentsResponse = await axios.get(`${API}/community/posts/${notification.post_id}/comments?athlete_id=${athleteId}`);
        post.comments = commentsResponse.data.comments;
        post.comments_count = commentsResponse.data.comments.length;
        
        setSelectedPostForComments(post);
        setShowCommentsModal(true);
      } catch (error) {
        logger.error(null, 'Error loading post from notification:', error);
      }
    } else if (notification.post_id && ['like', 'comment', 'share'].includes(notification.type)) {
      setActiveTab('feed');
      effectiveSetShowNotifications(false);
      
      try {
        const response = await axios.get(`${API}/community/posts/${notification.post_id}?athlete_id=${athleteId}`);
        const post = response.data;
        
        const commentsResponse = await axios.get(`${API}/community/posts/${notification.post_id}/comments?athlete_id=${athleteId}`);
        post.comments = commentsResponse.data.comments;
        post.comments_count = commentsResponse.data.comments.length;
        
        setSelectedPostForComments(post);
        setShowCommentsModal(true);
      } catch (error) {
        logger.error(null, 'Error loading post:', error);
      }
    } else if (notification.post_id) {
      setActiveTab('feed');
      effectiveSetShowNotifications(false);
      
      try {
        const response = await axios.get(`${API}/community/posts/${notification.post_id}?athlete_id=${athleteId}`);
        const post = response.data;
        
        const commentsResponse = await axios.get(`${API}/community/posts/${notification.post_id}/comments?athlete_id=${athleteId}`);
        post.comments = commentsResponse.data.comments;
        post.comments_count = commentsResponse.data.comments.length;
        
        const postExists = posts.find(p => p.id === notification.post_id);
        if (!postExists) {
          setPosts([{ ...post, type: 'post' }, ...posts]);
        }
        
        setSelectedPostForComments(post);
        setShowCommentsModal(true);
      } catch (error) {
        logger.error(null, 'Error loading post:', error);
      }
    } else {
      effectiveSetShowNotifications(false);
    }
  };

  // Handle URL parameters from notifications
  useEffect(() => {
    const view = searchParams.get('view');
    const athleteIdParam = searchParams.get('athleteId');
    const postIdParam = searchParams.get('postId');
    const requestType = searchParams.get('requestType'); // follow or message
    const requestId = searchParams.get('requestId'); // action_id for the request
    
    if (view === 'profile' && athleteIdParam) {
      // If requestType and requestId are present, pass them as context for accept/decline UI
      const requestContext = (requestType && requestId) ? { requestType, requestId } : null;
      loadAthleteProfile(athleteIdParam, requestContext);
      setSearchParams({});
    } else if (view === 'post' && postIdParam) {
      axios.get(`${API}/community/posts/${postIdParam}?athlete_id=${athleteId}`)
        .then(response => {
          const post = response.data;
          return axios.get(`${API}/community/posts/${postIdParam}/comments?athlete_id=${athleteId}`)
            .then(commentsResponse => {
              post.comments = commentsResponse.data.comments;
              post.comments_count = commentsResponse.data.comments.length;
              setSelectedPostForComments(post);
              setShowCommentsModal(true);
              setSearchParams({});
            });
        })
        .catch(error => {
          logger.error(null, 'Error loading post from URL:', error);
          setSearchParams({});
        });
    }
  }, [searchParams, athleteId]);

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
      logger.error(null, 'Error creating group:', error);
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
      logger.error(null, 'Error editing group:', error);
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
      logger.error(null, 'Error deleting group:', error);
      if (error.response?.status === 403) {
        alert('Only group admins and super admins can delete groups');
      } else {
        alert(error.response?.data?.detail || 'Failed to delete group');
      }
    }
  };

  const handleOpenEditGroup = (group) => {
    const groupToEdit = group || selectedGroup;
    if (!groupToEdit) {
      logger.error(null, 'No group provided to edit');
      return;
    }
    setEditGroupData({
      name: groupToEdit.name,
      description: groupToEdit.description,
      privacy: groupToEdit.privacy,
      profile_image: groupToEdit.profile_image,
      cover_photo: groupToEdit.cover_photo,
      rules: groupToEdit.rules || ''
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
      logger.error(null, 'Error joining group:', error);
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
      logger.error(null, 'Error joining group:', error);
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
      logger.error(null, 'Error leaving group:', error);
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
      logger.error(null, 'Error loading group details:', error);
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
      logger.error(null, 'Error creating group post:', error);
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
      logger.error(null, 'Error loading events:', error);
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
      logger.error(null, 'Error creating event:', error);
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
      logger.error(null, 'Error editing event:', error);
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
      logger.error(null, 'Error deleting event:', error);
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
      logger.error(null, 'Error loading challenges:', error);
      setIsLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    logger.debug(null, '🔍 DEBUG: handleCreateChallenge called');
    logger.debug(null, '🔍 DEBUG: athleteId:', athleteId);
    logger.debug(null, '🔍 DEBUG: newChallengeData:', JSON.stringify(newChallengeData, null, 2));
    
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

    logger.debug(null, '🔍 DEBUG: Validation passed, sending request to:', `${API}/community/challenges?athlete_id=${athleteId}`);
    logger.debug(null, '🔍 DEBUG: Request payload:', newChallengeData);

    try {
      const response = await axios.post(`${API}/community/challenges?athlete_id=${athleteId}`, newChallengeData);
      logger.debug(null, '✅ DEBUG: Challenge created successfully:', response.data);
      setShowCreateChallenge(false);
      setNewChallengeData({
        title: '', description: '', challenge_type: 'distance', goal_value: '', goal_unit: 'km',
        start_date: '', end_date: '', visibility: 'public', competition_type: 'individual',
        cover_photo: null, trophy_image: null, is_recurring: false, recurrence_frequency: 'weekly', recurrence_count: 4
      });
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
    } catch (error) {
      logger.error(null, '❌ DEBUG: Error creating challenge:', error);
      logger.error(null, '❌ DEBUG: Error response:', error.response?.data);
      logger.error(null, '❌ DEBUG: Error status:', error.response?.status);
      logger.error(null, '❌ DEBUG: Error headers:', error.response?.headers);
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
      logger.error(null, 'Error editing challenge:', error);
      alert('Failed to edit challenge');
    }
  };

  const handleJoinChallenge = async (challengeId) => {
    logger.debug(null, '🔍 DEBUG: Joining challenge:', challengeId);
    logger.debug(null, '🔍 DEBUG: AthleteId:', athleteId);
    try {
      const response = await axios.post(`${API}/community/challenges/${challengeId}/join?athlete_id=${athleteId}`);
      logger.debug(null, '✅ DEBUG: Successfully joined challenge:', response.data);
      alert('Successfully joined challenge!');
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
      if (showChallengeDetail && challengeDetailData?.id === challengeId) {
        handleOpenChallengeDetail(challengeId);
      }
    } catch (error) {
      logger.error(null, '❌ DEBUG: Error joining challenge:', error);
      logger.error(null, '❌ DEBUG: Error response:', error.response?.data);
      alert(error.response?.data?.detail || 'Failed to join challenge');
    }
  };

  const handleLeaveChallenge = async (challengeId) => {
    if (!window.confirm('Are you sure you want to leave this challenge?')) return;

    logger.debug(null, '🔍 DEBUG: Leaving challenge:', challengeId);
    logger.debug(null, '🔍 DEBUG: AthleteId:', athleteId);
    try {
      const response = await axios.post(`${API}/community/challenges/${challengeId}/leave?athlete_id=${athleteId}`);
      logger.debug(null, '✅ DEBUG: Successfully left challenge:', response.data);
      alert('Successfully left challenge!');
      setChallengesLoaded(false);
      loadChallenges(challengeFilter);
      if (showChallengeDetail && challengeDetailData?.id === challengeId) {
        handleOpenChallengeDetail(challengeId);
      }
    } catch (error) {
      logger.error(null, '❌ DEBUG: Error leaving challenge:', error);
      logger.error(null, '❌ DEBUG: Error response:', error.response?.data);
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
      logger.error(null, 'Error deleting challenge:', error);
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
        logger.error(null, 'Error loading challenge comments:', commentError);
        response.data.comments = [];
      }
      
      setChallengeDetailData(response.data);
    } catch (error) {
      logger.error(null, 'Error loading challenge details:', error);
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
      logger.error(null, 'Error adding challenge comment:', error);
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
        logger.error(null, 'Error loading event comments:', commentError);
        response.data.comments = []; // Set empty array if comments fail to load
      }
      
      setEventDetailData(response.data);
    } catch (error) {
      logger.error(null, 'Error loading event details:', error);
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
      logger.error(null, 'Error RSVP:', error);
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
      className="min-h-screen sm:max-w-5xl sm:mx-auto space-y-0 sm:space-y-6 p-0 sm:p-2 md:p-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with Tabs and Notifications */}
      <div 
        className="fixed top-16 left-0 right-0 z-30 md:relative md:top-auto space-y-0 sm:space-y-3 mb-0 sm:mb-6 md:translate-y-0 md:opacity-100"
        style={{
          transform: `translate3d(0, calc(${(1 - headerProgress) * -100}% - ${(1 - headerProgress) * 4}rem), 0)`,
          opacity: 0.08 + headerProgress * 0.92,
          pointerEvents: headerProgress > 0.05 ? 'auto' : 'none',
          willChange: 'transform, opacity'
        }}
      >
        {/* Main Navigation Tabs - Full width with no gaps on mobile */}
        <div className="flex justify-between w-full gap-0 sm:gap-2 p-0 md:p-2 bg-gray-900/95 md:bg-transparent">
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

      {/* Content Area - Clears tab bar on mobile */}
      <div className="pt-12 md:pt-0">

      {/* Feed Tab */}
      {activeTab === 'feed' && !selectedGroup && (
        <FeedTab
          posts={posts}
          isLoading={isLoading}
          nationalityFilter={nationalityFilter}
          onNationalityFilterChange={handleNationalityFilterChange}
          getUniqueNationalities={getUniqueNationalities}
          getFilteredPosts={getFilteredPosts}
          onRSVP={handleRSVP}
          onEditEvent={handleOpenEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onOpenEventDetail={handleOpenEventDetail}
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
          onLoadAthleteProfile={loadAthleteProfile}
          onStartEditPost={handleStartEditPost}
          onDeletePost={handleDeletePost}
          onEditMediaSelect={handleEditMediaSelect}
          onRemoveEditMedia={handleRemoveEditMedia}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onSetEditContent={setEditContent}
          onSetEditVisibility={setEditVisibility}
          onSetEditingPost={setEditingPost}
          onSetEditMedia={setEditMedia}
          onEditPost={handleEditPost}
          onToggleExpandPost={toggleExpandPost}
          onToggleLike={handleToggleLike}
          onToggleComments={toggleComments}
          onSharePost={handleSharePost}
          onCommentContentChange={handleCommentContentChange}
          onAddComment={handleAddComment}
          onSelectCommentMention={handleSelectCommentMention}
        />
      )}



      {/* Following Feed Tab */}
      {activeTab === 'following' && !selectedGroup && (
        <FollowingTab
          followingPosts={followingPosts}
          isLoading={isLoading}
          onRSVP={handleRSVP}
          onEditEvent={handleOpenEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onOpenEventDetail={handleOpenEventDetail}
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
          onLoadAthleteProfile={loadAthleteProfile}
          onStartEditPost={handleStartEditPost}
          onDeletePost={handleDeletePost}
          onEditMediaSelect={handleEditMediaSelect}
          onRemoveEditMedia={handleRemoveEditMedia}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onSetEditContent={setEditContent}
          onSetEditVisibility={setEditVisibility}
          onSetEditingPost={setEditingPost}
          onSetEditMedia={setEditMedia}
          onEditPost={handleEditPost}
          onToggleExpandPost={toggleExpandPost}
          onToggleLike={handleToggleLike}
          onToggleComments={toggleComments}
          onSharePost={handleSharePost}
          onCommentContentChange={handleCommentContentChange}
          onAddComment={handleAddComment}
          onSelectCommentMention={handleSelectCommentMention}
        />
      )}


      {/* Groups Tab */}
      {activeTab === 'groups' && !selectedGroup && (
        <CommunityGroups
          groups={groups}
          athleteId={athleteId}
          isSuperAdmin={isSuperAdmin}
          onJoin={handleJoinGroup}
          onEdit={handleOpenEditGroup}
          onDelete={handleDeleteGroup}
          onClick={(groupId) => loadGroupDetails(groupId)}
        />
      )}

      {/* My Groups Tab */}
      {activeTab === 'mygroups' && !selectedGroup && (
        <CommunityMyGroups
          myGroups={myGroups}
          athleteId={athleteId}
          isSuperAdmin={isSuperAdmin}
          onEdit={handleOpenEditGroup}
          onDelete={handleDeleteGroup}
          onClick={(groupId) => loadGroupDetails(groupId)}
        />
      )}


      {/* Events Tab */}
      {activeTab === 'events' && (
        <CommunityEvents
          events={events}
          athleteId={athleteId}
          isSuperAdmin={isSuperAdmin}
          onRSVP={handleRSVP}
          onEdit={handleOpenEditEvent}
          onDelete={handleDeleteEvent}
          onClick={handleOpenEventDetail}
        />
      )}

      {/* Challenges Tab */}
      {activeTab === 'challenges' && (
        <CommunityChallenges
          challenges={challenges}
          athleteId={athleteId}
          isSuperAdmin={isSuperAdmin}
          challengeFilter={challengeFilter}
          onFilterChange={(filter) => {
            setChallengeFilter(filter);
            setChallengesLoaded(false);
            loadChallenges(filter);
          }}
          onJoin={handleJoinChallenge}
          onLeave={handleLeaveChallenge}
          onDelete={handleDeleteChallenge}
          onEdit={handleOpenEditChallenge}
          onClick={handleOpenChallengeDetail}
        />
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
          handleToggleComments={toggleComments}
          setFullSizeImageUrl={setFullSizeImageUrl}
          setShowFullSizeImage={setShowFullSizeImage}
          onMessageUser={(userId) => handleMessageUser(userId, profileData.privacy_level, profileData.message_request_sent)}
          onAcceptFollowRequest={handleAcceptFollowRequest}
          onDeclineFollowRequest={handleDeclineFollowRequest}
          onAcceptMessageRequest={handleAcceptMessageRequest}
          onDeclineMessageRequest={handleDeclineMessageRequest}
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
          onMessageUser={(userId) => {
            const athlete = athletes.find(a => a.id === userId);
            if (athlete) {
              handleMessageUser(userId, athlete.privacy_level, athlete.message_request_sent);
            }
          }}
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

      </div>
      {/* End Content Area */}

      {/* Floating Action Button - Bottom Right */}
      <button
        onClick={() => setShowCreateMenu(!showCreateMenu)}
        className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(96px - ${(1 - footerProgress) * 100}px)`,
          right: '16px',
          transform: `translateY(${(1 - footerProgress) * 100}px)`,
          opacity: 0.08 + footerProgress * 0.92,
          transition: 'background 300ms',
          background: showCreateMenu ? 'var(--grad-danger)' : 'var(--grad-brand)',
          boxShadow: showCreateMenu 
            ? 'none' 
            : '0 10px 40px rgba(50,211,255,.3)',
          pointerEvents: footerProgress > 0.1 ? 'auto' : 'none',
          willChange: 'transform, opacity'
        }}
        aria-label={showCreateMenu ? "Close menu" : "Create"}
      >
        {showCreateMenu ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Plus className="w-7 h-7 text-white" />
        )}
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
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          right: '16px',
          transform: showCreateMenu 
            ? `translate(${-110}px, ${(1 - footerProgress) * 100}px)` 
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showCreateMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showCreateMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showCreateMenu ? '50ms' : '0ms',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
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
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          right: '16px',
          transform: showCreateMenu 
            ? `translate(${Math.cos(5 * Math.PI / 6) * 110}px, calc(${-Math.sin(5 * Math.PI / 6) * 110}px + ${(1 - footerProgress) * 100}px))` 
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showCreateMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showCreateMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showCreateMenu ? '100ms' : '0ms',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
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
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          right: '16px',
          transform: showCreateMenu 
            ? `translate(${Math.cos(2 * Math.PI / 3) * 110}px, calc(${-Math.sin(2 * Math.PI / 3) * 110}px + ${(1 - footerProgress) * 100}px))` 
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showCreateMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showCreateMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showCreateMenu ? '150ms' : '0ms',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
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
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          right: '16px',
          transform: showCreateMenu 
            ? `translate(0px, calc(${-110}px + ${(1 - footerProgress) * 100}px))` 
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showCreateMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showCreateMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showCreateMenu ? '200ms' : '0ms',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
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
                    style={{ background: 'var(--grad-surface)', border: '5px solid red', boxShadow: '0 0 20px red' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const alertDiv = document.createElement('div');
                      alertDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:red;color:white;padding:40px;z-index:999999;font-size:24px;border:5px solid yellow;';
                      alertDiv.textContent = 'MOBILE NOTIFICATION CLICKED! Type: ' + notification.type;
                      document.body.appendChild(alertDiv);
                      setTimeout(() => alertDiv.remove(), 3000);
                      window.alert('MOBILE NOTIFICATION CLICKED!');
                      handleNotificationClick(notification);
                    }}
                  >
                    <div className="p-4" style={{ border: '3px solid yellow' }}>
                      <p className="text-sm" style={{ color: 'var(--text-hi)', background: 'red' }}>{notification.message || notification.content}</p>
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
                      style={{ borderBottom: '1px solid var(--border)', border: '5px solid red', boxShadow: '0 0 20px red' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const alertDiv = document.createElement('div');
                        alertDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:red;color:white;padding:40px;z-index:999999;font-size:24px;border:5px solid yellow;';
                        alertDiv.textContent = 'DESKTOP NOTIFICATION CLICKED! Type: ' + notification.type;
                        document.body.appendChild(alertDiv);
                        setTimeout(() => alertDiv.remove(), 3000);
                        window.alert('DESKTOP NOTIFICATION CLICKED!');
                        handleNotificationClick(notification);
                      }}
                    >
                      <p className="text-sm" style={{ color: 'var(--text-hi)', background: 'red' }}>{notification.message || notification.content}</p>
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
// PostsList - Extracted to ./community/modals/PostsList.js or ./community/cards/PostsList.js or ./community/views/PostsList.js

// AthletesModal Component
// AthletesModal - Extracted to ./community/modals/AthletesModal.js or ./community/cards/AthletesModal.js or ./community/views/AthletesModal.js

// GroupRulesModal Component
// GroupRulesModal - Extracted to ./community/modals/GroupRulesModal.js or ./community/cards/GroupRulesModal.js or ./community/views/GroupRulesModal.js


// EventCard Component
// ChallengeCard Component
// ChallengeCard - Extracted to ./community/modals/ChallengeCard.js or ./community/cards/ChallengeCard.js or ./community/views/ChallengeCard.js

// EventCard - Extracted to ./community/modals/EventCard.js or ./community/cards/EventCard.js or ./community/views/EventCard.js

// CreateChallengeModal Component
// CreateChallengeModal - Extracted to ./community/modals/CreateChallengeModal.js or ./community/cards/CreateChallengeModal.js or ./community/views/CreateChallengeModal.js

// ChallengeDetailModal Component
// ChallengeDetailModal - Extracted to ./community/modals/ChallengeDetailModal.js or ./community/cards/ChallengeDetailModal.js or ./community/views/ChallengeDetailModal.js

// EditChallengeModal Component
// EditChallengeModal - Extracted to ./community/modals/EditChallengeModal.js or ./community/cards/EditChallengeModal.js or ./community/views/EditChallengeModal.js

// CreateEventModal Component
// CreateEventModal - Extracted to ./community/modals/CreateEventModal.js or ./community/cards/CreateEventModal.js or ./community/views/CreateEventModal.js

// EditEventModal Component (similar to Create but for editing)
// EditEventModal - Extracted to ./community/modals/EditEventModal.js or ./community/cards/EditEventModal.js or ./community/views/EditEventModal.js

// EventDetailModal Component
// EventDetailModal - Extracted to ./community/modals/EventDetailModal.js or ./community/cards/EventDetailModal.js or ./community/views/EventDetailModal.js

// CommentsModal Component
export default Community;
