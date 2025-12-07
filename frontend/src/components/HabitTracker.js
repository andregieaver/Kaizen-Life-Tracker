import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, X, Edit3, Trash2, Check, Flame, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HabitTracker = ({ athleteId }) => {
  const { t, i18n } = useTranslation();
  
  const DAYS_OF_WEEK = [
    { value: 'monday', label: t('habits.daysOfWeek.mon'), full: t('habits.daysOfWeek.monday') },
    { value: 'tuesday', label: t('habits.daysOfWeek.tue'), full: t('habits.daysOfWeek.tuesday') },
    { value: 'wednesday', label: t('habits.daysOfWeek.wed'), full: t('habits.daysOfWeek.wednesday') },
    { value: 'thursday', label: t('habits.daysOfWeek.thu'), full: t('habits.daysOfWeek.thursday') },
    { value: 'friday', label: t('habits.daysOfWeek.fri'), full: t('habits.daysOfWeek.friday') },
    { value: 'saturday', label: t('habits.daysOfWeek.sat'), full: t('habits.daysOfWeek.saturday') },
    { value: 'sunday', label: t('habits.daysOfWeek.sun'), full: t('habits.daysOfWeek.sunday') }
  ];
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedHabitId, setExpandedHabitId] = useState(null);

  // Use local date formatting to avoid timezone issues with toISOString()
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const today = getLocalDateString(new Date());
  const todayDayName = DAYS_OF_WEEK[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1].value;

  useEffect(() => {
    if (athleteId) {
      loadHabits();
      loadCompletions();
    }
  }, [athleteId]);

  const loadHabits = async () => {
    try {
      const response = await axios.get(`${API}/habits/${athleteId}`);
      setHabits(response.data.habits || []);
    } catch (error) {
      logger.error(null, 'Error loading habits:', error);
    }
  };

  const loadCompletions = async () => {
    try {
      // Load last 30 days of completions
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const response = await axios.get(`${API}/habits/${athleteId}/completions`, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });
      
      // Convert to map for easy lookup
      const completionsMap = {};
      (response.data.completions || []).forEach(comp => {
        const key = `${comp.habit_id}-${comp.date}`;
        completionsMap[key] = comp.completions;
      });
      
      setCompletions(completionsMap);
    } catch (error) {
      logger.error(null, 'Error loading completions:', error);
    }
  };

  const openAddModal = () => {
    setEditingHabit(null);
    setTitle('');
    setSelectedDays([]);
    setTimesPerDay(1);
    setShowModal(true);
  };

  const openEditModal = (habit) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setSelectedDays(habit.days_of_week || []);
    setTimesPerDay(habit.times_per_day || 1);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingHabit(null);
    setTitle('');
    setSelectedDays([]);
    setTimesPerDay(1);
  };

  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || selectedDays.length === 0 || timesPerDay < 1) {
      alert('Please fill all fields correctly');
      return;
    }

    setIsLoading(true);
    try {
      if (editingHabit) {
        // Update
        await axios.put(`${API}/habits/${editingHabit.id}`, {
          title: title.trim(),
          days_of_week: selectedDays,
          times_per_day: timesPerDay
        });
      } else {
        // Create
        await axios.post(`${API}/habits`, {
          athlete_id: athleteId,
          title: title.trim(),
          days_of_week: selectedDays,
          times_per_day: timesPerDay
        });
      }
      
      await loadHabits();
      closeModal();
    } catch (error) {
      logger.error(null, 'Error saving habit:', error);
      alert('Failed to save habit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (habitId) => {
    if (!window.confirm('Delete this habit? All tracking data will be lost.')) {
      return;
    }

    try {
      await axios.delete(`${API}/habits/${habitId}`);
      await loadHabits();
      await loadCompletions();
    } catch (error) {
      logger.error(null, 'Error deleting habit:', error);
      alert('Failed to delete habit');
    }
  };

  const handleComplete = async (habitId) => {
    try {
      await axios.post(`${API}/habits/${habitId}/complete`, null, {
        params: { athlete_id: athleteId, date: today }
      });
      await loadCompletions();
    } catch (error) {
      logger.error(null, 'Error logging completion:', error);
    }
  };

  const handleUncomplete = async (habitId) => {
    try {
      await axios.post(`${API}/habits/${habitId}/uncomplete`, null, {
        params: { athlete_id: athleteId, date: today }
      });
      await loadCompletions();
    } catch (error) {
      logger.error(null, 'Error undoing completion:', error);
    }
  };

  const getTodayCompletions = (habitId) => {
    const key = `${habitId}-${today}`;
    return completions[key] || 0;
  };

  const calculateStreak = (habit) => {
    let streak = 0;
    const checkDate = new Date();
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayName = DAYS_OF_WEEK[checkDate.getDay() === 0 ? 6 : checkDate.getDay() - 1].value;
      
      // Only check days that are in the habit's schedule
      if (habit.days_of_week.includes(dayName)) {
        const key = `${habit.id}-${dateStr}`;
        const count = completions[key] || 0;
        
        if (count >= habit.times_per_day) {
          streak++;
        } else if (dateStr !== today) {
          // Only break streak for past days, not today
          break;
        }
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Limit to last 90 days
      if (streak > 90) break;
    }
    
    return streak;
  };

  // Calculate completion score for last 30 days
  const calculateCompletionScore = (habit) => {
    let completedDays = 0;
    let totalScheduledDays = 0;
    
    const checkDate = new Date();
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayName = DAYS_OF_WEEK[checkDate.getDay() === 0 ? 6 : checkDate.getDay() - 1].value;
      
      // Only count days that are in the habit's schedule
      if (habit.days_of_week.includes(dayName)) {
        totalScheduledDays++;
        const key = `${habit.id}-${dateStr}`;
        const count = completions[key] || 0;
        
        if (count >= habit.times_per_day) {
          completedDays++;
        }
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return totalScheduledDays > 0 ? Math.round((completedDays / totalScheduledDays) * 100) : 0;
  };

  // Get last 28 days for mini calendar (4 weeks)
  const getLast28Days = () => {
    const days = [];
    const checkDate = new Date();
    
    // Go back to start of current week (Monday)
    const currentDay = checkDate.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    checkDate.setDate(checkDate.getDate() - daysFromMonday - 21); // Go back 3 more weeks
    
    for (let i = 0; i < 28; i++) {
      days.push({
        date: new Date(checkDate).toISOString().split('T')[0],
        dayName: DAYS_OF_WEEK[checkDate.getDay() === 0 ? 6 : checkDate.getDay() - 1].value,
        dayOfMonth: checkDate.getDate(),
        isToday: checkDate.toISOString().split('T')[0] === today
      });
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    return days;
  };

  // Get completion status for a specific day and habit
  const getDayCompletionStatus = (habit, date) => {
    const key = `${habit.id}-${date}`;
    const count = completions[key] || 0;
    
    if (count >= habit.times_per_day) {
      return 'complete';
    } else if (count > 0) {
      return 'partial';
    }
    return 'none';
  };

  const todayHabits = habits.filter(h => h.days_of_week.includes(todayDayName));
  const longestStreak = habits.length > 0 
    ? Math.max(...habits.map(h => calculateStreak(h)), 0)
    : 0;

  return (
    <div className="pt-4 px-2 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">{t('habits.title')}</h2>
        <Button 
          onClick={openAddModal} 
          className="text-white border-0 w-10 h-10 md:w-12 md:h-12 p-0 flex items-center justify-center"
          style={{ backgroundColor: '#32D3FF', borderRadius: '99px' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
        >
          <Plus className="w-5 h-5 md:w-6 md:h-6" />
        </Button>
      </div>

      {/* Longest Streak Banner */}
      {longestStreak > 0 && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-400" />
            <div>
              <div className="text-sm text-gray-300">{t('habits.currentStreak')}</div>
              <div className="text-2xl font-bold text-orange-400">{longestStreak} {t('habits.days')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Today's Habits */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-white">
          {t('habits.today')} - {new Date().toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })}
        </h3>
        
        {todayHabits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Check className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-200 mb-2">{t('habits.noHabitsYet')}</h3>
            <p className="text-gray-400 text-center">
              {t('habits.startTracking')}
            </p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {todayHabits.map(habit => {
              const todayCount = getTodayCompletions(habit.id);
              const isComplete = todayCount >= habit.times_per_day;
              const streak = calculateStreak(habit);
              const completionScore = calculateCompletionScore(habit);
              const last28Days = getLast28Days();
              const isExpanded = expandedHabitId === habit.id;
              
              return (
                <div 
                  key={habit.id} 
                  className={`transition-all p-4 ${isComplete ? 'ring-2 ring-green-400' : ''}`}
                  style={{ 
                    background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
                    backdropFilter: 'blur(24px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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
                    `,
                    borderRadius: '8px'
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      {/* Main Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h4 className="text-base md:text-lg font-semibold text-white">{habit.title}</h4>
                          {isComplete && (
                            <span className="flex items-center gap-1 text-xs md:text-sm font-medium" style={{ color: '#32D3FF' }}>
                              <Check className="w-4 h-4" />
                              {t('habits.complete')}
                            </span>
                          )}
                          {/* Completion Score Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            completionScore >= 80 ? 'bg-green-500/20 text-green-400' :
                            completionScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {completionScore}%
                          </span>
                        </div>
                        
                        <div className="text-xs md:text-sm text-gray-300 mb-3">
                          {t('habits.goal')}: {habit.times_per_day}x {t('habits.today').toLowerCase()}
                          <span className="mx-2">•</span>
                          {habit.days_of_week.length} {t('habits.daysPerWeek')}
                        </div>

                        {/* Progress Dots */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          {Array.from({ length: habit.times_per_day }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium transition-all ${
                                i < todayCount
                                  ? 'text-white'
                                  : 'bg-gray-700 text-gray-400'
                              }`}
                              style={i < todayCount ? { backgroundColor: '#32D3FF' } : {}}
                            >
                              {i < todayCount ? '✓' : i + 1}
                            </div>
                          ))}
                        </div>

                        {/* Streak */}
                        {streak > 0 && (
                          <div className="flex items-center gap-2 text-orange-400 mb-3">
                            <Flame className="w-4 h-4" />
                            <span className="text-xs md:text-sm font-medium">{streak} {t('habits.dayStreak')}</span>
                          </div>
                        )}

                        {/* Calendar Toggle Button */}
                        <button
                          onClick={() => setExpandedHabitId(isExpanded ? null : habit.id)}
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{isExpanded ? t('habits.hideHistory') || 'Hide history' : t('habits.showHistory') || 'Show history'}</span>
                          {isExpanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Action Buttons - Better mobile layout */}
                      <div className="flex md:flex-col gap-2 w-full md:w-auto">
                        {!isComplete ? (
                          <Button
                            onClick={() => handleComplete(habit.id)}
                            className="flex-1 md:flex-none md:min-w-[100px] border-0 text-white text-sm md:text-base"
                            style={{ 
                              backgroundColor: '#32D3FF',
                              '&:hover': { backgroundColor: '#1FC1FF' }
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                            size="lg"
                          >
                            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1" />
                            {t('habits.tap')}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUncomplete(habit.id)}
                            className="flex-1 md:flex-none md:min-w-[100px] bg-gray-700 text-white border-0 hover:bg-gray-600 text-sm md:text-base"
                          >
                            {t('habits.undo')}
                          </Button>
                        )}
                        
                        <div className="flex gap-1">
                          <Button
                            onClick={() => openEditModal(habit)}
                            className="bg-transparent hover:bg-gray-700 text-white"
                            size="sm"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(habit.id)}
                            className="bg-transparent hover:bg-red-900/30 text-red-400"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Mini Calendar - Expandable */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <div className="text-xs text-gray-400 mb-2">{t('habits.last4Weeks') || 'Last 4 weeks'}</div>
                        
                        {/* Day labels */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {DAYS_OF_WEEK.map(day => (
                            <div key={day.value} className="text-center text-[10px] text-gray-500">
                              {day.label}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar grid - 4 weeks */}
                        <div className="grid grid-cols-7 gap-1">
                          {last28Days.map((day, index) => {
                            const isScheduled = habit.days_of_week.includes(day.dayName);
                            const status = getDayCompletionStatus(habit, day.date);
                            
                            return (
                              <div
                                key={index}
                                className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium transition-all ${
                                  day.isToday ? 'ring-1 ring-white' : ''
                                } ${
                                  !isScheduled 
                                    ? 'bg-gray-800/30 text-gray-600' 
                                    : status === 'complete'
                                      ? 'bg-green-500/80 text-white'
                                      : status === 'partial'
                                        ? 'bg-yellow-500/60 text-white'
                                        : 'bg-gray-700/50 text-gray-400'
                                }`}
                                title={`${day.date}${isScheduled ? (status === 'complete' ? ' - Completed' : status === 'partial' ? ' - Partial' : ' - Not done') : ' - Not scheduled'}`}
                              >
                                {day.dayOfMonth}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Legend */}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-green-500/80"></div>
                            <span>{t('habits.completed') || 'Done'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-yellow-500/60"></div>
                            <span>{t('habits.partial') || 'Partial'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-gray-700/50"></div>
                            <span>{t('habits.missed') || 'Missed'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Habits Section */}
      {habits.length > todayHabits.length && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-white">{t('habits.otherHabits')}</h3>
          <div className="space-y-2 md:space-y-3">
            {habits.filter(h => !h.days_of_week.includes(todayDayName)).map(habit => {
              const completionScore = calculateCompletionScore(habit);
              const streak = calculateStreak(habit);
              const last28Days = getLast28Days();
              const isExpanded = expandedHabitId === habit.id;
              
              return (
                <div 
                  key={habit.id} 
                  className="transition-all p-4"
                  style={{ 
                    background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
                    backdropFilter: 'blur(24px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
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
                    `,
                    borderRadius: '8px'
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    {/* Main Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="text-base md:text-lg font-semibold text-white">{habit.title}</h4>
                        {/* Completion Score Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          completionScore >= 80 ? 'bg-green-500/20 text-green-400' :
                          completionScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {completionScore}%
                        </span>
                      </div>
                      
                      <div className="text-xs md:text-sm text-gray-300 mb-3">
                        {habit.times_per_day}x {t('habits.perDay')} • {habit.days_of_week.map(d => 
                          DAYS_OF_WEEK.find(day => day.value === d)?.label
                        ).join(', ')}
                      </div>

                      {/* Streak */}
                      {streak > 0 && (
                        <div className="flex items-center gap-2 text-orange-400 mb-3">
                          <Flame className="w-4 h-4" />
                          <span className="text-xs md:text-sm font-medium">{streak} {t('habits.dayStreak')}</span>
                        </div>
                      )}

                      {/* Calendar Toggle Button */}
                      <button
                        onClick={() => setExpandedHabitId(isExpanded ? null : habit.id)}
                        className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>{isExpanded ? t('habits.hideHistory') || 'Hide history' : t('habits.showHistory') || 'Show history'}</span>
                        {isExpanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1">
                      <Button
                        onClick={() => openEditModal(habit)}
                        className="bg-transparent hover:bg-gray-700 text-white"
                        size="sm"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(habit.id)}
                        className="bg-transparent hover:bg-red-900/30 text-red-400"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Mini Calendar - Expandable */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-2">{t('habits.last4Weeks') || 'Last 4 weeks'}</div>
                      
                      {/* Day labels */}
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {DAYS_OF_WEEK.map(day => (
                          <div key={day.value} className="text-center text-[10px] text-gray-500">
                            {day.label}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar grid - 4 weeks */}
                      <div className="grid grid-cols-7 gap-1">
                        {last28Days.map((day, index) => {
                          const isScheduled = habit.days_of_week.includes(day.dayName);
                          const status = getDayCompletionStatus(habit, day.date);
                          
                          return (
                            <div
                              key={index}
                              className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium transition-all ${
                                day.isToday ? 'ring-1 ring-white' : ''
                              } ${
                                !isScheduled 
                                  ? 'bg-gray-800/30 text-gray-600' 
                                  : status === 'complete'
                                    ? 'bg-green-500/80 text-white'
                                    : status === 'partial'
                                      ? 'bg-yellow-500/60 text-white'
                                      : 'bg-gray-700/50 text-gray-400'
                              }`}
                              title={`${day.date}${isScheduled ? (status === 'complete' ? ' - Completed' : status === 'partial' ? ' - Partial' : ' - Not done') : ' - Not scheduled'}`}
                            >
                              {day.dayOfMonth}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Legend */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-sm bg-green-500/80"></div>
                          <span>{t('habits.completed') || 'Done'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-sm bg-yellow-500/60"></div>
                          <span>{t('habits.partial') || 'Partial'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-sm bg-gray-700/50"></div>
                          <span>{t('habits.missed') || 'Missed'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Habit Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          role="presentation"
        >
          <div 
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-modal-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 
                id="habit-modal-title" 
                className="text-xl font-bold text-white"
              >
                {editingHabit ? t('habits.editHabit') : t('habits.addHabit')}
              </h3>
              <button 
                onClick={closeModal} 
                className="p-2 hover:bg-gray-700 rounded-lg text-white"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-white">{t('habits.habitTitle')} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('habits.habitTitlePlaceholder')}
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                />
              </div>

              {/* Days of Week */}
              <div>
                <Label className="text-white">{t('habits.selectDays')} *</Label>
                <div className="grid grid-cols-7 gap-2 mt-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`p-2 text-sm font-medium transition-colors ${
                        selectedDays.includes(day.value)
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times Per Day */}
              <div>
                <Label htmlFor="times" className="text-white">{t('habits.timesPerDay')} *</Label>
                <Input
                  id="times"
                  type="number"
                  min="1"
                  max="20"
                  value={timesPerDay}
                  onChange={(e) => setTimesPerDay(parseInt(e.target.value) || 1)}
                  className="mt-1 bg-gray-700 border-gray-600 text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={closeModal}
                  variant="outline"
                  className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !title.trim() || selectedDays.length === 0}
                  className="flex-1 text-white border-0"
                  style={{ 
                    backgroundColor: '#32D3FF',
                    '&:hover': { backgroundColor: '#1FC1FF' }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                >
                  {isLoading ? t('common.loading') : (editingHabit ? t('common.update') : t('common.create'))}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitTracker;
