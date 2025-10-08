import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import ReadinessCard from './ReadinessCard';
import CoachChat from './CoachChat';
import DataLogTabs from './DataLogTabs';
import WorkoutHistory from './WorkoutHistory';
import Account from './Account';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ athleteId }) => {
  const [athlete, setAthlete] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, [athleteId]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [athleteRes, readinessRes, workoutsRes] = await Promise.all([
        axios.get(`${API}/athlete/${athleteId}`),
        axios.get(`${API}/readiness/${athleteId}`),
        axios.get(`${API}/workouts/${athleteId}?limit=5`)
      ]);

      setAthlete(athleteRes.data);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your coaching insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="font-display text-2xl font-bold text-gray-900 mr-8">
                RunWisely
              </h1>
              <nav className="flex space-x-4 md:space-x-8">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`text-sm font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid="overview-tab"
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('coach')}
                  className={`text-sm font-medium transition-colors ${
                    activeTab === 'coach'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid="coach-tab"
                >
                  AI Coach
                </button>
                <button
                  onClick={() => setActiveTab('log-data')}
                  className={`text-sm font-medium transition-colors ${
                    activeTab === 'log-data'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid="log-data-tab"
                >
                  Log Data
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid="history-tab"
                >
                  History
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`text-sm font-medium transition-colors ${
                    activeTab === 'account'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid="account-tab"
                >
                  Account
                </button>
              </nav>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-3">Welcome back,</span>
              <Badge variant="secondary" className="font-medium">
                {athlete?.name}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Readiness Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ReadinessCard readiness={readiness} onRefresh={loadDashboardData} />
              </div>
              
              {/* Quick Stats */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg font-display">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Weekly Goal</span>
                    <span className="font-semibold">{athlete?.weekly_mileage} miles</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Recent Workouts</span>
                    <span className="font-semibold">{recentWorkouts.length}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Running Goals</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs"
                      data-testid="view-goals-btn"
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-display">Recent Activity</CardTitle>
                <CardDescription>Your latest workouts and training sessions</CardDescription>
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
                      onClick={() => setActiveTab('log-data')}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="log-first-workout-btn"
                    >
                      Log Your First Workout
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'coach' && (
          <CoachChat athleteId={athleteId} />
        )}

        {activeTab === 'log-data' && (
          <DataLogTabs athleteId={athleteId} onDataLogged={handleDataLogged} />
        )}

        {activeTab === 'history' && (
          <WorkoutHistory athleteId={athleteId} />
        )}

        {activeTab === 'account' && (
          <Account athleteId={athleteId} />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
