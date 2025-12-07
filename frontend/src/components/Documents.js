import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Upload, Trash2, FileText, File, X, Activity, Clipboard, FlaskConical, BookOpen, FolderOpen, Download, RefreshCw, Camera } from 'lucide-react';

import { logger } from '../utils/logger';
import { getApiUrl, getApiBaseUrl } from '../utils/apiConfig';
const API = getApiBaseUrl();

const Documents = ({ athleteId }) => {
  const [documents, setDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Persist modal state across remounts using sessionStorage
  const [showModal, setShowModal] = useState(() => {
    const saved = sessionStorage.getItem('documents_modal_open');
    return saved === 'true';
  });
  
  // Form fields
  // Persist form state across remounts
  const [title, setTitle] = useState(() => sessionStorage.getItem('documents_title') || '');
  const [category, setCategory] = useState(() => sessionStorage.getItem('documents_category') || 'medical');
  const [description, setDescription] = useState(() => sessionStorage.getItem('documents_description') || '');
  const [fileData, setFileData] = useState(() => {
    const saved = sessionStorage.getItem('documents_fileData');
    return saved && saved !== 'null' ? saved : null;
  });
  const [filePreview, setFilePreview] = useState(() => {
    const saved = sessionStorage.getItem('documents_filePreview');
    return saved && saved !== 'null' ? saved : null;
  });
  const [fileName, setFileName] = useState(() => sessionStorage.getItem('documents_fileName') || '');
  const [fileType, setFileType] = useState(() => sessionStorage.getItem('documents_fileType') || '');
  const [fileSize, setFileSize] = useState(() => {
    const saved = sessionStorage.getItem('documents_fileSize');
    return saved && saved !== 'null' ? parseInt(saved) : 0;
  });
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const resetForm = () => {
    setTitle('');
    setCategory('medical');
    setDescription('');
    setFileData(null);
    setFilePreview(null);
    setFileName('');
    setFileType('');
    setFileSize(0);
    setSaveStatus({ type: '', message: '' });
    
    // Clear all sessionStorage keys
    sessionStorage.removeItem('documents_modal_open');
    sessionStorage.removeItem('documents_title');
    sessionStorage.removeItem('documents_category');
    sessionStorage.removeItem('documents_description');
    sessionStorage.removeItem('documents_fileData');
    sessionStorage.removeItem('documents_filePreview');
    sessionStorage.removeItem('documents_fileName');
    sessionStorage.removeItem('documents_fileType');
    sessionStorage.removeItem('documents_fileSize');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const openUploadModal = () => {
    resetForm();
    setShowModal(true);
    sessionStorage.setItem('documents_modal_open', 'true');
  };

  const categories = [
    { value: 'medical', label: 'Medical Records', icon: Activity, color: 'bg-red-100 text-red-800' },
    { value: 'test_results', label: 'Test Results', icon: FlaskConical, color: 'bg-blue-100 text-blue-800' },
    { value: 'training_plan', label: 'Training Plans', icon: Clipboard, color: 'bg-green-100 text-green-800' },
    { value: 'research', label: 'Research/Articles', icon: BookOpen, color: 'bg-purple-100 text-purple-800' },
    { value: 'other', label: 'Other', icon: FolderOpen, color: 'bg-gray-100 text-gray-800' }
  ];

  // Load documents ONLY on component mount
  useEffect(() => {
    const loadInitialDocuments = async () => {
      if (!athleteId) return;
      
      try {
        setIsLoadingDocs(true);
        const response = await axios.get(`${API}/api/documents/${athleteId}`);
        const docs = response.data || [];
        setDocuments(Array.isArray(docs) ? docs : []);
      } catch (error) {
        logger.error(null, 'Error loading documents:', error);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };

    loadInitialDocuments();
  }, [athleteId]); // Only runs when athleteId changes (on mount)

  // Filter documents in-line during render (no useEffect)
  const getFilteredDocuments = () => {
    const docsArray = Array.isArray(documents) ? documents : [];
    if (selectedCategory === 'all') {
      return docsArray;
    } else {
      return docsArray.filter(doc => doc.category === selectedCategory);
    }
  };
  
  const filteredDocuments = getFilteredDocuments();

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

          // Adjust quality based on estimated size to stay under 12MB
          let quality = 0.85;
          
          // Estimate the base64 size and reduce quality if needed
          const estimatedSize = (width * height * 3) * 1.33; // RGB * base64 overhead
          if (estimatedSize > 10 * 1024 * 1024) {
            quality = 0.6; // More aggressive compression for large images
          } else if (estimatedSize > 5 * 1024 * 1024) {
            quality = 0.7;
          }

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Final size check
          const finalSize = compressedDataUrl.length * 0.75;
          if (finalSize > 12 * 1024 * 1024) {
            reject(new Error('Image is too large even after compression. Please try a smaller image.'));
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const newTitle = title || file.name;
      setTitle(newTitle);
      sessionStorage.setItem('documents_title', newTitle);
      
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        try {
          setSaveStatus({ type: '', message: 'Compressing image...' });
          const compressedImage = await compressImage(file);
          
          // Save to state AND sessionStorage immediately
          setFileData(compressedImage);
          sessionStorage.setItem('documents_fileData', compressedImage);
          
          setFilePreview(compressedImage);
          sessionStorage.setItem('documents_filePreview', compressedImage);
          
          setFileName(file.name);
          sessionStorage.setItem('documents_fileName', file.name);
          
          setFileType('image/jpeg');
          sessionStorage.setItem('documents_fileType', 'image/jpeg');
          
          const size = Math.round(compressedImage.length * 0.75);
          setFileSize(size);
          sessionStorage.setItem('documents_fileSize', size.toString());
          
          setSaveStatus({ type: 'success', message: '✓ Image ready' });
        } catch (error) {
          logger.error(null, 'Error processing image:', error);
          setSaveStatus({ type: 'error', message: error.message || 'Failed to process image' });
        }
      } else {
        processNonImageFile(file);
      }
    }
  };
  const handleCameraCapture = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const newTitle = title || file.name;
      setTitle(newTitle);
      sessionStorage.setItem('documents_title', newTitle);
      
      try {
        setSaveStatus({ type: '', message: 'Processing image...' });
        const compressedImage = await compressImage(file);
        
        // Save to state AND sessionStorage immediately
        setFileData(compressedImage);
        sessionStorage.setItem('documents_fileData', compressedImage);
        
        setFilePreview(compressedImage);
        sessionStorage.setItem('documents_filePreview', compressedImage);
        
        setFileName(file.name);
        sessionStorage.setItem('documents_fileName', file.name);
        
        setFileType('image/jpeg');
        sessionStorage.setItem('documents_fileType', 'image/jpeg');
        
        const size = Math.round(compressedImage.length * 0.75);
        setFileSize(size);
        sessionStorage.setItem('documents_fileSize', size.toString());
        
        setSaveStatus({ type: 'success', message: '✓ Image ready' });
      } catch (error) {
        logger.error(null, 'Error processing image:', error);
        setSaveStatus({ type: 'error', message: error.message || 'Failed to process image' });
      }
    }
  };

  const processNonImageFile = (file) => {
    if (file.size > 10 * 1024 * 1024) {
      setSaveStatus({ type: 'error', message: 'File must be less than 10MB' });
      return;
    }

    setSaveStatus({ type: '', message: 'Loading file...' });
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const data = e.target.result;
      
      // Save to state AND sessionStorage immediately
      setFileData(data);
      sessionStorage.setItem('documents_fileData', data);
      
      setFilePreview(null);
      sessionStorage.removeItem('documents_filePreview');
      
      setFileName(file.name);
      sessionStorage.setItem('documents_fileName', file.name);
      
      setFileType(file.type);
      sessionStorage.setItem('documents_fileType', file.type);
      
      setFileSize(file.size);
      sessionStorage.setItem('documents_fileSize', file.size.toString());
      
      setSaveStatus({ type: 'success', message: '✓ File ready' });
    };
    
    reader.onerror = () => {
      setSaveStatus({ type: 'error', message: 'Failed to read file' });
    };
    
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    // Validate
    if (!title.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter a title' });
      return;
    }
    if (!fileData) {
      setSaveStatus({ type: 'error', message: 'Please select a file' });
      return;
    }

    setIsUploading(true);
    setSaveStatus({ type: '', message: 'Uploading...' });

    try {
      const response = await axios.post(`${API}/api/documents`, {
        id: Math.random().toString(36).substring(7),
        athlete_id: athleteId,
        title: title.trim(),
        category,
        description: description.trim(),
        file_data: fileData,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        created_at: new Date().toISOString()
      }, { timeout: 30000 });
      
      // Success
      setSaveStatus({ type: 'success', message: '✓ Uploaded successfully!' });
      
      // Add the new document to the list immediately (no reload)
      const newDoc = {
        id: response.data.document_id || Math.random().toString(36).substring(7),
        athlete_id: athleteId,
        title: title.trim(),
        category,
        description: description.trim(),
        file_data: fileData,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        created_at: new Date().toISOString()
      };
      setDocuments(prev => [newDoc, ...prev]);
      
      resetForm();
      setTimeout(() => {
        setShowModal(false);
      }, 1000);
      
    } catch (error) {
      logger.error(null, 'Upload error:', error);
      
      let errorMessage = 'Upload failed';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out - file too large';
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      setSaveStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await axios.delete(`${API}/api/documents/${docId}`);
      // Remove document from state immediately (no reload)
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
    } catch (error) {
      logger.error(null, 'Error deleting document:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete document' });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCategoryIcon = (categoryValue) => {
    const cat = categories.find(c => c.value === categoryValue);
    return cat ? cat.icon : FileText;
  };

  const getCategoryLabel = (categoryValue) => {
    const cat = categories.find(c => c.value === categoryValue);
    return cat ? cat.label : categoryValue;
  };

  const getCategoryColor = (categoryValue) => {
    const cat = categories.find(c => c.value === categoryValue);
    return cat ? cat.color : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Documents</h2>
        <Button 
          onClick={openUploadModal}
          className="text-white border-0"
          style={{ backgroundColor: '#32D3FF' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Save Status */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' 
            ? 'bg-green-900/30 text-green-400 border border-green-700' 
            : 'bg-red-900/30 text-red-400 border border-red-700'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Document Upload Modal - Full Screen */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            // Prevent backdrop click from closing modal during file upload
            e.stopPropagation();
          }}
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Upload Document</CardTitle>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CardDescription className="text-gray-300">
                Upload medical records, test results, and other important documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Add File
              </label>
              
              {!filePreview && !fileName ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
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
                  <p className="text-xs text-gray-400 text-center">
                    Images auto-compressed • PDF, Word, Text accepted
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filePreview ? (
                    <div className="relative">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFileData(null);
                          setFilePreview(null);
                          setFileName('');
                          setFileType('');
                          setFileSize(0);
                          setSaveStatus({ type: '', message: '' });
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-600 rounded-lg border border-gray-500">
                      <div className="flex items-center gap-3">
                        <File className="w-8 h-8 text-teal-400" />
                        <div>
                          <p className="text-sm font-medium text-white">{fileName}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(fileSize)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFileData(null);
                          setFilePreview(null);
                          setFileName('');
                          setFileType('');
                          setFileSize(0);
                          setSaveStatus({ type: '', message: '' });
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-teal-400 hover:text-teal-300 underline"
                    >
                      Choose different file
                    </button>
                    <span className="text-xs text-gray-500">•</span>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-xs text-teal-400 hover:text-teal-300 underline"
                    >
                      Take new photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Document Title *
              </label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  sessionStorage.setItem('documents_title', e.target.value);
                }}
                placeholder="e.g., Blood Test Results - January 2024"
                className="w-full bg-gray-600 border-gray-500 text-white placeholder:text-gray-400"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  sessionStorage.setItem('documents_category', e.target.value);
                }}
                className="w-full p-2 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  sessionStorage.setItem('documents_description', e.target.value);
                }}
                placeholder="Add any notes or details about this document..."
                className="w-full p-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!fileData || !title || isUploading}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => setSelectedCategory('all')}
          size="sm"
          className={`border-0 ${
            selectedCategory === 'all' 
              ? 'text-white' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          style={selectedCategory === 'all' ? { backgroundColor: '#32D3FF' } : {}}
          onMouseEnter={(e) => {
            if (selectedCategory === 'all') {
              e.currentTarget.style.backgroundColor = '#009688';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCategory === 'all') {
              e.currentTarget.style.backgroundColor = '#32D3FF';
            }
          }}
        >
          All ({Array.isArray(documents) ? documents.length : 0})
        </Button>
        {categories.map((cat) => {
          const count = Array.isArray(documents) ? documents.filter(d => d.category === cat.value).length : 0;
          return (
            <Button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              size="sm"
              className={`border-0 ${
                selectedCategory === cat.value 
                  ? 'text-white' 
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              style={selectedCategory === cat.value ? { backgroundColor: '#32D3FF' } : {}}
              onMouseEnter={(e) => {
                if (selectedCategory === cat.value) {
                  e.currentTarget.style.backgroundColor = '#009688';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory === cat.value) {
                  e.currentTarget.style.backgroundColor = '#32D3FF';
                }
              }}
            >
              <cat.icon className="w-4 h-4 mr-2" />
              {cat.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Documents List */}
      {isLoadingDocs && filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#32D3FF' }}></div>
          <p className="mt-4 text-gray-300">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No documents yet</h3>
          <p className="text-gray-400 text-center">
            Upload your first document to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments.map((doc) => {
            const CategoryIcon = getCategoryIcon(doc.category);
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow bg-gradient-to-br from-gray-600 to-gray-800 border-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-gray-700 rounded-lg">
                        <CategoryIcon className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1">{doc.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge className="bg-gray-700 text-white border-0">
                            {getCategoryLabel(doc.category)}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {formatFileSize(doc.file_size)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {doc.description && (
                          <p className="text-sm text-gray-300 line-clamp-2">{doc.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = doc.file_data;
                          link.download = doc.file_name;
                          link.click();
                        }}
                        className="bg-gray-700 text-white border-0 hover:bg-gray-600"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        className="bg-red-900/30 text-red-400 border-0 hover:bg-red-900/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Documents;
