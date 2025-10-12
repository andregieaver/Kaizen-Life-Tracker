import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Upload, Trash2, FileText, File, X, Activity, Clipboard, FlaskConical, BookOpen, FolderOpen, Download } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const Documents = ({ athleteId }) => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('medical');
  const [description, setDescription] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  
  const fileInputRef = useRef(null);

  const categories = [
    { value: 'medical', label: 'Medical Records', icon: Activity, color: 'bg-red-100 text-red-800' },
    { value: 'test_results', label: 'Test Results', icon: Clipboard, color: 'bg-blue-100 text-blue-800' },
    { value: 'training_plan', label: 'Training Plans', icon: FlaskConical, color: 'bg-purple-100 text-purple-800' },
    { value: 'research', label: 'Research/Articles', icon: BookOpen, color: 'bg-green-100 text-green-800' },
    { value: 'other', label: 'Other', icon: FolderOpen, color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    loadDocuments();
  }, [athleteId]);

  useEffect(() => {
    filterDocuments();
  }, [selectedCategory, documents]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/documents/${athleteId}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load documents' });
    } finally {
      setIsLoading(false);
    }
  };

  const filterDocuments = () => {
    if (selectedCategory === 'all') {
      setFilteredDocuments(documents);
    } else {
      setFilteredDocuments(documents.filter(doc => doc.category === selectedCategory));
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max 1920px, maintaining aspect ratio)
          let width = img.width;
          let height = img.height;
          const maxSize = 1920;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels until under 10MB
          let quality = 0.9;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Keep reducing quality until under 10MB (base64 string length * 0.75 ≈ file size in bytes)
          while (compressedDataUrl.length * 0.75 > 10 * 1024 * 1024 && quality > 0.1) {
            quality -= 0.1;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Final check
          const finalSizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);
          if (finalSizeInMB > 10) {
            reject(new Error('Unable to compress image below 10MB. Please use a smaller image.'));
          } else {
            resolve({
              data: compressedDataUrl,
              size: Math.round(compressedDataUrl.length * 0.75),
              name: file.name.replace(/\.[^.]+$/, '.jpg')
            });
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // Check if file is an image
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
          // Compress images automatically
          setSaveStatus({ type: '', message: 'Compressing image...' });
          
          const compressed = await compressImage(file);
          setFileData(compressed.data);
          setFileName(compressed.name);
          setFileType('image/jpeg');
          setFileSize(compressed.size);
          
          setSaveStatus({ type: 'success', message: 'Image compressed successfully!' });
          setTimeout(() => setSaveStatus({ type: '', message: '' }), 2000);
        } else {
          // Non-image files: validate size and read normally
          if (file.size > 10 * 1024 * 1024) {
            setSaveStatus({ type: 'error', message: 'File size must be less than 10MB' });
            return;
          }

          // Read file as base64
          const reader = new FileReader();
          reader.onload = (e) => {
            setFileData(e.target.result);
            setFileName(file.name);
            setFileType(file.type);
            setFileSize(file.size);
          };
          reader.onerror = () => {
            setSaveStatus({ type: 'error', message: 'Failed to read file' });
          };
          reader.readAsDataURL(file);
        }
        
        // Auto-populate title if empty
        if (!title) {
          setTitle(file.name);
        }
      } catch (error) {
        console.error('Error processing file:', error);
        setSaveStatus({ type: 'error', message: error.message });
      }
    }
  };

  const handleSubmit = async () => {
    setSaveStatus({ type: '', message: '🔴 FUNCTION CALLED!' });
    
    try {
      // Step 1: Validation
      setSaveStatus({ type: '', message: '▶ STEP 1: Validating...' });
      await new Promise(resolve => setTimeout(resolve, 500));
    
      if (!title.trim()) {
        setSaveStatus({ type: 'error', message: '❌ ERROR: No title' });
        return;
      }

      if (!fileData) {
        setSaveStatus({ type: 'error', message: '❌ ERROR: No file' });
        return;
      }

      // Step 2: Prepare data
      setSaveStatus({ type: '', message: '▶ STEP 2: Preparing...' });
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsLoading(true);
    
    try {
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
      const dataSizeMB = (fileData.length * 0.75 / 1024 / 1024).toFixed(2);
      
      setSaveStatus({ type: '', message: `▶ STEP 3: Uploading ${fileSizeMB}MB file (${fileName})...` });
      
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

      // Step 4: Send to server
      setSaveStatus({ type: '', message: '▶ STEP 4: Sending to server...' });
      
      const response = await axios.post(`${API}/documents`, newDocument, {
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setSaveStatus({ type: '', message: `📤 Uploading: ${percentCompleted}%` });
        }
      });
      
      // Step 5: Check response
      setSaveStatus({ type: '', message: '▶ STEP 5: Checking server response...' });
      
      if (!response) {
        throw new Error('No response from server');
      }
      
      if (!response.data) {
        throw new Error('Empty response data');
      }
      
      if (response.data.success) {
        setSaveStatus({ type: 'success', message: `✅ SUCCESS! Document ID: ${response.data.id}` });
        
        // Step 6: Reset form
        setTitle('');
        setCategory('medical');
        setDescription('');
        setFileData(null);
        setFileName('');
        setFileType('');
        setFileSize(0);
        
        // Wait to show success - DON'T CLOSE MODAL YET
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 7: Close and reload
        setSaveStatus({ type: 'success', message: '▶ STEP 7: Closing and reloading documents...' });
        
        await loadDocuments();
        
        setShowModal(false);
        setSaveStatus({ type: '', message: '' });
      } else {
        throw new Error('Upload failed - server returned success=false');
      }
    } catch (error) {
      // Detailed error handling
      let errorMessage = `❌ ERROR: ${error.message || 'Unknown'} | Code: ${error.code || 'N/A'} | Status: ${error.response?.status || 'N/A'}`;
      
      setSaveStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
    } catch (topLevelError) {
      setSaveStatus({ type: 'error', message: `💥 FATAL ERROR: ${topLevelError.message}` });
      setIsLoading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await axios.delete(`${API}/documents/${documentId}`);
      setSaveStatus({ type: 'success', message: 'Document deleted successfully!' });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
      loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete document' });
    }
  };

  const handleDownload = (document) => {
    // Create download link
    const link = window.document.createElement('a');
    link.href = document.file_data;
    link.download = document.file_name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCategoryInfo = (categoryValue) => {
    return categories.find(cat => cat.value === categoryValue) || categories[categories.length - 1];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Panel */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
        <div className="font-bold mb-1 text-lg">🔧 DEBUG INFO v3.0</div>
        <div className="flex gap-2 mb-2">
          <button 
            onClick={() => setSaveStatus({ type: '', message: 'TEST BUTTON CLICKED!' })}
            className="bg-green-500 text-white px-3 py-2 rounded text-sm"
          >
            TEST CLICK
          </button>
          <button 
            onClick={() => {
              setTitle('Test Document');
              setFileData('data:text/plain;base64,VGVzdCBmaWxl');
              setFileName('test.txt');
              setFileType('text/plain');
              setFileSize(100);
              setSaveStatus({ type: '', message: '✅ Test data set! Now try upload.' });
            }}
            className="bg-purple-500 text-white px-3 py-2 rounded text-sm"
          >
            SET TEST DATA
          </button>
        </div>
        <div className="text-base">Documents loaded: <span className="font-bold">{documents.length}</span></div>
        <div className="text-base">Filtered: <span className="font-bold">{filteredDocuments.length}</span></div>
        <div>Category: {selectedCategory}</div>
        <div>Loading: {isLoading ? 'YES' : 'NO'}</div>
        <div>Modal Open: {showModal ? 'YES' : 'NO'}</div>
        <div>File Selected: {fileData ? 'YES' : 'NO'}</div>
        <div>Title: {title || '(empty)'}</div>
        <div className="break-all">Athlete ID: {athleteId}</div>
        <div className="break-all">API: {API}</div>
        {saveStatus.message && (
          <div className="mt-2 p-2 bg-red-100 border border-red-400 rounded text-base font-bold">
            STATUS: {saveStatus.message}
          </div>
        )}
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            Upload medical records, test results, and other important documents for AI analysis
          </p>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 btn-transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'bg-blue-600' : ''}
        >
          All Documents ({documents.length})
        </Button>
        {categories.map((cat) => {
          const count = documents.filter(doc => doc.category === cat.value).length;
          return (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.value)}
              className={selectedCategory === cat.value ? 'bg-blue-600' : ''}
            >
              <cat.icon className="w-4 h-4 mr-1" />
              {cat.label} ({count})
            </Button>
          );
        })}
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

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
            <p className="text-gray-600 text-center mb-4">
              {selectedCategory === 'all' 
                ? 'Upload your first document to get started'
                : `No ${getCategoryInfo(selectedCategory).label.toLowerCase()} uploaded yet`
              }
            </p>
            <Button 
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((document) => {
            const categoryInfo = getCategoryInfo(document.category);
            const CategoryIcon = categoryInfo.icon;
            
            return (
              <Card key={document.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="w-5 h-5 text-blue-600" />
                      <Badge className={categoryInfo.color}>
                        {categoryInfo.label}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(document.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-lg mt-2">{document.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {formatDate(document.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {document.description && (
                    <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                      {document.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <File className="w-3 h-3" />
                      {document.file_name}
                    </span>
                    <span>{formatFileSize(document.file_size)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(document)}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="file">Document File</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      id="file"
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {fileName || 'Choose File'}
                    </Button>
                  </div>
                  {fileName && (
                    <p className="text-sm text-gray-600">
                      Selected: {fileName} ({formatFileSize(fileSize)})
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Accepted formats: PDF, Word, Text, Images • Images auto-compressed
                  </p>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Blood Test Results - January 2024"
                    required
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add any additional notes about this document..."
                    rows={3}
                  />
                </div>

                {/* Form State Debug */}
                <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-xs">
                  <div className="font-bold mb-1">FORM STATE:</div>
                  <div>Title: "{title}" ({title.trim() ? 'OK' : 'EMPTY'})</div>
                  <div>File: {fileData ? `${fileName} (${(fileSize/1024).toFixed(1)}KB)` : 'NONE'}</div>
                  <div>Category: {category}</div>
                  <div>Button Enabled: {!(isLoading || !title.trim() || !fileData) ? 'YES' : 'NO'}</div>
                </div>

                {/* Status Message */}
                {saveStatus.message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    saveStatus.type === 'success' ? 'bg-green-50 text-green-800' :
                    saveStatus.type === 'error' ? 'bg-red-50 text-red-800' :
                    'bg-blue-50 text-blue-800'
                  }`}>
                    {saveStatus.message}
                  </div>
                )}

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
                    type="button"
                    onClick={() => {
                      setSaveStatus({ type: '', message: '🔵 MODAL BUTTON CLICKED!' });
                      handleSubmit();
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || !title.trim() || !fileData}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isLoading ? 'Uploading...' : 'Upload Document'}
                  </Button>
                  {(isLoading || !title.trim() || !fileData) && (
                    <div className="text-xs text-red-600 mt-1">
                      Button disabled: {isLoading ? 'Loading' : !title.trim() ? 'No title' : 'No file'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
