import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Calendar, 
  Clock, 
  Plus,
  Edit3,
  Trash2,
  Repeat
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Schedules = ({ athleteId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    prompt: '',
    frequency: 'daily',
    time: '08:00',
    days: [],
    active: true
  });
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState({ tier: 'free' });
  const [showScheduleLimitModal, setShowScheduleLimitModal] = useState(false);

  useEffect(() => {
    loadSchedules();
    loadSubscriptionStatus();
  }, [athleteId]);

  const loadSchedules = async () => {
    try {
      const response = await axios.get(`${API}/schedules/${athleteId}`);
      setSchedules(response.data);
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/status/${athleteId}`);
      // Backend returns 'subscription_tier' but we use 'tier' in frontend
      setSubscriptionStatus({
        tier: response.data.subscription_tier || 'free',
        status: response.data.subscription_status,
        ...response.data
      });
    } catch (error) {
      console.error('Error loading subscription:', error);
      setSubscriptionStatus({ tier: 'free' });
    }
  };

  const getScheduleLimit = (tier) => {
    switch (tier) {
      case 'free': return 1;
      case 'pro': return 5;
      case 'premium': return Infinity;
      default: return 1;
    }
  };

  const canAddSchedule = () => {
    const limit = getScheduleLimit(subscriptionStatus.tier);
    return schedules.length < limit;
  };

  const handleAddScheduleClick = () => {
    if (canAddSchedule()) {
      setShowScheduleForm(true);
    } else {
      setShowScheduleLimitModal(true);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSaveStatus({ type: '', message: '' });
    if (!scheduleForm.name.trim() || !scheduleForm.prompt.trim()) {
      setSaveStatus({ type: 'error', message: 'Please fill in schedule name and prompt' });
      return;
    }
    try {
      if (editingSchedule) {
        const response = await axios.put(`${API}/schedules/${editingSchedule.id}`, scheduleForm);
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? response.data : s));
        setSaveStatus({ type: 'success', message: 'Schedule updated successfully!' });
      } else {
        const scheduleData = {
          ...scheduleForm,
          athlete_id: athleteId
        };
        const response = await axios.post(`${API}/schedules`, scheduleData);
        setSchedules(prev => [...prev, response.data]);
        setSaveStatus({ type: 'success', message: 'Schedule created successfully!' });
      }
      handleCancelScheduleForm();
    } catch (error) {
      console.error('Error saving schedule:', error);
      // Check if it's a subscription limit error
      if (error.response && error.response.status === 403) {
        setSaveStatus({ type: 'error', message: error.response.data.detail || 'Schedule limit reached. Please upgrade your plan.' });
        setShowScheduleLimitModal(true);
      } else {
        setSaveStatus({ type: 'error', message: 'Failed to save schedule' });
      }
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      prompt: schedule.prompt,
      frequency: schedule.frequency,
      time: schedule.time,
      days: schedule.days || [],
      active: schedule.active !== undefined ? schedule.active : true
    });
    setShowScheduleForm(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
      await axios.delete(`${API}/schedules/${scheduleId}`);
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setSaveStatus({ type: 'success', message: 'Schedule deleted successfully' });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete schedule' });
    }
  };

  const handleCancelScheduleForm = () => {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setScheduleForm({
      name: '',
      prompt: '',
      frequency: 'daily',
      time: '08:00',
      days: [],
      active: true
    });
  };

  const handleTemplateClick = (template) => {
    if (!canAddSchedule() && !editingSchedule) {
      setShowScheduleLimitModal(true);
      return;
    }
    setScheduleForm({
      name: template.name,
      prompt: template.prompt,
      frequency: template.frequency,
      time: template.time,
      days: [],
      active: true
    });
    setShowScheduleForm(true);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900">
          Automated Analysis
        </h1>
        <p className="text-gray-600 mt-1">
          Schedule automated prompts for your AI coach to analyze your training and recovery data
        </p>
      </div>

      {/* Save Status */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Header Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Scheduled Reports
              </CardTitle>
              <CardDescription>
                {schedules.length} active {schedules.length === 1 ? 'schedule' : 'schedules'}
              </CardDescription>
            </div>
            <Button 
              onClick={handleAddScheduleClick}
              className="bg-blue-600 hover:bg-blue-700 btn-transition w-full md:w-auto"
              data-testid="add-schedule-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule ({schedules.length}/{getScheduleLimit(subscriptionStatus.tier) === Infinity ? '∞' : getScheduleLimit(subscriptionStatus.tier)})
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Schedule Form */}
      {showScheduleForm && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </CardTitle>
            <CardDescription>
              {editingSchedule 
                ? 'Update your automated AI analysis schedule'
                : 'Set up automated AI analysis of your training and recovery data'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-name" className="text-sm font-medium">Schedule Name</Label>
                  <Input
                    id="schedule-name"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Daily Recovery Review"
                    className="input-focus"
                    data-testid="schedule-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-frequency" className="text-sm font-medium">Frequency</Label>
                  <select
                    id="schedule-frequency"
                    value={scheduleForm.frequency}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md input-focus"
                    data-testid="schedule-frequency-select"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-prompt" className="text-sm font-medium">AI Analysis Prompt</Label>
                <textarea
                  id="schedule-prompt"
                  value={scheduleForm.prompt}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, prompt: e.target.value }))}
                  className="w-full min-h-24 p-3 border border-gray-300 rounded-md input-focus resize-none"
                  placeholder="Describe what you want the AI to analyze..."
                  data-testid="schedule-prompt-textarea"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-time" className="text-sm font-medium">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                    className="input-focus"
                    data-testid="schedule-time-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex items-center pt-2">
                    <input
                      type="checkbox"
                      id="schedule-active"
                      checked={scheduleForm.active}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="schedule-active" className="ml-2 text-sm text-gray-700">
                      Active
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleCancelScheduleForm}
                  data-testid="cancel-schedule-btn"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="save-schedule-btn"
                >
                  Save Schedule
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Schedules */}
      <div className="space-y-4">
        {schedules.length === 0 && !showScheduleForm ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No automated schedules yet</p>
              <Button 
                onClick={handleAddScheduleClick}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="create-first-schedule-btn"
              >
                Create Your First Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule, index) => (
            <Card key={index} className="border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      {schedule.frequency === 'daily' ? (
                        <Calendar className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Repeat className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        {schedule.name}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          schedule.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {schedule.active ? 'Active' : 'Inactive'}
                        </span>
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {schedule.frequency} at {schedule.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="btn-transition"
                      onClick={() => handleEditSchedule(schedule)}
                      data-testid={`edit-schedule-btn-${index}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      data-testid={`delete-schedule-btn-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {schedule.prompt}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Preset Templates */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Schedule Templates</CardTitle>
          <CardDescription>
            Quick start with these pre-built schedule templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: "Daily Recovery Review",
                prompt: "Analyze yesterday's workout alongside last night's sleep data. How did training intensity affect my HRV, sleep quality, and readiness? Recommend today's training approach.",
                frequency: "daily",
                time: "08:00"
              },
              {
                name: "Weekly Training Analysis",
                prompt: "Review this week's training load, sleep patterns, and recovery metrics. Identify trends and provide recommendations for next week's training plan.",
                frequency: "weekly", 
                time: "18:00"
              },
              {
                name: "Nutrition Check",
                prompt: "Review my nutrition entries and supplement intake for the past week. Are my macros aligned with my training goals? Any recommendations?",
                frequency: "weekly",
                time: "19:00"
              },
              {
                name: "Race Prep Check",
                prompt: "Analyze my recent training progression, sleep quality, and readiness trends. Am I on track for my upcoming race? Any adjustments needed?",
                frequency: "weekly",
                time: "19:00"
              }
            ].map((template, index) => (
              <div 
                key={index}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => handleTemplateClick(template)}
              >
                <h4 className="font-medium text-gray-900 mb-2">{template.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{template.prompt}</p>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {template.frequency} at {template.time}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Limit Modal */}
      {showScheduleLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Schedule Limit Reached</CardTitle>
              <CardDescription>
                {subscriptionStatus.tier === 'free' 
                  ? 'Free plan includes 1 scheduled analysis'
                  : `Your ${subscriptionStatus.tier} plan includes ${getScheduleLimit(subscriptionStatus.tier)} scheduled analyses`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Upgrade to create more automated analysis schedules and unlock additional features.
              </p>
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowScheduleLimitModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setShowScheduleLimitModal(false);
                    // Navigate to subscriptions would be handled by parent
                  }}
                >
                  View Plans
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Schedules;
