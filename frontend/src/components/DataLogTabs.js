import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Calendar, Moon, Dumbbell } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DataLogTabs = ({ athleteId, onDataLogged }) => {
  const [workoutForm, setWorkoutForm] = useState({
    date: new Date().toISOString().split('T')[0],
    workout_type: '',
    distance_miles: '',
    duration_minutes: '',
    avg_hr: '',
    max_hr: '',
    perceived_effort: '',
    notes: ''
  });

  const [sleepForm, setSleepForm] = useState({
    date: new Date().toISOString().split('T')[0],
    total_sleep_hours: '',
    sleep_efficiency: '',
    hrv_score: '',
    resting_hr: '',
    sleep_quality: ''
  });

  const [isLoading, setIsLoading] = useState({
    workout: false,
    sleep: false
  });

  const workoutTypes = [
    { value: 'easy', label: 'Easy Run' },
    { value: 'tempo', label: 'Tempo Run' },
    { value: 'intervals', label: 'Intervals' },
    { value: 'long_run', label: 'Long Run' },
    { value: 'recovery', label: 'Recovery Run' },
    { value: 'fartlek', label: 'Fartlek' },
    { value: 'hill_repeats', label: 'Hill Repeats' },
    { value: 'race', label: 'Race' }
  ];

  const handleWorkoutSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, workout: true }));

    try {
      const workoutData = {
        ...workoutForm,
        athlete_id: athleteId,
        distance_miles: parseFloat(workoutForm.distance_miles),
        duration_minutes: parseInt(workoutForm.duration_minutes),
        avg_hr: workoutForm.avg_hr ? parseInt(workoutForm.avg_hr) : null,
        max_hr: workoutForm.max_hr ? parseInt(workoutForm.max_hr) : null,
        perceived_effort: parseInt(workoutForm.perceived_effort)
      };

      await axios.post(`${API}/workout`, workoutData);
      
      // Reset form
      setWorkoutForm({
        date: new Date().toISOString().split('T')[0],
        workout_type: '',
        distance_miles: '',
        duration_minutes: '',
        avg_hr: '',
        max_hr: '',
        perceived_effort: '',
        notes: ''
      });

      onDataLogged();
      // Show success feedback (could add toast here)
    } catch (error) {
      logger.error(null, 'Error logging workout:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, workout: false }));
    }
  };

  const handleSleepSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, sleep: true }));

    try {
      const sleepData = {
        ...sleepForm,
        athlete_id: athleteId,
        total_sleep_hours: parseFloat(sleepForm.total_sleep_hours),
        sleep_efficiency: parseFloat(sleepForm.sleep_efficiency),
        hrv_score: sleepForm.hrv_score ? parseInt(sleepForm.hrv_score) : null,
        resting_hr: sleepForm.resting_hr ? parseInt(sleepForm.resting_hr) : null,
        sleep_quality: parseInt(sleepForm.sleep_quality)
      };

      await axios.post(`${API}/sleep`, sleepData);
      
      // Reset form
      setSleepForm({
        date: new Date().toISOString().split('T')[0],
        total_sleep_hours: '',
        sleep_efficiency: '',
        hrv_score: '',
        resting_hr: '',
        sleep_quality: ''
      });

      onDataLogged();
      // Show success feedback (could add toast here)
    } catch (error) {
      logger.error(null, 'Error logging sleep data:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, sleep: false }));
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-display flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Log Your Data
          </CardTitle>
          <CardDescription>
            Track your workouts and recovery data for personalized AI coaching insights
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="workout" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="workout" className="flex items-center" data-testid="workout-tab">
                <Dumbbell className="w-4 h-4 mr-2" />
                Workout
              </TabsTrigger>
              <TabsTrigger value="sleep" className="flex items-center" data-testid="sleep-tab">
                <Moon className="w-4 h-4 mr-2" />
                Sleep & Recovery
              </TabsTrigger>
            </TabsList>

            <TabsContent value="workout" className="space-y-6 mt-6">
              <form onSubmit={handleWorkoutSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workout-date">Date</Label>
                    <Input
                      id="workout-date"
                      type="date"
                      value={workoutForm.date}
                      onChange={(e) => setWorkoutForm(prev => ({ ...prev, date: e.target.value }))}
                      className="input-focus"
                      required
                      data-testid="workout-date-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workout-type">Workout Type</Label>
                    <Select
                      value={workoutForm.workout_type}
                      onValueChange={(value) => setWorkoutForm(prev => ({ ...prev, workout_type: value }))}
                      required
                    >
                      <SelectTrigger data-testid="workout-type-select">
                        <SelectValue placeholder="Select workout type" />
                      </SelectTrigger>
                      <SelectContent>
                        {workoutTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance (miles)</Label>
                    <Input
                      id="distance"
                      type="number"
                      step="0.1"
                      value={workoutForm.distance_miles}
                      onChange={(e) => setWorkoutForm(prev => ({ ...prev, distance_miles: e.target.value }))}
                      placeholder="5.2"
                      className="input-focus"
                      required
                      data-testid="distance-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={workoutForm.duration_minutes}
                      onChange={(e) => setWorkoutForm(prev => ({ ...prev, duration_minutes: e.target.value }))}
                      placeholder="35"
                      className="input-focus"
                      required
                      data-testid="duration-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="effort">Perceived Effort (1-10)</Label>
                    <Input
                      id="effort"
                      type="number"
                      min="1"
                      max="10"
                      value={workoutForm.perceived_effort}
                      onChange={(e) => setWorkoutForm(prev => ({ ...prev, perceived_effort: e.target.value }))}
                      placeholder="7"
                      className="input-focus"
                      required
                      data-testid="effort-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="avg-hr">Average HR (optional)</Label>
                    <Input
                      id="avg-hr"
                      type="number"
                      value={workoutForm.avg_hr}
                      onChange={(e) => setWorkoutForm(prev => ({ ...prev, avg_hr: e.target.value }))}
                      placeholder="150"
                      className="input-focus"
                      data-testid="avg-hr-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-hr">Max HR (optional)</Label>
                    <Input
                      id="max-hr"
                      type="number"
                      value={workoutForm.max_hr}
                      onChange={(e) => setWorkoutForm(prev => ({ ...prev, max_hr: e.target.value }))}
                      placeholder="175"
                      className="input-focus"
                      data-testid="max-hr-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workout-notes">Notes (optional)</Label>
                  <Textarea
                    id="workout-notes"
                    value={workoutForm.notes}
                    onChange={(e) => setWorkoutForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="How did the workout feel? Any observations?"
                    className="input-focus min-h-20 resize-none"
                    data-testid="workout-notes-textarea"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading.workout}
                  className="w-full bg-blue-600 hover:bg-blue-700 btn-transition"
                  data-testid="log-workout-btn"
                >
                  {isLoading.workout ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Logging Workout...
                    </div>
                  ) : (
                    'Log Workout'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sleep" className="space-y-6 mt-6">
              <form onSubmit={handleSleepSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sleep-date">Date</Label>
                    <Input
                      id="sleep-date"
                      type="date"
                      value={sleepForm.date}
                      onChange={(e) => setSleepForm(prev => ({ ...prev, date: e.target.value }))}
                      className="input-focus"
                      required
                      data-testid="sleep-date-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sleep-hours">Total Sleep (hours)</Label>
                    <Input
                      id="sleep-hours"
                      type="number"
                      step="0.5"
                      value={sleepForm.total_sleep_hours}
                      onChange={(e) => setSleepForm(prev => ({ ...prev, total_sleep_hours: e.target.value }))}
                      placeholder="8.0"
                      className="input-focus"
                      required
                      data-testid="sleep-hours-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sleep-efficiency">Sleep Efficiency (%)</Label>
                    <Input
                      id="sleep-efficiency"
                      type="number"
                      min="0"
                      max="100"
                      value={sleepForm.sleep_efficiency}
                      onChange={(e) => setSleepForm(prev => ({ ...prev, sleep_efficiency: e.target.value }))}
                      placeholder="85"
                      className="input-focus"
                      required
                      data-testid="sleep-efficiency-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sleep-quality">Sleep Quality (1-10)</Label>
                    <Input
                      id="sleep-quality"
                      type="number"
                      min="1"
                      max="10"
                      value={sleepForm.sleep_quality}
                      onChange={(e) => setSleepForm(prev => ({ ...prev, sleep_quality: e.target.value }))}
                      placeholder="8"
                      className="input-focus"
                      required
                      data-testid="sleep-quality-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hrv-score">HRV Score (ms, optional)</Label>
                    <Input
                      id="hrv-score"
                      type="number"
                      value={sleepForm.hrv_score}
                      onChange={(e) => setSleepForm(prev => ({ ...prev, hrv_score: e.target.value }))}
                      placeholder="45"
                      className="input-focus"
                      data-testid="hrv-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resting-hr">Resting HR (optional)</Label>
                    <Input
                      id="resting-hr"
                      type="number"
                      value={sleepForm.resting_hr}
                      onChange={(e) => setSleepForm(prev => ({ ...prev, resting_hr: e.target.value }))}
                      placeholder="55"
                      className="input-focus"
                      data-testid="resting-hr-input"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading.sleep}
                  className="w-full bg-green-600 hover:bg-green-700 btn-transition"
                  data-testid="log-sleep-btn"
                >
                  {isLoading.sleep ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Logging Sleep Data...
                    </div>
                  ) : (
                    'Log Sleep & Recovery'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataLogTabs;
