import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Calendar, Clock, MapPin, Heart, Zap } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
      console.error('Error loading history data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWorkoutTypeColor = (type) => {
    const colors = {
      'easy': 'bg-green-100 text-green-800',
      'tempo': 'bg-orange-100 text-orange-800',
      'intervals': 'bg-red-100 text-red-800',
      'long_run': 'bg-blue-100 text-blue-800',
      'recovery': 'bg-gray-100 text-gray-800',
      'fartlek': 'bg-purple-100 text-purple-800',
      'hill_repeats': 'bg-yellow-100 text-yellow-800',
      'race': 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getEffortColor = (effort) => {
    if (effort >= 8) return 'text-red-600';
    if (effort >= 6) return 'text-orange-600';
    if (effort >= 4) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getSleepQualityColor = (quality) => {
    if (quality >= 8) return 'text-green-600';
    if (quality >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with view switcher */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-display">{t('history.title')}</CardTitle>
              <CardDescription>{t('history.description')}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={activeView === 'workouts' ? 'default' : 'outline'}
                onClick={() => setActiveView('workouts')}
                className="btn-transition w-full sm:w-auto"
                data-testid="workouts-view-btn"
              >
                {t('history.workouts')} ({workouts.length})
              </Button>
              <Button
                variant={activeView === 'sleep' ? 'default' : 'outline'}
                onClick={() => setActiveView('sleep')}
                className="btn-transition w-full sm:w-auto"
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
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No workouts logged yet</p>
              </CardContent>
            </Card>
          ) : (
            workouts.map((workout) => (
              <Card key={workout.id} className="border-0 shadow-lg hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <Badge 
                        className={getWorkoutTypeColor(workout.workout_type)}
                        data-testid={`workout-type-${workout.id}`}
                      >
                        {workout.workout_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(workout.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {workout.distance_miles} mi
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.round(workout.duration_minutes / workout.distance_miles * 10) / 10} min/mi avg
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Duration</p>
                        <p className="font-medium">{workout.duration_minutes} min</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Zap className={`w-4 h-4 mr-2 ${getEffortColor(workout.perceived_effort)}`} />
                      <div>
                        <p className="text-sm text-gray-600">Effort</p>
                        <p className={`font-medium ${getEffortColor(workout.perceived_effort)}`}>
                          {workout.perceived_effort}/10
                        </p>
                      </div>
                    </div>
                    
                    {workout.avg_hr && (
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-red-400" />
                        <div>
                          <p className="text-sm text-gray-600">Avg HR</p>
                          <p className="font-medium">{workout.avg_hr} bpm</p>
                        </div>
                      </div>
                    )}
                    
                    {workout.max_hr && (
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-red-600" />
                        <div>
                          <p className="text-sm text-gray-600">Max HR</p>
                          <p className="font-medium">{workout.max_hr} bpm</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {workout.notes && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-700 italic">"{workout.notes}"</p>
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
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No sleep data logged yet</p>
              </CardContent>
            </Card>
          ) : (
            sleepData.map((sleep) => (
              <Card key={sleep.id} className="border-0 shadow-lg hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(sleep.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {sleep.total_sleep_hours}h
                      </div>
                      <div className={`text-sm font-medium ${getSleepQualityColor(sleep.sleep_quality)}`}>
                        Quality: {sleep.sleep_quality}/10
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Efficiency</p>
                      <p className="font-medium">{sleep.sleep_efficiency}%</p>
                    </div>
                    
                    {sleep.hrv_score && (
                      <div>
                        <p className="text-sm text-gray-600">HRV</p>
                        <p className="font-medium">{sleep.hrv_score}ms</p>
                      </div>
                    )}
                    
                    {sleep.resting_hr && (
                      <div>
                        <p className="text-sm text-gray-600">Resting HR</p>
                        <p className="font-medium">{sleep.resting_hr} bpm</p>
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
