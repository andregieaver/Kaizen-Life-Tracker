import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Edit, Trash2, LineChart as LineChartIcon, X, TrendingUp, Calendar as CalendarIcon, Crown, Check, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { 
  Line as ChartLine
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { logger } from '../utils/logger';
// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Sortable Test Card Component
const SortableTestCard = ({ testName, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: testName,
    // Restrict to vertical axis only
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  // Only apply vertical transform to prevent horizontal movement
  const style = {
    transform: transform ? `translate3d(0px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative sortable-test-card ${isDragging ? 'dragging-test-card' : ''}`}
    >
      {/* Drag Handle - Top Right */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 z-20 drag-handle p-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing"
        style={{ 
          touchAction: 'none',
          backgroundColor: 'rgba(55, 65, 81, 0.1)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.2)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.1)'}
        title="Drag to reorder"
      >
        <GripVertical className="w-5 h-5 text-gray-300 hover:text-white" />
      </div>
      {children}
    </div>
  );
};

const TestsAnalytics = ({ athleteId }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [testResults, setTestResults] = useState([]);
  const [testNames, setTestNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState({ tier: 'free', status: 'active' });
  const [showTestLimitModal, setShowTestLimitModal] = useState(false);
  const [addingEntryToTest, setAddingEntryToTest] = useState(null); // Track which test we're adding entry to
  const [expandedTests, setExpandedTests] = useState({}); // Track which test histories are expanded
  const [testOrder, setTestOrder] = useState([]); // Track custom test order
  
  const [formData, setFormData] = useState({
    test_name: '',
    unit: 'repetitions',
    result_value: '',
    time_hours: '',
    time_minutes: '',
    time_seconds: '',
    time_display_unit: 'seconds', // Default to seconds for time-based tests
    goal_direction: 'higher', // Default: higher is better
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
    loadTestOrder();
  }, [athleteId]);

  // Handle opening add entry modal when navigated from Dashboard
  useEffect(() => {
    if (location.state?.addEntryToTest && location.state?.testUnit) {
      // Wait for data to load first
      if (!isLoading && testResults.length > 0) {
        handleAddEntryToTest(location.state.addEntryToTest, location.state.testUnit);
        // Clear the state so it doesn't reopen on refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, isLoading, testResults]);

  const loadTestOrder = () => {
    try {
      const savedOrder = localStorage.getItem(`testOrder_${athleteId}`);
      if (savedOrder) {
        setTestOrder(JSON.parse(savedOrder));
      }
    } catch (error) {
      logger.error(null, 'Error loading test order:', error);
    }
  };

  const saveTestOrder = (order) => {
    try {
      localStorage.setItem(`testOrder_${athleteId}`, JSON.stringify(order));
      setTestOrder(order);
    } catch (error) {
      logger.error(null, 'Error saving test order:', error);
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/status/${athleteId}`);
      setSubscriptionStatus({
        tier: response.data.subscription_tier || 'free',
        status: response.data.subscription_status || 'active'
      });
    } catch (error) {
      logger.error(null, 'Error loading subscription status:', error);
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
      logger.error(null, 'Error loading test data:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load test data' });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for test limits
  const getTestLimit = (tier) => {
    const limits = {
      free: 3,
      pro: 10,
      premium: Infinity
    };
    return limits[tier] || 3;
  };

  const canAddTest = () => {
    const limit = getTestLimit(subscriptionStatus.tier);
    return testNames.length < limit;
  };

  const handleAddTestClick = () => {
    if (canAddTest()) {
      setShowModal(true);
    } else {
      setShowTestLimitModal(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.test_name.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter a test name' });
      return;
    }

    // For time-based tests, require time completion instead of result value
    const isTimeBasedTest = formData.unit === 'time';
    
    if (isTimeBasedTest) {
      // Require at least one time field to be filled
      if (!formData.time_hours && !formData.time_minutes && !formData.time_seconds) {
        setSaveStatus({ type: 'error', message: 'Please enter time to completion' });
        return;
      }
    } else {
      // For non-time tests, require result value
      if (!formData.result_value) {
        setSaveStatus({ type: 'error', message: 'Please enter a result value' });
        return;
      }
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
        result_value: parseFloat(formData.result_value) || 0,
        time_to_completion: timeToCompletion,
        time_display_unit: formData.unit === 'time' || formData.unit === 'duration' ? formData.time_display_unit : null,
        goal_direction: formData.goal_direction,
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
        time_display_unit: 'seconds',
        goal_direction: 'higher',
        notes: '',
        test_date: new Date().toISOString().split('T')[0],
        use_existing_test: false
      });
      setEditingResult(null);
      setAddingEntryToTest(null);
      setShowModal(false);
      
      // Reload data
      loadData();
    } catch (error) {
      logger.error(null, 'Error saving test result:', error);
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
      time_display_unit: result.time_display_unit || 'seconds',
      goal_direction: result.goal_direction || 'higher',
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
      logger.error(null, 'Error deleting test result:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete test result' });
    }
  };

  const handleAddNew = () => {
    setEditingResult(null);
    setAddingEntryToTest(null);
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

  const handleAddEntryToTest = (testName, unit) => {
    setEditingResult(null);
    setAddingEntryToTest({ testName, unit });
    setFormData({
      test_name: testName,
      unit: unit,
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

  const toggleTestHistory = (testName) => {
    setExpandedTests(prev => ({
      ...prev,
      [testName]: !prev[testName]
    }));
  };

  const handleDeleteAllTests = async (testName) => {
    if (!window.confirm(`Are you sure you want to delete ALL test results for "${testName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Get all results for this test
      const testResults = await axios.get(`${API}/test-results/${athleteId}`, {
        params: { test_name: testName }
      });
      
      // Delete each result
      const deletePromises = testResults.data.results.map(result => 
        axios.delete(`${API}/test-results/${result.id}`)
      );
      
      await Promise.all(deletePromises);
      
      setSaveStatus({ type: 'success', message: `All test results for "${testName}" deleted successfully!` });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      loadData();
    } catch (error) {
      logger.error(null, 'Error deleting all tests:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete test results' });
    }
  };

  // Drag and drop sensors - optimized for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms press before drag on touch devices
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedTestNames.indexOf(active.id);
      const newIndex = orderedTestNames.indexOf(over.id);
      
      const newOrder = arrayMove(orderedTestNames, oldIndex, newIndex);
      saveTestOrder(newOrder);
    }
  };

  const handleDragStart = () => {
    // Provide haptic feedback on mobile if available
    if (window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatValue = (value, unit, timeDisplayUnit = 'seconds') => {
    if (unit === 'time') {
      // Convert seconds to the desired display unit
      if (timeDisplayUnit === 'hours') {
        return (value / 3600).toFixed(3);
      } else if (timeDisplayUnit === 'minutes') {
        return (value / 60).toFixed(2);
      } else {
        // Default to seconds or MM:SS format
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    if (unit === 'percentage') {
      return `${value}%`;
    }
    return value.toString();
  };

  const getTimeDisplayLabel = (timeDisplayUnit) => {
    if (timeDisplayUnit === 'hours') return 'hrs';
    if (timeDisplayUnit === 'minutes') return 'min';
    return ''; // For seconds, we use MM:SS format
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
  
  // Get ordered test names
  const orderedTestNames = (() => {
    const allTestNames = Object.keys(testGroups);
    
    // If we have a saved order, use it and append any new tests
    if (testOrder.length > 0) {
      const newTests = allTestNames.filter(name => !testOrder.includes(name));
      return [...testOrder.filter(name => allTestNames.includes(name)), ...newTests];
    }
    
    // Default: alphabetical order
    return allTestNames.sort();
  })();

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Tests & Analytics</h1>
          <p className="text-white mt-1">
            Track your fitness test results and visualize progress over time
          </p>
        </div>
        <Button 
          onClick={handleAddTestClick}
          className="bg-black hover:bg-gray-900 text-white btn-transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Test ({testNames.length}/{getTestLimit(subscriptionStatus.tier) === Infinity ? '∞' : getTestLimit(subscriptionStatus.tier)})
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
        <div className="flex flex-col items-center justify-center py-12">
          <LineChartIcon className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No test results yet</h3>
          <p className="text-gray-400 text-center">
            Start tracking your fitness tests to see progress over time
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedTestNames}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6 w-full">
              {orderedTestNames.map((testName) => {
                const results = testGroups[testName];
            // Sort results by date
            const sortedResults = [...results].sort((a, b) => 
              new Date(a.test_date) - new Date(b.test_date)
            );

            const unit = results[0].unit;
            const timeDisplayUnit = results[0].time_display_unit || 'seconds'; // Get from first result
            
            // For distance-based tests, plot time_to_completion instead of distance
            const isDistanceTest = unit === 'distance';
            
            // Determine Y-axis label based on what's being plotted
            let yAxisLabel = isDistanceTest ? 'Time' : getUnitLabel(unit);
            
            // For time-based tests, add the display unit label
            if (unit === 'time' && timeDisplayUnit !== 'seconds') {
              yAxisLabel = `Time (${getTimeDisplayLabel(timeDisplayUnit)})`;
            }
            
            // Prepare chart data - convert time values based on display preference
            const chartData = sortedResults.map(result => {
              let displayValue;
              if (isDistanceTest && result.time_to_completion) {
                displayValue = result.time_to_completion;
              } else if (unit === 'time' && result.time_to_completion) {
                // For time-based tests, convert to display unit
                if (timeDisplayUnit === 'hours') {
                  displayValue = result.time_to_completion / 3600;
                } else if (timeDisplayUnit === 'minutes') {
                  displayValue = result.time_to_completion / 60;
                } else {
                  displayValue = result.time_to_completion; // Keep as seconds
                }
              } else {
                displayValue = result.result_value;
              }
              
              return {
                date: formatDate(result.test_date),
                value: displayValue,
                fullDate: result.test_date,
                rawValue: result.time_to_completion || result.result_value // Keep raw for tooltip
              };
            });

            const latestResult = sortedResults[sortedResults.length - 1];
            const firstResult = sortedResults[0];
            
            // Calculate improvement based on what's being plotted
            // For time-based tests, use time_to_completion; for others use result_value
            const latestValue = (unit === 'time' || isDistanceTest) && latestResult.time_to_completion 
              ? latestResult.time_to_completion 
              : latestResult.result_value;
            const firstValue = (unit === 'time' || isDistanceTest) && firstResult.time_to_completion 
              ? firstResult.time_to_completion 
              : firstResult.result_value;
            
            const improvement = latestValue - firstValue;
            
            // Use goal_direction from the test result, defaulting to 'higher' if not set
            const goalDirection = latestResult.goal_direction || 'higher';
            const isLowerBetter = goalDirection === 'lower';
            
            const improvementPercent = sortedResults.length > 1 && firstValue > 0
              ? ((improvement / firstValue) * 100).toFixed(1) 
              : 0;

            return (
              <SortableTestCard key={testName} testName={testName}>
                <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300 border-0 bg-gradient-to-br from-gray-600 to-gray-800">
                {/* Add Entry Icon - Positioned below drag handler */}
                <button
                  onClick={() => handleAddEntryToTest(testName, unit)}
                  className="absolute right-2 top-14 z-10 p-1 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Add Entry"
                >
                  <Plus className="w-6 h-6 text-gray-300 hover:text-white" />
                </button>
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-bold text-white">
                        {testName}
                      </CardTitle>
                      <CardDescription className="text-gray-300 font-medium">
                        {sortedResults.length} test{sortedResults.length !== 1 ? 's' : ''} recorded
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {sortedResults.length > 1 && (
                        <Badge 
                          className={`shadow-md ${
                            isLowerBetter 
                              ? (improvement < 0 ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white border-0' : 'bg-gradient-to-r from-red-400 to-rose-500 text-white border-0')
                              : (improvement > 0 ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white border-0' : 'bg-gradient-to-r from-red-400 to-rose-500 text-white border-0')
                          }`}
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {isLowerBetter 
                            ? (improvement < 0 ? '' : '+')
                            : (improvement > 0 ? '+' : '')
                          }
                          {improvementPercent}%
                        </Badge>
                      )}
                      <Badge className="bg-black text-white border border-gray-700 shadow-md">
                        Latest: {
                          (() => {
                            if (unit === 'time' && latestResult.time_to_completion) {
                              const formattedTime = formatValue(latestResult.time_to_completion, 'time', timeDisplayUnit);
                              const label = getTimeDisplayLabel(timeDisplayUnit);
                              return label ? `${formattedTime} ${label}` : formattedTime;
                            } else if (isDistanceTest && latestResult.time_to_completion) {
                              return formatValue(latestResult.time_to_completion, 'time');
                            } else {
                              return formatValue(latestResult.result_value, unit);
                            }
                          })()
                        }
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Chart.js Line Chart with Gradient Fill */}
                  <div className="mb-0 bg-transparent focus:outline-none" style={{ outline: 'none' }}>
                    <div style={{ height: '350px', position: 'relative' }}>
                      <ChartLine
                        data={{
                          labels: chartData.map(item => item.date),
                          datasets: [{
                            label: testName,
                            data: chartData.map(item => item.value),
                            borderColor: '#32D3FF',
                            backgroundColor: (context) => {
                              const ctx = context.chart.ctx;
                              const gradient = ctx.createLinearGradient(0, 0, 0, 350);
                              gradient.addColorStop(0, 'rgba(0, 194, 168, 0.4)');
                              gradient.addColorStop(1, 'rgba(0, 194, 168, 0)');
                              return gradient;
                            },
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#32D3FF',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointHoverBackgroundColor: '#32D3FF',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 3,
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: {
                            intersect: false,
                            mode: 'index',
                          },
                          plugins: {
                            legend: {
                              display: true,
                              position: 'bottom',
                              labels: {
                                color: '#ffffff',
                                font: {
                                  size: 13,
                                  weight: '500'
                                },
                                padding: 20,
                                usePointStyle: true,
                                pointStyle: 'circle'
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              titleColor: '#ffffff',
                              bodyColor: '#32D3FF',
                              borderColor: '#32D3FF',
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: 16,
                              titleFont: {
                                size: 13,
                                weight: '600'
                              },
                              bodyFont: {
                                size: 14,
                                weight: '500'
                              },
                              callbacks: {
                                label: function(context) {
                                  const rawValue = chartData[context.dataIndex].rawValue;
                                  let formattedValue;
                                  
                                  if (unit === 'time') {
                                    if (timeDisplayUnit === 'hours') {
                                      formattedValue = (rawValue / 3600).toFixed(3) + ' hrs';
                                    } else if (timeDisplayUnit === 'minutes') {
                                      formattedValue = (rawValue / 60).toFixed(2) + ' min';
                                    } else {
                                      const minutes = Math.floor(rawValue / 60);
                                      const seconds = Math.floor(rawValue % 60);
                                      formattedValue = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                    }
                                  } else {
                                    formattedValue = formatValue(context.parsed.y, isDistanceTest ? 'time' : unit, timeDisplayUnit);
                                    if (!isDistanceTest && unit !== 'percentage') {
                                      formattedValue += ' ' + getUnitLabel(unit);
                                    }
                                  }
                                  
                                  return `${testName}: ${formattedValue}`;
                                }
                              }
                            }
                          },
                          scales: {
                            x: {
                              grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawTicks: false,
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderWidth: 2
                              },
                              ticks: {
                                color: '#ffffff',
                                font: {
                                  size: 12,
                                  weight: '500'
                                },
                                padding: 8
                              }
                            },
                            y: {
                              grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawTicks: false,
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderWidth: 2
                              },
                              ticks: {
                                color: '#ffffff',
                                font: {
                                  size: 12,
                                  weight: '500'
                                },
                                padding: 8,
                                callback: function(value) {
                                  if (unit === 'time' && timeDisplayUnit !== 'seconds') {
                                    return value.toFixed(timeDisplayUnit === 'hours' ? 3 : 2);
                                  }
                                  return value;
                                }
                              },
                              title: {
                                display: true,
                                text: yAxisLabel,
                                color: '#ffffff',
                                font: {
                                  size: 13,
                                  weight: '600'
                                },
                                padding: 12
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Individual Test Results List */}
                  <div className="border-t border-gray-700 pt-4 px-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => toggleTestHistory(testName)}
                        className="flex items-center gap-2 font-semibold text-white hover:text-blue-400 transition-colors"
                      >
                        <span>Test History</span>
                        {expandedTests[testName] ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteAllTests(testName)}
                        className="bg-black text-white hover:bg-gray-900 border-0"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete All
                      </Button>
                    </div>
                    
                    {expandedTests[testName] && (
                      <div className="space-y-2">
                        {sortedResults.map((result) => (
                          <div
                            key={result.id}
                            className="flex items-center justify-between gap-2 p-3 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg hover:from-gray-500 hover:to-gray-700 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center text-gray-300">
                                  <CalendarIcon className="w-4 h-4 mr-1" />
                                  <span className="text-sm font-medium">{formatDate(result.test_date)}</span>
                                </div>
                                {unit === 'time' ? (
                                  // For time-based tests, show time prominently
                                  result.time_to_completion ? (
                                    <div className="font-semibold text-lg text-blue-400">
                                      {formatValue(result.time_to_completion, 'time')}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-400 italic">No time recorded</div>
                                  )
                                ) : (
                                  // For non-time tests, show result value prominently
                                  <>
                                    <div className="font-semibold text-white">
                                      {formatValue(result.result_value, unit)} {getUnitLabel(unit)}
                                    </div>
                                    {result.time_to_completion && (
                                      <div className="text-sm text-gray-300">
                                        Time: {formatValue(result.time_to_completion, 'time')}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              {result.notes && (
                                <p className="text-sm text-gray-300 mt-1 truncate">{result.notes}</p>
                              )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(result)}
                                className="bg-black text-white hover:bg-gray-900 border-0"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(result.id)}
                                className="bg-black text-white hover:bg-gray-900 border-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </SortableTestCard>
            );
          })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">
                  {editingResult 
                    ? 'Edit Test Result' 
                    : addingEntryToTest 
                      ? `Add Entry to ${addingEntryToTest.testName}` 
                      : 'Add New Test Result'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowModal(false);
                    setAddingEntryToTest(null);
                  }}
                  className="text-white hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Test Name Selection */}
                <div className="space-y-2">
                  <Label htmlFor="test_name" className="text-white">Test Name *</Label>
                  <div className="space-y-2">
                    {/* Show checkbox only when not editing and not adding entry to specific test */}
                    {testNames.length > 0 && !editingResult && !addingEntryToTest && (
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
                        <label htmlFor="use_existing" className="text-sm text-gray-300">
                          Use existing test
                        </label>
                      </div>
                    )}
                    
                    {/* If adding entry to specific test, show disabled input */}
                    {addingEntryToTest ? (
                      <Input
                        id="test_name"
                        value={formData.test_name}
                        disabled
                        className="bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed"
                      />
                    ) : formData.use_existing_test ? (
                      <Select 
                        value={formData.test_name} 
                        onValueChange={(value) => setFormData(prev => ({...prev, test_name: value}))}
                      >
                        <SelectTrigger className="bg-gray-600 border-gray-500 text-white">
                          <SelectValue placeholder="Select a test" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {testNames.map((name) => (
                            <SelectItem key={name} value={name} className="text-white">{name}</SelectItem>
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
                        disabled={editingResult !== null}
                        className={editingResult ? "bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed" : "bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"}
                      />
                    )}
                  </div>
                </div>

                {/* Unit */}
                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-white">Unit *</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(value) => setFormData(prev => ({...prev, unit: value}))}
                    disabled={addingEntryToTest !== null}
                  >
                    <SelectTrigger className={addingEntryToTest ? "bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed" : "bg-gray-600 border-gray-500 text-white"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {units.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value} className="text-white">
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addingEntryToTest && (
                    <p className="text-xs text-gray-400">Unit is fixed for this test</p>
                  )}
                </div>

                {/* Result Value - Hidden for time-based tests */}
                {formData.unit !== 'time' && (
                  <div className="space-y-2">
                    <Label htmlFor="result_value" className="text-white">Result Value *</Label>
                    <Input
                      id="result_value"
                      type="number"
                      step="0.01"
                      value={formData.result_value}
                      onChange={(e) => setFormData(prev => ({...prev, result_value: e.target.value}))}
                      placeholder="e.g., 20 (for 20 pull-ups)"
                      className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                      required
                    />
                  </div>
                )}

                {/* Time to Completion */}
                <div className="space-y-2">
                  <Label className="text-white">
                    Time to Completion {formData.unit === 'time' ? '*' : '- Optional'}
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Input
                        id="time_hours"
                        type="number"
                        min="0"
                        value={formData.time_hours}
                        onChange={(e) => setFormData(prev => ({...prev, time_hours: e.target.value}))}
                        placeholder="HH"
                        className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                        required={formData.unit === 'time'}
                      />
                      <p className="text-xs text-gray-400 text-center">Hours</p>
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
                        className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                        required={formData.unit === 'time'}
                      />
                      <p className="text-xs text-gray-400 text-center">Minutes</p>
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
                        className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                        required={formData.unit === 'time'}
                      />
                      <p className="text-xs text-gray-400 text-center">Seconds</p>
                    </div>
                  </div>
                  {formData.unit === 'time' ? (
                    <p className="text-xs text-teal-400 font-medium">Enter the time result for this test</p>
                  ) : (
                    <p className="text-xs text-gray-400">Leave empty if not applicable</p>
                  )}
                </div>

                {/* Time Display Unit - Only for time-based tests */}
                {(formData.unit === 'time' || formData.unit === 'duration') && (
                  <div className="space-y-2">
                    <Label htmlFor="time_display_unit" className="text-white">Display Time As *</Label>
                    <Select
                      value={formData.time_display_unit}
                      onValueChange={(value) => setFormData(prev => ({...prev, time_display_unit: value}))}
                      disabled={addingEntryToTest !== null}
                    >
                      <SelectTrigger className={addingEntryToTest ? "bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed" : "bg-gray-600 border-gray-500 text-white"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="seconds" className="text-white">Seconds (e.g., 90s)</SelectItem>
                        <SelectItem value="minutes" className="text-white">Minutes (e.g., 1.5 min)</SelectItem>
                        <SelectItem value="hours" className="text-white">Hours (e.g., 0.025 hrs)</SelectItem>
                      </SelectContent>
                    </Select>
                    {addingEntryToTest ? (
                      <p className="text-xs text-gray-400">Display format is fixed for this test</p>
                    ) : (
                      <p className="text-xs text-gray-400">Choose how time will be displayed in the chart axis</p>
                    )}
                  </div>
                )}

                {/* Goal Direction - Whether higher or lower is better */}
                <div className="space-y-2">
                  <Label htmlFor="goal_direction" className="text-white">Goal Direction *</Label>
                  <Select
                    value={formData.goal_direction}
                    onValueChange={(value) => setFormData(prev => ({...prev, goal_direction: value}))}
                    disabled={addingEntryToTest !== null}
                  >
                    <SelectTrigger className={addingEntryToTest ? "bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed" : "bg-gray-600 border-gray-500 text-white"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="higher" className="text-white">Higher is Better (e.g., Pull-ups, Hang-bar)</SelectItem>
                      <SelectItem value="lower" className="text-white">Lower is Better (e.g., Run time, Body fat)</SelectItem>
                    </SelectContent>
                  </Select>
                  {addingEntryToTest ? (
                    <p className="text-xs text-gray-400">Goal direction is fixed for this test</p>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {formData.goal_direction === 'higher' 
                        ? 'Increases will show green, decreases red' 
                        : 'Decreases will show green, increases red'}
                    </p>
                  )}
                </div>

                {/* Test Date */}
                <div className="space-y-2">
                  <Label htmlFor="test_date" className="text-white">Test Date *</Label>
                  <Input
                    id="test_date"
                    type="date"
                    value={formData.test_date}
                    onChange={(e) => setFormData(prev => ({...prev, test_date: e.target.value}))}
                    className="bg-gray-600 border-gray-500 text-white"
                    required
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-white">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                    placeholder="Add any notes about this test..."
                    className="bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowModal(false);
                      setAddingEntryToTest(null);
                    }}
                    className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {editingResult ? 'Update Test' : addingEntryToTest ? 'Add Entry' : 'Add Test'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Test Limit Modal */}
      {showTestLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                Upgrade to Track More Tests
              </CardTitle>
              <CardDescription>
                {subscriptionStatus.tier === 'free' 
                  ? "You've reached the limit of 3 fitness tests on the Free plan."
                  : "You've reached the limit of 10 fitness tests on the Pro plan."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Upgrade Benefits:</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  {subscriptionStatus.tier === 'free' ? (
                    <>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span><strong>Pro:</strong> Track up to 10 fitness tests</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span><strong>Premium:</strong> Unlimited test tracking</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Advanced analytics & trend visualization</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span><strong>Premium:</strong> Unlimited test tracking</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Personalized training plans</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Performance predictions & insights</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>1-on-1 coaching sessions</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowTestLimitModal(false)}
                >
                  Maybe Later
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  onClick={() => {
                    setShowTestLimitModal(false);
                    window.location.href = '/dashboard/account?tab=subscriptions';
                  }}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TestsAnalytics;
