import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Calendar, Clock, MapPin, Heart, Zap } from 'lucide-react';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

const WorkoutHistory = ({ athleteId }) => {
  const { t } = useTranslation();
  const [workouts, setWorkouts] = useState([]);
  const [sleepData, setSleepData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('workouts');

  useEffect(() => {
    loadHistoryData();
  }, [athleteId]);

  const loadHistoryData = async () => {
    setIsLoading(true);
    try {
      const [workoutsRes, sleepRes] = await Promise.all([
        axios.get(`${API}/workouts/${athleteId}?limit=50`),
        axios.get(`${API}/sleep/${athleteId}?limit=30`)
      ]);
      
      setWorkouts(workoutsRes.data);
      setSleepData(sleepRes.data);
    } catch (error) {
      logger.error(null, 'Error loading history data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWorkoutTypeColor = (type) => {
    const colors = {
      'easy': 'bg-green-700 text-green-200 border border-green-600',
      'tempo': 'bg-orange-700 text-orange-200 border border-orange-600',
      'intervals': 'bg-red-700 text-red-200 border border-red-600',
      'long_run': 'bg-blue-700 text-blue-200 border border-blue-600',
      'recovery': 'bg-gray-600 text-gray-200 border border-gray-500',
      'fartlek': 'bg-purple-700 text-purple-200 border border-purple-600',
      'hill_repeats': 'bg-yellow-700 text-yellow-200 border border-yellow-600',
      'race': 'bg-pink-700 text-pink-200 border border-pink-600'
    };
    return colors[type] || 'bg-gray-600 text-gray-200 border border-gray-500';
  };

  const getEffortColor = (effort) => {
    if (effort >= 8) return 'text-red-400';
    if (effort >= 6) return 'text-orange-400';
    if (effort >= 4) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getSleepQualityColor = (quality) => {
    if (quality >= 8) return 'text-green-400';
    if (quality >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Header with view switcher */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-display text-white">{t('history.title')}</CardTitle>
              <CardDescription className="text-gray-300">{t('history.description')}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={activeView === 'workouts' ? 'default' : 'outline'}
                onClick={() => setActiveView('workouts')}
                className={`btn-transition w-full sm:w-auto ${
                  activeView === 'workouts' 
                    ? 'bg-teal-600 hover:bg-teal-700 text-white border-0' 
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'
                }`}
                data-testid="workouts-view-btn"
              >
                {t('history.workouts')} ({workouts.length})
              </Button>
              <Button
                variant={activeView === 'sleep' ? 'default' : 'outline'}
                onClick={() => setActiveView('sleep')}
                className={`btn-transition w-full sm:w-auto ${
                  activeView === 'sleep' 
                    ? 'bg-teal-600 hover:bg-teal-700 text-white border-0' 
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'
                }`}
                data-testid="sleep-view-btn"
              >
                {t('history.sleep')} ({sleepData.length})
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Workouts View */}
      {activeView === 'workouts' && (
        <div className="space-y-4">
          {workouts.length === 0 ? (
            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardContent className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300">{t('history.noWorkouts')}</p>
              </CardContent>
            </Card>
          ) : (
            workouts.map((workout) => (
              <Card key={workout.id} className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600 hover:border-teal-600 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <Badge 
                        className={getWorkoutTypeColor(workout.workout_type)}
                        data-testid={`workout-type-${workout.id}`}
                      >
                        {workout.workout_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-400">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(workout.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {workout.distance_miles} mi
                      </div>
                      <div className="text-sm text-gray-400">
                        {Math.round(workout.duration_minutes / workout.distance_miles * 10) / 10} min/mi avg
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">{t('history.duration')}</p>
                        <p className="font-medium text-white">{workout.duration_minutes} min</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Zap className={`w-4 h-4 mr-2 ${getEffortColor(workout.perceived_effort)}`} />
                      <div>
                        <p className="text-sm text-gray-400">{t('history.type')}</p>
                        <p className={`font-medium ${getEffortColor(workout.perceived_effort)}`}>
                          {workout.perceived_effort}/10
                        </p>
                      </div>
                    </div>
                    
                    {workout.avg_hr && (
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-red-400" />
                        <div>
                          <p className="text-sm text-gray-400">{t('history.avgHR')}</p>
                          <p className="font-medium text-white">{workout.avg_hr} bpm</p>
                        </div>
                      </div>
                    )}
                    
                    {workout.max_hr && (
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-red-500" />
                        <div>
                          <p className="text-sm text-gray-400">Max HR</p>
                          <p className="font-medium text-white">{workout.max_hr} bpm</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {workout.notes && (
                    <div className="pt-4 border-t border-gray-600">
                      <p className="text-sm text-gray-300 italic">"{workout.notes}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Sleep View */}
      {activeView === 'sleep' && (
        <div className="space-y-4">
          {sleepData.length === 0 ? (
            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardContent className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300">{t('history.noSleep')}</p>
              </CardContent>
            </Card>
          ) : (
            sleepData.map((sleep) => (
              <Card key={sleep.id} className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600 hover:border-teal-600 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center text-sm text-gray-400">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(sleep.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">
                        {sleep.total_sleep_hours}h
                      </div>
                      <div className={`text-sm font-medium ${getSleepQualityColor(sleep.sleep_quality)}`}>
                        Quality: {sleep.sleep_quality}/10
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Efficiency</p>
                      <p className="font-medium text-white">{sleep.sleep_efficiency}%</p>
                    </div>
                    
                    {sleep.hrv_score && (
                      <div>
                        <p className="text-sm text-gray-400">HRV</p>
                        <p className="font-medium text-white">{sleep.hrv_score}ms</p>
                      </div>
                    )}
                    
                    {sleep.resting_hr && (
                      <div>
                        <p className="text-sm text-gray-400">Resting HR</p>
                        <p className="font-medium text-white">{sleep.resting_hr} bpm</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkoutHistory;
