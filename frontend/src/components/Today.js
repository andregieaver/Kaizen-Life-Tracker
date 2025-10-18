import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Calendar, 
  Activity, 
  Utensils, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Flame
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : 'http://localhost:8001/api';

const Today = ({ athleteId }) => {
  const [todayData, setTodayData] = useState({
    calorieNeed: 0,
    caloriesConsumed: 0,
    caloriesRemaining: 0,
    trainingLoad: 0,
    workouts: [],
    meals: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [athleteProfile, setAthleteProfile] = useState(null);

  useEffect(() => {
    loadTodayData();
  }, [athleteId]);

  const loadTodayData = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Load athlete profile for calorie need
      const profileRes = await axios.get(`${API}/athlete/${athleteId}`);
      setAthleteProfile(profileRes.data);
      const calorieNeed = profileRes.data.estimated_calorie_need || 2000; // Default to 2000 if not set

      // Load today's nutrition entries
      const nutritionRes = await axios.get(`${API}/nutrition/${athleteId}`);
      const todayMeals = nutritionRes.data.entries.filter(entry => entry.entry_date === today);
      const caloriesConsumed = todayMeals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

      // Load today's workouts
      const workoutsRes = await axios.get(`${API}/workouts/${athleteId}`);
      const todayWorkouts = workoutsRes.data.filter(workout => {
        const workoutDate = new Date(workout.start_date).toISOString().split('T')[0];
        return workoutDate === today;
      });

      // Calculate training load (sum of workout durations or distances)
      const trainingLoad = todayWorkouts.reduce((sum, workout) => {
        // If distance exists, use it, otherwise use moving_time in minutes
        if (workout.distance) {
          return sum + (workout.distance / 1000); // Convert meters to km
        } else if (workout.moving_time) {
          return sum + (workout.moving_time / 60); // Convert seconds to minutes
        }
        return sum;
      }, 0);

      setTodayData({
        calorieNeed,
        caloriesConsumed,
        caloriesRemaining: calorieNeed - caloriesConsumed,
        trainingLoad: Math.round(trainingLoad),
        workouts: todayWorkouts,
        meals: todayMeals
      });

    } catch (error) {
      console.error('Error loading today data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCalorieStatus = () => {
    const remaining = todayData.caloriesRemaining;
    if (remaining > 500) return { color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp };
    if (remaining < -500) return { color: 'text-red-600', bg: 'bg-red-50', icon: TrendingDown };
    return { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle };
  };

  const calorieStatus = getCalorieStatus();
  const StatusIcon = calorieStatus.icon;

  const formatDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white flex items-center gap-2">
          <Calendar className="w-8 h-8 text-teal-400" />
          Today
        </h1>
        <p className="text-sm text-gray-300 mt-1">{formatDate()}</p>
      </div>

      {/* Main Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nutrition Overview */}
        <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-teal-600 border-2">
          <CardHeader className="bg-gradient-to-br from-teal-700 to-teal-800">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Utensils className="w-5 h-5 text-teal-200" />
              Nutrition
            </CardTitle>
            <CardDescription className="text-teal-100">Daily calorie tracking</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Calorie Need */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Daily Need</span>
                <span className="text-2xl font-bold text-white">{todayData.calorieNeed}</span>
              </div>
              <div className="text-xs text-gray-400">
                {athleteProfile?.estimated_calorie_need 
                  ? 'Based on your profile settings' 
                  : 'Default value (update in Account Settings)'}
              </div>
            </div>

            {/* Calories Consumed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Consumed</span>
                <span className="text-2xl font-bold text-teal-400">{todayData.caloriesConsumed}</span>
              </div>
              <div className="text-xs text-gray-400">
                From {todayData.meals.length} meal{todayData.meals.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Calories Remaining */}
            <div className={`p-4 rounded-lg ${
              todayData.caloriesRemaining > 500 ? 'bg-blue-900/30 border border-blue-700' :
              todayData.caloriesRemaining < -500 ? 'bg-red-900/30 border border-red-700' :
              'bg-green-900/30 border border-green-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-5 h-5 ${
                    todayData.caloriesRemaining > 500 ? 'text-blue-400' :
                    todayData.caloriesRemaining < -500 ? 'text-red-400' :
                    'text-green-400'
                  }`} />
                  <span className="text-sm font-medium text-gray-200">Remaining</span>
                </div>
                <span className={`text-2xl font-bold ${
                  todayData.caloriesRemaining > 500 ? 'text-blue-400' :
                  todayData.caloriesRemaining < -500 ? 'text-red-400' :
                  'text-green-400'
                }`}>
                  {todayData.caloriesRemaining > 0 ? '+' : ''}{todayData.caloriesRemaining}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {todayData.caloriesRemaining > 500 && 'You need more calories today'}
                {todayData.caloriesRemaining >= -500 && todayData.caloriesRemaining <= 500 && 'You\'re on track!'}
                {todayData.caloriesRemaining < -500 && 'You\'ve exceeded your daily goal'}
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2 text-xs text-gray-300">
                <span>Progress</span>
                <span>{Math.round((todayData.caloriesConsumed / todayData.calorieNeed) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    todayData.caloriesConsumed > todayData.calorieNeed 
                      ? 'bg-red-500' 
                      : 'bg-teal-500'
                  }`}
                  style={{ 
                    width: `${Math.min((todayData.caloriesConsumed / todayData.calorieNeed) * 100, 100)}%` 
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Load */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-blue-600" />
              Training Load
            </CardTitle>
            <CardDescription>Today's activity summary</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Training Load Value */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Load</span>
                <span className="text-2xl font-bold text-blue-600">
                  {todayData.trainingLoad}
                  <span className="text-sm text-gray-500 ml-1">
                    {todayData.workouts.length > 0 && todayData.workouts[0].distance ? 'km' : 'min'}
                  </span>
                </span>
              </div>
              <div className="text-xs text-gray-500">
                From {todayData.workouts.length} workout{todayData.workouts.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Workout List */}
            {todayData.workouts.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Today's Workouts</h4>
                {todayData.workouts.map((workout, index) => (
                  <div key={index} className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">{workout.name || 'Workout'}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {workout.sport_type || workout.type || 'Run'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                      {workout.distance && (
                        <span>{(workout.distance / 1000).toFixed(2)} km</span>
                      )}
                      {workout.moving_time && (
                        <span>{Math.round(workout.moving_time / 60)} min</span>
                      )}
                      {workout.average_heartrate && (
                        <span>{workout.average_heartrate} bpm</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50 rounded-lg">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No workouts recorded today</p>
                <p className="text-xs text-gray-500 mt-1">Connect Strava or log manually</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meals Detail */}
      {todayData.meals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Today's Meals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayData.meals.map((meal, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Utensils className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{meal.meal_type}</p>
                      <p className="text-xs text-gray-600">{meal.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{meal.calories || 0}</p>
                    <p className="text-xs text-gray-500">cal</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Today;
