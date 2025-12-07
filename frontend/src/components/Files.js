import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Camera, Upload, Trash2, Edit3, X, ImageIcon, ChevronLeft, ChevronRight, FileText, File, Image } from 'lucide-react';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

const Files = ({ athleteId }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [fileType, setFileType] = useState('document');
  const [description, setDescription] = useState('');
  const [fileData, setFileData] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [viewType, setViewType] = useState('week');
  const [selectedDay, setSelectedDay] = useState(null);
  
  const fileInputRef = useRef(null);

  const fileTypes = [
    { value: 'document', label: 'Document', icon: FileText },
    { value: 'image', label: 'Image', icon: Image },
    { value: 'file', label: 'Other File', icon: File }
  ];

  useEffect(() => {
    loadEntries();
    loadAthleteData();
  }, [athleteId]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'add') {
      setTimeout(() => {
        openNewEntryModal();
        window.history.replaceState({}, '', window.location.pathname);
      }, 300);
    }
  }, []);

  const loadAthleteData = async () => {
    try {
      const response = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(response.data);
    } catch (error) {
      logger.error(null, 'Error loading athlete data:', error);
    }
  };

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/files/${athleteId}`);
      setEntries(response.data.entries || []);
    } catch (error) {
      logger.error(null, 'Error loading file entries:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load file entries' });
    } finally {
      setIsLoading(false);
    }
  };

  const openNewEntryModal = () => {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const dateStr = localDate.toISOString().split('T')[0];
    const timeStr = localDate.toTimeString().slice(0, 5);

    setEntryDate(dateStr);
    setEntryTime(timeStr);
    setViewMode(false);
    setEditingEntry(null);
    setShowUploadForm(true);
  };

  const openViewEntryModal = (entry) => {
    setViewingEntry(entry);
    setViewMode(true);
    setShowUploadForm(true);
  };

  const handleEditEntry = () => {
    if (viewingEntry) {
      setEditingEntry(viewingEntry);
      setFileType(viewingEntry.file_type || 'document');
      setDescription(viewingEntry.description || '');
      setFileData(viewingEntry.file_data);
      setFilePreview(viewingEntry.file_data);
      setFileName(viewingEntry.file_name || '');
      setEntryDate(viewingEntry.entry_date || '');
      setEntryTime(viewingEntry.entry_time || '');
      setViewMode(false);
      setViewingEntry(null);
    }
  };

  const closeModals = () => {
    setShowUploadForm(false);
    setShowImageModal(false);
    setViewMode(false);
    setViewingEntry(null);
    setEditingEntry(null);
    setFileType('document');
    setDescription('');
    setFileData(null);
    setFilePreview(null);
    setFileName('');
    setEntryDate('');
    setEntryTime('');
    setSaveStatus({ type: '', message: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    
    // Critical: Prevent event propagation that might close the modal
    event.stopPropagation();
    
    if (!file) {
      logger.debug(null, 'No file selected');
      return;
    }
    
    logger.debug(null, 'File selected:', file.name, file.type, file.size);
    
    // Ensure modal stays open
    setShowUploadForm(true);
    
    // Set description if empty
    if (!description) {
      setDescription(file.name);
    }
    
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
      processImage(file);
    } else {
      processNonImageFile(file);
    }
  };

  const processImage = async (file) => {
    try {
      logger.debug(null, 'Processing image...');
      setSaveStatus({ type: '', message: 'Processing image...' });
      setShowUploadForm(true); // Keep modal open
      
      const compressedImage = await compressImage(file);
      
      logger.debug(null, 'Image compressed successfully');
      setFileData(compressedImage);
      setFilePreview(compressedImage);
      setFileName(file.name);
      setSaveStatus({ type: 'success', message: '✓ Image ready' });
      setShowUploadForm(true); // Ensure modal stays open
    } catch (error) {
      logger.error(null, 'Image processing error:', error);
      setSaveStatus({ type: 'error', message: error.message || 'Failed to process image' });
      setShowUploadForm(true); // Keep modal open even on error
    }
  };

  const processNonImageFile = (file) => {
    if (file.size > 10 * 1024 * 1024) {
      setSaveStatus({ type: 'error', message: 'File must be less than 10MB' });
      setShowUploadForm(true);
      return;
    }

    logger.debug(null, 'Processing non-image file...');
    setSaveStatus({ type: '', message: 'Loading file...' });
    setShowUploadForm(true); // Keep modal open
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      logger.debug(null, 'File loaded successfully');
      setFileData(e.target.result);
      setFilePreview(null);
      setFileName(file.name);
      setSaveStatus({ type: 'success', message: '✓ File ready' });
      setShowUploadForm(true); // Ensure modal stays open
    };
    
    reader.onerror = () => {
      logger.error(null, 'File reading error');
      setSaveStatus({ type: 'error', message: 'Failed to read file' });
      setShowUploadForm(true); // Keep modal open even on error
    };
    
    reader.readAsDataURL(file);
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
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

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          const estimatedSize = (width * height * 3) * 1.33;
          if (estimatedSize > 10 * 1024 * 1024) {
            quality = 0.6;
          } else if (estimatedSize > 5 * 1024 * 1024) {
            quality = 0.7;
          }

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          const finalSize = compressedDataUrl.length * 0.75;
          if (finalSize > 12 * 1024 * 1024) {
            reject(new Error('Image is too large even after compression.'));
            return;
          }

          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSaveEntry = async () => {
    if (!fileData) {
      setSaveStatus({ type: 'error', message: 'Please upload a file' });
      return;
    }

    if (!description.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter a description' });
      return;
    }

    try {
      setSaveStatus({ type: '', message: 'Saving...' });

      const entryData = {
        athlete_id: athleteId,
        file_type: fileType,
        description: description.trim(),
        file_data: fileData,
        file_name: fileName,
        entry_date: entryDate,
        entry_time: entryTime
      };

      if (editingEntry) {
        await axios.put(`${API}/files/${editingEntry.id}`, entryData);
        setSaveStatus({ type: 'success', message: 'File entry updated successfully!' });
      } else {
        await axios.post(`${API}/files/${athleteId}`, entryData);
        setSaveStatus({ type: 'success', message: 'File entry saved successfully!' });
      }

      await loadEntries();
      setTimeout(() => {
        closeModals();
      }, 1500);
    } catch (error) {
      logger.error(null, 'Error saving file entry:', error);
      setSaveStatus({ type: 'error', message: error.response?.data?.detail || 'Failed to save file entry' });
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this file entry?')) {
      return;
    }

    try {
      await axios.delete(`${API}/files/${entryId}`);
      await loadEntries();
      setSaveStatus({ type: 'success', message: 'File entry deleted successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      logger.error(null, 'Error deleting file entry:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete file entry' });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFilteredEntries = () => {
    if (viewType === 'day' && selectedDay) {
      const dayStr = selectedDay.toISOString().split('T')[0];
      return entries.filter(entry => entry.entry_date === dayStr);
    } else if (selectedWeekStart) {
      const weekEnd = new Date(selectedWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return entries.filter(entry => {
        const entryDate = new Date(entry.entry_date + 'T00:00:00');
        return entryDate >= selectedWeekStart && entryDate < weekEnd;
      });
    }
    return entries;
  };

  const groupEntriesByDay = (entriesToGroup) => {
    const grouped = {};
    entriesToGroup.forEach(entry => {
      if (!grouped[entry.entry_date]) {
        grouped[entry.entry_date] = [];
      }
      grouped[entry.entry_date].push(entry);
    });
    return grouped;
  };

  const navigateWeek = (direction) => {
    const newStart = new Date(selectedWeekStart || new Date());
    newStart.setDate(newStart.getDate() + (direction * 7));
    setSelectedWeekStart(newStart);
    setSelectedDay(null);
  };

  const navigateDay = (direction) => {
    const newDay = new Date(selectedDay || new Date());
    newDay.setDate(newDay.getDate() + direction);
    setSelectedDay(newDay);
  };

  const goToToday = () => {
    const today = new Date();
    if (viewType === 'day') {
      setSelectedDay(today);
    } else {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      setSelectedWeekStart(startOfWeek);
    }
  };

  useEffect(() => {
    goToToday();
  }, [viewType]);

  const filteredEntries = getFilteredEntries();
  const groupedEntries = viewType === 'week' ? groupEntriesByDay(filteredEntries) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-gray-900">Files</h2>
          <p className="text-gray-600 mt-1">Track and manage your files</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => {
              if (showUploadForm && !viewMode && !editingEntry) {
                // If form is open for new entry, close it
                closeModals();
              } else {
                // Open new entry form
                openNewEntryModal();
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 btn-transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            {(showUploadForm && !viewMode && !editingEntry) ? 'Cancel' : 'Add File'}
          </Button>
        </div>
      </div>

      {/* Save Status */}
      {saveStatus.message && !showUploadForm && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Week/Day Navigation */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewType('week')}
                className={viewType === 'week' ? 'bg-blue-50 text-blue-600' : ''}
              >
                Week View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewType('day')}
                className={viewType === 'day' ? 'bg-blue-50 text-blue-600' : ''}
              >
                Day View
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => viewType === 'day' ? navigateDay(-1) : navigateWeek(-1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="px-4 py-2 bg-gray-50 rounded-lg min-w-[200px] text-center">
                <span className="font-medium text-gray-900">
                  {viewType === 'day' && selectedDay
                    ? formatDate(selectedDay.toISOString().split('T')[0])
                    : selectedWeekStart
                    ? `Week of ${formatDate(selectedWeekStart.toISOString().split('T')[0])}`
                    : 'Current Week'
                  }
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => viewType === 'day' ? navigateDay(1) : navigateWeek(1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="ml-2"
              >
                Today
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries List */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No file entries yet</p>
              <Button 
                onClick={openNewEntryModal}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Add Your First File
              </Button>
            </CardContent>
          </Card>
        ) : viewType === 'week' ? (
          Object.keys(groupedEntries).sort((a, b) => new Date(b) - new Date(a)).map(date => (
            <div key={date} className="space-y-3">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-50 to-white py-2 px-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-900">{formatDate(date)}</h3>
              </div>
              {groupedEntries[date].map((entry) => (
                <Card 
                  key={entry.id}
                  className="border-0 shadow-lg hover-lift cursor-pointer"
                  onClick={() => openViewEntryModal(entry)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {entry.file_data && entry.file_data.startsWith('data:image') ? (
                            <ImageIcon className="w-6 h-6 text-blue-600" />
                          ) : (
                            <FileText className="w-6 h-6 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="capitalize">{entry.file_type}</Badge>
                            {entry.entry_time && (
                              <span className="text-sm text-gray-500">{entry.entry_time}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 font-medium">{entry.description}</p>
                          {entry.file_name && (
                            <p className="text-xs text-gray-500 mt-1">{entry.file_name}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(entry.id);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        ) : (
          filteredEntries.map((entry) => (
            <Card 
              key={entry.id}
              className="border-0 shadow-lg hover-lift cursor-pointer"
              onClick={() => openViewEntryModal(entry)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {entry.file_data && entry.file_data.startsWith('data:image') ? (
                        <ImageIcon className="w-6 h-6 text-blue-600" />
                      ) : (
                        <FileText className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="capitalize">{entry.file_type}</Badge>
                        {entry.entry_time && (
                          <span className="text-sm text-gray-500">{entry.entry_time}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{entry.description}</p>
                      {entry.file_name && (
                        <p className="text-xs text-gray-500 mt-1">{entry.file_name}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEntry(entry.id);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Inline Upload/Edit Form */}
      {showUploadForm && (
        <Card className="border-2 border-blue-200 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <CardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {viewMode ? 'File Entry' : editingEntry ? 'Edit File Entry' : 'Add File Entry'}
                </CardTitle>
                <CardDescription>
                  {viewMode ? 'View file details' : editingEntry ? 'Update file information' : 'Upload and track your files'}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModals}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6" onClick={(e) => e.stopPropagation()}>
            {viewMode ? (
              <>
                {viewingEntry?.file_data && (
                  <div className="mb-4">
                    {viewingEntry.file_data.startsWith('data:image') ? (
                      <img 
                        src={viewingEntry.file_data} 
                        alt="File preview" 
                        className="w-full rounded-lg cursor-pointer"
                        onClick={() => {
                          setSelectedImage(viewingEntry.file_data);
                          setShowImageModal(true);
                        }}
                      />
                    ) : (
                      <div className="p-8 bg-gray-50 rounded-lg text-center">
                        <FileText className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">{viewingEntry.file_name}</p>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  <p className="mt-1 capitalize">{viewingEntry?.file_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <p className="mt-1">{viewingEntry?.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Date</label>
                    <p className="mt-1">{viewingEntry?.entry_date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Time</label>
                    <p className="mt-1">{viewingEntry?.entry_time}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleEditEntry}
                    className="flex-1"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Entry
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={closeModals}
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select File
                    </label>
                    
                    {!filePreview && !fileName ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={fileInputRef}
                          id="file-upload-input"
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          onChange={handleFileUpload}
                          onClick={(e) => {
                            e.stopPropagation();
                            logger.debug(null, 'File input clicked');
                          }}
                          onFocus={() => {
                            logger.debug(null, 'File input focused - keeping modal open');
                            setShowUploadForm(true);
                          }}
                          onBlur={() => {
                            logger.debug(null, 'File input blurred - but keeping modal open');
                            // Don't close the modal on blur
                          }}
                          className="hidden"
                        />
                        
                        <label 
                          htmlFor="file-upload-input"
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100 transition-all"
                        >
                          <Upload className="w-12 h-12 mb-3 text-gray-400" />
                          <span className="text-base font-medium text-gray-700 mb-1">
                            Tap to Choose File
                          </span>
                          <span className="text-xs text-gray-500">
                            Images, PDF, Documents
                          </span>
                          <span className="text-xs text-gray-400 mt-1">
                            Max 12MB
                          </span>
                        </label>
                      </div>
                    ) : filePreview ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <img src={filePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg border-2 border-gray-300" />
                          <button
                            type="button"
                            onClick={() => {
                              setFileData(null);
                              setFilePreview(null);
                              setFileName('');
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <label htmlFor="file-upload-input" className="block">
                          <span className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer underline">
                            Choose a different file
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-blue-600" />
                            <p className="text-sm font-medium text-gray-900">{fileName}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFileData(null);
                              setFilePreview(null);
                              setFileName('');
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <label htmlFor="file-upload-input" className="block">
                          <span className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer underline">
                            Choose a different file
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* File Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {fileTypes.map((type) => (
                        <Button
                          key={type.value}
                          type="button"
                          variant={fileType === type.value ? 'default' : 'outline'}
                          onClick={() => setFileType(type.value)}
                          className="flex items-center justify-center"
                        >
                          <type.icon className="w-4 h-4 mr-2" />
                          {type.label}
                        </Button>
                      ))}
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
                      className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                      rows={3}
                      placeholder="Enter description..."
                    />
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                      <input
                        type="time"
                        value={entryTime}
                        onChange={(e) => setEntryTime(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  {saveStatus.message && (
                    <div className={`p-3 rounded-lg text-sm ${
                      saveStatus.type === 'success' 
                        ? 'bg-green-50 text-green-800' 
                        : 'bg-red-50 text-red-800'
                    }`}>
                      {saveStatus.message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={closeModals}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button"
                      onClick={handleSaveEntry}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {editingEntry ? 'Update' : 'Save'} Entry
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <img 
            src={selectedImage} 
            alt="Full size preview" 
            className="max-w-full max-h-full object-contain"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setShowImageModal(false)}
            aria-label="Close image preview"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Files;
