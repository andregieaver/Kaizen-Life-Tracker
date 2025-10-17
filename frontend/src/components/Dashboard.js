import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Home, MessageCircle, PlusCircle, BarChart3, User, Menu, X, Settings, BookOpen, Utensils, Calendar, Zap, Activity, FileText, LineChart, Mic, Pill, Brain, ChefHat, Calculator, Check } from 'lucide-react';
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
import Files from './Files';
import HabitTracker from './HabitTracker';
import Memories from './Memories';
import Today from './Today';
import TrainingCalendar from './TrainingCalendar';
import Documents from './Documents';
import TestsAnalytics from './TestsAnalytics';
import RecipesPage from './RecipesPage';
import CalculatorsConverters from './CalculatorsConverters';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ athleteId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useParams();
  const [athlete, setAthlete] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [ytdDistance, setYtdDistance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [testResults, setTestResults] = useState([]);
  
  // Scroll animation state
  const [scrollDirection, setScrollDirection] = useState('none'); // 'none' on initial load to show elements
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  // Determine active tab from URL, default to overview
  const activeTab = tab || 'overview';

  useEffect(() => {
    loadDashboardData();
  }, [athleteId]);

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

  const handleDataLogged = () => {
    // Refresh dashboard data when new data is logged
    loadDashboardData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0fffe] to-[#e8f9f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D4F0E9] border-t-[#62D2C4] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffe] to-[#e8f9f7] flex flex-col">
      {/* Desktop Header */}
      <header className={`hidden md:block bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] shadow-lg fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="font-display text-2xl font-bold text-white mr-8 tracking-tight">
                My Health Tracker
              </h1>
              <nav className="flex space-x-8">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'overview'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  data-testid="overview-tab"
                >
                  {t('nav.overview')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/coach')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'coach'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  data-testid="coach-tab"
                >
                  {t('nav.coach')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/reports')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'reports'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  data-testid="reports-tab"
                >
                  {t('nav.reports')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/calendar')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'calendar'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  data-testid="calendar-tab"
                >
                  {t('nav.calendar')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/history')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'history'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  data-testid="history-tab"
                >
                  {t('nav.history')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/account')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'account'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  data-testid="account-tab"
                >
                  {t('nav.account')}
                </button>
              </nav>
            </div>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className={`md:hidden bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] shadow-lg fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="font-display text-xl font-bold text-white tracking-tight">
              My Health Tracker
            </h1>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Slideout Menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-40 z-50 transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5]">
              <button 
                className="flex items-center space-x-3 w-full text-left hover:bg-white/10 rounded-lg p-2 transition-colors"
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
                    className="w-10 h-10 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <span className="text-[#62D2C4] font-bold text-lg">
                      {athlete?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{athlete?.name || 'User'}</p>
                </div>
              </button>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Menu Content */}
            <div className="flex-1 p-4">
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    navigate('/dashboard/journal');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'journal'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium">Journal</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/nutrition');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'nutrition'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Utensils className="w-5 h-5" />
                  <span className="font-medium">Nutrition</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/recipes');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'recipes'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChefHat className="w-5 h-5" />
                  <span className="font-medium">Recipes</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/supplements');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'supplements'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Pill className="w-5 h-5" />
                  <span className="font-medium">Supplements</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/calculators');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'calculators'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Calculator className="w-5 h-5" />
                  <span className="font-medium">Calculators</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/memories');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'memories'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Brain className="w-5 h-5" />
                  <span className="font-medium">Memories</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/calendar');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'calendar'
                      ? 'bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">Training Calendar</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/documents');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'documents'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Documents</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/tests');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'tests'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <LineChart className="w-5 h-5" />
                  <span className="font-medium">Tests & Analytics</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/habits');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'habits'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Habit Tracker</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/schedules');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'schedules'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">Schedules</span>
                </button>
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
      )}

      {/* Main Content */}
      <main className={activeTab === 'coach' ? 'flex-1 flex flex-col pt-16' : 'w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-20 md:pb-8 pt-20 md:pt-24'}>
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Today Overview */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#62D2C4] to-[#4fc4b5] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/today')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-white">Today</h3>
                      <p className="text-sm text-white/80">Daily overview</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Menu */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#FFB347] to-[#FFA500] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/recipes')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <ChefHat className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-white">Weekly Menu</h3>
                      <p className="text-sm text-white/80">View meal plans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Log Meal */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#FF7F7F] to-[#ff6666] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/nutrition?action=add')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Utensils className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-white">Log Meal</h3>
                      <p className="text-sm text-white/80">Track nutrition</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Log Supplement */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#9B7EBD] to-[#8B6FAD] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/supplements', { state: { openAddModal: true } })}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Pill className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-white">Log Supplement</h3>
                      <p className="text-sm text-white/80">Track supplements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Talk to Coach */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#D4F0E9] to-[#b8e6db] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/coach?action=voice')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-[#62D2C4] rounded-xl shadow-sm">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-gray-800">Talk to Coach</h3>
                      <p className="text-sm text-gray-600">Voice AI assistance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Voice Journal */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#C1E1C1] to-[#a8d5a8] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/journal?action=voice')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-white">Voice Journal</h3>
                      <p className="text-sm text-white/80">Record your thoughts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Habit Tracker */}
              <Card 
                className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-[#FFB84D] to-[#FF9A1F] hover:scale-105 transform"
                onClick={() => navigate('/dashboard/habits')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-white">Habit Tracker</h3>
                      <p className="text-sm text-white/80">Track daily habits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Body Score, Progress, and Merits - Three Equal Columns on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1: Body Score */}
              <Card className="border-0 shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-display text-gray-800">Body Score</CardTitle>
                  <CardDescription className="text-gray-600">Overall health and recovery status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Main Body Score - Large Circular */}
                  <div className="flex justify-center">
                    <div className="relative w-40 h-40">
                      <svg className="transform -rotate-90 w-40 h-40">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="#e5e7eb"
                          strokeWidth="12"
                          fill="none"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="url(#bodyScoreGradient)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 70}`}
                          strokeDashoffset={`${2 * Math.PI * 70 * (1 - 0.87)}`}
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="bodyScoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#62D2C4" />
                            <stop offset="100%" stopColor="#4fc4b5" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-gray-800">87</span>
                        <span className="text-sm text-gray-500">Body Score</span>
                      </div>
                    </div>
                  </div>

                  {/* Three Inline Scores */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Readiness */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-20 h-20">
                        <svg className="transform -rotate-90 w-20 h-20">
                          <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                          <circle
                            cx="40" cy="40" r="35"
                            stroke="#C1E1C1"
                            strokeWidth="6" fill="none"
                            strokeDasharray={`${2 * Math.PI * 35}`}
                            strokeDashoffset={`${2 * Math.PI * 35 * (1 - 0.82)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">82</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 mt-2">Readiness</span>
                    </div>

                    {/* Sleep */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-20 h-20">
                        <svg className="transform -rotate-90 w-20 h-20">
                          <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                          <circle
                            cx="40" cy="40" r="35"
                            stroke="#9B7EBD"
                            strokeWidth="6" fill="none"
                            strokeDasharray={`${2 * Math.PI * 35}`}
                            strokeDashoffset={`${2 * Math.PI * 35 * (1 - 0.78)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">78</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 mt-2">Sleep</span>
                    </div>

                    {/* Activity */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-20 h-20">
                        <svg className="transform -rotate-90 w-20 h-20">
                          <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                          <circle
                            cx="40" cy="40" r="35"
                            stroke="#FFB347"
                            strokeWidth="6" fill="none"
                            strokeDasharray={`${2 * Math.PI * 35}`}
                            strokeDashoffset={`${2 * Math.PI * 35 * (1 - 0.91)}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">91</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 mt-2">Activity</span>
                    </div>
                  </div>

                  {/* 2x2 Grid of Metrics */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    {/* Sleep Amount */}
                    <div className="bg-gradient-to-br from-[#D4F0E9] to-[#b8e6db] rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">Sleep Amount</div>
                      <div className="text-2xl font-bold text-gray-800">7h 23m</div>
                    </div>

                    {/* Sleep Quality */}
                    <div className="bg-gradient-to-br from-[#D4F0E9] to-[#b8e6db] rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">Sleep Quality</div>
                      <div className="text-2xl font-bold text-gray-800">85%</div>
                    </div>

                    {/* HRV */}
                    <div className="bg-gradient-to-br from-[#FFE5B4] to-[#FFD89B] rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">HRV</div>
                      <div className="text-2xl font-bold text-gray-800">68 ms</div>
                    </div>

                    {/* Resting Heart Rate */}
                    <div className="bg-gradient-to-br from-[#FFE5B4] to-[#FFD89B] rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">Resting HR</div>
                      <div className="text-2xl font-bold text-gray-800">52 bpm</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Column 2: Progress - Test Results */}
              <Card className="border-0 shadow-md bg-white overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-display text-gray-800">Progress</CardTitle>
                  <CardDescription className="text-gray-600">Latest test results and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Running YTD */}
                  <div className="flex justify-between items-center mb-4 pb-4 border-b">
                    <span className="text-sm text-gray-600">Running (YTD)</span>
                    <span className="font-semibold text-[#62D2C4]">
                      {ytdDistance.toFixed(1)} {
                        (athlete?.measurement_system === 'metric' || 
                         athlete?.distance_unit === 'kilometers' || 
                         athlete?.distance_unit === 'km') ? 'km' : 'mi'
                      }
                    </span>
                  </div>
                  
                  {testResults.length > 0 ? (
                    <div className="space-y-3">
                      {testResults.map((test) => (
                        <div 
                          key={test.id} 
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-[#D4F0E9]/30 to-transparent rounded-lg hover:from-[#D4F0E9]/50 cursor-pointer transition-all"
                          onClick={() => navigate('/dashboard/tests', { 
                            state: { 
                              addEntryToTest: test.test_name,
                              testUnit: test.unit 
                            } 
                          })}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#62D2C4] to-[#4fc4b5] rounded-lg flex items-center justify-center shadow-sm">
                              <LineChart className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                {test.test_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(test.test_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[#62D2C4]">
                              {test.result_value} {test.unit === 'repetitions' ? 'reps' : 
                               test.unit === 'time' ? 'min' : 
                               test.unit === 'distance' ? 'km' : 
                               test.unit === 'weight' ? 'kg' : 
                               test.unit === 'percentage' ? '%' : test.unit}
                            </p>
                            {test.time_to_completion && (
                              <p className="text-sm text-gray-500">
                                {test.time_to_completion} min
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No test results yet</p>
                      <Button 
                        onClick={() => navigate('/dashboard/tests')}
                        className="bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] hover:from-[#4fc4b5] hover:to-[#62D2C4] text-white shadow-md"
                      >
                        Add Test Results
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

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

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 transition-transform duration-300 ease-in-out ${
        scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
      }`}>
        <div className="grid grid-cols-4 h-16">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            data-testid="mobile-overview-tab"
          >
            <Home className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('nav.home')}</span>
          </button>
          
          <button
            onClick={() => navigate('/dashboard/coach')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'coach'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            data-testid="mobile-coach-tab"
          >
            <MessageCircle className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('nav.coach')}</span>
          </button>
          
          <button
            onClick={() => navigate('/dashboard/reports')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'reports'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            data-testid="mobile-reports-tab"
          >
            <PlusCircle className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('nav.reports')}</span>
          </button>
          
          <button
            onClick={() => navigate('/dashboard/history')}
            className={`flex flex-col items-center justify-center transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            data-testid="mobile-history-tab"
          >
            <BarChart3 className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">{t('nav.history')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
