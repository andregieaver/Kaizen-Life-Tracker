import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Edit, Trash2, LineChart as LineChartIcon, X, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const TestsAnalytics = ({ athleteId }) => {
  const { t } = useTranslation();
  const [testResults, setTestResults] = useState([]);
  const [testNames, setTestNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState({ tier: 'free', status: 'active' });
  const [showTestLimitModal, setShowTestLimitModal] = useState(false);
  
  const [formData, setFormData] = useState({
    test_name: '',
    unit: 'repetitions',
    result_value: '',
    time_hours: '',
    time_minutes: '',
    time_seconds: '',
    notes: '',
    test_date: new Date().toISOString().split('T')[0],
    use_existing_test: false
  });

  const units = [
    { value: 'repetitions', label: 'Repetitions' },
    { value: 'time', label: 'Time (seconds)' },
    { value: 'distance', label: 'Distance (meters)' },
    { value: 'weight', label: 'Weight (kg)' },
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    loadData();
    loadSubscriptionStatus();
  }, [athleteId]);

  const loadSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/status/${athleteId}`);
      setSubscriptionStatus({
        tier: response.data.subscription_tier || 'free',
        status: response.data.subscription_status || 'active'
      });
    } catch (error) {
      console.error('Error loading subscription status:', error);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [resultsRes, namesRes] = await Promise.all([
        axios.get(`${API}/test-results/${athleteId}`),
        axios.get(`${API}/test-results/${athleteId}/test-names`)
      ]);
      
      setTestResults(resultsRes.data.results || []);
      setTestNames(namesRes.data.test_names || []);
    } catch (error) {
      console.error('Error loading test data:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load test data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.test_name.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter a test name' });
      return;
    }

    if (!formData.result_value) {
      setSaveStatus({ type: 'error', message: 'Please enter a result value' });
      return;
    }

    try {
      // Convert time fields to total seconds
      let timeToCompletion = null;
      if (formData.time_hours || formData.time_minutes || formData.time_seconds) {
        const hours = parseInt(formData.time_hours) || 0;
        const minutes = parseInt(formData.time_minutes) || 0;
        const seconds = parseInt(formData.time_seconds) || 0;
        timeToCompletion = (hours * 3600) + (minutes * 60) + seconds;
      }

      const payload = {
        id: editingResult?.id || Math.random().toString(36).substring(7),
        athlete_id: athleteId,
        test_name: formData.test_name.trim(),
        unit: formData.unit,
        result_value: parseFloat(formData.result_value),
        time_to_completion: timeToCompletion,
        notes: formData.notes.trim() || null,
        test_date: formData.test_date,
        created_at: editingResult?.created_at || new Date().toISOString()
      };

      if (editingResult) {
        await axios.put(`${API}/test-results/${editingResult.id}`, payload);
        setSaveStatus({ type: 'success', message: 'Test result updated successfully!' });
      } else {
        await axios.post(`${API}/test-results`, payload);
        setSaveStatus({ type: 'success', message: 'Test result added successfully!' });
      }
      
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      
      // Reset form
      setFormData({
        test_name: '',
        unit: 'repetitions',
        result_value: '',
        time_hours: '',
        time_minutes: '',
        time_seconds: '',
        notes: '',
        test_date: new Date().toISOString().split('T')[0],
        use_existing_test: false
      });
      setEditingResult(null);
      setShowModal(false);
      
      // Reload data
      loadData();
    } catch (error) {
      console.error('Error saving test result:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save test result' });
    }
  };

  const handleEdit = (result) => {
    setEditingResult(result);
    
    // Convert seconds back to hours, minutes, seconds
    let hours = '';
    let minutes = '';
    let seconds = '';
    
    if (result.time_to_completion) {
      const totalSeconds = result.time_to_completion;
      hours = Math.floor(totalSeconds / 3600).toString();
      minutes = Math.floor((totalSeconds % 3600) / 60).toString();
      seconds = Math.floor(totalSeconds % 60).toString();
    }
    
    setFormData({
      test_name: result.test_name,
      unit: result.unit,
      result_value: result.result_value.toString(),
      time_hours: hours,
      time_minutes: minutes,
      time_seconds: seconds,
      notes: result.notes || '',
      test_date: result.test_date,
      use_existing_test: false
    });
    setShowModal(true);
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm('Are you sure you want to delete this test result?')) {
      return;
    }

    try {
      await axios.delete(`${API}/test-results/${resultId}`);
      setSaveStatus({ type: 'success', message: 'Test result deleted successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      loadData();
    } catch (error) {
      console.error('Error deleting test result:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete test result' });
    }
  };

  const handleAddNew = () => {
    setEditingResult(null);
    setFormData({
      test_name: '',
      unit: 'repetitions',
      result_value: '',
      time_hours: '',
      time_minutes: '',
      time_seconds: '',
      notes: '',
      test_date: new Date().toISOString().split('T')[0],
      use_existing_test: false
    });
    setShowModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatValue = (value, unit) => {
    if (unit === 'time') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    if (unit === 'percentage') {
      return `${value}%`;
    }
    return value.toString();
  };

  const getUnitLabel = (unit) => {
    const unitObj = units.find(u => u.value === unit);
    return unitObj?.label || unit;
  };

  // Group results by test name for charting
  const getTestGroups = () => {
    const groups = {};
    testResults.forEach(result => {
      if (!groups[result.test_name]) {
        groups[result.test_name] = [];
      }
      groups[result.test_name].push(result);
    });
    return groups;
  };

  const testGroups = getTestGroups();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">Loading test data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tests & Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track your fitness test results and visualize progress over time
          </p>
        </div>
        <Button 
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 btn-transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Test
        </Button>
      </div>

      {/* Status Messages */}
      {saveStatus.type && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Test Graphs */}
      {Object.keys(testGroups).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LineChartIcon className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No test results yet</h3>
            <p className="text-gray-600 text-center mb-4">
              Start tracking your fitness tests to see progress over time
            </p>
            <Button 
              onClick={handleAddNew}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(testGroups).map(([testName, results]) => {
            // Sort results by date
            const sortedResults = [...results].sort((a, b) => 
              new Date(a.test_date) - new Date(b.test_date)
            );

            const unit = results[0].unit;
            
            // For distance-based tests, plot time_to_completion instead of distance
            const isDistanceTest = unit === 'distance';
            
            // Determine Y-axis label based on what's being plotted
            const yAxisLabel = isDistanceTest ? 'Time' : getUnitLabel(unit);
            
            // Prepare chart data
            const chartData = sortedResults.map(result => ({
              date: formatDate(result.test_date),
              value: isDistanceTest && result.time_to_completion 
                ? result.time_to_completion 
                : result.result_value,
              fullDate: result.test_date
            }));

            const latestResult = sortedResults[sortedResults.length - 1];
            const firstResult = sortedResults[0];
            
            // Calculate improvement based on what's being plotted
            const latestValue = isDistanceTest && latestResult.time_to_completion 
              ? latestResult.time_to_completion 
              : latestResult.result_value;
            const firstValue = isDistanceTest && firstResult.time_to_completion 
              ? firstResult.time_to_completion 
              : firstResult.result_value;
            
            const improvement = latestValue - firstValue;
            
            // For time-based metrics (including distance tests), lower is better
            const isLowerBetter = isDistanceTest || unit === 'time';
            const improvementPercent = sortedResults.length > 1 
              ? ((improvement / firstValue) * 100).toFixed(1) 
              : 0;

            return (
              <Card key={testName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{testName}</CardTitle>
                      <CardDescription>
                        {sortedResults.length} test{sortedResults.length !== 1 ? 's' : ''} recorded
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {sortedResults.length > 1 && (
                        <Badge 
                          className={
                            isLowerBetter 
                              ? (improvement <= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                              : (improvement >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                          }
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {isLowerBetter 
                            ? (improvement <= 0 ? '' : '+')
                            : (improvement >= 0 ? '+' : '')
                          }
                          {improvementPercent}%
                        </Badge>
                      )}
                      <Badge className="bg-blue-100 text-blue-800">
                        Latest: {
                          isDistanceTest && latestResult.time_to_completion
                            ? formatValue(latestResult.time_to_completion, 'time')
                            : formatValue(latestResult.result_value, unit)
                        }
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Line Chart */}
                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#6b7280"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#6b7280"
                          style={{ fontSize: '12px' }}
                          label={{ 
                            value: yAxisLabel, 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { fontSize: '12px' }
                          }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                          }}
                          formatter={(value) => [
                            formatValue(value, isDistanceTest ? 'time' : unit), 
                            yAxisLabel
                          ]}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', r: 4 }}
                          name={testName}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingResult ? 'Edit Test Result' : 'Add New Test Result'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Test Name Selection */}
                <div className="space-y-2">
                  <Label htmlFor="test_name">Test Name *</Label>
                  <div className="space-y-2">
                    {testNames.length > 0 && !editingResult && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="use_existing"
                          checked={formData.use_existing_test}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            use_existing_test: e.target.checked,
                            test_name: e.target.checked ? testNames[0] : ''
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="use_existing" className="text-sm text-gray-600">
                          Use existing test
                        </label>
                      </div>
                    )}
                    
                    {formData.use_existing_test ? (
                      <Select 
                        value={formData.test_name} 
                        onValueChange={(value) => setFormData(prev => ({...prev, test_name: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a test" />
                        </SelectTrigger>
                        <SelectContent>
                          {testNames.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="test_name"
                        value={formData.test_name}
                        onChange={(e) => setFormData(prev => ({...prev, test_name: e.target.value}))}
                        placeholder="e.g., Pull-ups, 5km Run, Plank Hold"
                        required
                      />
                    )}
                  </div>
                </div>

                {/* Unit */}
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(value) => setFormData(prev => ({...prev, unit: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Result Value */}
                <div className="space-y-2">
                  <Label htmlFor="result_value">Result Value *</Label>
                  <Input
                    id="result_value"
                    type="number"
                    step="0.01"
                    value={formData.result_value}
                    onChange={(e) => setFormData(prev => ({...prev, result_value: e.target.value}))}
                    placeholder="e.g., 20 (for 20 pull-ups)"
                    required
                  />
                </div>

                {/* Time to Completion */}
                <div className="space-y-2">
                  <Label>Time to Completion - Optional</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Input
                        id="time_hours"
                        type="number"
                        min="0"
                        value={formData.time_hours}
                        onChange={(e) => setFormData(prev => ({...prev, time_hours: e.target.value}))}
                        placeholder="HH"
                      />
                      <p className="text-xs text-gray-500 text-center">Hours</p>
                    </div>
                    <div className="space-y-1">
                      <Input
                        id="time_minutes"
                        type="number"
                        min="0"
                        max="59"
                        value={formData.time_minutes}
                        onChange={(e) => setFormData(prev => ({...prev, time_minutes: e.target.value}))}
                        placeholder="MM"
                      />
                      <p className="text-xs text-gray-500 text-center">Minutes</p>
                    </div>
                    <div className="space-y-1">
                      <Input
                        id="time_seconds"
                        type="number"
                        min="0"
                        max="59"
                        value={formData.time_seconds}
                        onChange={(e) => setFormData(prev => ({...prev, time_seconds: e.target.value}))}
                        placeholder="SS"
                      />
                      <p className="text-xs text-gray-500 text-center">Seconds</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Leave empty if not applicable</p>
                </div>

                {/* Test Date */}
                <div className="space-y-2">
                  <Label htmlFor="test_date">Test Date *</Label>
                  <Input
                    id="test_date"
                    type="date"
                    value={formData.test_date}
                    onChange={(e) => setFormData(prev => ({...prev, test_date: e.target.value}))}
                    required
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                    placeholder="Add any notes about this test..."
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {editingResult ? 'Update Test' : 'Add Test'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestsAnalytics;
