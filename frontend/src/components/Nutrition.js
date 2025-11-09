import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Camera, Upload, Trash2, Edit3, Utensils, Coffee, UtensilsCrossed, Apple, X, ImageIcon, ChevronLeft, ChevronRight, Pill, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [supplements, setSupplements] = useState([]);
  const [selectedSupplements, setSelectedSupplements] = useState([]);
  const [supplementLogs, setSupplementLogs] = useState([]);
  const [supplementLogDate, setSupplementLogDate] = useState('');
  const [supplementLogTime, setSupplementLogTime] = useState('');
  const [supplementNotes, setSupplementNotes] = useState('');
  const [expandedMacros, setExpandedMacros] = useState({});
  const [expandedMicros, setExpandedMicros] = useState({});
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const mealTypes = [
    { value: 'breakfast', label: t('nutrition.mealTypes.breakfast'), icon: Coffee },
    { value: 'lunch', label: t('nutrition.mealTypes.lunch'), icon: Utensils },
    { value: 'dinner', label: t('nutrition.mealTypes.dinner'), icon: UtensilsCrossed },
    { value: 'snack', label: t('nutrition.mealTypes.snack'), icon: Apple }
  ];

  useEffect(() => {
    loadNutritionEntries();
    loadAthleteData();
    loadSupplements();
    loadSupplementLogs();
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

  const loadSupplements = async () => {
    try {
      const response = await axios.get(`${API}/supplements/${athleteId}`);
      setSupplements(response.data.supplements || []);
    } catch (error) {
      console.error('Error loading supplements:', error);
    }
  };

  const loadSupplementLogs = async () => {
    try {
      const response = await axios.get(`${API}/supplement-logs/${athleteId}`);
      setSupplementLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error loading supplement logs:', error);
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

  const openSupplementModal = () => {
    const { date, time } = getCurrentDateTime();
    setSelectedSupplements([]);
    setSupplementLogDate(date);
    setSupplementLogTime(time);
    setSupplementNotes('');
    setShowSupplementModal(true);
  };

  const handleSupplementToggle = (supplementId) => {
    setSelectedSupplements(prev => {
      if (prev.includes(supplementId)) {
        return prev.filter(id => id !== supplementId);
      } else {
        return [...prev, supplementId];
      }
    });
  };

  const handleSaveSupplementLog = async () => {
    if (selectedSupplements.length === 0) {
      setSaveStatus({ type: 'error', message: 'Please select at least one supplement' });
      return;
    }

    try {
      await axios.post(`${API}/supplement-logs`, {
        athlete_id: athleteId,
        supplement_ids: selectedSupplements,
        log_date: supplementLogDate,
        log_time: supplementLogTime,
        notes: supplementNotes
      });

      setSaveStatus({ type: 'success', message: 'Supplements logged successfully!' });
      setShowSupplementModal(false);
      await loadSupplementLogs();
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error saving supplement log:', error);
      setSaveStatus({ type: 'error', message: 'Failed to log supplements' });
    }
  };

  // Get supplements logged on the same day as a meal entry
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

  // Day navigation functions
  const goToPreviousDay = () => {
    const currentDay = selectedDay || new Date();
    const previousDay = new Date(currentDay);
    previousDay.setDate(previousDay.getDate() - 1);
    setSelectedDay(previousDay);
  };

  const goToNextDay = () => {
    const currentDay = selectedDay || new Date();
    const nextDay = new Date(currentDay);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDay(nextDay);
  };

  const goToToday = () => {
    setSelectedDay(null); // null means today
  };

  const isToday = (day) => {
    const today = new Date();
    const compareDay = day || today;
    return compareDay.toDateString() === today.toDateString();
  };

  const formatDayDisplay = (day) => {
    const displayDay = day || new Date();
    return displayDay.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calculate stats for a single day (includes supplement logs for count)
  const calculateDailyStats = (entries, supplementLogs, targetDay = null) => {
    if (!entries || entries.length === 0) {
      return {
        totals: {
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
        entryCount: 0
      };
    }

    const selectedDate = targetDay || new Date();
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Filter entries from the specified day
    const dayEntries = entries.filter(entry => {
      const entryDate = entry.entry_date 
        ? new Date(entry.entry_date) 
        : new Date(entry.created_at);
      return entryDate >= dayStart && entryDate <= dayEnd;
    });

    // Filter supplement logs from the specified day
    const daySupplements = (supplementLogs || []).filter(log => {
      const logDate = new Date(log.log_date);
      return logDate >= dayStart && logDate <= dayEnd;
    });

    if (dayEntries.length === 0) {
      return {
        totals: {
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
        entryCount: daySupplements.length // Count supplements even if no meals
      };
    }

    // Sum all nutrients for the day (only from meal entries)
    const totals = dayEntries.reduce((acc, entry) => ({
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

    return {
      totals,
      entryCount: dayEntries.length + daySupplements.length
    };
  };

  // Calculate daily average for a specific week (includes supplement logs for count)
  const calculateWeeklyAverage = (entries, supplementLogs, weekStartDate = null) => {
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

    // Filter supplement logs from the specified week
    const weekSupplements = (supplementLogs || []).filter(log => {
      const logDate = new Date(log.log_date);
      return logDate >= weekStart && logDate <= weekEnd;
    });

    if (weekEntries.length === 0 && weekSupplements.length === 0) {
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

    // Calculate unique days with entries OR supplement logs in the specified week
    const uniqueDaysSet = new Set();
    
    weekEntries.forEach(entry => {
      const date = entry.entry_date 
        ? new Date(entry.entry_date) 
        : new Date(entry.created_at);
      uniqueDaysSet.add(date.toDateString());
    });
    
    weekSupplements.forEach(log => {
      const date = new Date(log.log_date);
      uniqueDaysSet.add(date.toDateString());
    });
    
    const uniqueDays = uniqueDaysSet.size;

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

  const weekStats = calculateWeeklyAverage(entries, supplementLogs, selectedWeekStart);
  const currentWeekStart = selectedWeekStart || getStartOfWeek(new Date());
  const dayStats = calculateDailyStats(entries, supplementLogs, selectedDay);
  const currentDay = selectedDay || new Date();

  // Filter entries based on view type
  const getFilteredEntries = () => {
    if (viewType === 'day') {
      // Show only entries from the selected day
      const dayStart = new Date(currentDay);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDay);
      dayEnd.setHours(23, 59, 59, 999);

      return entries.filter(entry => {
        const entryDate = entry.entry_date 
          ? new Date(entry.entry_date) 
          : new Date(entry.created_at);
        return entryDate >= dayStart && entryDate <= dayEnd;
      });
    } else {
      // Show only entries from the selected week
      const weekStart = new Date(currentWeekStart);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = getEndOfWeek(currentWeekStart);
      weekEnd.setHours(23, 59, 59, 999);

      return entries.filter(entry => {
        const entryDate = entry.entry_date 
          ? new Date(entry.entry_date) 
          : new Date(entry.created_at);
        return entryDate >= weekStart && entryDate <= weekEnd;
      });
    }
  };

  // Merge and filter entries based on view type
  const getFilteredEntriesWithSupplements = () => {
    let filteredMeals = [];
    let filteredSupplements = [];

    if (viewType === 'day') {
      // Show only entries from the selected day
      const dayStart = new Date(currentDay);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDay);
      dayEnd.setHours(23, 59, 59, 999);

      filteredMeals = entries.filter(entry => {
        const entryDate = entry.entry_date 
          ? new Date(entry.entry_date) 
          : new Date(entry.created_at);
        return entryDate >= dayStart && entryDate <= dayEnd;
      });

      filteredSupplements = supplementLogs.filter(log => {
        const logDate = new Date(log.log_date);
        return logDate >= dayStart && logDate <= dayEnd;
      });
    } else {
      // Show only entries from the selected week
      const weekStart = new Date(currentWeekStart);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = getEndOfWeek(currentWeekStart);
      weekEnd.setHours(23, 59, 59, 999);

      filteredMeals = entries.filter(entry => {
        const entryDate = entry.entry_date 
          ? new Date(entry.entry_date) 
          : new Date(entry.created_at);
        return entryDate >= weekStart && entryDate <= weekEnd;
      });

      filteredSupplements = supplementLogs.filter(log => {
        const logDate = new Date(log.log_date);
        return logDate >= weekStart && logDate <= weekEnd;
      });
    }

    // Combine and sort all entries by date and time
    const combined = [
      ...filteredMeals.map(entry => ({
        ...entry,
        type: 'meal',
        sortDate: entry.entry_date || entry.created_at,
        sortTime: entry.entry_time || new Date(entry.created_at).toTimeString().slice(0, 8)
      })),
      ...filteredSupplements.map(log => ({
        ...log,
        type: 'supplement',
        sortDate: log.log_date,
        sortTime: log.log_time
      }))
    ];

    // Sort by date and time
    combined.sort((a, b) => {
      const dateA = new Date(`${a.sortDate}T${a.sortTime}`);
      const dateB = new Date(`${b.sortDate}T${b.sortTime}`);
      return dateB - dateA; // Most recent first
    });

    return combined;
  };

  const filteredEntries = getFilteredEntriesWithSupplements();

  // Group entries by day for week view
  const groupEntriesByDay = (entries) => {
    const groups = {};
    entries.forEach(entry => {
      const date = entry.sortDate;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    });
    return groups;
  };

  const entriesByDay = viewType === 'week' ? groupEntriesByDay(filteredEntries) : {};

  return (
    <div className="min-h-screen p-2 md:p-6 space-y-6" style={{ background: 'var(--grad-page)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Nutrition Log</h1>
          <p className="text-gray-300 mt-1">{t('nutrition.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={openSupplementModal} 
            className="flex-1 sm:flex-none text-white border-0"
            style={{ backgroundColor: '#32D3FF' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
          >
            <Pill className="w-4 h-4 mr-2" />
            {t('nutrition.logSupplements')}
          </Button>
          <Button 
            onClick={openNewEntryModal} 
            className="flex-1 sm:flex-none text-white border-0"
            style={{ backgroundColor: '#32D3FF' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('nutrition.logMeal')}
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Nutrition Statistics - Day/Week View */}
      {entries.length > 0 && (
        <div className="bg-gradient-to-br from-gray-600 to-gray-800 border-0" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* View Type Toggle and Navigation */}
            <div className="flex flex-col gap-4">
              {/* Title and Description */}
              <div className="flex-1">
                <h3 className="text-lg text-white" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                  {viewType === 'week' ? 'Daily Average' : 'Day Total'}
                </h3>
                <p className="text-gray-300" style={{ color: 'var(--text-med)' }}>
                  {viewType === 'week' 
                    ? (weekStats.daysInWeek > 0 
                        ? `${weekStats.daysInWeek} day${weekStats.daysInWeek > 1 ? 's' : ''} tracked`
                        : 'No entries this week')
                    : (dayStats.entryCount > 0
                        ? `${dayStats.entryCount} entr${dayStats.entryCount > 1 ? 'ies' : 'y'} logged`
                        : 'No entries this day')
                  }
                </p>
              </div>

              {/* Toggle and Navigation Controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Day/Week Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setViewType('day')}
                    className={`h-8 px-3 text-xs border-0 ${
                      viewType === 'day' 
                        ? 'text-white' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                    style={viewType === 'day' ? { backgroundColor: '#32D3FF' } : {}}
                    onMouseEnter={(e) => {
                      if (viewType === 'day') {
                        e.currentTarget.style.backgroundColor = '#1FC1FF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (viewType === 'day') {
                        e.currentTarget.style.backgroundColor = '#32D3FF';
                      }
                    }}
                  >
                    {t('nutrition.day')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setViewType('week')}
                    className={`h-8 px-3 text-xs border-0 ${
                      viewType === 'week' 
                        ? 'text-white' 
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                    style={viewType === 'week' ? { backgroundColor: '#32D3FF' } : {}}
                    onMouseEnter={(e) => {
                      if (viewType === 'week') {
                        e.currentTarget.style.backgroundColor = '#1FC1FF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (viewType === 'week') {
                        e.currentTarget.style.backgroundColor = '#32D3FF';
                      }
                    }}
                  >
                    {t('nutrition.week')}
                  </Button>
                </div>
                
                {/* Navigation Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={viewType === 'week' ? goToPreviousWeek : goToPreviousDay}
                    className="h-8 w-8 p-0 bg-gray-700 text-white border-0 hover:bg-gray-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {viewType === 'week' ? (
                    !isCurrentWeek(currentWeekStart) && (
                      <Button
                        size="sm"
                        onClick={goToCurrentWeek}
                        className="h-8 px-2 text-xs bg-gray-700 text-white border-0 hover:bg-gray-600"
                      >
                        Today
                      </Button>
                    )
                  ) : (
                    !isToday(currentDay) && (
                      <Button
                        size="sm"
                        onClick={goToToday}
                        className="h-8 px-2 text-xs bg-gray-700 text-white border-0 hover:bg-gray-600"
                      >
                        Today
                      </Button>
                    )
                  )}
                  
                  <Button
                    size="sm"
                    onClick={viewType === 'week' ? goToNextWeek : goToNextDay}
                    className="h-8 w-8 p-0 bg-gray-700 text-white border-0 hover:bg-gray-600"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            
              {/* Date Range Display */}
              <div className="mt-2 -mx-6 px-6">
                <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm font-medium rounded-lg">
                  <span>{viewType === 'week' ? formatWeekRange(currentWeekStart) : formatDayDisplay(currentDay)}</span>
                  {viewType === 'week' && isCurrentWeek(currentWeekStart) && (
                    <span className="text-xs bg-gray-700 text-white px-2 py-0.5 rounded-full">Current Week</span>
                  )}
                  {viewType === 'day' && isToday(currentDay) && (
                    <span className="text-xs bg-gray-700 text-white px-2 py-0.5 rounded-full">Today</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="p-4" className="space-y-4">
            {/* Only show Calories and Macros if there are entries for the period */}
            {(() => {
              const hasEntries = viewType === 'week' 
                ? weekStats.daysInWeek > 0 
                : dayStats.totals.calories > 0 || dayStats.totals.protein > 0 || dayStats.totals.carbs > 0 || dayStats.totals.fat > 0;
              
              // Don't show anything if no entries - message is shown in entries section below
              if (!hasEntries) return null;
              
              return (
                <>
                  {/* Calories */}
                  <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-1">Calories</div>
                    <div className="text-3xl font-bold text-white">
                      {viewType === 'week' ? weekStats.dailyAverage.calories : dayStats.totals.calories}
                    </div>
                    <div className="text-xs text-gray-400">{viewType === 'week' ? 'per day' : 'total'}</div>
                  </div>

                  {/* Macronutrients */}
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">Macronutrients</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-300 mb-1">Protein</div>
                        <div className="text-2xl font-bold text-white">
                          {viewType === 'week' ? weekStats.dailyAverage.protein : dayStats.totals.protein}g
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-300 mb-1">Carbs</div>
                        <div className="text-2xl font-bold text-white">
                          {viewType === 'week' ? weekStats.dailyAverage.carbs : dayStats.totals.carbs}g
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-300 mb-1">Fat</div>
                        <div className="text-2xl font-bold text-white">
                          {viewType === 'week' ? weekStats.dailyAverage.fat : dayStats.totals.fat}g
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-300 mb-1">Fiber</div>
                        <div className="text-2xl font-bold text-white">
                          {viewType === 'week' ? weekStats.dailyAverage.fiber : dayStats.totals.fiber}g
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Micronutrients */}
            {((viewType === 'week' && (weekStats.dailyAverage.sodium > 0 || weekStats.dailyAverage.sugar > 0 || 
              weekStats.dailyAverage.vitamin_a > 0 || weekStats.dailyAverage.vitamin_c > 0 || 
              weekStats.dailyAverage.vitamin_d > 0 || weekStats.dailyAverage.calcium > 0 || 
              weekStats.dailyAverage.iron > 0 || weekStats.dailyAverage.potassium > 0)) ||
             (viewType === 'day' && (dayStats.totals.sodium > 0 || dayStats.totals.sugar > 0 || 
              dayStats.totals.vitamin_a > 0 || dayStats.totals.vitamin_c > 0 || 
              dayStats.totals.vitamin_d > 0 || dayStats.totals.calcium > 0 || 
              dayStats.totals.iron > 0 || dayStats.totals.potassium > 0))) && (
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-white mb-3">Micronutrients</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {((viewType === 'week' && weekStats.dailyAverage.sugar > 0) || (viewType === 'day' && dayStats.totals.sugar > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Sugar</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.sugar : dayStats.totals.sugar}g
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.sodium > 0) || (viewType === 'day' && dayStats.totals.sodium > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Sodium</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.sodium : dayStats.totals.sodium}mg
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.vitamin_a > 0) || (viewType === 'day' && dayStats.totals.vitamin_a > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Vitamin A</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.vitamin_a : dayStats.totals.vitamin_a}μg
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.vitamin_c > 0) || (viewType === 'day' && dayStats.totals.vitamin_c > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Vitamin C</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.vitamin_c : dayStats.totals.vitamin_c}mg
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.vitamin_d > 0) || (viewType === 'day' && dayStats.totals.vitamin_d > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Vitamin D</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.vitamin_d : dayStats.totals.vitamin_d}μg
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.calcium > 0) || (viewType === 'day' && dayStats.totals.calcium > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Calcium</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.calcium : dayStats.totals.calcium}mg
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.iron > 0) || (viewType === 'day' && dayStats.totals.iron > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Iron</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.iron : dayStats.totals.iron}mg
                      </div>
                    </div>
                  )}
                  {((viewType === 'week' && weekStats.dailyAverage.potassium > 0) || (viewType === 'day' && dayStats.totals.potassium > 0)) && (
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-300">Potassium</div>
                      <div className="text-lg font-semibold text-white">
                        {viewType === 'week' ? weekStats.dailyAverage.potassium : dayStats.totals.potassium}mg
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Supplements Summary */}
            {(() => {
              let filteredSupplementLogs = [];
              let hasSupplements = false;
              
              console.log('[Supplements Summary] Total supplement logs:', supplementLogs?.length || 0);
              console.log('[Supplements Summary] View type:', viewType);
              console.log('[Supplements Summary] Selected week start:', selectedWeekStart);
              console.log('[Supplements Summary] Selected day:', selectedDay);
              
              if (viewType === 'week') {
                const weekStart = new Date(selectedWeekStart);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                filteredSupplementLogs = (supplementLogs || []).filter(log => {
                  const logDate = new Date(log.log_date);
                  const matches = logDate >= weekStart && logDate <= weekEnd && log.supplement_ids && log.supplement_ids.length > 0;
                  if (matches) console.log('[Supplements Summary] Matched log:', log);
                  return matches;
                });
                hasSupplements = filteredSupplementLogs.length > 0;
                console.log('[Supplements Summary] Filtered supplements for week:', filteredSupplementLogs.length);
              } else if (viewType === 'day' && selectedDay) {
                filteredSupplementLogs = (supplementLogs || []).filter(log => {
                  const logDateStr = new Date(log.log_date).toDateString();
                  const selectedDateStr = selectedDay.toDateString();
                  const matches = logDateStr === selectedDateStr && log.supplement_ids && log.supplement_ids.length > 0;
                  if (matches) console.log('[Supplements Summary] Matched log:', log);
                  return matches;
                });
                hasSupplements = filteredSupplementLogs.length > 0;
                console.log('[Supplements Summary] Filtered supplements for day:', filteredSupplementLogs.length);
              }
              
              console.log('[Supplements Summary] Has supplements:', hasSupplements);
              
              // Show section if there are supplements
              if (!hasSupplements) return null;
              
              return (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Pill className="w-5 h-5 text-[#62D2C4]" />
                    <h4 className="text-sm font-semibold text-gray-700">Supplements Taken</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(() => {
                      // Group supplements by supplement name
                      const supplementSummary = {};
                      filteredSupplementLogs.forEach(log => {
                        if (log.supplement_ids && Array.isArray(log.supplement_ids)) {
                          // Join with supplements array to get details
                          const logSupplements = supplements.filter(s => log.supplement_ids.includes(s.id));
                          logSupplements.forEach(supp => {
                            if (supp && supp.name) {
                              const suppName = supp.name;
                              if (!supplementSummary[suppName]) {
                                supplementSummary[suppName] = {
                                  name: suppName,
                                  totalDosage: 0,
                                  unit: supp.unit || '',
                                  count: 0
                                };
                              }
                              supplementSummary[suppName].totalDosage += parseFloat(supp.dosage) || 0;
                              supplementSummary[suppName].count += 1;
                            }
                          });
                        }
                      });
                      
                      console.log('[Supplements Summary] Summary:', supplementSummary);
                      
                      return Object.values(supplementSummary).map((supp, idx) => (
                        <div key={idx} className="bg-gradient-to-br from-[#D4F0E9] to-[#b8e6db] rounded-lg p-3 border border-[#62D2C4]/20">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 text-sm">{supp.name}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {viewType === 'week' && `${supp.count} time${supp.count > 1 ? 's' : ''} this week`}
                                {viewType === 'day' && `${supp.count} time${supp.count > 1 ? 's' : ''} today`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-[#62D2C4]">
                                {supp.totalDosage.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-600">{supp.unit}</div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Nutrition Entries List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading entries...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Utensils className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">{t('nutrition.noEntriesThisWeek')}</h3>
          <p className="text-gray-400 text-center">
            {t('nutrition.startTrackingMealsAndSupplements')}
          </p>
        </div>
      ) : viewType === 'week' ? (
        // Week view with day separators
        <div className="space-y-6">
          {Object.keys(entriesByDay).sort((a, b) => new Date(b) - new Date(a)).map(date => (
            <div key={date}>
              {/* Day Separator */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-white text-center">
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
              </div>
              
              {/* Entries for this day */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {entriesByDay[date].map((entry) => {
                  if (entry.type === 'supplement') {
                    // Render supplement log card
                    const logSupplements = supplements.filter(s => entry.supplement_ids.includes(s.id));
                    return (
                      <div key={entry.id} className="hover:shadow-lg transition-shadow border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
                        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                  <Pill className="w-3 h-3 mr-1" />
                                  Supplements
                                </Badge>
                              </div>
                              <h3 className="text-base text-white" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                                {new Date(`${entry.log_date}T${entry.log_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </h3>
                            </div>
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this supplement log?')) {
                                  axios.delete(`${API}/supplement-logs/${entry.id}`)
                                    .then(() => {
                                      setSaveStatus({ type: 'success', message: 'Supplement log deleted' });
                                      loadSupplementLogs();
                                    })
                                    .catch(err => console.error('Error deleting log:', err));
                                }
                              }}
                              className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="space-y-2">
                            {logSupplements.map(supp => (
                              <div key={supp.id} className="flex items-center gap-2 text-sm text-white">
                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                <span className="font-medium">{supp.name}</span>
                                <span className="text-gray-300">({supp.dosage} {supp.unit})</span>
                              </div>
                            ))}
                            {entry.notes && (
                              <p className="text-sm text-gray-300 mt-2 pt-2 border-t border-gray-700">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Render meal card
                    const MealIcon = getMealIcon(entry.meal_type);
                    return (
                      <div key={entry.id} className="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer border-0 shadow-lg rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
                        {entry.image_data && (
                          <div 
                            className="relative h-48 bg-gray-700"
                            onClick={() => handleViewEntry(entry)}
                          >
                            <img
                              src={entry.image_data}
                              alt="Food"
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                            />
                          </div>
                        )}
                        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }} onClick={() => handleViewEntry(entry)}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge className={getMealColor(entry.meal_type)}>
                                  <MealIcon className="w-3 h-3 mr-1" />
                                  {entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1)}
                                </Badge>
                              </div>
                              <h3 className="text-base line-clamp-2 text-white" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                                {entry.description || 'No description'}
                              </h3>
                              <p className="text-gray-300" style={{ color: 'var(--text-med)' }}>
                                {formatDateTime(entry.entry_date || entry.created_at, entry.entry_time)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntry(entry.id);
                              }}
                              className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4" onClick={() => handleViewEntry(entry)}>
                          {/* Calories Always Visible */}
                          {entry.calories > 0 && (
                            <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3 mb-3">
                              <div className="text-xs text-gray-300">Calories</div>
                              <div className="text-2xl font-bold text-white">{entry.calories}</div>
                            </div>
                          )}

                          {/* Macronutrients - Expandable */}
                          {(entry.protein > 0 || entry.carbs > 0 || entry.fat > 0 || entry.fiber > 0) && (
                            <div className="border-t border-gray-700 pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedMacros(prev => ({
                                    ...prev,
                                    [entry.id]: !prev[entry.id]
                                  }));
                                }}
                                className="w-full flex items-center justify-between p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <span className="text-sm font-semibold text-white">Macronutrients</span>
                                {expandedMacros[entry.id] ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              {expandedMacros[entry.id] && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {entry.protein > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Protein</div>
                                      <div className="text-lg font-semibold text-white">{entry.protein}g</div>
                                    </div>
                                  )}
                                  {entry.carbs > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Carbs</div>
                                      <div className="text-lg font-semibold text-white">{entry.carbs}g</div>
                                    </div>
                                  )}
                                  {entry.fat > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Fat</div>
                                      <div className="text-lg font-semibold text-white">{entry.fat}g</div>
                                    </div>
                                  )}
                                  {entry.fiber > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Fiber</div>
                                      <div className="text-lg font-semibold text-white">{entry.fiber}g</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Micronutrients - Expandable */}
                          {(entry.sugar > 0 || entry.sodium > 0 || entry.vitamin_a > 0 || entry.vitamin_c > 0 || 
                            entry.vitamin_d > 0 || entry.calcium > 0 || entry.iron > 0 || entry.potassium > 0) && (
                            <div className="border-t border-gray-700 pt-2 mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedMicros(prev => ({
                                    ...prev,
                                    [entry.id]: !prev[entry.id]
                                  }));
                                }}
                                className="w-full flex items-center justify-between p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <span className="text-sm font-semibold text-white">Micronutrients</span>
                                {expandedMicros[entry.id] ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              {expandedMicros[entry.id] && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {entry.fiber > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Fiber</div>
                                      <div className="text-sm font-semibold text-white">{entry.fiber}g</div>
                                    </div>
                                  )}
                                  {entry.sugar > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Sugar</div>
                                      <div className="text-sm font-semibold text-white">{entry.sugar}g</div>
                                    </div>
                                  )}
                                  {entry.sodium > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Sodium</div>
                                      <div className="text-sm font-semibold text-white">{entry.sodium}mg</div>
                                    </div>
                                  )}
                                  {entry.vitamin_a > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Vitamin A</div>
                                      <div className="text-sm font-semibold text-white">{entry.vitamin_a}μg</div>
                                    </div>
                                  )}
                                  {entry.vitamin_c > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Vitamin C</div>
                                      <div className="text-sm font-semibold text-white">{entry.vitamin_c}mg</div>
                                    </div>
                                  )}
                                  {entry.vitamin_d > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Vitamin D</div>
                                      <div className="text-sm font-semibold text-white">{entry.vitamin_d}μg</div>
                                    </div>
                                  )}
                                  {entry.calcium > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Calcium</div>
                                      <div className="text-sm font-semibold text-white">{entry.calcium}mg</div>
                                    </div>
                                  )}
                                  {entry.iron > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Iron</div>
                                      <div className="text-sm font-semibold text-white">{entry.iron}mg</div>
                                    </div>
                                  )}
                                  {entry.potassium > 0 && (
                                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-2">
                                      <div className="text-xs text-gray-300">Potassium</div>
                                      <div className="text-sm font-semibold text-white">{entry.potassium}mg</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Day view without separators
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => {
            if (entry.type === 'supplement') {
              // Render supplement log card
              const logSupplements = supplements.filter(s => entry.supplement_ids.includes(s.id));
              return (
                <div key={entry.id} className="hover:shadow-lg transition-shadow border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
                  <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                            <Pill className="w-3 h-3 mr-1" />
                            Supplements
                          </Badge>
                        </div>
                        <h3 className="text-base text-white" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                          {new Date(`${entry.log_date}T${entry.log_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h3>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this supplement log?')) {
                            axios.delete(`${API}/supplement-logs/${entry.id}`)
                              .then(() => {
                                setSaveStatus({ type: 'success', message: 'Supplement log deleted' });
                                loadSupplementLogs();
                              })
                              .catch(err => console.error('Error deleting log:', err));
                          }
                        }}
                        className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {logSupplements.map(supp => (
                        <div key={supp.id} className="flex items-center gap-2 text-sm text-white">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span className="font-medium">{supp.name}</span>
                          <span className="text-gray-300">({supp.dosage} {supp.unit})</span>
                        </div>
                      ))}
                      {entry.notes && (
                        <p className="text-sm text-gray-300 mt-2 pt-2 border-t border-gray-700">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              // Render meal card
              const MealIcon = getMealIcon(entry.meal_type);
            return (
              <div key={entry.id} className="hover:shadow-lg transition-shadow overflow-hidden cursor-pointer border-0 shadow-lg rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
                {entry.image_data && (
                  <div 
                    className="relative h-48 bg-gray-700"
                    onClick={() => handleViewEntry(entry)}
                  >
                    <img
                      src={entry.image_data}
                      alt="Food"
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }} onClick={() => handleViewEntry(entry)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getMealColor(entry.meal_type)}>
                          <MealIcon className="w-3 h-3 mr-1" />
                          {entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1)}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-300">
                        {formatDateTime(entry.entry_date || entry.created_at, entry.entry_time)}
                      </span>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="p-2 hover:bg-blue-900/30 rounded-lg transition-colors text-blue-400"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4" onClick={() => handleViewEntry(entry)}>
                  <p className="text-gray-700 whitespace-pre-wrap mb-3">{entry.description}</p>
                  
                  {/* Calories Always Visible */}
                  {entry.calories > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-3">
                      <div className="text-xs text-gray-500">Calories</div>
                      <div className="text-2xl font-bold text-blue-600">{entry.calories}</div>
                    </div>
                  )}

                  {/* Macronutrients - Expandable */}
                  {(entry.protein > 0 || entry.carbs > 0 || entry.fat > 0 || entry.fiber > 0) && (
                    <div className="border-t pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMacros(prev => ({
                            ...prev,
                            [entry.id]: !prev[entry.id]
                          }));
                        }}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span className="text-sm font-semibold text-gray-700">Macronutrients</span>
                        {expandedMacros[entry.id] ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      {expandedMacros[entry.id] && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {entry.protein > 0 && (
                            <div className="bg-orange-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">Protein</div>
                              <div className="text-lg font-semibold text-orange-600">{entry.protein}g</div>
                            </div>
                          )}
                          {entry.carbs > 0 && (
                            <div className="bg-green-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">Carbs</div>
                              <div className="text-lg font-semibold text-green-600">{entry.carbs}g</div>
                            </div>
                          )}
                          {entry.fat > 0 && (
                            <div className="bg-purple-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">Fat</div>
                              <div className="text-lg font-semibold text-purple-600">{entry.fat}g</div>
                            </div>
                          )}
                          {entry.fiber > 0 && (
                            <div className="bg-amber-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">Fiber</div>
                              <div className="text-lg font-semibold text-amber-600">{entry.fiber}g</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Micronutrients - Expandable */}
                  {(entry.sugar > 0 || entry.sodium > 0 || entry.vitamin_a > 0 || entry.vitamin_c > 0 || 
                    entry.vitamin_d > 0 || entry.calcium > 0 || entry.iron > 0 || entry.potassium > 0) && (
                    <div className="border-t pt-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMicros(prev => ({
                            ...prev,
                            [entry.id]: !prev[entry.id]
                          }));
                        }}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span className="text-sm font-semibold text-gray-700">{t('nutrition.micros.micronutrients')}</span>
                        {expandedMicros[entry.id] ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      {expandedMicros[entry.id] && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {entry.sugar > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.sugar')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.sugar}g</div>
                            </div>
                          )}
                          {entry.sodium > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.sodium')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.sodium}mg</div>
                            </div>
                          )}
                          {entry.vitamin_a > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.vitaminA')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.vitamin_a}μg</div>
                            </div>
                          )}
                          {entry.vitamin_c > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.vitaminC')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.vitamin_c}mg</div>
                            </div>
                          )}
                          {entry.vitamin_d > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.vitaminD')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.vitamin_d}μg</div>
                            </div>
                          )}
                          {entry.calcium > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.calcium')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.calcium}mg</div>
                            </div>
                          )}
                          {entry.iron > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">{t('nutrition.micros.iron')}</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.iron}mg</div>
                            </div>
                          )}
                          {entry.potassium > 0 && (
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-xs text-gray-500">Potassium</div>
                              <div className="text-sm font-semibold text-gray-900">{entry.potassium}mg</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
            }
          })}
        </div>
      )}

      {/* Nutrition Entry Modal - View or Edit Mode */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-2 md:p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none md:rounded-3xl border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                  {viewMode ? 'Meal Details' : (editingEntry ? 'Edit Meal or Drink' : t('nutrition.mealModal.title'))}
                </h3>
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
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-med)' }}>
                {viewMode ? 'View your meal or drink details' : (editingEntry ? 'Update your meal or drink entry' : 'Add what you ate or drank')}
              </p>
            </div>
            <div className="p-6 space-y-4">
              
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">Date & Time</label>
                    <p className="text-white">{formatDateTime(viewingEntry.entry_date || viewingEntry.created_at, viewingEntry.entry_time)}</p>
                  </div>
                  
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                    <p className="text-white whitespace-pre-wrap">{viewingEntry.description}</p>
                  </div>
                  
                  {/* Nutritional Information */}
                  {viewingEntry.calories > 0 && (
                    <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-3">Nutritional Information</h4>
                      
                      {/* Macronutrients */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-600">
                          <div className="text-xs text-gray-400 mb-1">Calories</div>
                          <div className="text-xl font-bold text-blue-400">{viewingEntry.calories}</div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-600">
                          <div className="text-xs text-gray-400 mb-1">Protein</div>
                          <div className="text-xl font-bold text-green-400">{viewingEntry.protein}g</div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-600">
                          <div className="text-xs text-gray-400 mb-1">Carbs</div>
                          <div className="text-xl font-bold text-orange-400">{viewingEntry.carbs}g</div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 text-center border border-gray-600">
                          <div className="text-xs text-gray-400 mb-1">Fat</div>
                          <div className="text-xl font-bold text-purple-400">{viewingEntry.fat}g</div>
                        </div>
                      </div>
                      
                      {/* Micronutrients */}
                      {(viewingEntry.fiber > 0 || viewingEntry.sodium > 0 || viewingEntry.sugar > 0 || 
                        viewingEntry.vitamin_a > 0 || viewingEntry.vitamin_c > 0 || viewingEntry.vitamin_d > 0 || 
                        viewingEntry.calcium > 0 || viewingEntry.iron > 0 || viewingEntry.potassium > 0) && (
                        <div className="pt-3 border-t border-gray-600">
                          <h5 className="text-sm font-semibold text-gray-300 mb-2">Micronutrients</h5>
                          <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                            <ul className="space-y-1 text-sm">
                              {viewingEntry.fiber > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Fiber:</span>
                                  <span className="font-medium text-white">{viewingEntry.fiber}g</span>
                                </li>
                              )}
                              {viewingEntry.sugar > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Sugar:</span>
                                  <span className="font-medium text-white">{viewingEntry.sugar}g</span>
                                </li>
                              )}
                              {viewingEntry.sodium > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Sodium:</span>
                                  <span className="font-medium text-white">{viewingEntry.sodium}mg</span>
                                </li>
                              )}
                              {viewingEntry.vitamin_a > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Vitamin A:</span>
                                  <span className="font-medium text-white">{viewingEntry.vitamin_a}μg</span>
                                </li>
                              )}
                              {viewingEntry.vitamin_c > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Vitamin C:</span>
                                  <span className="font-medium text-white">{viewingEntry.vitamin_c}mg</span>
                                </li>
                              )}
                              {viewingEntry.vitamin_d > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Vitamin D:</span>
                                  <span className="font-medium text-white">{viewingEntry.vitamin_d}μg</span>
                                </li>
                              )}
                              {viewingEntry.calcium > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Calcium:</span>
                                  <span className="font-medium text-white">{viewingEntry.calcium}mg</span>
                                </li>
                              )}
                              {viewingEntry.iron > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Iron:</span>
                                  <span className="font-medium text-white">{viewingEntry.iron}mg</span>
                                </li>
                              )}
                              {viewingEntry.potassium > 0 && (
                                <li className="flex justify-between">
                                  <span className="text-gray-400">Potassium:</span>
                                  <span className="font-medium text-white">{viewingEntry.potassium}mg</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {/* AI Analysis */}
                      {viewingEntry.ai_analysis && (
                        <p className="text-xs text-gray-400 italic mt-3">AI: {viewingEntry.ai_analysis}</p>
                      )}
                    </div>
                  )}
                  
                  {/* View Mode Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
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
                      className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
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
                  placeholder={t('placeholders.whatDidYouHave')}
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
            </div>
          </div>
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

      {/* Supplement Log Modal */}
      {showSupplementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 md:p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto relative z-50 rounded-none md:rounded-3xl border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('nutrition.supplementModal.title')}</h3>
                <button
                  onClick={() => setShowSupplementModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-med)' }}>
                {t('nutrition.supplementModal.subtitle')}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">{t('nutrition.supplementModal.date')}</label>
                  <input
                    type="date"
                    value={supplementLogDate}
                    onChange={(e) => setSupplementLogDate(e.target.value)}
                    className="w-full p-2 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">{t('nutrition.supplementModal.time')}</label>
                  <input
                    type="time"
                    value={supplementLogTime}
                    onChange={(e) => setSupplementLogTime(e.target.value)}
                    className="w-full p-2 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Supplements List */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">{t('nutrition.supplementModal.supplements')}</label>
                {supplements.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('nutrition.supplementModal.noSupplementsConfigured')}</p>
                    <p className="text-xs mt-1">{t('nutrition.supplementModal.goToSupplements')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-700">
                    {supplements.map((supplement) => (
                      <label
                        key={supplement.id}
                        className="flex items-start gap-3 p-2 hover:bg-gray-600 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSupplements.includes(supplement.id)}
                          onChange={() => handleSupplementToggle(supplement.id)}
                          className="mt-1 h-4 w-4 border-gray-500 rounded"
                          style={{ color: '#32D3FF' }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-white">{supplement.name}</div>
                          <div className="text-sm text-gray-400">
                            {supplement.dosage} {supplement.unit}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">{t('nutrition.supplementModal.notes')}</label>
                <textarea
                  value={supplementNotes}
                  onChange={(e) => setSupplementNotes(e.target.value)}
                  placeholder={t('placeholders.additionalNotes')}
                  className="w-full h-20 p-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                  onClick={() => setShowSupplementModal(false)}
                >
                  {t('nutrition.supplementModal.cancel')}
                </Button>
                <Button
                  className="flex-1 text-white border-0"
                  style={{ backgroundColor: '#32D3FF' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                  onClick={handleSaveSupplementLog}
                  disabled={selectedSupplements.length === 0}
                >
                  {t('nutrition.supplementModal.saveLog')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nutrition;
