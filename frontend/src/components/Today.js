import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

      // Load all data in parallel for better performance
      const [profileRes, nutritionRes, workoutsRes] = await Promise.all([
        axios.get(`${API}/athlete/${athleteId}`),
        axios.get(`${API}/nutrition/${athleteId}?date=${today}`),
        axios.get(`${API}/workouts/${athleteId}?date=${today}&limit=50`)
      ]);

      // Process profile data
      setAthleteProfile(profileRes.data);
      const calorieNeed = profileRes.data.estimated_calorie_need || 2000; // Default to 2000 if not set

      // Process nutrition data - already filtered by backend
      const todayMeals = nutritionRes.data.entries;
      const caloriesConsumed = todayMeals.reduce((sum, meal) => sum + (meal.calories || 0), 0);

      // Process workouts - already filtered by backend
      const todayWorkouts = workoutsRes.data;

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
      // Silently fail - non-critical feature
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--c-brand-500)' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 md:p-6 space-y-6" style={{ background: 'var(--grad-page)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
          <Calendar className="w-6 h-6 md:w-8 md:h-8" style={{ color: 'var(--c-brand-500)' }} />
          {t('today.title')}
        </h1>
        <p className="text-xs md:text-sm text-right" style={{ color: 'var(--text-med)' }}>{formatDate()}</p>
      </div>

      {/* Main Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* Nutrition Overview */}
        <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)'
        }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Utensils className="w-5 h-5" style={{ color: 'var(--c-brand-500)' }} />
              {t('nutrition.title')}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-med)' }}>{t('today.dailyCalorieTracking')}</p>
          </div>
          <div className="p-4 space-y-4">
            {/* Calorie Need */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-med)' }}>{t('today.dailyNeed')}</span>
                <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{todayData.calorieNeed}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {athleteProfile?.estimated_calorie_need 
                  ? t('today.basedOnProfile')
                  : t('today.defaultValue')}
              </div>
            </div>

            {/* Calories Consumed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-med)' }}>{t('today.consumed')}</span>
                <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-brand-500)' }}>{todayData.caloriesConsumed}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('today.fromMeals', { count: todayData.meals.length })}
              </div>
            </div>

            {/* Calories Remaining */}
            <div className={`p-4 rounded-2xl`} style={{
              background: todayData.caloriesRemaining > 500 ? 'rgba(59, 130, 246, 0.15)' :
                         todayData.caloriesRemaining < -500 ? 'rgba(239, 68, 68, 0.15)' :
                         'rgba(34, 197, 94, 0.15)',
              border: todayData.caloriesRemaining > 500 ? '1px solid var(--c-info)' :
                     todayData.caloriesRemaining < -500 ? '1px solid var(--c-danger)' :
                     '1px solid var(--c-success)'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-5 h-5`} style={{
                    color: todayData.caloriesRemaining > 500 ? 'var(--c-info)' :
                          todayData.caloriesRemaining < -500 ? 'var(--c-danger)' :
                          'var(--c-success)'
                  }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-med)' }}>{t('today.remaining')}</span>
                </div>
                <span className={`text-2xl font-bold`} style={{ 
                  fontFamily: 'var(--font-display)',
                  color: todayData.caloriesRemaining > 500 ? 'var(--c-info)' :
                        todayData.caloriesRemaining < -500 ? 'var(--c-danger)' :
                        'var(--c-success)'
                }}>
                  {todayData.caloriesRemaining > 0 ? '+' : ''}{todayData.caloriesRemaining}
                </span>
              </div>
              <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {todayData.caloriesRemaining > 500 && t('today.needMoreCalories')}
                {todayData.caloriesRemaining >= -500 && todayData.caloriesRemaining <= 500 && t('today.onTrack')}
                {todayData.caloriesRemaining < -500 && t('today.exceededGoal')}
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2 text-xs" style={{ color: 'var(--text-med)' }}>
                <span>{t('today.progress')}</span>
                <span>{Math.round((todayData.caloriesConsumed / todayData.calorieNeed) * 100)}%</span>
              </div>
              <div className="w-full rounded-full h-3" style={{ background: 'var(--bg-800)' }}>
                <div 
                  className={`h-3 rounded-full transition-all`}
                  style={{ 
                    width: `${Math.min((todayData.caloriesConsumed / todayData.calorieNeed) * 100, 100)}%`,
                    background: todayData.caloriesConsumed > todayData.calorieNeed ? 'var(--c-danger)' : 'var(--grad-brand)'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Training Load */}
        <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)'
        }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Activity className="w-5 h-5" style={{ color: 'var(--c-brand-500)' }} />
              {t('today.trainingLoad')}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-med)' }}>{t('today.todaysActivitySummary')}</p>
          </div>
          <div className="p-4 space-y-4">
            {/* Training Load Value */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: 'var(--text-med)' }}>{t('today.totalLoad')}</span>
                <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-brand-500)' }}>
                  {todayData.trainingLoad}
                  <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>
                    {todayData.workouts.length > 0 && todayData.workouts[0].distance ? t('common.km') : t('today.min')}
                  </span>
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('today.fromWorkouts', { count: todayData.workouts.length })}
              </div>
            </div>

            {/* Workout List */}
            {todayData.workouts.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium" style={{ color: 'var(--text-med)' }}>{t('today.todaysWorkouts')}</h4>
                {todayData.workouts.map((workout, index) => (
                  <div key={index} className="p-3 rounded-2xl" style={{ background: 'var(--grad-cta-soft)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4" style={{ color: 'var(--c-warning)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>{workout.name || t('today.workout')}</span>
                      </div>
                      <Badge variant="outline" className="text-xs" style={{ borderColor: 'var(--c-brand-500)', color: 'var(--c-brand-500)' }}>
                        {workout.sport_type || workout.type || 'Run'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: 'var(--text-med)' }}>
                      {workout.distance && (
                        <span>{(workout.distance / 1000).toFixed(2)} {t('common.km')}</span>
                      )}
                      {workout.moving_time && (
                        <span>{Math.round(workout.moving_time / 60)} {t('today.min')}</span>
                      )}
                      {workout.average_heartrate && (
                        <span>{workout.average_heartrate} {t('today.bpm')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-lg" style={{
                background: 'color-mix(in srgb, var(--c-glass) 8%, transparent)',
                backdropFilter: 'blur(8px) saturate(120%)',
                WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.15)'
              }}>
                <Activity className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-med)' }}>{t('today.noWorkoutsToday')}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('today.connectStravaOrLogManually')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meals Detail */}
      {todayData.meals.length > 0 && (
        <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('today.todaysMeals')}</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {todayData.meals.map((meal, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{
                  background: 'color-mix(in srgb, var(--c-glass) 8%, transparent)',
                  backdropFilter: 'blur(8px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.15)'
                }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full" style={{ background: 'var(--c-brand-500)' }}>
                      <Utensils className="w-4 h-4" style={{ color: 'white' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-hi)' }}>{meal.meal_type}</p>
                      <p className="text-xs" style={{ color: 'var(--text-med)' }}>{meal.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-hi)' }}>{meal.calories || 0}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('today.cal')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Today;
