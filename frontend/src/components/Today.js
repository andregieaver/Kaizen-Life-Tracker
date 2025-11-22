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
  Flame,
  Check,
  Repeat
} from 'lucide-react';
import { formatDate as formatDateUtil } from '../utils/formatters';
import BodyScoreCard from './BodyScoreCard';
import LoadingSpinner from './ui/LoadingSpinner';

import { logger } from '../utils/logger';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Today = ({ athleteId }) => {
  const { t, i18n } = useTranslation();
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
  const [habits, setHabits] = useState([]);
  const [habitCompletions, setHabitCompletions] = useState({});

  useEffect(() => {
    loadTodayData();
    loadHabits();
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

  // Habits functions
  const loadHabits = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [habitsRes, completionsRes] = await Promise.all([
        axios.get(`${API}/habits/${athleteId}`),
        axios.get(`${API}/habits/${athleteId}/completions`, {
          params: {
            start_date: today,
            end_date: today
          }
        })
      ]);
      
      setHabits(habitsRes.data.habits || []);
      
      // Convert completions to map
      const completionsMap = {};
      (completionsRes.data.completions || []).forEach(comp => {
        const key = `${comp.habit_id}-${comp.date}`;
        completionsMap[key] = comp.completions;
      });
      setHabitCompletions(completionsMap);
    } catch (error) {
      logger.error(null, 'Error loading habits:', error);
    }
  };

  const getTodayCompletions = (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `${habitId}-${today}`;
    return habitCompletions[key] || 0;
  };

  const handleCompleteHabit = async (habitId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await axios.post(`${API}/habits/${habitId}/complete`, null, {
        params: { athlete_id: athleteId, date: today }
      });
      await loadHabits();
    } catch (error) {
      logger.error(null, 'Error logging habit completion:', error);
    }
  };

  const handleUncompleteHabit = async (habitId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await axios.post(`${API}/habits/${habitId}/uncomplete`, null, {
        params: { athlete_id: athleteId, date: today }
      });
      await loadHabits();
    } catch (error) {
      logger.error(null, 'Error undoing habit completion:', error);
    }
  };

  const getTodayHabits = () => {
    const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = DAYS_OF_WEEK[new Date().getDay()];
    return habits.filter(habit => habit.days_of_week && habit.days_of_week.includes(todayDayName));
  };

  const calorieStatus = getCalorieStatus();
  const StatusIcon = calorieStatus.icon;

  const formatDate = () => {
    const today = new Date();
    const preferences = {
      date_format: athleteProfile?.date_format || 'MM/DD/YYYY',
      timezone: athleteProfile?.timezone || 'UTC'
    };
    
    // Get weekday name based on locale
    const weekday = today.toLocaleDateString(i18n.language, { weekday: 'long' });
    
    // Get formatted date based on user's preference
    const formattedDate = formatDateUtil(today.toISOString(), preferences);
    
    return `${weekday}, ${formattedDate}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-950)' }}>
        <LoadingSpinner size="lg" withBackground={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 md:p-6 md:pt-0 space-y-6" style={{ background: 'var(--bg-950)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
          <Calendar className="w-6 h-6 md:w-8 md:h-8" style={{ color: 'var(--c-brand-500)' }} />
          {t('today.title')}
        </h1>
        <p className="text-xs md:text-sm text-right" style={{ color: 'var(--text-med)' }}>{formatDate()}</p>
      </div>

      {/* Body Score Card */}
      <BodyScoreCard athleteId={athleteId} />

      {/* Today's Habits Section */}
      {getTodayHabits().length > 0 && (
        <div className="border-0 shadow-lg overflow-hidden" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          borderRadius: '12px',
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
        }}>
          <div className="p-3 md:p-4 pb-2 md:pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="flex items-center gap-2 text-base md:text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Repeat className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--c-brand-500)' }} />
              {t('today.todayHabits')}
            </h3>
          </div>
          <div className="p-3 md:p-4 space-y-2">
            {getTodayHabits().map(habit => {
              const completions = getTodayCompletions(habit.id);
              const goal = habit.times_per_day || 1;
              const isComplete = completions >= goal;
              
              return (
                <div 
                  key={habit.id}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg"
                  style={{
                    background: isComplete 
                      ? 'rgba(50, 211, 255, 0.1)'
                      : 'color-mix(in srgb, var(--c-glass) 8%, transparent)',
                    border: isComplete 
                      ? '1px solid rgba(50, 211, 255, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div 
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isComplete 
                          ? 'rgba(50, 211, 255, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {isComplete ? (
                        <Check className="w-4 h-4 md:w-5 md:h-5" style={{ color: '#32D3FF' }} />
                      ) : (
                        <Repeat className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm md:text-base font-medium truncate" style={{ color: 'var(--text-hi)' }}>{habit.title}</h4>
                      <p className="text-xs" style={{ color: 'var(--text-med)' }}>
                        {completions} / {goal} {t('habits.today')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                    {completions < goal && (
                      <button
                        onClick={() => handleCompleteHabit(habit.id)}
                        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all"
                        style={{
                          backgroundColor: '#32D3FF',
                          color: 'white'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                      >
                        {t('habits.tap')}
                      </button>
                    )}
                    {completions > 0 && (
                      <button
                        onClick={() => handleUncompleteHabit(habit.id)}
                        className="px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-med)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.color = 'var(--text-hi)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.color = 'var(--text-med)';
                        }}
                      >
                        {t('habits.undo')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* Nutrition Overview */}
        <div className="border-0 shadow-lg overflow-hidden" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          borderRadius: '12px',
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
        }}>
          <div className="p-3 md:p-4 pb-2 md:pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="flex items-center gap-2 text-base md:text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Utensils className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--c-brand-500)' }} />
              {t('nutrition.title')}
            </h3>
          </div>
          <div className="p-3 md:p-4 space-y-2 md:space-y-3">
            {/* Calories Remaining - Hero Stat */}
            <div className={`p-3 md:p-4 rounded-lg`} style={{
              background: todayData.caloriesRemaining > 500 ? 'rgba(59, 130, 246, 0.15)' :
                         todayData.caloriesRemaining < -500 ? 'rgba(239, 68, 68, 0.15)' :
                         'rgba(34, 197, 94, 0.15)',
              border: todayData.caloriesRemaining > 500 ? '1px solid var(--c-info)' :
                     todayData.caloriesRemaining < -500 ? '1px solid var(--c-danger)' :
                     '1px solid var(--c-success)'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 md:w-5 md:h-5`} style={{
                    color: todayData.caloriesRemaining > 500 ? 'var(--c-info)' :
                          todayData.caloriesRemaining < -500 ? 'var(--c-danger)' :
                          'var(--c-success)'
                  }} />
                  <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-med)' }}>{t('today.remaining')}</span>
                </div>
                <span className={`text-xl md:text-2xl font-bold`} style={{ 
                  fontFamily: 'var(--font-display)',
                  color: todayData.caloriesRemaining > 500 ? 'var(--c-info)' :
                        todayData.caloriesRemaining < -500 ? 'var(--c-danger)' :
                        'var(--c-success)'
                }}>
                  {todayData.caloriesRemaining > 0 ? '+' : ''}{todayData.caloriesRemaining}
                </span>
              </div>
            </div>

            {/* Daily Need & Consumed - Compact Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 md:p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                <div className="text-xs" style={{ color: 'var(--text-med)' }}>{t('today.dailyNeed')}</div>
                <div className="text-lg md:text-xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{todayData.calorieNeed}</div>
              </div>
              <div className="p-2 md:p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                <div className="text-xs" style={{ color: 'var(--text-med)' }}>{t('today.consumed')}</div>
                <div className="text-lg md:text-xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-brand-500)' }}>{todayData.caloriesConsumed}</div>
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
        <div className="border-0 shadow-lg overflow-hidden" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          borderRadius: '12px',
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
        }}>
          <div className="p-3 md:p-4 pb-2 md:pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="flex items-center gap-2 text-base md:text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Activity className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--c-brand-500)' }} />
              {t('today.trainingLoad')}
            </h3>
          </div>
          <div className="p-3 md:p-4 space-y-2 md:space-y-3">
            {/* Training Load Value */}
            <div className="p-2 md:p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm" style={{ color: 'var(--text-med)' }}>{t('today.totalLoad')}</span>
                <span className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-brand-500)' }}>
                  {todayData.trainingLoad}
                  <span className="text-xs md:text-sm ml-1" style={{ color: 'var(--text-muted)' }}>
                    {todayData.workouts.length > 0 && todayData.workouts[0].distance ? t('common.km') : t('today.min')}
                  </span>
                </span>
              </div>
            </div>

            {/* Workout List */}
            {todayData.workouts.length > 0 ? (
              <div className="space-y-2">
                {todayData.workouts.map((workout, index) => (
                  <div key={index} className="p-2 md:p-3 rounded-lg" style={{ background: 'var(--grad-cta-soft)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-3 h-3 md:w-4 md:h-4" style={{ color: 'var(--c-warning)' }} />
                        <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-hi)' }}>{workout.name || t('today.workout')}</span>
                      </div>
                      <Badge variant="outline" className="text-xs" style={{ borderColor: 'var(--c-brand-500)', color: 'var(--c-brand-500)' }}>
                        {workout.sport_type || workout.type || 'Run'}
                      </Badge>
                    </div>
                    <div className="mt-1 md:mt-2 flex items-center gap-3 md:gap-4 text-xs" style={{ color: 'var(--text-med)' }}>
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
              <div className="p-4 md:p-6 text-center rounded-lg" style={{
                background: 'color-mix(in srgb, var(--c-glass) 8%, transparent)',
                backdropFilter: 'blur(8px) saturate(120%)',
                WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.15)'
              }}>
                <Activity className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs md:text-sm" style={{ color: 'var(--text-med)' }}>{t('today.noWorkoutsToday')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meals Detail */}
      {todayData.meals.length > 0 && (
        <div className="border-0 shadow-lg overflow-hidden" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <div className="p-3 md:p-4 pb-2 md:pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-base md:text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('today.todaysMeals')}</h3>
          </div>
          <div className="p-3 md:p-4">
            <div className="space-y-2">
              {todayData.meals.map((meal, index) => (
                <div key={index} className="flex items-center justify-between p-2 md:p-3 rounded-lg" style={{
                  background: 'color-mix(in srgb, var(--c-glass) 8%, transparent)',
                  backdropFilter: 'blur(8px) saturate(120%)',
                  WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.15)'
                }}>
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className="p-1.5 md:p-2 rounded-full flex-shrink-0" style={{ background: 'var(--c-brand-500)' }}>
                      <Utensils className="w-3 h-3 md:w-4 md:h-4" style={{ color: 'white' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm font-medium capitalize truncate" style={{ color: 'var(--text-hi)' }}>{meal.meal_type}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-med)' }}>{meal.description}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm md:text-base font-bold" style={{ color: 'var(--text-hi)' }}>{meal.calories || 0}</p>
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
