import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    <div className="w-full max-w-[1600px] mx-auto space-y-6 p-2 md:p-6 min-h-screen" style={{ background: 'var(--grad-page)' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
          Scheduled Reports
        </h1>
        <p className="text-gray-300 mt-1">
          Schedule automated prompts for your AI coach to analyze your training and recovery data
        </p>
      </div>

      {/* Save Status */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' 
            ? 'bg-green-900/30 text-green-200 border border-green-700' 
            : 'bg-red-900/30 text-red-200 border border-red-700'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Header Card */}
      <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="flex items-center text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                <Calendar className="w-5 h-5 mr-2" style={{ color: 'var(--c-brand-500)' }} />
                Scheduled Reports
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-med)' }}>
                {schedules.length} active {schedules.length === 1 ? 'schedule' : 'schedules'}
              </p>
            </div>
            <Button 
              onClick={handleAddScheduleClick}
              className="bg-[#00C2A8] hover:bg-[#00a890] text-white btn-transition w-full md:w-auto"
              data-testid="add-schedule-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule ({schedules.length}/{getScheduleLimit(subscriptionStatus.tier) === Infinity ? '∞' : getScheduleLimit(subscriptionStatus.tier)})
            </Button>
          </div>
        </div>
      </div>

      {/* Schedule Form */}
      {showScheduleForm && (
        <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-med)' }}>
              {editingSchedule 
                ? 'Update your automated AI analysis schedule'
                : 'Set up automated AI analysis of your training and recovery data'
              }
            </p>
          </div>
          <div className="p-4">
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-name" className="text-sm font-medium text-white">Schedule Name</Label>
                  <Input
                    id="schedule-name"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('schedules.presets.dailyRecovery.name')}
                    className="input-focus bg-gray-600 border-gray-500 text-white placeholder-gray-400"
                    data-testid="schedule-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-frequency" className="text-sm font-medium text-white">Frequency</Label>
                  <select
                    id="schedule-frequency"
                    value={scheduleForm.frequency}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full p-2 border border-gray-500 rounded-md input-focus bg-gray-600 text-white"
                    data-testid="schedule-frequency-select"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-prompt" className="text-sm font-medium text-white">AI Analysis Prompt</Label>
                <textarea
                  id="schedule-prompt"
                  value={scheduleForm.prompt}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, prompt: e.target.value }))}
                  className="w-full min-h-24 p-3 border border-gray-500 rounded-md input-focus resize-none bg-gray-600 text-white placeholder-gray-400"
                  placeholder={t('schedules.analyzePrompt')}
                  data-testid="schedule-prompt-textarea"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-time" className="text-sm font-medium text-white">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                    className="input-focus bg-gray-600 border-gray-500 text-white"
                    data-testid="schedule-time-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Status</Label>
                  <div className="flex items-center pt-2">
                    <input
                      type="checkbox"
                      id="schedule-active"
                      checked={scheduleForm.active}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, active: e.target.checked }))}
                      className="w-4 h-4 text-[#00C2A8] border-gray-500 rounded focus:ring-[#00C2A8] bg-gray-600"
                    />
                    <Label htmlFor="schedule-active" className="ml-2 text-sm text-gray-300">
                      Active
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleCancelScheduleForm}
                  data-testid="cancel-schedule-btn"
                  className="w-full sm:w-auto bg-gray-600 text-white border-gray-500 hover:bg-gray-500"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="w-full sm:w-auto bg-[#00C2A8] hover:bg-[#00a890] text-white"
                  data-testid="save-schedule-btn"
                >
                  Save Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Schedules */}
      <div className="space-y-4">
        {schedules.length === 0 && !showScheduleForm ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-200 mb-2">No automated schedules yet</h3>
            <p className="text-gray-400 text-center">
              Schedule automated prompts for your AI coach
            </p>
          </div>
        ) : (
          schedules.map((schedule, index) => (
            <div key={index} className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3" style={{ background: 'var(--bg-800)' }}>
                      {schedule.frequency === 'daily' ? (
                        <Calendar className="w-5 h-5" style={{ color: 'var(--c-brand-500)' }} />
                      ) : (
                        <Repeat className="w-5 h-5" style={{ color: 'var(--c-brand-500)' }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium flex items-center gap-2" style={{ color: 'var(--text-hi)' }}>
                        {schedule.name}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          schedule.active 
                            ? 'bg-green-900/30 text-green-300 border border-green-700' 
                            : 'bg-gray-900/30 text-gray-400 border border-gray-600'
                        }`}>
                          {schedule.active ? 'Active' : 'Inactive'}
                        </span>
                      </h3>
                      <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
                        {schedule.frequency} at {schedule.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="btn-transition bg-gray-600 text-white border-gray-500 hover:bg-gray-500"
                      onClick={() => handleEditSchedule(schedule)}
                      data-testid={`edit-schedule-btn-${index}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-400 hover:bg-red-900/30 bg-gray-600 border-gray-500"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      data-testid={`delete-schedule-btn-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm bg-gray-900/50 p-3 rounded-lg" style={{ color: 'var(--text-med)' }}>
                  {schedule.prompt}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preset Templates */}
      <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Schedule Templates</h3>
          <p className="text-sm" style={{ color: 'var(--text-med)' }}>
            Quick start with these pre-built schedule templates
          </p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: t('schedules.presets.dailyRecovery.name'),
                prompt: t('schedules.presets.dailyRecovery.prompt'),
                frequency: "daily",
                time: "08:00"
              },
              {
                name: t('schedules.presets.weeklyTraining.name'),
                prompt: t('schedules.presets.weeklyTraining.prompt'),
                frequency: "weekly", 
                time: "18:00"
              },
              {
                name: t('schedules.presets.nutrition.name'),
                prompt: t('schedules.presets.nutrition.prompt'),
                frequency: "weekly",
                time: "19:00"
              },
              {
                name: t('schedules.presets.racePrep.name'),
                prompt: t('schedules.presets.racePrep.prompt'),
                frequency: "weekly",
                time: "19:00"
              }
            ].map((template, index) => (
              <div 
                key={index}
                className="p-4 border border-gray-600 rounded-lg transition-colors cursor-pointer bg-gray-800/50"
                style={{ 
                  borderColor: '#4b5563'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00C2A8'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#4b5563'}
                onClick={() => handleTemplateClick(template)}
              >
                <h4 className="font-medium text-white mb-2">{template.name}</h4>
                <p className="text-sm text-gray-300 mb-3">{template.prompt}</p>
                <div className="flex items-center text-xs text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  {template.frequency} at {template.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Limit Modal */}
      {showScheduleLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl border border-gray-600" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Schedule Limit Reached</h3>
              <p className="text-sm" style={{ color: 'var(--text-med)' }}>
                {subscriptionStatus.tier === 'free' 
                  ? 'Free plan includes 1 scheduled analysis'
                  : `Your ${subscriptionStatus.tier} plan includes ${getScheduleLimit(subscriptionStatus.tier)} scheduled analyses`
                }
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm mb-4" style={{ color: 'var(--text-med)' }}>
                Upgrade to create more automated analysis schedules and unlock additional features.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowScheduleLimitModal(false)}
                  className="w-full sm:w-auto bg-gray-600 text-white border-gray-500 hover:bg-gray-500"
                >
                  Cancel
                </Button>
                <Button 
                  className="w-full sm:w-auto bg-[#00C2A8] hover:bg-[#00a890] text-white"
                  onClick={() => {
                    setShowScheduleLimitModal(false);
                    navigate('/dashboard/account?tab=subscriptions');
                  }}
                >
                  View Plans
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedules;
