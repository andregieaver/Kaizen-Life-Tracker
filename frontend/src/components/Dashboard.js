import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Home, MessageCircle, PlusCircle, BarChart3, User, Menu, X, Settings, BookOpen, Utensils, Calendar, Zap, Activity, FileText, LineChart, Mic, Pill, Brain, ChefHat, Calculator, Check, Users, Gift, Bell, Repeat, GlassWater, Edit3, UserPlus, Heart, Share2, Trophy, ArrowRight, ExternalLink, Circle, ShoppingCart, MessageSquare } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import ReadinessCard from './ReadinessCard';
import CoachChat from './CoachChat';
import Recommendations from './Recommendations';
import WorkoutHistory from './WorkoutHistory';
import Account from './Account';
import Merits from './Merits';
import Journal from './Journal';
import Nutrition from './Nutrition';
import Supplements from './Supplements';
import Schedules from './Schedules';
import HabitTracker from './HabitTracker';
import Memories from './Memories';
import Today from './Today';
import TrainingCalendar from './TrainingCalendar';
import Documents from './Documents';
import TestsAnalytics from './TestsAnalytics';
import RecipesPage from './RecipesPage';
import CalculatorsConverters from './CalculatorsConverters';
import Community from './Community';
import Referrals from './Referrals';
import SystemSettings from './SystemSettings';
import CRM from './CRM';
import Orders from './Orders';
import UserProfile from './UserProfile';
import OrderDetail from './OrderDetail';
import Subscriptions from './Subscriptions';
import Pages from './Pages';
import PageEditor from './PageEditor';
import MenuEditor from './MenuEditor';
import Emails from './Emails';
import Drinks from './Drinks';
import Support from './Support';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ athleteId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { tab } = useParams();
  const [athlete, setAthlete] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [ytdDistance, setYtdDistance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [communityUnreadCount, setCommunityUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [notificationTab, setNotificationTab] = useState('all'); // all, follows, posts, groups, events, challenges
  
  // SEO settings state
  const [siteTitle, setSiteTitle] = useState('TrainSmart');
  const [logoUrl, setLogoUrl] = useState(null);
  
  // Module settings state
  const [moduleSettings, setModuleSettings] = useState({
    affiliateProgram: { enabled: true },
    community: { enabled: true }
  });
  
  // Menu settings state
  const [menuItems, setMenuItems] = useState({
    slideout_menu: [],
    header_logged_in: []
  });
  
  // Scroll animation state
  const [scrollDirection, setScrollDirection] = useState('none'); // 'none' on initial load to show elements
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  // Floating Action Button state
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  
  // Bottom tab bar state for tracking previous selection (for animation)
  const [previousTab, setPreviousTab] = useState('overview');
  
  // Check if we're on nested pages
  const isUserProfilePage = location.pathname.includes('/dashboard/crm/user/');
  const isOrderDetailPage = location.pathname.match(/\/dashboard\/orders\/[^/]+$/) && !location.pathname.endsWith('/orders');
  const isPageEditorPage = location.pathname.includes('/dashboard/pages/edit/') || location.pathname.includes('/dashboard/pages/new');
  const isMenuEditorPage = location.pathname === '/dashboard/menus';
  
  // Extract pageId from URL for page editor
  const getPageIdFromUrl = () => {
    if (location.pathname.includes('/dashboard/pages/new')) {
      return 'new';
    }
    const match = location.pathname.match(/\/dashboard\/pages\/edit\/([^/]+)/);
    return match ? match[1] : null;
  };
  const pageIdFromUrl = getPageIdFromUrl();
  
  // Determine active tab from URL, default to overview
  const activeTab = tab || 'overview';

  // Update the DOM attribute when activeTab changes (for CSS transform-origin)
  useEffect(() => {
    const tabSwitcher = document.querySelector('.bottom-tab-switcher');
    if (tabSwitcher && previousTab) {
      tabSwitcher.setAttribute('data-previous', previousTab);
    }
  }, [activeTab, previousTab]);

  useEffect(() => {
    loadDashboardData();
    loadCommunityUnreadCount();
    loadModuleSettings();
    loadSEOSettings();
  }, [athleteId]);

  const loadSEOSettings = async () => {
    try {
      const response = await axios.get(`${API}/system/settings/public`);
      if (response.data?.seo) {
        const seo = response.data.seo;
        if (seo.siteTitle) {
          setSiteTitle(seo.siteTitle);
        }
        if (seo.logoUrl) {
          setLogoUrl(seo.logoUrl);
        }
      }
    } catch (error) {
      console.error('Error loading SEO settings:', error);
      // Keep defaults
    }
  };

  const loadMenus = async () => {
    try {
      const response = await axios.get(`${API}/menus/public`);
      setMenuItems({
        slideout_menu: response.data.slideout_menu || [],
        header_logged_in: response.data.header_logged_in || []
      });
    } catch (error) {
      console.error('Error loading menus:', error);
      // Keep defaults (empty arrays)
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  // Reload community unread count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadCommunityUnreadCount();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [athleteId]);

  const loadCommunityUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/community/notifications/${athleteId}/unread-count`);
      setCommunityUnreadCount(response.data.unread_count);
      setNotificationsUnreadCount(response.data.unread_count); // Also set notifications unread count
    } catch (error) {
      console.error('Error loading community unread count:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await axios.get(`${API}/community/notifications/${athleteId}`);
      // API returns { notifications: [...] } not just [...]
      const notificationsList = Array.isArray(response.data.notifications) ? response.data.notifications : [];
      setNotifications(notificationsList);
      // Update unread count
      const unreadCount = notificationsList.filter(n => !n.read).length;
      setNotificationsUnreadCount(unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]); // Set to empty array on error
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      if (!notification.read) {
        await axios.put(`${API}/community/notifications/${notification.id}/read`);
        await loadNotifications();
        await loadCommunityUnreadCount();
      }
      
      // Navigate based on notification type
      setShowNotifications(false);
      
      if (notification.type === 'follow') {
        // Navigate to follower's profile
        navigate(`/dashboard/community?view=profile&athleteId=${notification.from_athlete_id}`);
      } else if (notification.type === 'like' || notification.type === 'comment') {
        // Navigate to post (Community component will handle opening post modal)
        navigate(`/dashboard/community?view=post&postId=${notification.post_id}`);
      } else if (notification.type === 'group_join' || notification.type === 'group_invite') {
        // Navigate to group detail
        navigate(`/dashboard/community?tab=groups&groupId=${notification.group_id}`);
      } else if (notification.type === 'event_join' || notification.type === 'event_invite') {
        // Navigate to event detail
        navigate(`/dashboard/community?tab=events&eventId=${notification.event_id}`);
      } else if (notification.type === 'challenge_join' || notification.type === 'challenge_invite') {
        // Navigate to challenge detail
        navigate(`/dashboard/community?tab=challenges&challengeId=${notification.challenge_id}`);
      } else if (notification.post_id) {
        // Fallback for other post-related notifications
        navigate(`/dashboard/community?view=post&postId=${notification.post_id}`);
      } else {
        // Default: go to community
        navigate('/dashboard/community');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };
  
  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'follow':
        return <UserPlus className="w-5 h-5 text-blue-400" />;
      case 'like':
        return <Heart className="w-5 h-5 text-red-400" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-teal-400" />;
      case 'share':
        return <Share2 className="w-5 h-5 text-purple-400" />;
      case 'group_join':
      case 'group_invite':
        return <Users className="w-5 h-5 text-green-400" />;
      case 'event_join':
      case 'event_invite':
        return <Calendar className="w-5 h-5 text-orange-400" />;
      case 'challenge_join':
      case 'challenge_invite':
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };
  
  // Filter notifications by tab
  const getFilteredNotifications = () => {
    if (!notifications) return [];
    
    if (notificationTab === 'all') return notifications;
    
    if (notificationTab === 'follows') {
      return notifications.filter(n => n.type === 'follow');
    }
    
    if (notificationTab === 'posts') {
      return notifications.filter(n => ['like', 'comment', 'share'].includes(n.type));
    }
    
    if (notificationTab === 'groups') {
      return notifications.filter(n => ['group_join', 'group_invite'].includes(n.type));
    }
    
    if (notificationTab === 'events') {
      return notifications.filter(n => ['event_join', 'event_invite'].includes(n.type));
    }
    
    if (notificationTab === 'challenges') {
      return notifications.filter(n => ['challenge_join', 'challenge_invite'].includes(n.type));
    }
    
    return notifications;
  };

  // Load notifications when panel opens
  useEffect(() => {
    if (showNotifications) {
      loadNotifications();
    }
  }, [showNotifications]);

  // No longer needed - removed forced reload timer

  // Listen for athlete profile updates (e.g., profile picture changes)
  useEffect(() => {
    const handleAthleteProfileUpdate = (event) => {
      // Reload athlete data to get updated profile picture
      if (event.detail.athleteId === athleteId) {
        loadDashboardData();
      }
    };

    window.addEventListener('athleteProfileUpdated', handleAthleteProfileUpdate);
    
    return () => {
      window.removeEventListener('athleteProfileUpdated', handleAthleteProfileUpdate);
    };
  }, [athleteId]);
  
  // Force refresh athlete data on page visibility change (when user returns to page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && athleteId) {
        loadDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [athleteId]);

  // Scroll animation effect
  useEffect(() => {
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;

      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }

      if (scrollY > lastScrollY && scrollY > 80) {
        // Scrolling down - hide navigation
        setScrollDirection('down');
        setIsHeaderVisible(false);
      } else if (scrollY < lastScrollY) {
        // Scrolling up - show navigation
        setScrollDirection('up');
        setIsHeaderVisible(true);
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

  const calculateYTD = async (athleteData) => {
    try {
      // Get all workouts for the current year
      const currentYear = new Date().getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;
      
      const response = await axios.get(`${API}/workouts/${athleteId}?start_date=${startOfYear}&end_date=${endOfYear}`);
      const workouts = response.data;
      
      // Determine if user prefers metric (check both fields for compatibility)
      const isMetric = athleteData?.measurement_system === 'metric' || 
                       athleteData?.distance_unit === 'kilometers' || 
                       athleteData?.distance_unit === 'km';
      
      // Calculate total distance (convert to appropriate unit based on athlete preference)
      const totalDistance = workouts.reduce((sum, workout) => {
        const distance = isMetric
          ? workout.distance_miles * 1.60934 // Convert miles to km
          : workout.distance_miles;
        return sum + distance;
      }, 0);
      
      setYtdDistance(totalDistance);
    } catch (error) {
      console.error('Error calculating YTD:', error);
      setYtdDistance(0);
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Add cache-busting to ensure fresh data
      const cacheBuster = `?_t=${Date.now()}`;
      
      // Make athlete call first (this is critical and must succeed)
      const athleteRes = await axios.get(`${API}/athlete/${athleteId}${cacheBuster}`);
      
      // Set athlete data
      setAthlete(athleteRes.data);
      
      // Make other calls but don't fail if they error
      try {
        const readinessRes = await axios.get(`${API}/readiness/${athleteId}${cacheBuster}`);
        setReadiness(readinessRes.data);
      } catch (error) {
        setReadiness(null);
      }
      
      try {
        const workoutsRes = await axios.get(`${API}/workouts/${athleteId}?limit=5&_t=${Date.now()}`);
        setRecentWorkouts(workoutsRes.data);
      } catch (error) {
        setRecentWorkouts([]);
      }
      
      try {
        const testResultsRes = await axios.get(`${API}/test-results/${athleteId}${cacheBuster}`);
        // Group by test name and get latest for each
        const grouped = {};
        testResultsRes.data.results.forEach(test => {
          if (!grouped[test.test_name] || new Date(test.test_date) > new Date(grouped[test.test_name].test_date)) {
            grouped[test.test_name] = test;
          }
        });
        setTestResults(Object.values(grouped));
      } catch (error) {
        setTestResults([]);
      }
      
      // Calculate YTD after athlete data is loaded
      if (athleteRes.data) {
        calculateYTD(athleteRes.data);
      }
      
      return; // Skip the old Promise.all code

      console.log('Raw API response for athlete:', athleteRes.data);
      console.log('Setting athlete state to:', athleteRes.data);
      
      // Force a clean state update
      setAthlete(null); // Clear first
      setTimeout(() => {
        setAthlete(athleteRes.data); // Then set new data
        console.log('Athlete state updated');
      }, 100);
      
      setReadiness(readinessRes.data);
      setRecentWorkouts(workoutsRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadModuleSettings = async () => {
    try {
      const response = await axios.get(`${API}/system/settings?athlete_id=${athleteId}`);
      if (response.data.modules) {
        setModuleSettings(response.data.modules);
      }
    } catch (error) {
      // If error (e.g., not super admin or endpoint not accessible), use defaults
      console.log('Using default module settings');
    }
  };

  const handleDataLogged = () => {
    // Refresh dashboard data when new data is logged
    loadDashboardData();
  };

  // Helper function to get icon component by name
  const getIconComponent = (iconName) => {
    // Try to get from LucideIcons dynamic import first
    if (iconName && LucideIcons[iconName]) {
      return LucideIcons[iconName];
    }
    
    // Fallback to explicitly imported icons
    const iconMap = {
      Home, MessageCircle, PlusCircle, BarChart3, User, Menu, X, Settings,
      BookOpen, Utensils, Calendar, Zap, Activity, FileText, LineChart, Mic,
      Pill, Brain, ChefHat, Calculator, Check, Users, Gift, Bell, Repeat,
      GlassWater, Edit3, UserPlus, Heart, Share2, Trophy, ArrowRight,
      ExternalLink, Circle, ShoppingCart, MessageSquare
    };
    
    return iconMap[iconName] || Circle;
  };

  // Helper function to render menu item
  const renderMenuItem = (item, index) => {
    if (item.is_separator) {
      return (
        <div key={item.id || `separator-${index}`} className="py-2">
          <div className="h-px bg-white opacity-10"></div>
        </div>
      );
    }

    const IconComponent = getIconComponent(item.icon);
    const isActive = location.pathname === item.url;
    const highlightColor = item.highlight_color || '#00C2A8';

    return (
      <button
        key={item.id}
        onClick={() => {
          navigate(item.url);
          setIsMenuOpen(false);
        }}
        className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
          item.highlighted ? 'font-semibold' : ''
        }`}
        style={{
          background: item.highlighted && !isActive 
            ? `${highlightColor}22` // 22 = 13% opacity in hex
            : isActive 
            ? 'var(--grad-brand)' 
            : 'transparent',
          color: isActive ? 'var(--bg-950)' : item.highlighted ? highlightColor : 'var(--text-med)',
          borderLeft: item.highlighted && !isActive ? `3px solid ${highlightColor}` : 'none',
          paddingLeft: item.highlighted && !isActive ? 'calc(0.75rem - 3px)' : '0.75rem'
        }}
      >
        <IconComponent className="w-5 h-5" />
        <span className="font-medium">{item.label}</span>
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D4F0E9] border-t-[#62D2C4] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-600 flex flex-col">
      {/* Desktop Header */}
      <header className={`hidden md:block shadow-lg fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`} style={{ background: 'var(--grad-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center mr-8 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate('/dashboard')}>
                {logoUrl && (
                  <img 
                    src={`${BACKEND_URL}${logoUrl}`} 
                    alt={siteTitle}
                    className="w-8 h-8 object-contain mr-2"
                  />
                )}
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-hi)', fontFamily: 'var(--font-logo)' }}>
                  {siteTitle}
                </h1>
              </div>
              <nav 
                className="header-menu-switcher flex space-x-2 relative"
                data-previous={previousTab}
                data-active-tab={activeTab}
              >
                {menuItems.header_logged_in.length > 0 ? (
                  // Render dynamic header menu from menu editor
                  menuItems.header_logged_in
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((item, index) => {
                      // Determine if this menu item is active
                      const isActive = location.pathname === item.url || 
                                      (item.url === '/dashboard' && activeTab === 'overview') ||
                                      (item.url.includes('/dashboard/') && activeTab === item.url.replace('/dashboard/', ''));
                      
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setPreviousTab(activeTab);
                            navigate(item.url);
                          }}
                          className="header-menu-item text-sm font-medium transition-all px-3 py-2 relative"
                          data-active={isActive}
                          style={{ 
                            color: isActive ? 'var(--c-brand-500)' : 'var(--text-med)'
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })
                ) : (
                  // Fallback to default header menu if no menu items loaded
                  <>
                    <button
                      onClick={() => {
                        setPreviousTab(activeTab);
                        navigate('/dashboard');
                      }}
                      className="header-menu-item text-sm font-medium transition-all px-3 py-2 relative"
                      data-active={activeTab === 'overview'}
                      data-tab="overview"
                      style={{ 
                        color: activeTab === 'overview' ? 'var(--c-brand-500)' : 'var(--text-med)'
                      }}
                      data-testid="overview-tab"
                    >
                      {t('nav.overview')}
                    </button>
                    <button
                      onClick={() => {
                        setPreviousTab(activeTab);
                        navigate('/dashboard/coach');
                      }}
                      className="header-menu-item text-sm font-medium transition-all px-3 py-2 relative"
                      data-active={activeTab === 'coach'}
                      data-tab="coach"
                      style={{ 
                        color: activeTab === 'coach' ? 'var(--c-brand-500)' : 'var(--text-med)'
                      }}
                      data-testid="coach-tab"
                    >
                      {t('nav.coach')}
                    </button>
                    <button
                      onClick={() => {
                        setPreviousTab(activeTab);
                        navigate('/dashboard/reports');
                      }}
                      className="header-menu-item text-sm font-medium transition-all px-3 py-2 relative"
                      data-active={activeTab === 'reports'}
                      data-tab="reports"
                      style={{ 
                        color: activeTab === 'reports' ? 'var(--c-brand-500)' : 'var(--text-med)'
                      }}
                      data-testid="reports-tab"
                    >
                      {t('nav.reports')}
                    </button>
                    <button
                      onClick={() => {
                        setPreviousTab(activeTab);
                        navigate('/dashboard/calendar');
                      }}
                      className="header-menu-item text-sm font-medium transition-all px-3 py-2 relative"
                      data-active={activeTab === 'calendar'}
                      data-tab="calendar"
                      style={{ 
                        color: activeTab === 'calendar' ? 'var(--c-brand-500)' : 'var(--text-med)'
                      }}
                      data-testid="calendar-tab"
                    >
                      {t('nav.calendar')}
                    </button>
                    <button
                      onClick={() => {
                        setPreviousTab(activeTab);
                        navigate('/dashboard/account');
                      }}
                      className="header-menu-item text-sm font-medium transition-all px-3 py-2 relative"
                      data-active={activeTab === 'account'}
                      data-tab="account"
                      style={{ 
                        color: activeTab === 'account' ? 'var(--c-brand-500)' : 'var(--text-med)'
                      }}
                      data-testid="account-tab"
                    >
                      {t('nav.account')}
                    </button>
                  </>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {moduleSettings.affiliateProgram.enabled && (
                <button 
                  onClick={() => navigate('/dashboard/referrals')}
                  className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                  style={{ background: 'var(--grad-cta-soft)' }}
                  aria-label="Referrals"
                  title={t('dashboard.modals.referralRewards')}
                >
                  <Gift className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                </button>
              )}
              {moduleSettings.community.enabled && (
                <button 
                  onClick={() => activeTab === 'community' ? navigate('/dashboard') : navigate('/dashboard/community')}
                  className="p-2 rounded-lg transition-all duration-200 hover:scale-110 relative"
                  style={{ background: 'var(--grad-cta-soft)' }}
                  aria-label={activeTab === 'community' ? 'Dashboard' : 'Community'}
                  title={activeTab === 'community' ? 'Back to Dashboard' : 'Community'}
                >
                  {activeTab === 'community' ? (
                    <User className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                  ) : (
                    <Users className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                  )}
                </button>
              )}
              {moduleSettings.community.enabled && (
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-lg transition-all duration-200 hover:scale-110 relative"
                  style={{ background: 'var(--grad-cta-soft)' }}
                  aria-label="Notifications"
                  title={t('dashboard.modals.notifications')}
                >
                  <Bell className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                  {notificationsUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold" style={{ background: 'var(--c-danger)' }}>
                      {notificationsUnreadCount > 9 ? '9+' : notificationsUnreadCount}
                    </span>
                  )}
                </button>
              )}
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--grad-cta-soft)' }}
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className={`md:hidden shadow-lg fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`} style={{ background: 'var(--grad-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div 
              className="flex items-center cursor-pointer active:opacity-80 transition-opacity"
              onClick={() => navigate('/dashboard')}
            >
              {logoUrl && (
                <img 
                  src={`${BACKEND_URL}${logoUrl}`} 
                  alt={siteTitle}
                  className="w-11 h-11 object-contain"
                />
              )}
              <h1 className="hidden text-xl font-bold tracking-tight" style={{ color: 'var(--text-hi)', fontFamily: 'var(--font-logo)' }}>
                {siteTitle}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {moduleSettings.affiliateProgram.enabled && (
                <button 
                  onClick={() => navigate('/dashboard/referrals')}
                  className="p-2 rounded-lg transition-all duration-200 active:scale-95"
                  style={{ background: 'var(--grad-cta-soft)' }}
                  aria-label="Referrals"
                >
                  <Gift className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                </button>
              )}
              {moduleSettings.community.enabled && (
                <button 
                  onClick={() => activeTab === 'community' ? navigate('/dashboard') : navigate('/dashboard/community')}
                  className="p-2 rounded-lg transition-all duration-200 active:scale-95 relative"
                  style={{ background: 'var(--grad-cta-soft)' }}
                  aria-label={activeTab === 'community' ? 'Dashboard' : 'Community'}
                  title={activeTab === 'community' ? 'Back to Dashboard' : 'Community'}
                >
                  {activeTab === 'community' ? (
                    <User className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                  ) : (
                    <Users className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                  )}
                </button>
              )}
              {moduleSettings.community.enabled && (
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-lg transition-all duration-200 active:scale-95 relative"
                  style={{ background: 'var(--grad-cta-soft)' }}
                  aria-label="Notifications"
                  title={t('dashboard.modals.notifications')}
                >
                  <Bell className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                  {notificationsUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold" style={{ background: 'var(--c-danger)' }}>
                      {notificationsUnreadCount > 9 ? '9+' : notificationsUnreadCount}
                    </span>
                  )}
                </button>
              )}
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 rounded-lg transition-all duration-200 active:scale-95"
                style={{ background: 'var(--grad-cta-soft)' }}
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slideout Menu */}
      <>
        {/* Backdrop */}
        <div 
          className={`fixed inset-0 z-50 transition-opacity duration-300 ${
            isMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            opacity: isMenuOpen ? 1 : 0
          }}
          onClick={() => setIsMenuOpen(false)}
        />
        
        {/* Menu Panel */}
        <div className={`fixed inset-y-0 left-0 w-80 shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`} style={{ background: 'var(--bg-900)' }}>
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--grad-surface)' }}>
              <button 
                className="flex items-center space-x-3 w-full text-left rounded-lg p-2 transition-all duration-200"
                onClick={() => {
                  navigate('/dashboard/account');
                  setIsMenuOpen(false);
                }}
              >
                {/* Profile Picture or Initial */}
                {athlete?.profile_picture ? (
                  <img
                    src={athlete.profile_picture}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover"
                    style={{ border: '2px solid var(--c-brand-500)' }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--grad-brand)' }}>
                    <span className="font-bold text-lg" style={{ color: 'var(--bg-950)' }}>
                      {athlete?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-hi)' }}>{athlete?.name || 'User'}</p>
                </div>
              </button>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                style={{ background: 'var(--grad-cta-soft)' }}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-hi)' }} />
              </button>
            </div>

            {/* Menu Content */}
            <div className="flex-1 p-4">
              <nav className="space-y-1">
                {menuItems.slideout_menu.length > 0 ? (
                  // Render dynamic menu from menu editor
                  menuItems.slideout_menu
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((item, index) => renderMenuItem(item, index))
                ) : (
                  // Fallback to default hard-coded menu if no menu items loaded
                  <>
                    {/* Journal */}
                    <button
                  onClick={() => {
                    navigate('/dashboard/journal');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'journal'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium">Journal</span>
                </button>

                {/* Separator */}
                <div className="py-2">
                  <div className="h-px bg-white opacity-10"></div>
                </div>

                {/* Nutrition Section */}
                <button
                  onClick={() => {
                    navigate('/dashboard/nutrition');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'nutrition'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Utensils className="w-5 h-5" />
                  <span className="font-medium">Nutrition</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/supplements');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'supplements'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Pill className="w-5 h-5" />
                  <span className="font-medium">Supplements</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/recipes');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'recipes'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <ChefHat className="w-5 h-5" />
                  <span className="font-medium">{t('nav.recipes')}</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/calendar');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'calendar'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">{t('nav.trainingCalendar')}</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/habits');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'habits'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{t('nav.habitTracker')}</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/history');
                    setIsMenuOpen(false);
                  }}
                  className={`hidden w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'history'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Activity className="w-5 h-5" />
                  <span className="font-medium">{t('nav.history')}</span>
                </button>

                {/* Separator */}
                <div className="py-2">
                  <div className="h-px bg-white opacity-10"></div>
                </div>

                {/* Analytics Section */}
                <button
                  onClick={() => {
                    navigate('/dashboard/tests');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'tests'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <LineChart className="w-5 h-5" />
                  <span className="font-medium">Tests & Analytics</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/schedules');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'schedules'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Repeat className="w-5 h-5" />
                  <span className="font-medium">Schedules</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/calculators');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'calculators'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Calculator className="w-5 h-5" />
                  <span className="font-medium">Calculators</span>
                </button>

                {/* Separator */}
                <div className="py-2">
                  <div className="h-px bg-white opacity-10"></div>
                </div>

                {/* Documents Section */}
                <button
                  onClick={() => {
                    navigate('/dashboard/documents');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'documents'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Documents</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/memories');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'memories'
                      ? '' : ''
                  }`}
                  style={{
                    background: activeTab === 'journal' ? 'var(--grad-brand)' : 'transparent',
                    color: activeTab === 'journal' ? 'var(--bg-950)' : 'var(--text-med)'
                  }}
                >
                  <Brain className="w-5 h-5" />
                  <span className="font-medium">Memories</span>
                </button>
                  </>
                )}
              </nav>
            </div>

            {/* Account Settings - Fixed at Bottom */}
            <div className="border-t border-gray-200">
              <button
                onClick={() => {
                  navigate('/dashboard/account');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 p-4 transition-colors ${
                  activeTab === 'account'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">{t('nav.account')}</span>
              </button>
            </div>
          </div>
      </>

      {/* Main Content */}
      <main className={
        activeTab === 'coach' 
          ? 'flex-1 flex flex-col pt-16' 
          : activeTab === 'system-settings' || activeTab === 'crm'
          ? 'w-full pt-20 md:pt-24'
          : activeTab === 'community'
          ? 'w-full max-w-[1600px] mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8 pb-24 md:pb-8 pt-16 md:pt-24'
          : 'w-full max-w-[1600px] mx-auto px-0 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-24 md:pb-8'
      }>
        {activeTab === 'overview' && (
          <div className="space-y-0 md:space-y-6">
            {/* Quick Actions Grid - Redesigned */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 md:gap-3">
              {/* Weekly Menu */}
              <div 
                className="border-0 shadow-lg cursor-pointer transition-all duration-200 ease-out rounded-none md:rounded-3xl overflow-hidden group hover:scale-105"
                style={{ 
                  background: 'var(--grad-surface)',
                  borderColor: 'var(--border)'
                }}
                onClick={() => navigate('/dashboard/recipes')}
              >
                <div className="p-4">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad-cta-soft)' }}>
                      <ChefHat className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Weekly Menu</h3>
                      <p className="text-sm" style={{ color: 'var(--text-med)' }}>View meal plans</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Voice Journal */}
              <div 
                className="border-0 shadow-lg cursor-pointer transition-all duration-200 ease-out rounded-none md:rounded-3xl overflow-hidden group hover:scale-105"
                style={{ 
                  background: 'var(--grad-surface)',
                  borderColor: 'var(--border)'
                }}
                onClick={() => navigate('/dashboard/journal?action=voice')}
              >
                <div className="p-4">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad-cta-soft)' }}>
                      <Mic className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Voice Journal</h3>
                      <p className="text-sm" style={{ color: 'var(--text-med)' }}>Record thoughts</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Habit Tracker */}
              <div 
                className="border-0 shadow-lg cursor-pointer transition-all duration-200 ease-out rounded-none md:rounded-3xl overflow-hidden group hover:scale-105"
                style={{ 
                  background: 'var(--grad-surface)',
                  borderColor: 'var(--border)'
                }}
                onClick={() => navigate('/dashboard/habits')}
              >
                <div className="p-4">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad-cta-soft)' }}>
                      <Check className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Habit Tracker</h3>
                      <p className="text-sm" style={{ color: 'var(--text-med)' }}>Track daily habits</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Training Calendar */}
              <div 
                className="border-0 shadow-lg cursor-pointer transition-all duration-200 ease-out rounded-none md:rounded-3xl overflow-hidden group hover:scale-105"
                style={{ 
                  background: 'var(--grad-surface)',
                  borderColor: 'var(--border)'
                }}
                onClick={() => navigate('/dashboard/calendar')}
              >
                <div className="p-4">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad-cta-soft)' }}>
                      <Calendar className="w-6 h-6" style={{ color: 'var(--c-brand-500)' }} />
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h3 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Calendar</h3>
                      <p className="text-sm" style={{ color: 'var(--text-med)' }}>Your schedule</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Body Score, Progress, and Merits - Three Equal Columns on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 md:gap-3">
              {/* Column 1: Body Score */}
              <ReadinessCard athleteId={athleteId} readiness={readiness} />

              {/* Column 2: Progress - Recent Test Results */}
              <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)', borderColor: 'var(--border)' }}>
                <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Progress</h2>
                  <p className="text-sm" style={{ color: 'var(--text-med)' }}>Recent test results</p>
                </div>
                <div className="p-4">
                  {testResults && testResults.length > 0 ? (
                    <div className="space-y-3">
                      {testResults.slice(0, 3).map((test, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: 'var(--grad-cta-soft)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center space-x-4">
                            <div className="p-3 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-800)' }}>
                              <LineChart className="w-5 h-5" style={{ color: 'var(--c-brand-500)' }} />
                            </div>
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--text-hi)', fontFamily: 'var(--font-display)' }}>
                                {test.test_name}
                              </p>
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                {new Date(test.test_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg" style={{ color: 'var(--c-brand-500)', fontFamily: 'var(--font-display)' }}>
                              {test.result_value} {test.unit === 'repetitions' ? 'reps' : 
                               test.unit === 'time' ? 'min' : 
                               test.unit === 'distance' ? 'km' : 
                               test.unit === 'weight' ? 'kg' : 
                               test.unit === 'percentage' ? '%' : test.unit}
                            </p>
                            {test.time_to_completion && (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                {test.time_to_completion} min
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="mb-4" style={{ color: 'var(--text-med)' }}>No test results yet</p>
                      <button 
                        onClick={() => navigate('/dashboard/tests')}
                        className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                        style={{ 
                          background: 'var(--grad-brand)',
                          color: 'var(--bg-950)',
                          fontFamily: 'var(--font-display)',
                          boxShadow: '0 10px 24px rgba(50,211,255,.15)'
                        }}
                      >
                        Add Test Results
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Merits - Running Distance Personal Records */}
              <Merits athleteId={athleteId} />
            </div>

          </div>
        )}

        {activeTab === 'today' && (
          <Today athleteId={athleteId} />
        )}

        {activeTab === 'coach' && (
          <CoachChat athleteId={athleteId} scrollDirection={scrollDirection} />
        )}

        {activeTab === 'reports' && (
          <Recommendations athleteId={athleteId} />
        )}

        {activeTab === 'history' && (
          <WorkoutHistory athleteId={athleteId} />
        )}

        {activeTab === 'account' && (
          <Account athleteId={athleteId} />
        )}

        {activeTab === 'journal' && (
          <Journal athleteId={athleteId} />
        )}

        {activeTab === 'nutrition' && (
          <Nutrition athleteId={athleteId} />
        )}

        {activeTab === 'recipes' && (
          <RecipesPage athleteId={athleteId} />
        )}

        {activeTab === 'supplements' && (
          <Supplements athleteId={athleteId} />
        )}

        {activeTab === 'drinks' && (
          <Drinks athleteId={athleteId} />
        )}

        {activeTab === 'calculators' && (
          <CalculatorsConverters athleteId={athleteId} />
        )}

        {activeTab === 'documents' && (
          <Documents athleteId={athleteId} />
        )}

        {activeTab === 'tests' && (
          <TestsAnalytics athleteId={athleteId} />
        )}

        {activeTab === 'habits' && (
          <HabitTracker athleteId={athleteId} />
        )}

        {activeTab === 'schedules' && (
          <Schedules athleteId={athleteId} />
        )}

        {activeTab === 'files' && (
          <Files athleteId={athleteId} />
        )}

        {activeTab === 'memories' && (
          <Memories athleteId={athleteId} />
        )}

        {activeTab === 'community' && (
          <Community 
            athleteId={athleteId}
            athlete={athlete}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
            setCommunityUnreadCount={setCommunityUnreadCount}
          />
        )}

        {activeTab === 'referrals' && (
          <Referrals athleteId={athleteId} />
        )}

        {activeTab === 'system-settings' && (
          <SystemSettings athleteId={athleteId} />
        )}
        {activeTab === 'crm' && !isUserProfilePage && (
          <CRM athleteId={athleteId} />
        )}
        {isUserProfilePage && (
          <UserProfile athleteId={athleteId} />
        )}
        {activeTab === 'orders' && !isOrderDetailPage && (
          <Orders athleteId={athleteId} />
        )}
        {isOrderDetailPage && (
          <OrderDetail athleteId={athleteId} />
        )}
        {activeTab === 'subscriptions' && (
          <Subscriptions athleteId={athleteId} />
        )}
        {activeTab === 'emails' && (
          <Emails />
        )}
        {activeTab === 'support' && (
          <Support athleteId={athleteId} athlete={athlete} />
        )}
        {activeTab === 'pages' && !isPageEditorPage && (
          <Pages athleteId={athleteId} />
        )}
        {isPageEditorPage && (
          <PageEditor athleteId={athleteId} pageId={pageIdFromUrl} />
        )}
        {isMenuEditorPage && (
          <MenuEditor athleteId={athleteId} onBack={() => navigate('/dashboard/account')} />
        )}

        {activeTab === 'calendar' && (
          <TrainingCalendar 
            athleteId={athleteId} 
            athletePreferences={athlete ? {
              distance_unit: athlete.distance_unit || 'miles',
              measurement_system: athlete.measurement_system || 'imperial',
              week_starts_on: athlete.week_starts_on || 'monday',
              timezone: athlete.timezone || 'UTC',
              time_format: athlete.time_format || '12h',
              language: athlete.language || 'en'
            } : null}
          />
        )}
      </main>

      {/* Bottom Tab Bar - Liquid Glass Switcher Style */}
      <div 
        className="md:hidden fixed left-1/2 z-40 bottom-tab-switcher"
        data-previous={previousTab}
        style={{
          bottom: '12px',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '340px',
          maxWidth: '90vw',
          height: '70px',
          boxSizing: 'border-box',
          padding: '8px 12px 10px',
          border: 'none',
          borderRadius: '99em',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `,
          transition: 'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)'
        }}
      >
        {/* Tab 1: Today */}
        <button
          onClick={() => {
            setPreviousTab(activeTab);
            navigate('/dashboard/today');
          }}
          className="tab-option"
          data-active={activeTab === 'today'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 12px',
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: '99em',
            opacity: 1,
            transition: 'all 160ms',
            color: activeTab === 'today' ? 'var(--c-brand-500)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'today') {
              e.currentTarget.style.color = 'var(--c-brand-500)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'today') {
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <Zap 
            className="w-6 h-6 transition-transform duration-200"
            style={{
              transform: activeTab === 'today' ? 'scale(1.1)' : 'scale(1)'
            }}
          />
        </button>

        {/* Tab 2: Home */}
        <button
          onClick={() => {
            setPreviousTab(activeTab);
            navigate('/dashboard');
          }}
          className="tab-option"
          data-active={activeTab === 'overview'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 12px',
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: '99em',
            opacity: 1,
            transition: 'all 160ms',
            color: activeTab === 'overview' ? 'var(--c-brand-500)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'overview') {
              e.currentTarget.style.color = 'var(--c-brand-500)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'overview') {
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <Home 
            className="w-6 h-6 transition-transform duration-200"
            style={{
              transform: activeTab === 'overview' ? 'scale(1.1)' : 'scale(1)'
            }}
          />
        </button>

        {/* Tab 3: Coach */}
        <button
          onClick={() => {
            setPreviousTab(activeTab);
            navigate('/dashboard/coach');
          }}
          className="tab-option"
          data-active={activeTab === 'coach'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 12px',
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: '99em',
            opacity: 1,
            transition: 'all 160ms',
            color: activeTab === 'coach' ? 'var(--c-brand-500)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'coach') {
              e.currentTarget.style.color = 'var(--c-brand-500)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'coach') {
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <Brain 
            className="w-6 h-6 transition-transform duration-200"
            style={{
              transform: activeTab === 'coach' ? 'scale(1.1)' : 'scale(1)'
            }}
          />
        </button>

        {/* Tab 4: Reports */}
        <button
          onClick={() => {
            setPreviousTab(activeTab);
            navigate('/dashboard/reports');
          }}
          className="tab-option"
          data-active={activeTab === 'reports'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 12px',
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: '99em',
            opacity: 1,
            transition: 'all 160ms',
            color: activeTab === 'reports' ? 'var(--c-brand-500)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'reports') {
              e.currentTarget.style.color = 'var(--c-brand-500)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'reports') {
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <BarChart3 
            className="w-6 h-6 transition-transform duration-200"
            style={{
              transform: activeTab === 'reports' ? 'scale(1.1)' : 'scale(1)'
            }}
          />
        </button>

        {/* Tab 5: Account */}
        <button
          onClick={() => {
            setPreviousTab(activeTab);
            navigate('/dashboard/account');
          }}
          className="tab-option"
          data-active={activeTab === 'account'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 12px',
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: '99em',
            opacity: 1,
            transition: 'all 160ms',
            color: activeTab === 'account' ? 'var(--c-brand-500)' : 'var(--text-med)',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'account') {
              e.currentTarget.style.color = 'var(--c-brand-500)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'account') {
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <User 
            className="w-6 h-6 transition-transform duration-200"
            style={{
              transform: activeTab === 'account' ? 'scale(1.1)' : 'scale(1)'
            }}
          />
        </button>
      </div>

      {/* Global Notifications Panel */}
      {showNotifications && (
        <>
          {/* Mobile: Fullscreen Modal */}
          <div className="md:hidden fixed top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-gray-900 to-gray-800 z-[9999] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-semibold text-lg">Notifications</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex overflow-x-auto flex-shrink-0 custom-scrollbar" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-800)' }}>
              <button
                onClick={() => setNotificationTab('all')}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                  notificationTab === 'all'
                    ? 'text-[#00C2A8]'
                    : 'border-transparent hover:text-white'
                }`}
                style={notificationTab === 'all' ? { borderBottomColor: '#00C2A8', color: '#00C2A8' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <Bell className="w-4 h-4" />
                All
              </button>
              <button
                onClick={() => setNotificationTab('follows')}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                  notificationTab === 'follows'
                    ? 'text-blue-400'
                    : 'border-transparent hover:text-white'
                }`}
                style={notificationTab === 'follows' ? { borderBottomColor: '#60A5FA', color: '#60A5FA' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <UserPlus className="w-4 h-4" />
                Follows
              </button>
              <button
                onClick={() => setNotificationTab('posts')}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                  notificationTab === 'posts'
                    ? 'text-red-400'
                    : 'border-transparent hover:text-white'
                }`}
                style={notificationTab === 'posts' ? { borderBottomColor: '#F87171', color: '#F87171' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <Heart className="w-4 h-4" />
                Posts
              </button>
              <button
                onClick={() => setNotificationTab('groups')}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                  notificationTab === 'groups'
                    ? 'text-green-400'
                    : 'border-transparent hover:text-white'
                }`}
                style={notificationTab === 'groups' ? { borderBottomColor: '#4ADE80', color: '#4ADE80' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <Users className="w-4 h-4" />
                Groups
              </button>
              <button
                onClick={() => setNotificationTab('events')}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                  notificationTab === 'events'
                    ? 'text-orange-400'
                    : 'border-transparent hover:text-white'
                }`}
                style={notificationTab === 'events' ? { borderBottomColor: '#FB923C', color: '#FB923C' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <Calendar className="w-4 h-4" />
                Events
              </button>
              <button
                onClick={() => setNotificationTab('challenges')}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                  notificationTab === 'challenges'
                    ? 'text-yellow-400'
                    : 'border-transparent hover:text-white'
                }`}
                style={notificationTab === 'challenges' ? { borderBottomColor: '#FACC15', color: '#FACC15' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
              >
                <Trophy className="w-4 h-4" />
                Challenges
              </button>
            </div>
            
            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {!notifications || getFilteredNotifications().length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg" style={{ color: 'var(--text-med)' }}>No notifications</p>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>You're all caught up!</p>
                  </div>
                </div>
              ) : (
                getFilteredNotifications().map(notification => (
                  <div
                    key={notification.id}
                    className={`mb-2 rounded-none md:rounded-3xl hover:opacity-90 active:opacity-80 cursor-pointer transition-all overflow-hidden ${
                      !notification.read ? 'ring-2 ring-[#00C2A8]/30' : ''
                    }`}
                    style={{ background: 'var(--grad-surface)' }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: 'var(--text-hi)' }}>{notification.message || notification.content}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <ArrowRight className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Desktop: Dropdown */}
          <div className="hidden md:block fixed top-16 right-4 z-50">
            <div className="w-96 rounded-3xl shadow-xl max-h-[600px] flex flex-col overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Notifications</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex overflow-x-auto flex-shrink-0 custom-scrollbar" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-800)' }}>
                <button
                  onClick={() => setNotificationTab('all')}
                  className="flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={notificationTab === 'all' ? { borderBottomColor: '#00C2A8', color: '#00C2A8' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  <Bell className="w-4 h-4" />
                  All
                </button>
                <button
                  onClick={() => setNotificationTab('follows')}
                  className="flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={notificationTab === 'follows' ? { borderBottomColor: '#60A5FA', color: '#60A5FA' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  <UserPlus className="w-4 h-4" />
                  Follows
                </button>
                <button
                  onClick={() => setNotificationTab('posts')}
                  className="flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={notificationTab === 'posts' ? { borderBottomColor: '#F87171', color: '#F87171' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  <Heart className="w-4 h-4" />
                  Posts
                </button>
                <button
                  onClick={() => setNotificationTab('groups')}
                  className="flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={notificationTab === 'groups' ? { borderBottomColor: '#4ADE80', color: '#4ADE80' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  <Users className="w-4 h-4" />
                  Groups
                </button>
                <button
                  onClick={() => setNotificationTab('events')}
                  className="flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={notificationTab === 'events' ? { borderBottomColor: '#FB923C', color: '#FB923C' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  <Calendar className="w-4 h-4" />
                  Events
                </button>
                <button
                  onClick={() => setNotificationTab('challenges')}
                  className="flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={notificationTab === 'challenges' ? { borderBottomColor: '#FACC15', color: '#FACC15' } : { borderBottomColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  <Trophy className="w-4 h-4" />
                  Challenges
                </button>
              </div>
              
              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!notifications || getFilteredNotifications().length === 0 ? (
                  <div className="p-8 text-gray-400 text-center">
                    <Bell className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  getFilteredNotifications().map(notification => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-gray-700/50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">{notification.message || notification.content}</p>
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <ArrowRight className="w-4 h-4 text-gray-500" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Action Buttons - Show only on overview and today pages, hide on community */}
      {(activeTab === 'overview' || activeTab === 'today') && (
        <>
          {/* Main FAB Button - Bottom Right */}
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className={`md:hidden fixed z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
              showCreateMenu ? 'rotate-45' : ''
            }`}
            style={{
              bottom: '96px',
              right: '16px',
              background: showCreateMenu ? 'var(--grad-danger)' : 'var(--grad-brand)',
              boxShadow: showCreateMenu 
                ? '0 10px 40px rgba(255,100,100,.3)' 
                : '0 10px 40px rgba(50,211,255,.3)'
            }}
            aria-label={showCreateMenu ? "Close menu" : "Create new entry"}
          >
            <PlusCircle className="w-7 h-7" style={{ color: 'var(--bg-950)' }} />
          </button>

          {/* Backdrop when menu is open */}
          {showCreateMenu && (
            <div 
              className="fixed inset-0 bg-black/30 z-30"
              onClick={() => setShowCreateMenu(false)}
            />
          )}

          {/* Fan Menu - Individual FABs */}
          {/* Add Journal Entry - 180° (9 o'clock - straight left) */}
          <button
            onClick={() => {
              navigate('/dashboard/journal?action=voice');
              setShowCreateMenu(false);
            }}
            className={`fixed z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
              showCreateMenu 
                ? 'opacity-100 translate-x-0 translate-y-0' 
                : 'opacity-0 scale-0 pointer-events-none'
            }`}
            style={{
              bottom: '90px',
              right: '16px',
              transform: showCreateMenu 
                ? `translate(${-110}px, 0px)` // 180° (9 o'clock - straight left)
                : 'translate(0, 0) scale(0)',
              transitionDelay: showCreateMenu ? '50ms' : '0ms'
            }}
            title={t('dashboard.modals.addJournalEntry')}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </button>

          {/* Log Drink - 150° (10 o'clock position) */}
          <button
            onClick={() => {
              navigate('/dashboard/drinks');
              setShowCreateMenu(false);
            }}
            className={`fixed z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
              showCreateMenu 
                ? 'opacity-100 translate-x-0 translate-y-0' 
                : 'opacity-0 scale-0 pointer-events-none'
            }`}
            style={{
              bottom: '90px',
              right: '16px',
              transform: showCreateMenu 
                ? `translate(${Math.cos(5 * Math.PI / 6) * 110}px, ${-Math.sin(5 * Math.PI / 6) * 110}px)` // 150° (10 o'clock)
                : 'translate(0, 0) scale(0)',
              transitionDelay: showCreateMenu ? '100ms' : '0ms'
            }}
            title={t('dashboard.modals.logDrink')}
          >
            <GlassWater className="w-5 h-5 text-white" />
          </button>

          {/* Log Supplement - 120° (11 o'clock position) */}
          <button
            onClick={() => {
              navigate('/dashboard/supplements', { state: { openAddModal: true } });
              setShowCreateMenu(false);
            }}
            className={`fixed z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
              showCreateMenu 
                ? 'opacity-100 translate-x-0 translate-y-0' 
                : 'opacity-0 scale-0 pointer-events-none'
            }`}
            style={{
              bottom: '90px',
              right: '16px',
              transform: showCreateMenu 
                ? `translate(${Math.cos(2 * Math.PI / 3) * 110}px, ${-Math.sin(2 * Math.PI / 3) * 110}px)` // 120° (11 o'clock)
                : 'translate(0, 0) scale(0)',
              transitionDelay: showCreateMenu ? '150ms' : '0ms'
            }}
            title={t('dashboard.modals.logSupplement')}
          >
            <Pill className="w-5 h-5 text-white" />
          </button>

          {/* Log Meal - 90° (12 o'clock - straight up) */}
          <button
            onClick={() => {
              navigate('/dashboard/nutrition?action=add');
              setShowCreateMenu(false);
            }}
            className={`fixed z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
              showCreateMenu 
                ? 'opacity-100 translate-x-0 translate-y-0' 
                : 'opacity-0 scale-0 pointer-events-none'
            }`}
            style={{
              bottom: '90px',
              right: '16px',
              transform: showCreateMenu 
                ? `translate(0px, ${-110}px)` // 90° (12 o'clock - straight up)
                : 'translate(0, 0) scale(0)',
              transitionDelay: showCreateMenu ? '200ms' : '0ms'
            }}
            title={t('dashboard.modals.logMeal')}
          >
            <Utensils className="w-5 h-5 text-white" />
          </button>
        </>
      )}
    </div>
  );
};

export default Dashboard;
