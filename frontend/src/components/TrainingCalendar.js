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
import { Calendar as CalendarIcon, Plus, Edit, Trash2, Dumbbell, Heart, Clock, MapPin, Timer } from 'lucide-react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './TrainingCalendar.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const localizer = momentLocalizer(moment);

const TrainingCalendar = ({ athleteId }) => {
  const { t } = useTranslation();
  const [trainingBlocks, setTrainingBlocks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.WEEK);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [formData, setFormData] = useState({
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
    unit_system: 'miles'
  });

  useEffect(() => {
    if (athleteId) {
      loadTrainingBlocks();
      loadWeeklySummary();
    }
  }, [athleteId, currentDate]);

  const loadTrainingBlocks = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/training-calendar/${athleteId}`);
      setTrainingBlocks(response.data.blocks || []);
    } catch (error) {
      console.error('Error loading training blocks:', error);
      setTrainingBlocks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeeklySummary = async () => {
    try {
      const year = currentDate.getFullYear();
      const week = moment(currentDate).week();
      const response = await axios.get(`${API}/training-calendar/${athleteId}/weekly-summary?year=${year}&week=${week}`);
      setWeeklySummary(response.data);
    } catch (error) {
      console.error('Error loading weekly summary:', error);
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
      unit_system: 'miles'
    });
    setIsDialogOpen(true);
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
      unit_system: block.unit_system || 'miles'
    });
    setIsDialogOpen(true);
  };

  const handleDeleteBlock = async (blockId) => {
    if (window.confirm('Are you sure you want to delete this training block?')) {
      try {
        await axios.delete(`${API}/training-calendar/${blockId}`);
        await loadTrainingBlocks();
        await loadWeeklySummary();
      } catch (error) {
        console.error('Error deleting training block:', error);
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
        unit_system: 'miles'
      });
    } catch (error) {
      console.error('Error saving training block:', error);
    }
  };

  // Convert training blocks to calendar events
  const calendarEvents = trainingBlocks.map(block => ({
    id: block.id,
    title: block.title,
    start: new Date(block.start_date + 'T00:00:00'),
    end: new Date(block.end_date + 'T23:59:59'),
    resource: block
  }));

  const handleSelectSlot = useCallback((slotInfo) => {
    handleCreateBlock(slotInfo);
  }, []);

  const handleSelectEvent = useCallback((event) => {
    handleEditBlock(event.resource);
  }, []);

  const EventComponent = ({ event }) => {
    const block = event.resource;
    const isTraining = block.block_type === 'training';
    
    return (
      <div className={`p-2 text-xs ${isTraining ? 'bg-blue-500' : 'bg-green-500'} text-white rounded relative group hover:shadow-lg transition-all cursor-pointer`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{block.title}</div>
            <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
              {block.distance && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{block.distance}{block.unit_system === 'miles' ? 'mi' : 'km'}</span>
                </div>
              )}
              {block.duration_minutes && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{block.duration_minutes}min</span>
                </div>
              )}
              {block.pace_per_unit && (
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  <span>{block.pace_per_unit}</span>
                </div>
              )}
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteBlock(block.id);
              }}
              className="text-white hover:text-red-200 transition-colors"
              title="Delete workout"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
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
          <h1 className="text-2xl font-bold text-gray-900">
            Enhanced Training Calendar
          </h1>
          <p className="text-gray-600 mt-1">
            Plan and track your workouts with detailed metrics
          </p>
        </div>
        <div className="flex gap-2">
          {weeklySummary && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <div className="font-medium text-blue-900">Weekly Summary</div>
              <div className="text-blue-700">
                {weeklySummary.total_distance > 0 && (
                  <span>{weeklySummary.total_distance} miles • </span>
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Workout
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingBlock ? 'Edit Workout' : 'Create Workout'}
                </DialogTitle>
                <DialogDescription>
                  {editingBlock ? 'Update your workout details' : 'Plan your workout with specific metrics and goals'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic Details</TabsTrigger>
                    <TabsTrigger value="workout">Workout Metrics</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Workout Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                        placeholder="e.g., Morning Run, Track Workout"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="block_type">Block Type</Label>
                        <Select 
                          value={formData.block_type} 
                          onValueChange={(value) => setFormData(prev => ({...prev, block_type: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="training">
                              <div className="flex items-center">
                                <Dumbbell className="w-4 h-4 mr-2" />
                                Training
                              </div>
                            </SelectItem>
                            <SelectItem value="recovery">
                              <div className="flex items-center">
                                <Heart className="w-4 h-4 mr-2" />
                                Recovery
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="workout_type">Workout Type</Label>
                        <Select 
                          value={formData.workout_type} 
                          onValueChange={(value) => setFormData(prev => ({...prev, workout_type: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="run">Easy Run</SelectItem>
                            <SelectItem value="tempo">Tempo Run</SelectItem>
                            <SelectItem value="intervals">Intervals</SelectItem>
                            <SelectItem value="long_run">Long Run</SelectItem>
                            <SelectItem value="recovery">Recovery Run</SelectItem>
                            <SelectItem value="cross_training">Cross Training</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData(prev => ({...prev, start_date: e.target.value}))}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date</Label>
                        <Input
                          id="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                        placeholder="Add notes about your workout goals, route, weather conditions..."
                        rows={3}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="workout" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="distance">Distance</Label>
                        <Input
                          id="distance"
                          type="number"
                          step="0.1"
                          value={formData.distance}
                          onChange={(e) => setFormData(prev => ({...prev, distance: e.target.value}))}
                          placeholder="5.0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="duration_minutes">Duration (min)</Label>
                        <Input
                          id="duration_minutes"
                          type="number"
                          value={formData.duration_minutes}
                          onChange={(e) => setFormData(prev => ({...prev, duration_minutes: e.target.value}))}
                          placeholder="30"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="unit_system">Unit System</Label>
                        <Select 
                          value={formData.unit_system} 
                          onValueChange={(value) => setFormData(prev => ({...prev, unit_system: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="miles">Miles</SelectItem>
                            <SelectItem value="km">Kilometers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pace_per_unit">Pace (per {formData.unit_system === 'miles' ? 'mile' : 'km'})</Label>
                      <Input
                        id="pace_per_unit"
                        value={formData.pace_per_unit}
                        onChange={(e) => setFormData(prev => ({...prev, pace_per_unit: e.target.value}))}
                        placeholder="7:30 (minutes:seconds)"
                      />
                    </div>

                    {formData.workout_type === 'intervals' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="intervals">Number of Intervals</Label>
                          <Input
                            id="intervals"
                            type="number"
                            value={formData.intervals}
                            onChange={(e) => setFormData(prev => ({...prev, intervals: e.target.value}))}
                            placeholder="8"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="interval_distance">Interval Distance</Label>
                          <Input
                            id="interval_distance"
                            type="number"
                            step="0.1"
                            value={formData.interval_distance}
                            onChange={(e) => setFormData(prev => ({...prev, interval_distance: e.target.value}))}
                            placeholder="0.25"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="interval_pace">Interval Pace</Label>
                          <Input
                            id="interval_pace"
                            value={formData.interval_pace}
                            onChange={(e) => setFormData(prev => ({...prev, interval_pace: e.target.value}))}
                            placeholder="6:00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="rest_duration">Rest Duration (sec)</Label>
                          <Input
                            id="rest_duration"
                            type="number"
                            value={formData.rest_duration}
                            onChange={(e) => setFormData(prev => ({...prev, rest_duration: e.target.value}))}
                            placeholder="90"
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between pt-4 border-t">
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
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Training Calendar
            </div>
            <div className="flex gap-2">
              <Button
                variant={currentView === Views.WEEK ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView(Views.WEEK)}
              >
                Week
              </Button>
              <Button
                variant={currentView === Views.MONTH ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView(Views.MONTH)}
              >
                Month
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Click and drag to create new workouts. Click on existing workouts to edit them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={currentView}
              onView={setCurrentView}
              date={currentDate}
              onNavigate={setCurrentDate}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              components={{
                event: EventComponent,
                eventWrapper: ({ event, children }) => (
                  <div className="relative group">
                    {children}
                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full shadow-lg p-1 transform translate-x-1 -translate-y-1">
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditBlock(event.resource);
                          }}
                          className="text-gray-600 hover:text-blue-600 transition-colors p-1 rounded"
                          title="Edit workout"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBlock(event.resource.id);
                          }}
                          className="text-gray-600 hover:text-red-600 transition-colors p-1 rounded"
                          title="Delete workout"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: event.resource.block_type === 'training' ? '#3B82F6' : '#10B981',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white'
                }
              })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingCalendar;