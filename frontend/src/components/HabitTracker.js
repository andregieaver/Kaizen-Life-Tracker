import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, X, Edit3, Trash2, Check, Flame } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon', full: 'Monday' },
  { value: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { value: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { value: 'thursday', label: 'Thu', full: 'Thursday' },
  { value: 'friday', label: 'Fri', full: 'Friday' },
  { value: 'saturday', label: 'Sat', full: 'Saturday' },
  { value: 'sunday', label: 'Sun', full: 'Sunday' }
];

const HabitTracker = ({ athleteId }) => {
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
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
      console.error('Error loading habits:', error);
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
      console.error('Error loading completions:', error);
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
      console.error('Error saving habit:', error);
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
      console.error('Error deleting habit:', error);
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
      console.error('Error logging completion:', error);
    }
  };

  const handleUncomplete = async (habitId) => {
    try {
      await axios.post(`${API}/habits/${habitId}/uncomplete`, null, {
        params: { athlete_id: athleteId, date: today }
      });
      await loadCompletions();
    } catch (error) {
      console.error('Error undoing completion:', error);
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

  const todayHabits = habits.filter(h => h.days_of_week.includes(todayDayName));
  const longestStreak = habits.length > 0 
    ? Math.max(...habits.map(h => calculateStreak(h)), 0)
    : 0;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 pt-4 px-2 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Habit Tracker</h2>
        <Button 
          onClick={openAddModal} 
          className="text-white border-0"
          style={{ backgroundColor: '#00C2A8' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Habit
        </Button>
      </div>

      {/* Longest Streak Banner */}
      {longestStreak > 0 && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-400" />
            <div>
              <div className="text-sm text-gray-300">Longest Streak</div>
              <div className="text-2xl font-bold text-orange-400">{longestStreak} days</div>
            </div>
          </div>
        </div>
      )}

      {/* Today's Habits */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-white">Today - {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        
        {todayHabits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Check className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-200 mb-2">No habits scheduled for today</h3>
            <p className="text-gray-400 text-center">
              Add a habit to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayHabits.map(habit => {
              const todayCount = getTodayCompletions(habit.id);
              const isComplete = todayCount >= habit.times_per_day;
              const streak = calculateStreak(habit);
              
              return (
                <div key={habit.id} className={`transition-all bg-gradient-to-br from-gray-800 to-gray-900 p-4 ${isComplete ? 'ring-2 ring-green-400' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                      {/* Main Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">{habit.title}</h4>
                          {isComplete && (
                            <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                              <Check className="w-4 h-4" />
                              Complete!
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-300 mb-3">
                          Goal: {habit.times_per_day}x today
                          <span className="mx-2">•</span>
                          {habit.days_of_week.length} days/week
                        </div>

                        {/* Progress Dots */}
                        <div className="flex items-center gap-2 mb-3">
                          {Array.from({ length: habit.times_per_day }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                                i < todayCount
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {i < todayCount ? '✓' : i + 1}
                            </div>
                          ))}
                        </div>

                        {/* Streak */}
                        {streak > 0 && (
                          <div className="flex items-center gap-2 text-orange-400">
                            <Flame className="w-4 h-4" />
                            <span className="text-sm font-medium">{streak} day streak</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        {!isComplete ? (
                          <Button
                            onClick={() => handleComplete(habit.id)}
                            className="bg-green-600 hover:bg-green-700 min-w-[100px] border-0"
                            size="lg"
                          >
                            <Plus className="w-5 h-5 mr-1" />
                            Tap
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUncomplete(habit.id)}
                            className="min-w-[100px] bg-gray-700 text-white border-0 hover:bg-gray-600"
                          >
                            Undo
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Habits Section */}
      {habits.length > todayHabits.length && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-white">Other Habits</h3>
          <div className="space-y-2">
            {habits.filter(h => !h.days_of_week.includes(todayDayName)).map(habit => (
              <div key={habit.id} className="bg-gradient-to-br from-gray-800 to-gray-900 p-3">
                <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{habit.title}</div>
                      <div className="text-sm text-gray-300">
                        {habit.times_per_day}x per day • {habit.days_of_week.map(d => 
                          DAYS_OF_WEEK.find(day => day.value === d)?.label
                        ).join(', ')}
                      </div>
                    </div>
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
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Habit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{editingHabit ? 'Edit Habit' : 'Add New Habit'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-700 rounded-lg text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-white">Habit Name *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Drink Water, Morning Run"
                  className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                />
              </div>

              {/* Days of Week */}
              <div>
                <Label className="text-white">Active Days *</Label>
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
                <Label htmlFor="times" className="text-white">Times Per Day *</Label>
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
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={isLoading || !title.trim() || selectedDays.length === 0}
                >
                  {isLoading ? 'Saving...' : (editingHabit ? 'Update' : 'Create')}
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
