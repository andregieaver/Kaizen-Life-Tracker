import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Home, MessageCircle, PlusCircle, BarChart3, User, Menu, X, Settings, BookOpen, Utensils, Calendar, Zap, Activity, FileText, LineChart, Mic, Pill, Brain, ChefHat } from 'lucide-react';
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
import Memories from './Memories';
import Today from './Today';
import TrainingCalendar from './TrainingCalendar';
import Documents from './Documents';
import TestsAnalytics from './TestsAnalytics';
import RecipesPage from './RecipesPage';

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
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-[#1A2A40] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Desktop Header */}
      <header className={`hidden md:block bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="font-display text-2xl font-bold text-[#1A2A40] mr-8 tracking-tight">
                My Health Tracker
              </h1>
              <nav className="flex space-x-8">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'overview'
                      ? 'text-[#1A2A40] border-b-2 border-[#1A2A40]'
                      : 'text-gray-500 hover:text-[#1A2A40]'
                  }`}
                  data-testid="overview-tab"
                >
                  {t('nav.overview')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/coach')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'coach'
                      ? 'text-[#1A2A40] border-b-2 border-[#1A2A40]'
                      : 'text-gray-500 hover:text-[#1A2A40]'
                  }`}
                  data-testid="coach-tab"
                >
                  {t('nav.coach')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/reports')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'reports'
                      ? 'text-[#1A2A40] border-b-2 border-[#1A2A40]'
                      : 'text-gray-500 hover:text-[#1A2A40]'
                  }`}
                  data-testid="reports-tab"
                >
                  {t('nav.reports')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/calendar')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'calendar'
                      ? 'text-[#1A2A40] border-b-2 border-[#1A2A40]'
                      : 'text-gray-500 hover:text-[#1A2A40]'
                  }`}
                  data-testid="calendar-tab"
                >
                  {t('nav.calendar')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/history')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'history'
                      ? 'text-[#1A2A40] border-b-2 border-[#1A2A40]'
                      : 'text-gray-500 hover:text-[#1A2A40]'
                  }`}
                  data-testid="history-tab"
                >
                  {t('nav.history')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/account')}
                  className={`text-sm font-medium transition-colors px-1 py-1 ${
                    activeTab === 'account'
                      ? 'text-[#1A2A40] border-b-2 border-[#1A2A40]'
                      : 'text-gray-500 hover:text-[#1A2A40]'
                  }`}
                  data-testid="account-tab"
                >
                  {t('nav.account')}
                </button>
              </nav>
            </div>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className={`md:hidden bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="font-display text-xl font-bold text-[#1A2A40] tracking-tight">
              My Health Tracker
            </h1>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Slideout Menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <button 
                className="flex items-center space-x-3 w-full text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
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
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {athlete?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{athlete?.name || 'User'}</p>
                </div>
              </button>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Menu Content */}
            <div className="flex-1 p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => {
                    navigate('/dashboard/journal');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'journal'
                      ? 'bg-blue-50 text-blue-600'
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
                      ? 'bg-blue-50 text-blue-600'
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
                      ? 'bg-blue-50 text-blue-600'
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
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Pill className="w-5 h-5" />
                  <span className="font-medium">Supplements</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/files');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'files'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Files</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/dashboard/memories');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeTab === 'memories'
                      ? 'bg-blue-50 text-blue-600'
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
                      ? 'bg-blue-50 text-blue-600'
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
            <div className="grid grid-cols-2 gap-4">
              {/* Today Overview */}
              <Card 
                className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100 hover:scale-105"
                onClick={() => navigate('/dashboard/today')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-orange-600 rounded-full">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-gray-900">Today</h3>
                      <p className="text-sm text-gray-600">Daily overview</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Voice Journal Entry */}
              <Card 
                className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 hover:scale-105"
                onClick={() => navigate('/dashboard/journal?action=voice')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-blue-600 rounded-full">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-gray-900">Voice Journal</h3>
                      <p className="text-sm text-gray-600">Record your thoughts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Voice AI Coach */}
              <Card 
                className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100 hover:scale-105"
                onClick={() => navigate('/dashboard/coach?action=voice')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-purple-600 rounded-full">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-gray-900">Talk to Coach</h3>
                      <p className="text-sm text-gray-600">Voice AI assistance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Add Nutrition Entry */}
              <Card 
                className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-green-50 to-green-100 hover:scale-105"
                onClick={() => navigate('/dashboard/nutrition?action=add')}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
                    <div className="p-3 bg-green-600 rounded-full">
                      <Utensils className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-semibold text-gray-900">Log Meal</h3>
                      <p className="text-sm text-gray-600">Track nutrition</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Readiness Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ReadinessCard readiness={readiness} onRefresh={loadDashboardData} />
              </div>
              
              {/* Quick Stats */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg font-display">{t('dashboard.quickStats')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Health Score</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-400">Coming Soon</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Running (YTD)</span>
                    <span className="font-semibold">
                      {ytdDistance.toFixed(1)} {
                        (athlete?.measurement_system === 'metric' || 
                         athlete?.distance_unit === 'kilometers' || 
                         athlete?.distance_unit === 'km') ? 'km' : 'mi'
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Merits - Personal Records */}
              <Merits athleteId={athleteId} />

              {/* Progress - Test Results */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg font-display">Progress</CardTitle>
                  <CardDescription>Latest test results and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {testResults.length > 0 ? (
                    <div className="space-y-3">
                      {testResults.map((test) => (
                        <div 
                          key={test.id} 
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover-lift cursor-pointer"
                          onClick={() => navigate('/dashboard/tests')}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <LineChart className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {test.test_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(test.test_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
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
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Add Test Results
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-display">{t('dashboard.recentActivity')}</CardTitle>
                <CardDescription>{t('dashboard.currentReadiness')}</CardDescription>
              </CardHeader>
              <CardContent>
                {recentWorkouts.length > 0 ? (
                  <div className="space-y-3">
                    {recentWorkouts.slice(0, 3).map((workout) => (
                      <div 
                        key={workout.id} 
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover-lift"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {workout.workout_type.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 capitalize">
                              {workout.workout_type.replace('_', ' ')}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(workout.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {workout.distance_miles} mi
                          </p>
                          <p className="text-sm text-gray-500">
                            {workout.duration_minutes} min
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No workouts logged yet</p>
                    <Button 
                      onClick={() => navigate('/dashboard/reports')}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="view-reports-btn"
                    >
                      View Reports
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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

        {activeTab === 'documents' && (
          <Documents athleteId={athleteId} />
        )}

        {activeTab === 'tests' && (
          <TestsAnalytics athleteId={athleteId} />
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
