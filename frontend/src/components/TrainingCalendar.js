import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Calendar as CalendarIcon, Plus, Edit, Trash2, Dumbbell, Heart, Clock, MapPin, Timer, Trophy } from 'lucide-react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './TrainingCalendar.css';
import { formatDistance, formatPace, getDistanceUnitLabel, convertDistanceUnits } from '../utils/formatters';
import AddEventModal from './AddEventModal';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const localizer = momentLocalizer(moment);

// Weekly Summary Column Component
const WeeklySummaryColumn = ({ currentDate, currentView, trainingBlocks, athleteId, preferences }) => {
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const distanceUnit = preferences?.distance_unit || 'miles';

  useEffect(() => {
    calculateWeeklySummaries();
  }, [currentDate, currentView, trainingBlocks]);

  const calculateWeeklySummaries = () => {
    setLoading(true);
    
    // Get weeks to display based on current view
    const weeks = getWeeksForView();
    const summaries = weeks.map(weekInfo => {
      const weekBlocks = trainingBlocks.filter(block => {
        const blockStart = moment(block.start_date);
        const blockEnd = moment(block.end_date);
        return blockStart.isSameOrAfter(weekInfo.start, 'day') && 
               blockStart.isSameOrBefore(weekInfo.end, 'day');
      });

      const totalDistance = weekBlocks.reduce((sum, block) => 
        sum + (parseFloat(block.distance) || 0), 0
      );
      const totalDuration = weekBlocks.reduce((sum, block) => 
        sum + (parseInt(block.duration_minutes) || 0), 0
      );
      const workoutCount = weekBlocks.filter(block => 
        block.workout_type && block.workout_type !== 'recovery'
      ).length;

      return {
        ...weekInfo,
        totalDistance,
        totalDuration,
        workoutCount,
        blocks: weekBlocks
      };
    });

    setWeeklyData(summaries);
    setLoading(false);
  };

  const getWeeksForView = () => {
    const weeks = [];
    
    if (currentView === Views.WEEK) {
      // For week view, show current week and 2 weeks before/after
      for (let i = -2; i <= 2; i++) {
        const weekStart = moment(currentDate).startOf('week').add(i, 'weeks');
        const weekEnd = moment(weekStart).endOf('week');
        weeks.push({
          start: weekStart,
          end: weekEnd,
          label: i === 0 ? 'This Week' : weekStart.format('MMM D'),
          isCurrentWeek: i === 0
        });
      }
    } else {
      // For month view, show all weeks in current month
      const monthStart = moment(currentDate).startOf('month');
      const monthEnd = moment(currentDate).endOf('month');
      let weekStart = moment(monthStart).startOf('week');
      
      while (weekStart.isSameOrBefore(monthEnd)) {
        const weekEnd = moment(weekStart).endOf('week');
        const isCurrentWeek = moment().isBetween(weekStart, weekEnd, 'day', '[]');
        
        weeks.push({
          start: moment(weekStart),
          end: moment(weekEnd),
          label: weekStart.format('MMM D'),
          isCurrentWeek
        });
        
        weekStart.add(1, 'week');
      }
    }
    
    return weeks;
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-white text-sm">Weekly Summary</h3>
      
      {weeklyData.map((week, index) => (
        <div 
          key={index}
          className={`p-3 rounded-lg border-0 ${
            week.isCurrentWeek 
              ? 'bg-gradient-to-r from-gray-700 to-gray-800' 
              : 'bg-gradient-to-r from-gray-700 to-gray-800'
          }`}
          style={week.isCurrentWeek ? { boxShadow: '0 0 0 2px #32D3FF' } : {}}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-white">
              {week.label}
            </h4>
            {week.isCurrentWeek && (
              <Badge className="text-xs bg-gray-700 text-white border-0">
                Current
              </Badge>
            )}
          </div>
          
          <div className="space-y-2 text-xs">
            {/* Distance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-gray-300">Distance</span>
              </div>
              <span className="font-medium text-white">
                {formatDistance(week.totalDistance, distanceUnit)}
              </span>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-gray-300">Time</span>
              </div>
              <span className="font-medium text-white">
                {week.totalDuration > 0 ? formatDuration(week.totalDuration) : '0m'}
              </span>
            </div>

            {/* Workouts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Dumbbell className="w-3 h-3 text-gray-400" />
                <span className="text-gray-300">Workouts</span>
              </div>
              <span className="font-medium text-white">
                {week.workoutCount}
              </span>
            </div>

            {/* Average Pace */}
            {week.totalDistance > 0 && week.totalDuration > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-300">Avg Pace</span>
                </div>
                <span className="font-medium text-white">
                  {formatPace(week.totalDuration, week.totalDistance, distanceUnit)}
                </span>
              </div>
            )}
          </div>

          {/* Workout List */}
          {week.blocks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="space-y-1">
                {week.blocks.slice(0, 3).map((block, blockIndex) => (
                  <div key={blockIndex} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 truncate">{block.title}</span>
                    <div className="flex items-center gap-1 text-gray-400">
                      {block.distance && (
                        <span>{block.distance}{getDistanceUnitLabel(distanceUnit)}</span>
                      )}
                      {block.duration_minutes && (
                        <span>•{block.duration_minutes}m</span>
                      )}
                    </div>
                  </div>
                ))}
                {week.blocks.length > 3 && (
                  <div className="text-xs text-gray-400">
                    +{week.blocks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const TrainingCalendar = ({ athleteId, athletePreferences }) => {
  const { t } = useTranslation();
  const [trainingBlocks, setTrainingBlocks] = useState([]);
  const [trainingEvents, setTrainingEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.MONTH);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(null);
  
  // Get user's distance unit preference
  const distanceUnit = athletePreferences?.distance_unit || 'miles';
  const weekStartsOn = athletePreferences?.week_starts_on || 'monday';
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    block_type: 'training',
    workout_type: 'run',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    distance: '',
    duration_minutes: '',
    pace_per_unit: '',
    intervals: '',
    interval_distance: '',
    interval_pace: '',
    rest_duration: '',
    unit_system: distanceUnit
  });

  useEffect(() => {
    if (athleteId) {
      loadTrainingBlocks();
      loadTrainingEvents();
      loadWeeklySummary();
    }
  }, [athleteId, currentDate]);

  // Configure moment locale to respect week start preference
  useEffect(() => {
    const weekStartDay = weekStartsOn === 'sunday' ? 0 : 1;
    moment.updateLocale('en', {
      week: {
        dow: weekStartDay,
        doy: 6
      }
    });
  }, [weekStartsOn]);

  const loadTrainingBlocks = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/training-calendar/${athleteId}`);
      setTrainingBlocks(response.data.blocks || []);
    } catch (error) {
      logger.error(null, 'Error loading training blocks:', error);
      setTrainingBlocks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrainingEvents = async () => {
    try {
      const response = await axios.get(`${API}/training-calendar/events/${athleteId}`);
      setTrainingEvents(response.data.events || []);
    } catch (error) {
      logger.error(null, 'Error loading training events:', error);
      setTrainingEvents([]);
    }
  };

  const loadWeeklySummary = async () => {
    try {
      const year = currentDate.getFullYear();
      const week = moment(currentDate).week();
      const response = await axios.get(`${API}/training-calendar/${athleteId}/weekly-summary?year=${year}&week=${week}`);
      setWeeklySummary(response.data);
    } catch (error) {
      logger.error(null, 'Error loading weekly summary:', error);
      setWeeklySummary(null);
    }
  };

  const handleCreateBlock = (slotInfo = null) => {
    const startDate = slotInfo ? moment(slotInfo.start).format('YYYY-MM-DD') : moment(currentDate).format('YYYY-MM-DD');
    const endDate = slotInfo ? moment(slotInfo.end).subtract(1, 'day').format('YYYY-MM-DD') : startDate;
    
    setEditingBlock(null);
    setFormData({
      title: '',
      description: '',
      block_type: 'training',
      workout_type: 'run',
      start_date: startDate,
      end_date: endDate,
      distance: '',
      duration_minutes: '',
      pace_per_unit: '',
      intervals: '',
      interval_distance: '',
      interval_pace: '',
      rest_duration: '',
      unit_system: distanceUnit
    });
    setIsDialogOpen(true);
  };

  const handleCreateEvent = (slotInfo = null) => {
    const eventDate = slotInfo ? moment(slotInfo.start).format('YYYY-MM-DD') : moment(currentDate).format('YYYY-MM-DD');
    
    setEditingEvent(null);
    setIsEventDialogOpen(true);
  };

  const handleEditBlock = (block) => {
    setEditingBlock(block);
    setFormData({
      title: block.title,
      description: block.description || '',
      block_type: block.block_type,
      workout_type: block.workout_type || 'run',
      start_date: block.start_date,
      end_date: block.end_date,
      distance: block.distance || '',
      duration_minutes: block.duration_minutes || '',
      pace_per_unit: block.pace_per_unit || '',
      intervals: block.intervals || '',
      interval_distance: block.interval_distance || '',
      interval_pace: block.interval_pace || '',
      rest_duration: block.rest_duration || '',
      unit_system: block.unit_system || distanceUnit
    });
    setIsDialogOpen(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleDeleteBlock = async (blockId) => {
    if (window.confirm('Are you sure you want to delete this training block?')) {
      try {
        await axios.delete(`${API}/training-calendar/${blockId}`);
        await loadTrainingBlocks();
        await loadWeeklySummary();
      } catch (error) {
        logger.error(null, 'Error deleting training block:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        athlete_id: athleteId,
        distance: formData.distance ? parseFloat(formData.distance) : null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        intervals: formData.intervals ? parseInt(formData.intervals) : null,
        interval_distance: formData.interval_distance ? parseFloat(formData.interval_distance) : null,
        rest_duration: formData.rest_duration ? parseInt(formData.rest_duration) : null
      };

      if (editingBlock) {
        await axios.put(`${API}/training-calendar/${editingBlock.id}`, data);
      } else {
        await axios.post(`${API}/training-calendar`, data);
      }

      setIsDialogOpen(false);
      await loadTrainingBlocks();
      await loadWeeklySummary();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        block_type: 'training',
        workout_type: 'run',
        start_date: '',
        end_date: '',
        distance: '',
        duration_minutes: '',
        pace_per_unit: '',
        intervals: '',
        interval_distance: '',
        interval_pace: '',
        rest_duration: '',
        unit_system: distanceUnit
      });
    } catch (error) {
      logger.error(null, 'Error saving training block:', error);
    }
  };

  const handleEventSubmit = async (eventData) => {
    try {
      const data = {
        ...eventData,
        athlete_id: athleteId,
        target_distance: eventData.target_distance ? parseFloat(eventData.target_distance) : null,
        target_amount: eventData.target_amount ? parseInt(eventData.target_amount) : null,
        actual_distance: eventData.actual_distance ? parseFloat(eventData.actual_distance) : null,
        actual_amount: eventData.actual_amount ? parseInt(eventData.actual_amount) : null,
      };

      if (editingEvent) {
        await axios.put(`${API}/training-calendar/events/${editingEvent.id}`, data);
      } else {
        await axios.post(`${API}/training-calendar/events`, data);
      }

      setIsEventDialogOpen(false);
      setEditingEvent(null);
      await loadTrainingEvents();
      await loadWeeklySummary();
    } catch (error) {
      logger.error(null, 'Error saving training event:', error);
      alert('Failed to save event. Please try again.');
    }
  };

  // Convert training blocks to calendar events
  const workoutCalendarEvents = trainingBlocks.map(block => {
    // If start_time is provided, use it; otherwise default to 00:00:00
    const startTime = block.start_time || '00:00';
    const endTime = block.end_time || '23:59';
    
    return {
      id: block.id,
      title: block.title,
      start: new Date(block.start_date + 'T' + startTime + ':00'),
      end: new Date(block.end_date + 'T' + endTime + ':59'),
      allDay: !block.start_time, // If no start_time, treat as all-day event
      resource: block,
      type: 'workout'
    };
  });

  // Convert training events to calendar events
  const eventCalendarEvents = trainingEvents.map(event => {
    const startTime = event.start_time || '00:00';
    
    return {
      id: event.id,
      title: event.title,
      start: new Date(event.event_date + 'T' + startTime + ':00'),
      end: new Date(event.event_date + 'T' + (event.start_time ? '23:59' : '23:59') + ':59'),
      allDay: !event.start_time,
      resource: event,
      type: 'event'
    };
  });

  // Combine both workout and event calendar items
  const calendarEvents = [...workoutCalendarEvents, ...eventCalendarEvents];

  const handleSelectSlot = useCallback((slotInfo) => {
    handleCreateBlock(slotInfo);
  }, []);

  const handleSelectEvent = useCallback((event) => {
    if (event.type === 'event') {
      handleEditEvent(event.resource);
    } else {
      handleEditBlock(event.resource);
    }
  }, []);

  const EventComponent = ({ event }) => {
    const block = event.resource;
    const isEvent = event.type === 'event';
    const isTraining = block.block_type === 'training';
    const isHealth = block.block_type === 'health';
    const isStrava = block.source === 'strava';
    const isOura = block.source === 'oura';
    const isPolar = block.source === 'polar';
    const isFitbit = block.source === 'fitbit';
    const isGarmin = block.source === 'garmin';
    const isCoros = block.source === 'coros';
    const isWhoop = block.source === 'whoop';
    const isSuunto = block.source === 'suunto';
    
    // Different colors for different sources
    let bgColor = 'bg-blue-500'; // Default for manual training
    if (isEvent) bgColor = 'bg-yellow-600'; // Events get a distinct color
    else if (isStrava) bgColor = 'bg-orange-500';
    else if (isOura) bgColor = 'bg-purple-500';
    else if (isPolar) bgColor = 'bg-red-500';
    else if (isFitbit) bgColor = 'bg-teal-500';
    else if (isGarmin) bgColor = 'bg-blue-600';
    else if (isCoros) bgColor = 'bg-yellow-500';
    else if (isWhoop) bgColor = 'bg-purple-600';
    else if (isSuunto) bgColor = 'bg-cyan-500';
    else if (isHealth) bgColor = 'bg-green-500';
    
    // Icons for different sources
    let sourceIcon = null;
    if (isEvent) sourceIcon = '🏆';
    else if (isStrava) sourceIcon = '🏃';
    else if (isPolar) sourceIcon = '❄️';
    else if (isFitbit) sourceIcon = '📊';
    else if (isGarmin) sourceIcon = '⌚';
    else if (isCoros) sourceIcon = '🏔️';
    else if (isWhoop) sourceIcon = '💪';
    else if (isSuunto) sourceIcon = '🧭';
    else if (isOura && block.oura_data?.type === 'Sleep') sourceIcon = '😴';
    else if (isOura && block.oura_data?.type === 'Readiness') sourceIcon = '⚡';
    else if (isOura) sourceIcon = '💪';
    
    return (
      <div className={`p-2 text-xs ${bgColor} text-white rounded hover:shadow-lg transition-all cursor-pointer`}>
        <div className="flex items-center gap-1">
          {sourceIcon && <span className="text-[10px] font-bold">{sourceIcon}</span>}
          <div className="font-medium truncate flex-1">{block.title}</div>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
          {/* For training events, show target metrics */}
          {isEvent && block.target_distance && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{block.target_distance}{getDistanceUnitLabel(distanceUnit)}</span>
            </div>
          )}
          {isEvent && block.target_time && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{block.target_time}</span>
            </div>
          )}
          {isEvent && block.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{block.location}</span>
            </div>
          )}
          {/* For workouts, show regular metrics */}
          {!isEvent && block.distance && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{block.distance}{getDistanceUnitLabel(distanceUnit)}</span>
            </div>
          )}
          {!isEvent && block.duration_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{block.duration_minutes}min</span>
            </div>
          )}
          {!isEvent && block.pace_per_unit && (
            <div className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              <span>{block.pace_per_unit}</span>
            </div>
          )}
          {isStrava && block.strava_data?.average_heartrate && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.strava_data.average_heartrate)}</span>
            </div>
          )}
          {isPolar && block.polar_data?.heart_rate_avg && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.polar_data.heart_rate_avg)}</span>
            </div>
          )}
          {isFitbit && block.fitbit_data?.heart_rate_avg && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.fitbit_data.heart_rate_avg)}</span>
            </div>
          )}
          {isGarmin && block.garmin_data?.heart_rate_avg && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.garmin_data.heart_rate_avg)}</span>
            </div>
          )}
          {isCoros && block.coros_data?.heart_rate_avg && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.coros_data.heart_rate_avg)}</span>
            </div>
          )}
          {isWhoop && block.whoop_data?.heart_rate_avg && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.whoop_data.heart_rate_avg)}</span>
            </div>
          )}
          {isSuunto && block.suunto_data?.heart_rate_avg && (
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span>{Math.round(block.suunto_data.heart_rate_avg)}</span>
            </div>
          )}
          {isOura && block.oura_data?.score && (
            <div className="flex items-center gap-1">
              <span className="font-bold">Score: {block.oura_data.score}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Enhanced Training Calendar
          </h1>
          <p className="text-gray-300 mt-1">
            Plan and track your workouts with detailed metrics
          </p>
        </div>
        <div className="flex gap-2">
          {weeklySummary && (
            <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-3 rounded-lg text-sm">
              <div className="font-medium text-white">Weekly Summary</div>
              <div className="text-gray-300">
                {weeklySummary.total_distance > 0 && (
                  <span>{formatDistance(weeklySummary.total_distance, distanceUnit)} • </span>
                )}
                {weeklySummary.total_duration > 0 && (
                  <span>{weeklySummary.total_duration} min • </span>
                )}
                <span>{weeklySummary.workout_count} workouts</span>
              </div>
            </div>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => handleCreateBlock()}
                className="text-white border-0"
                style={{ backgroundColor: '#32D3FF' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Workout
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {editingBlock ? 'Edit Workout' : 'Create Workout'}
                </DialogTitle>
                <DialogDescription className="text-gray-300">
                  {editingBlock ? 'Update your workout details' : 'Plan your workout with specific metrics and goals'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-700">
                    <TabsTrigger value="basic" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-gray-300">Basic Details</TabsTrigger>
                    <TabsTrigger value="workout" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-gray-300">Workout Metrics</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-white">Workout Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                        placeholder="e.g., Morning Run, Track Workout"
                        className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="block_type" className="text-white">Block Type</Label>
                        <Select 
                          value={formData.block_type} 
                          onValueChange={(value) => setFormData(prev => ({...prev, block_type: value}))}
                        >
                          <SelectTrigger className="bg-gray-600 border-gray-500 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="training" className="text-white">
                              <div className="flex items-center">
                                <Dumbbell className="w-4 h-4 mr-2" />
                                Training
                              </div>
                            </SelectItem>
                            <SelectItem value="recovery" className="text-white">
                              <div className="flex items-center">
                                <Heart className="w-4 h-4 mr-2" />
                                Recovery
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="workout_type" className="text-white">Workout Type</Label>
                        <Select 
                          value={formData.workout_type} 
                          onValueChange={(value) => setFormData(prev => ({...prev, workout_type: value}))}
                        >
                          <SelectTrigger className="bg-gray-600 border-gray-500 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="run" className="text-white">Easy Run</SelectItem>
                            <SelectItem value="tempo" className="text-white">Tempo Run</SelectItem>
                            <SelectItem value="intervals" className="text-white">Intervals</SelectItem>
                            <SelectItem value="long_run" className="text-white">Long Run</SelectItem>
                            <SelectItem value="recovery" className="text-white">Recovery Run</SelectItem>
                            <SelectItem value="cross_training" className="text-white">Cross Training</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_date" className="text-white">Start Date</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData(prev => ({...prev, start_date: e.target.value}))}
                          className="bg-gray-600 border-gray-500 text-white"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end_date" className="text-white">End Date</Label>
                        <Input
                          id="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))}
                          className="bg-gray-600 border-gray-500 text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time" className="text-white">Start Time (Optional)</Label>
                        <Input
                          id="start_time"
                          type="time"
                          value={formData.start_time || ''}
                          onChange={(e) => setFormData(prev => ({...prev, start_time: e.target.value}))}
                          placeholder="06:00"
                          className="bg-gray-600 border-gray-500 text-white"
                        />
                        <p className="text-xs text-gray-400">Leave empty for all-day workout</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end_time" className="text-white">End Time (Optional)</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={formData.end_time || ''}
                          onChange={(e) => setFormData(prev => ({...prev, end_time: e.target.value}))}
                          placeholder="07:30"
                          className="bg-gray-600 border-gray-500 text-white"
                        />
                        <p className="text-xs text-gray-400">Calculated from duration if empty</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-white">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                        placeholder="Add notes about your workout goals, route, weather conditions..."
                        rows={3}
                        className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="workout" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="distance" className="text-white">Distance ({getDistanceUnitLabel(formData.unit_system)})</Label>
                        <Input
                          id="distance"
                          type="number"
                          step="0.1"
                          value={formData.distance}
                          onChange={(e) => setFormData(prev => ({...prev, distance: e.target.value}))}
                          placeholder="5.0"
                          className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="duration_minutes" className="text-white">Duration (min)</Label>
                        <Input
                          id="duration_minutes"
                          type="number"
                          value={formData.duration_minutes}
                          onChange={(e) => setFormData(prev => ({...prev, duration_minutes: e.target.value}))}
                          placeholder="30"
                          className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="unit_system" className="text-white">Unit System</Label>
                        <Select 
                          value={formData.unit_system} 
                          onValueChange={(value) => setFormData(prev => ({...prev, unit_system: value}))}
                        >
                          <SelectTrigger className="bg-gray-600 border-gray-500 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="miles" className="text-white">Miles</SelectItem>
                            <SelectItem value="km" className="text-white">Kilometers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pace_per_unit" className="text-white">Pace (per {formData.unit_system === 'miles' ? 'mile' : 'km'})</Label>
                      <Input
                        id="pace_per_unit"
                        value={formData.pace_per_unit}
                        onChange={(e) => setFormData(prev => ({...prev, pace_per_unit: e.target.value}))}
                        placeholder="7:30 (minutes:seconds)"
                        className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                      />
                    </div>

                    {formData.workout_type === 'intervals' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="intervals" className="text-white">Number of Intervals</Label>
                          <Input
                            id="intervals"
                            type="number"
                            value={formData.intervals}
                            onChange={(e) => setFormData(prev => ({...prev, intervals: e.target.value}))}
                            placeholder="8"
                            className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="interval_distance" className="text-white">Interval Distance</Label>
                          <Input
                            id="interval_distance"
                            type="number"
                            step="0.1"
                            value={formData.interval_distance}
                            onChange={(e) => setFormData(prev => ({...prev, interval_distance: e.target.value}))}
                            placeholder="0.25"
                            className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="interval_pace" className="text-white">Interval Pace</Label>
                          <Input
                            id="interval_pace"
                            value={formData.interval_pace}
                            onChange={(e) => setFormData(prev => ({...prev, interval_pace: e.target.value}))}
                            placeholder="6:00"
                            className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="rest_duration" className="text-white">Rest Duration (sec)</Label>
                          <Input
                            id="rest_duration"
                            type="number"
                            value={formData.rest_duration}
                            onChange={(e) => setFormData(prev => ({...prev, rest_duration: e.target.value}))}
                            placeholder="90"
                            className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between pt-4 border-t border-gray-600">
                  <div>
                    {editingBlock && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this workout?')) {
                            handleDeleteBlock(editingBlock.id);
                            setIsDialogOpen(false);
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Workout
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white">
                      {editingBlock ? 'Update Workout' : 'Create Workout'}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar */}
      <Card className="bg-gradient-to-br from-gray-600 to-gray-800 border-0">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <CalendarIcon className="w-5 h-5 mr-2" />
            Training Calendar
          </CardTitle>
          <CardDescription className="text-gray-300">
            Click and drag to create new workouts. Click on existing workouts to edit them.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 md:p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Calendar */}
            <div className="flex-1 min-h-[400px] sm:min-h-[500px] lg:h-[600px] w-full overflow-hidden">
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ 
                  height: '100%',
                  minHeight: '400px'
                }}
                view={currentView}
                onView={setCurrentView}
                date={currentDate}
                onNavigate={setCurrentDate}
                selectable
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                defaultView={Views.MONTH}
                components={{
                  event: EventComponent
                }}
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: event.resource.block_type === 'training' ? '#3B82F6' : '#10B981',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: window.innerWidth < 640 ? '0.625rem' : '0.75rem',
                    padding: window.innerWidth < 640 ? '1px 2px' : '2px 4px'
                  }
                })}
                popup
                popupOffset={{ x: 0, y: 0 }}
              />
            </div>

            {/* Weekly Summary Column - Hidden on small mobile, shown on tablet+ */}
            <div className="hidden md:block w-full lg:w-80 p-4 overflow-y-auto max-h-[400px] lg:max-h-[600px]" style={{
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
            }}>
              <WeeklySummaryColumn 
                currentDate={currentDate}
                currentView={currentView}
                trainingBlocks={trainingBlocks}
                athleteId={athleteId}
                preferences={athletePreferences}
              />
            </div>
          </div>
          
          {/* Mobile Summary - Show below calendar on small screens */}
          <div className="md:hidden mt-4 bg-gray-50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
            <WeeklySummaryColumn 
              currentDate={currentDate}
              currentView={currentView}
              trainingBlocks={trainingBlocks}
              athleteId={athleteId}
              preferences={athletePreferences}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingCalendar;