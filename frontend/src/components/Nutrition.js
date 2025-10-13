import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Camera, Upload, Trash2, Edit3, Utensils, Coffee, UtensilsCrossed, Apple, X, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const Nutrition = ({ athleteId }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState(false); // true = view-only, false = edit mode
  const [viewingEntry, setViewingEntry] = useState(null); // Entry being viewed
  const [editingEntry, setEditingEntry] = useState(null);
  const [mealType, setMealType] = useState('breakfast');
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [entryDate, setEntryDate] = useState(''); // YYYY-MM-DD
  const [entryTime, setEntryTime] = useState(''); // HH:MM
  const [captureMethod, setCaptureMethod] = useState('upload'); // 'upload' or 'camera'
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [athlete, setAthlete] = useState(null); // For time format preference
  const [selectedWeekStart, setSelectedWeekStart] = useState(null); // Track selected week
  const [viewType, setViewType] = useState('week'); // 'day' or 'week'
  const [selectedDay, setSelectedDay] = useState(null); // Track selected day (Date object)
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast', icon: Coffee },
    { value: 'lunch', label: 'Lunch', icon: Utensils },
    { value: 'dinner', label: 'Dinner', icon: UtensilsCrossed },
    { value: 'snack', label: 'Snack', icon: Apple }
  ];

  useEffect(() => {
    loadNutritionEntries();
    loadAthleteData();
  }, [athleteId]);

  // Check for action parameter in URL to auto-open modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'add') {
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        openNewEntryModal();
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 300);
    }
  }, []);

  const loadAthleteData = async () => {
    try {
      const response = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(response.data);
    } catch (error) {
      console.error('Error loading athlete data:', error);
    }
  };

  const loadNutritionEntries = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/nutrition/${athleteId}`);
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading nutrition entries:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load nutrition entries' });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get current date and time in required formats
  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`; // HH:MM
    return { date, time };
  };

  // Format time according to user preference (12h or 24h)
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    
    if (athlete?.time_format === '12h') {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${period}`;
    }
    
    return `${hours}:${minutes}`;
  };

  // Format date and time for display
  const formatDateTime = (dateString, timeString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    if (timeString) {
      return `${formattedDate} at ${formatTime(timeString)}`;
    }
    
    return formattedDate;
  };

  // Open modal for new entry
  const openNewEntryModal = () => {
    const { date, time } = getCurrentDateTime();
    setViewMode(false);
    setEditingEntry(null);
    setViewingEntry(null);
    setMealType('breakfast');
    setDescription('');
    setImageData(null);
    setImagePreview(null);
    setEntryDate(date);
    setEntryTime(time);
    setNutritionData(null);
    setShowModal(true);
  };

  // Open modal to view entry (read-only)
  const handleViewEntry = (entry) => {
    setViewingEntry(entry);
    setViewMode(true);
    setShowModal(true);
  };

  // Switch from view mode to edit mode
  const switchToEditMode = () => {
    if (viewingEntry) {
      setEditingEntry(viewingEntry);
      setMealType(viewingEntry.meal_type);
      setDescription(viewingEntry.description);
      setImageData(viewingEntry.image_data);
      setImagePreview(viewingEntry.image_data);
      setEntryDate(viewingEntry.entry_date || '');
      setEntryTime(viewingEntry.entry_time || '');
      
      // Load nutrition data if available
      if (viewingEntry.calories || viewingEntry.protein || viewingEntry.carbs || viewingEntry.fat) {
        setNutritionData({
          calories: viewingEntry.calories,
          protein: viewingEntry.protein,
          carbs: viewingEntry.carbs,
          fat: viewingEntry.fat,
          fiber: viewingEntry.fiber,
          sodium: viewingEntry.sodium,
          sugar: viewingEntry.sugar,
          vitamin_a: viewingEntry.vitamin_a,
          vitamin_c: viewingEntry.vitamin_c,
          vitamin_d: viewingEntry.vitamin_d,
          calcium: viewingEntry.calcium,
          iron: viewingEntry.iron,
          potassium: viewingEntry.potassium,
          ai_analysis: viewingEntry.ai_analysis
        });
      }
      
      setViewMode(false);
      setViewingEntry(null);
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max 1920px width, maintaining aspect ratio)
          let width = img.width;
          let height = img.height;
          const maxWidth = 1920;
          const maxHeight = 1920;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height / width) * maxWidth;
              width = maxWidth;
            } else {
              width = (width / height) * maxHeight;
              height = maxHeight;
            }
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels until under 5MB
          let quality = 0.9;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Keep reducing quality until under 5MB (base64 string length * 0.75 ≈ file size in bytes)
          while (compressedDataUrl.length * 0.75 > 5 * 1024 * 1024 && quality > 0.1) {
            quality -= 0.1;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Final check
          const finalSizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);
          if (finalSizeInMB > 5) {
            reject(new Error('Unable to compress image below 5MB. Please use a smaller image.'));
          } else {
            resolve(compressedDataUrl);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const analyzeFoodImage = async (imageData, descriptionText = '') => {
    try {
      setIsAnalyzing(true);
      setSaveStatus({ type: '', message: 'Analyzing food image with AI...' });
      
      const response = await axios.post(`${API}/nutrition/analyze-image/${athleteId}`, {
        image_data: imageData,
        description: descriptionText
      });
      
      setNutritionData(response.data);
      setSaveStatus({ type: 'success', message: 'Nutritional analysis complete!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 2000);
    } catch (error) {
      console.error('Error analyzing food image:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to analyze image';
      setSaveStatus({ type: 'error', message: errorMessage });
      // Set default nutrition data on error
      setNutritionData({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        ai_analysis: 'Analysis unavailable'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setSaveStatus({ type: '', message: 'Compressing image...' });
        const compressedImage = await compressImage(file);
        setImageData(compressedImage);
        setImagePreview(compressedImage);
        setSaveStatus({ type: 'success', message: 'Image ready!' });
        
        // Automatically analyze the image with description if available
        await analyzeFoodImage(compressedImage, description);
      } catch (error) {
        console.error('Error processing image:', error);
        setSaveStatus({ type: 'error', message: error.message });
      }
    }
  };

  const handleCameraCapture = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setSaveStatus({ type: '', message: 'Processing image...' });
        const compressedImage = await compressImage(file);
        setImageData(compressedImage);
        setImagePreview(compressedImage);
        setSaveStatus({ type: 'success', message: 'Image ready!' });
        
        // Automatically analyze the image with description if available
        await analyzeFoodImage(compressedImage, description);
      } catch (error) {
        console.error('Error processing image:', error);
        setSaveStatus({ type: 'error', message: error.message });
      }
    }
  };

  const removeImage = () => {
    setImageData(null);
    setImagePreview(null);
    setNutritionData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleEditEntry = (entry) => {
    setViewMode(false);
    setViewingEntry(null);
    setEditingEntry(entry);
    setMealType(entry.meal_type);
    setDescription(entry.description);
    setImageData(entry.image_data);
    setImagePreview(entry.image_data);
    setEntryDate(entry.entry_date || '');
    setEntryTime(entry.entry_time || '');
    
    // Load nutrition data if available
    if (entry.calories || entry.protein || entry.carbs || entry.fat) {
      setNutritionData({
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sodium: entry.sodium,
        sugar: entry.sugar,
        vitamin_a: entry.vitamin_a,
        vitamin_c: entry.vitamin_c,
        vitamin_d: entry.vitamin_d,
        calcium: entry.calcium,
        iron: entry.iron,
        potassium: entry.potassium,
        ai_analysis: entry.ai_analysis
      });
    }
    
    setShowModal(true);
  };

  const handleSaveEntry = async () => {
    if (!description.trim()) {
      setSaveStatus({ type: 'error', message: 'Please add a description' });
      return;
    }

    try {
      const entryData = {
        meal_type: mealType,
        description: description,
        image_data: imageData,
        entry_date: entryDate,
        entry_time: entryTime,
        ...(nutritionData && {
          calories: nutritionData.calories,
          protein: nutritionData.protein,
          carbs: nutritionData.carbs,
          fat: nutritionData.fat,
          fiber: nutritionData.fiber,
          sodium: nutritionData.sodium,
          sugar: nutritionData.sugar,
          vitamin_a: nutritionData.vitamin_a,
          vitamin_c: nutritionData.vitamin_c,
          vitamin_d: nutritionData.vitamin_d,
          calcium: nutritionData.calcium,
          iron: nutritionData.iron,
          potassium: nutritionData.potassium,
          ai_analysis: nutritionData.ai_analysis
        })
      };

      if (editingEntry) {
        // Update existing entry
        await axios.put(`${API}/nutrition/${editingEntry.id}`, entryData);
        setSaveStatus({ type: 'success', message: 'Nutrition entry updated!' });
      } else {
        // Create new entry
        await axios.post(`${API}/nutrition`, {
          athlete_id: athleteId,
          ...entryData
        });
        setSaveStatus({ type: 'success', message: 'Nutrition entry saved!' });
      }

      setShowModal(false);
      setViewMode(false);
      setViewingEntry(null);
      setEditingEntry(null);
      setDescription('');
      setMealType('breakfast');
      setImageData(null);
      setImagePreview(null);
      setEntryDate('');
      setEntryTime('');
      setNutritionData(null);
      await loadNutritionEntries();
    } catch (error) {
      console.error('Error saving nutrition entry:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save entry' });
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await axios.delete(`${API}/nutrition/${entryId}`);
      setSaveStatus({ type: 'success', message: 'Entry deleted' });
      await loadNutritionEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete entry' });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMealIcon = (type) => {
    const meal = mealTypes.find(m => m.value === type);
    return meal ? meal.icon : Utensils;
  };

  const getMealColor = (type) => {
    const colors = {
      breakfast: 'bg-orange-100 text-orange-700',
      lunch: 'bg-green-100 text-green-700',
      dinner: 'bg-blue-100 text-blue-700',
      snack: 'bg-purple-100 text-purple-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // Get start of current week (Monday)
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  // Get end of current week (Sunday)
  const getEndOfWeek = (date) => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
  };

  // Format date range for display
  const formatWeekRange = (weekStart) => {
    const weekEnd = getEndOfWeek(weekStart);
    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // Check if a date is in the current week
  const isCurrentWeek = (weekStart) => {
    const currentWeekStart = getStartOfWeek(new Date());
    return weekStart.toDateString() === currentWeekStart.toDateString();
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const currentStart = selectedWeekStart || getStartOfWeek(new Date());
    const previousWeek = new Date(currentStart);
    previousWeek.setDate(previousWeek.getDate() - 7);
    setSelectedWeekStart(previousWeek);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const currentStart = selectedWeekStart || getStartOfWeek(new Date());
    const nextWeek = new Date(currentStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setSelectedWeekStart(nextWeek);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setSelectedWeekStart(null); // null means current week
  };

  // Calculate daily average for a specific week
  const calculateWeeklyAverage = (entries, weekStartDate = null) => {
    if (!entries || entries.length === 0) {
      return {
        dailyAverage: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sodium: 0,
          sugar: 0,
          vitamin_a: 0,
          vitamin_c: 0,
          vitamin_d: 0,
          calcium: 0,
          iron: 0,
          potassium: 0
        },
        daysInWeek: 0
      };
    }

    // Use provided week or current week
    const targetWeekStart = weekStartDate || getStartOfWeek(new Date());
    const weekEnd = getEndOfWeek(targetWeekStart);
    const weekStart = new Date(targetWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    // Filter entries from the specified week
    const weekEntries = entries.filter(entry => {
      const entryDate = entry.entry_date 
        ? new Date(entry.entry_date) 
        : new Date(entry.created_at);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    if (weekEntries.length === 0) {
      return {
        dailyAverage: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sodium: 0,
          sugar: 0,
          vitamin_a: 0,
          vitamin_c: 0,
          vitamin_d: 0,
          calcium: 0,
          iron: 0,
          potassium: 0
        },
        daysInWeek: 0
      };
    }

    // Calculate unique days with entries in the specified week
    const uniqueDays = new Set(
      weekEntries.map(entry => {
        const date = entry.entry_date 
          ? new Date(entry.entry_date) 
          : new Date(entry.created_at);
        return date.toDateString();
      })
    ).size;

    // Sum all nutrients for the week
    const totals = weekEntries.reduce((acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      protein: acc.protein + (entry.protein || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      fat: acc.fat + (entry.fat || 0),
      fiber: acc.fiber + (entry.fiber || 0),
      sodium: acc.sodium + (entry.sodium || 0),
      sugar: acc.sugar + (entry.sugar || 0),
      vitamin_a: acc.vitamin_a + (entry.vitamin_a || 0),
      vitamin_c: acc.vitamin_c + (entry.vitamin_c || 0),
      vitamin_d: acc.vitamin_d + (entry.vitamin_d || 0),
      calcium: acc.calcium + (entry.calcium || 0),
      iron: acc.iron + (entry.iron || 0),
      potassium: acc.potassium + (entry.potassium || 0)
    }), {
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
      sodium: 0, sugar: 0, vitamin_a: 0, vitamin_c: 0, vitamin_d: 0,
      calcium: 0, iron: 0, potassium: 0
    });

    // Calculate daily averages
    const dailyAverage = {
      calories: uniqueDays > 0 ? Math.round(totals.calories / uniqueDays) : 0,
      protein: uniqueDays > 0 ? Math.round(totals.protein / uniqueDays) : 0,
      carbs: uniqueDays > 0 ? Math.round(totals.carbs / uniqueDays) : 0,
      fat: uniqueDays > 0 ? Math.round(totals.fat / uniqueDays) : 0,
      fiber: uniqueDays > 0 ? Math.round(totals.fiber / uniqueDays) : 0,
      sodium: uniqueDays > 0 ? Math.round(totals.sodium / uniqueDays) : 0,
      sugar: uniqueDays > 0 ? Math.round(totals.sugar / uniqueDays) : 0,
      vitamin_a: uniqueDays > 0 ? Math.round(totals.vitamin_a / uniqueDays) : 0,
      vitamin_c: uniqueDays > 0 ? Math.round(totals.vitamin_c / uniqueDays) : 0,
      vitamin_d: uniqueDays > 0 ? Math.round(totals.vitamin_d / uniqueDays) : 0,
      calcium: uniqueDays > 0 ? Math.round(totals.calcium / uniqueDays) : 0,
      iron: uniqueDays > 0 ? Math.round(totals.iron / uniqueDays) : 0,
      potassium: uniqueDays > 0 ? Math.round(totals.potassium / uniqueDays) : 0
    };

    return {
      dailyAverage,
      daysInWeek: uniqueDays
    };
  };

  const weekStats = calculateWeeklyAverage(entries, selectedWeekStart);
  const currentWeekStart = selectedWeekStart || getStartOfWeek(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nutrition Log</h1>
          <p className="text-gray-600 mt-1">Track what you eat and drink</p>
        </div>
        <Button onClick={openNewEntryModal}>
          <Plus className="w-4 h-4 mr-2" />
          Log Meal
        </Button>
      </div>

      {/* Status Messages */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Daily Average Statistics - Current Week */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">Daily Average</CardTitle>
                <CardDescription>
                  {weekStats.daysInWeek > 0 
                    ? `${weekStats.daysInWeek} day${weekStats.daysInWeek > 1 ? 's' : ''} tracked`
                    : 'No entries this week'}
                </CardDescription>
              </div>
              
              {/* Week Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {!isCurrentWeek(currentWeekStart) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToCurrentWeek}
                    className="h-8 px-2 text-xs"
                  >
                    Today
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextWeek}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Week Range Display */}
            <div className="mt-2">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                {formatWeekRange(currentWeekStart)}
                {isCurrentWeek(currentWeekStart) && (
                  <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current Week</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Calories */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Calories</div>
              <div className="text-3xl font-bold text-blue-600">{weekStats.dailyAverage.calories}</div>
              <div className="text-xs text-gray-500">per day</div>
            </div>

            {/* Macronutrients */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Macronutrients</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Protein</div>
                  <div className="text-2xl font-bold text-orange-600">{weekStats.dailyAverage.protein}g</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Carbs</div>
                  <div className="text-2xl font-bold text-green-600">{weekStats.dailyAverage.carbs}g</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Fat</div>
                  <div className="text-2xl font-bold text-purple-600">{weekStats.dailyAverage.fat}g</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Fiber</div>
                  <div className="text-2xl font-bold text-amber-600">{weekStats.dailyAverage.fiber}g</div>
                </div>
              </div>
            </div>

            {/* Micronutrients */}
            {(weekStats.dailyAverage.sodium > 0 || weekStats.dailyAverage.sugar > 0 || 
              weekStats.dailyAverage.vitamin_a > 0 || weekStats.dailyAverage.vitamin_c > 0 || 
              weekStats.dailyAverage.vitamin_d > 0 || weekStats.dailyAverage.calcium > 0 || 
              weekStats.dailyAverage.iron > 0 || weekStats.dailyAverage.potassium > 0) && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Micronutrients</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {weekStats.dailyAverage.sugar > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Sugar</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.sugar}g</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.sodium > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Sodium</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.sodium}mg</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.vitamin_a > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Vitamin A</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.vitamin_a}μg</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.vitamin_c > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Vitamin C</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.vitamin_c}mg</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.vitamin_d > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Vitamin D</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.vitamin_d}μg</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.calcium > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Calcium</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.calcium}mg</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.iron > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Iron</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.iron}mg</div>
                    </div>
                  )}
                  {weekStats.dailyAverage.potassium > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Potassium</div>
                      <div className="text-lg font-semibold text-gray-900">{weekStats.dailyAverage.potassium}mg</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Nutrition Entries List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No nutrition entries yet</h3>
            <p className="text-gray-600 mb-4">Start tracking your meals and drinks</p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Log First Meal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => {
            const MealIcon = getMealIcon(entry.meal_type);
            return (
              <Card key={entry.id} className="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer">
                {entry.image_data && (
                  <div 
                    className="relative h-48 bg-gray-100"
                    onClick={() => handleViewEntry(entry)}
                  >
                    <img
                      src={entry.image_data}
                      alt="Food"
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <CardHeader onClick={() => handleViewEntry(entry)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getMealColor(entry.meal_type)}>
                          <MealIcon className="w-3 h-3 mr-1" />
                          {entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1)}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDateTime(entry.entry_date || entry.created_at, entry.entry_time)}
                      </span>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent onClick={() => handleViewEntry(entry)}>
                  <p className="text-gray-700 whitespace-pre-wrap mb-3">{entry.description}</p>
                  
                  {/* Nutritional Information */}
                  {entry.calories > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-600">Calories</div>
                          <div className="text-lg font-bold text-blue-600">{entry.calories}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-600">Protein</div>
                          <div className="text-lg font-bold text-green-600">{entry.protein}g</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-600">Carbs</div>
                          <div className="text-lg font-bold text-orange-600">{entry.carbs}g</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-600">Fat</div>
                          <div className="text-lg font-bold text-purple-600">{entry.fat}g</div>
                        </div>
                      </div>
                      
                      {/* Micronutrients - Show if any are present */}
                      {(entry.fiber || entry.sodium || entry.sugar || entry.vitamin_a || entry.vitamin_c || entry.vitamin_d || entry.calcium || entry.iron || entry.potassium) && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Micronutrients</div>
                          <div className="grid grid-cols-3 gap-2">
                            {entry.fiber > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Fiber</div>
                                <div className="text-sm font-semibold">{entry.fiber}g</div>
                              </div>
                            )}
                            {entry.sugar > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Sugar</div>
                                <div className="text-sm font-semibold">{entry.sugar}g</div>
                              </div>
                            )}
                            {entry.sodium > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Sodium</div>
                                <div className="text-sm font-semibold">{entry.sodium}mg</div>
                              </div>
                            )}
                            {entry.vitamin_a > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Vit A</div>
                                <div className="text-sm font-semibold">{entry.vitamin_a}μg</div>
                              </div>
                            )}
                            {entry.vitamin_c > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Vit C</div>
                                <div className="text-sm font-semibold">{entry.vitamin_c}mg</div>
                              </div>
                            )}
                            {entry.vitamin_d > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Vit D</div>
                                <div className="text-sm font-semibold">{entry.vitamin_d}μg</div>
                              </div>
                            )}
                            {entry.calcium > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Calcium</div>
                                <div className="text-sm font-semibold">{entry.calcium}mg</div>
                              </div>
                            )}
                            {entry.iron > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Iron</div>
                                <div className="text-sm font-semibold">{entry.iron}mg</div>
                              </div>
                            )}
                            {entry.potassium > 0 && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">Potassium</div>
                                <div className="text-sm font-semibold">{entry.potassium}mg</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {entry.ai_analysis && (
                        <p className="text-xs text-gray-500 italic mt-2">AI: {entry.ai_analysis}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Nutrition Entry Modal - View or Edit Mode */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {viewMode ? 'Meal Details' : (editingEntry ? 'Edit Meal or Drink' : 'Log Meal or Drink')}
                </CardTitle>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setViewMode(false);
                    setViewingEntry(null);
                    setEditingEntry(null);
                    setDescription('');
                    setMealType('breakfast');
                    setEntryDate('');
                    setEntryTime('');
                    removeImage();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CardDescription>
                {viewMode ? 'View your meal or drink details' : (editingEntry ? 'Update your meal or drink entry' : 'Add what you ate or drank')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* VIEW MODE - Read Only */}
              {viewMode && viewingEntry && (
                <div className="space-y-4">
                  {/* Image */}
                  {viewingEntry.image_data && (
                    <div 
                      className="relative h-64 bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedImage(viewingEntry.image_data);
                        setShowImageModal(true);
                      }}
                    >
                      <img
                        src={viewingEntry.image_data}
                        alt="Food"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Meal Type Badge */}
                  <div>
                    <Badge className={`${getMealColor(viewingEntry.meal_type)} text-lg px-3 py-1`}>
                      {React.createElement(getMealIcon(viewingEntry.meal_type), { className: 'w-4 h-4 mr-2 inline' })}
                      {viewingEntry.meal_type.charAt(0).toUpperCase() + viewingEntry.meal_type.slice(1)}
                    </Badge>
                  </div>
                  
                  {/* Date and Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                    <p className="text-gray-900">{formatDateTime(viewingEntry.entry_date || viewingEntry.created_at, viewingEntry.entry_time)}</p>
                  </div>
                  
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{viewingEntry.description}</p>
                  </div>
                  
                  {/* Nutritional Information */}
                  {viewingEntry.calories > 0 && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Nutritional Information</h4>
                      
                      {/* Macronutrients */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                          <div className="text-xs text-gray-600 mb-1">Calories</div>
                          <div className="text-xl font-bold text-blue-600">{viewingEntry.calories}</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                          <div className="text-xs text-gray-600 mb-1">Protein</div>
                          <div className="text-xl font-bold text-green-600">{viewingEntry.protein}g</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                          <div className="text-xs text-gray-600 mb-1">Carbs</div>
                          <div className="text-xl font-bold text-orange-600">{viewingEntry.carbs}g</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                          <div className="text-xs text-gray-600 mb-1">Fat</div>
                          <div className="text-xl font-bold text-purple-600">{viewingEntry.fat}g</div>
                        </div>
                      </div>
                      
                      {/* Micronutrients */}
                      {(viewingEntry.fiber > 0 || viewingEntry.sodium > 0 || viewingEntry.sugar > 0 || 
                        viewingEntry.vitamin_a > 0 || viewingEntry.vitamin_c > 0 || viewingEntry.vitamin_d > 0 || 
                        viewingEntry.calcium > 0 || viewingEntry.iron > 0 || viewingEntry.potassium > 0) && (
                        <div className="pt-3 border-t border-blue-200">
                          <h5 className="text-sm font-semibold text-gray-800 mb-2">Micronutrients</h5>
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <ul className="space-y-1 text-sm">
                              {viewingEntry.fiber > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Fiber:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.fiber}g</span>
                                </li>
                              )}
                              {viewingEntry.sugar > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Sugar:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.sugar}g</span>
                                </li>
                              )}
                              {viewingEntry.sodium > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Sodium:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.sodium}mg</span>
                                </li>
                              )}
                              {viewingEntry.vitamin_a > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Vitamin A:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.vitamin_a}μg</span>
                                </li>
                              )}
                              {viewingEntry.vitamin_c > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Vitamin C:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.vitamin_c}mg</span>
                                </li>
                              )}
                              {viewingEntry.vitamin_d > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Vitamin D:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.vitamin_d}μg</span>
                                </li>
                              )}
                              {viewingEntry.calcium > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Calcium:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.calcium}mg</span>
                                </li>
                              )}
                              {viewingEntry.iron > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Iron:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.iron}mg</span>
                                </li>
                              )}
                              {viewingEntry.potassium > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Potassium:</span>
                                  <span className="font-medium text-gray-900">{viewingEntry.potassium}mg</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {/* AI Analysis */}
                      {viewingEntry.ai_analysis && (
                        <p className="text-xs text-gray-500 italic mt-3">AI: {viewingEntry.ai_analysis}</p>
                      )}
                    </div>
                  )}
                  
                  {/* View Mode Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowModal(false);
                        setViewMode(false);
                        setViewingEntry(null);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={switchToEditMode}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowModal(false);
                        setViewMode(false);
                        setViewingEntry(null);
                        handleDeleteEntry(viewingEntry.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
              
              {/* EDIT MODE - Form for creating/editing */}
              {!viewMode && (
                <div className="space-y-4">
              {/* Meal Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meal Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {mealTypes.map((meal) => {
                    const Icon = meal.icon;
                    return (
                      <button
                        key={meal.value}
                        onClick={() => setMealType(meal.value)}
                        className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                          mealType === meal.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-1 ${
                          mealType === meal.value ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                        <span className={`text-sm font-medium ${
                          mealType === meal.value ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {meal.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date and Time */}
              {!viewMode && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you have? (e.g., Oatmeal with berries, Chicken salad)"
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Image Upload/Camera */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Photo (Optional)
                </label>
                
                {!imagePreview ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 text-center">
                      Images automatically compressed • JPG, PNG, WEBP
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={() => analyzeFoodImage(imageData, description)}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Nutrition with AI'}
                    </Button>
                  </div>
                )}
              </div>

              {/* AI Nutritional Analysis */}
              {isAnalyzing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-600 font-medium">Analyzing food image...</span>
                  </div>
                </div>
              )}
              
              {nutritionData && nutritionData.calories > 0 && !isAnalyzing && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">AI Nutritional Analysis</h4>
                      {nutritionData.ai_analysis && (
                        <p className="text-xs text-gray-600 mt-1">{nutritionData.ai_analysis}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">Calories</div>
                      <div className="text-xl font-bold text-blue-600">{nutritionData.calories}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">Protein</div>
                      <div className="text-xl font-bold text-green-600">{nutritionData.protein}g</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">Carbs</div>
                      <div className="text-xl font-bold text-orange-600">{nutritionData.carbs}g</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <div className="text-xs text-gray-600 mb-1">Fat</div>
                      <div className="text-xl font-bold text-purple-600">{nutritionData.fat}g</div>
                    </div>
                  </div>
                  
                  {/* Micronutrients Simplified List */}
                  {(nutritionData.fiber > 0 || nutritionData.sodium > 0 || nutritionData.sugar > 0 || 
                    nutritionData.vitamin_a > 0 || nutritionData.vitamin_c > 0 || nutritionData.vitamin_d > 0 || 
                    nutritionData.calcium > 0 || nutritionData.iron > 0 || nutritionData.potassium > 0) && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <h5 className="text-sm font-semibold text-gray-800 mb-2">Micronutrients</h5>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <ul className="space-y-1 text-sm">
                          {nutritionData.fiber > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Fiber:</span>
                              <span className="font-medium text-gray-900">{nutritionData.fiber}g</span>
                            </li>
                          )}
                          {nutritionData.sugar > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Sugar:</span>
                              <span className="font-medium text-gray-900">{nutritionData.sugar}g</span>
                            </li>
                          )}
                          {nutritionData.sodium > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Sodium:</span>
                              <span className="font-medium text-gray-900">{nutritionData.sodium}mg</span>
                            </li>
                          )}
                          {nutritionData.vitamin_a > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Vitamin A:</span>
                              <span className="font-medium text-gray-900">{nutritionData.vitamin_a}μg</span>
                            </li>
                          )}
                          {nutritionData.vitamin_c > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Vitamin C:</span>
                              <span className="font-medium text-gray-900">{nutritionData.vitamin_c}mg</span>
                            </li>
                          )}
                          {nutritionData.vitamin_d > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Vitamin D:</span>
                              <span className="font-medium text-gray-900">{nutritionData.vitamin_d}μg</span>
                            </li>
                          )}
                          {nutritionData.calcium > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Calcium:</span>
                              <span className="font-medium text-gray-900">{nutritionData.calcium}mg</span>
                            </li>
                          )}
                          {nutritionData.iron > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Iron:</span>
                              <span className="font-medium text-gray-900">{nutritionData.iron}mg</span>
                            </li>
                          )}
                          {nutritionData.potassium > 0 && (
                            <li className="flex justify-between">
                              <span className="text-gray-600">Potassium:</span>
                              <span className="font-medium text-gray-900">{nutritionData.potassium}mg</span>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false);
                    setViewMode(false);
                    setViewingEntry(null);
                    setEditingEntry(null);
                    setDescription('');
                    setMealType('breakfast');
                    setEntryDate('');
                    setEntryTime('');
                    removeImage();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveEntry}
                  disabled={!description.trim()}
                >
                  {editingEntry ? 'Update Entry' : 'Save Entry'}
                </Button>
              </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-[70] flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Nutrition;
