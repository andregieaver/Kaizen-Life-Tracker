import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Upload, Trash2, FileText, File, X, Activity, Clipboard, FlaskConical, BookOpen, FolderOpen, Download } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const Documents = ({ athleteId }) => {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('medical');
  const [description, setDescription] = useState('');
  const [fileData, setFileData] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  
  const fileInputRef = useRef(null);

  const categories = [
    { value: 'medical', label: 'Medical Records', icon: Activity, color: 'bg-red-100 text-red-800' },
    { value: 'test_results', label: 'Test Results', icon: FlaskConical, color: 'bg-blue-100 text-blue-800' },
    { value: 'training_plan', label: 'Training Plans', icon: Clipboard, color: 'bg-green-100 text-green-800' },
    { value: 'research', label: 'Research/Articles', icon: BookOpen, color: 'bg-purple-100 text-purple-800' },
    { value: 'other', label: 'Other', icon: FolderOpen, color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    if (athleteId) {
      loadDocuments();
    }
  }, [athleteId]);

  useEffect(() => {
    filterDocuments();
  }, [documents, selectedCategory]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/api/documents/${athleteId}`);
      const docs = response.data || [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
      setSaveStatus({ type: 'error', message: 'Failed to load documents' });
    } finally {
      setIsLoading(false);
    }
  };

  const filterDocuments = () => {
    const docsArray = Array.isArray(documents) ? documents : [];
    if (selectedCategory === 'all') {
      setFilteredDocuments(docsArray);
    } else {
      setFilteredDocuments(docsArray.filter(doc => doc.category === selectedCategory));
    }
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
      try {
        // Ensure modal stays open during file processing (important for mobile)
        setShowModal(true);
        
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
          setSaveStatus({ type: '', message: 'Compressing image...' });
          const compressedImage = await compressImage(file);
          setFileData(compressedImage);
          setFilePreview(compressedImage);
          setFileName(file.name);
          setFileType('image/jpeg');
          setFileSize(Math.round(compressedImage.length * 0.75));
          setSaveStatus({ type: 'success', message: 'Image ready!' });
        } else {
          if (file.size > 10 * 1024 * 1024) {
            setSaveStatus({ type: 'error', message: 'File size must be less than 10MB' });
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            setFileData(e.target.result);
            setFilePreview(null);
            setFileName(file.name);
            setFileType(file.type);
            setFileSize(file.size);
          };
          reader.onerror = () => {
            setSaveStatus({ type: 'error', message: 'Failed to read file' });
          };
          reader.readAsDataURL(file);
        }
        
        if (!title) {
          setTitle(file.name);
        }
        
        // Ensure modal stays visible after file processing
        setShowModal(true);
      } catch (error) {
        console.error('Error processing file:', error);
        setSaveStatus({ type: 'error', message: error.message });
        // Keep modal open even on error
        setShowModal(true);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter a title' });
      return;
    }

    if (!fileData) {
      setSaveStatus({ type: 'error', message: 'Please select a file' });
      return;
    }

    try {
      setIsLoading(true);
      setSaveStatus({ type: '', message: 'Uploading document...' });
      
      const newDocument = {
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
      };

      const response = await axios.post(`${API}/api/documents`, newDocument, {
        timeout: 30000
      });
      
      if (response.data.success) {
        setSaveStatus({ type: 'success', message: 'Document uploaded successfully!' });
        
        setTitle('');
        setCategory('medical');
        setDescription('');
        setFileData(null);
        setFilePreview(null);
        setFileName('');
        setFileType('');
        setFileSize(0);
        
        await loadDocuments();
        
        setTimeout(() => {
          setShowModal(false);
          setSaveStatus({ type: '', message: '' });
        }, 1500);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      let errorMessage = 'Failed to upload document';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out. File may be too large.';
      } else if (error.response?.status === 413) {
        errorMessage = 'File is too large.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      setSaveStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await axios.delete(`${API}/api/documents/${docId}`);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
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
        <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
        <Button 
          onClick={() => setShowModal(!showModal)} 
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showModal ? 'Cancel' : 'Upload Document'}
        </Button>
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

      {/* Inline Upload Form */}
      {showModal && (
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Upload Document</CardTitle>
                <CardDescription>Upload medical records, test results, and other important documents</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModal(false);
                  setTitle('');
                  setCategory('medical');
                  setDescription('');
                  setFileData(null);
                  setFilePreview(null);
                  setFileName('');
                  setFileType('');
                  setFileSize(0);
                  setSaveStatus({ type: '', message: '' });
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document File *
              </label>
              
              {!filePreview && !fileName ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-32 border-2 border-dashed border-gray-300 hover:border-blue-400"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <div className="text-sm font-medium text-gray-700">Choose File</div>
                      <div className="text-xs text-gray-500 mt-1">or drag and drop</div>
                    </div>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    style={{ display: 'none' }}
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Accepted formats: PDF, Word, Text, Images • Max size: 12MB • Images auto-compressed
                  </p>
                </div>
              ) : (
                <div>
                  {filePreview ? (
                    <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-full h-64 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFileData(null);
                          setFilePreview(null);
                          setFileName('');
                          setFileType('');
                          setFileSize(0);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{fileName}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(fileSize)}</p>
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
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Blood Test Results - January 2024"
                className="w-full"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any notes or details about this document..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowModal(false);
                  setTitle('');
                  setCategory('medical');
                  setDescription('');
                  setFileData(null);
                  setFilePreview(null);
                  setFileName('');
                  setFileType('');
                  setFileSize(0);
                  setSaveStatus({ type: '', message: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!fileData || !title || isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
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
      )}

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('all')}
          size="sm"
        >
          All ({Array.isArray(documents) ? documents.length : 0})
        </Button>
        {categories.map((cat) => {
          const count = Array.isArray(documents) ? documents.filter(d => d.category === cat.value).length : 0;
          return (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat.value)}
              size="sm"
            >
              <cat.icon className="w-4 h-4 mr-2" />
              {cat.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Documents List */}
      {isLoading && filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No documents yet</p>
          <p className="text-sm text-gray-500">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments.map((doc) => {
            const CategoryIcon = getCategoryIcon(doc.category);
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <CategoryIcon className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge className={getCategoryColor(doc.category)}>
                            {getCategoryLabel(doc.category)}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(doc.file_size)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {doc.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{doc.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = doc.file_data;
                          link.download = doc.file_name;
                          link.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-600 hover:text-red-700"
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
