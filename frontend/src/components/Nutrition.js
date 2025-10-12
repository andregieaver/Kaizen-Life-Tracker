import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Camera, Upload, Trash2, Edit3, Utensils, Coffee, UtensilsCrossed, Apple, X, ImageIcon } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const Nutrition = ({ athleteId }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [mealType, setMealType] = useState('breakfast');
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [captureMethod, setCaptureMethod] = useState('upload'); // 'upload' or 'camera'
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
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
  }, [athleteId]);

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

  const analyzeFoodImage = async (imageData) => {
    try {
      setIsAnalyzing(true);
      setSaveStatus({ type: '', message: 'Analyzing food image with AI...' });
      
      const response = await axios.post(`${API}/nutrition/analyze-image/${athleteId}`, {
        image_data: imageData
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
        
        // Automatically analyze the image
        await analyzeFoodImage(compressedImage);
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
        
        // Automatically analyze the image
        await analyzeFoodImage(compressedImage);
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
    setEditingEntry(entry);
    setMealType(entry.meal_type);
    setDescription(entry.description);
    setImageData(entry.image_data);
    setImagePreview(entry.image_data);
    
    // Load nutrition data if available
    if (entry.calories || entry.protein || entry.carbs || entry.fat) {
      setNutritionData({
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
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
        ...(nutritionData && {
          calories: nutritionData.calories,
          protein: nutritionData.protein,
          carbs: nutritionData.carbs,
          fat: nutritionData.fat,
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
      setEditingEntry(null);
      setDescription('');
      setMealType('breakfast');
      setImageData(null);
      setImagePreview(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nutrition Log</h1>
          <p className="text-gray-600 mt-1">Track what you eat and drink</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
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
              <Card key={entry.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {entry.image_data && (
                  <div 
                    className="relative h-48 bg-gray-100 cursor-pointer"
                    onClick={() => {
                      setSelectedImage(entry.image_data);
                      setShowImageModal(true);
                    }}
                  >
                    <img
                      src={entry.image_data}
                      alt="Food"
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getMealColor(entry.meal_type)}>
                          <MealIcon className="w-3 h-3 mr-1" />
                          {entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1)}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(entry.created_at)}</span>
                    </div>
                    <div className="flex gap-1">
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
                <CardContent>
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
                      {entry.ai_analysis && (
                        <p className="text-xs text-gray-500 italic">AI: {entry.ai_analysis}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingEntry ? 'Edit Meal or Drink' : 'Log Meal or Drink'}</CardTitle>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingEntry(null);
                    setDescription('');
                    setMealType('breakfast');
                    removeImage();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CardDescription>{editingEntry ? 'Update your meal or drink entry' : 'Add what you ate or drank'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEntry(null);
                    setDescription('');
                    setMealType('breakfast');
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
