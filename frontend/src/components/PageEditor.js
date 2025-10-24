import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Save, FileText } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PageEditor = ({ athleteId, pageId }) => {
  const navigate = useNavigate();
  const isEditMode = pageId && pageId !== 'new';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    url_slug: '',
    thumbnail: '',
    status: 'draft',
    index_status: 'indexed',
    meta_title: '',
    meta_description: '',
    focus_keyword: '',
    og_image: ''
  });

  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [ogImagePreview, setOgImagePreview] = useState(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      loadPage();
    }
  }, [pageId]);

  const loadPage = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/pages/${pageId}?athlete_id=${athleteId}`);
      setFormData(response.data);
      if (response.data.thumbnail) {
        setThumbnailPreview(`${BACKEND_URL}${response.data.thumbnail}`);
      }
      if (response.data.og_image) {
        setOgImagePreview(`${BACKEND_URL}${response.data.og_image}`);
      }
    } catch (error) {
      console.error('Error loading page:', error);
      alert('Failed to load page');
      navigate('/dashboard/pages');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-generate URL slug from title if not manually edited
    if (field === 'title' && !isEditMode) {
      const slug = '/' + value.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setFormData(prev => ({
        ...prev,
        url_slug: slug
      }));
    }
  };

  const handleImageUpload = async (type, file) => {
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // If editing existing page, upload immediately
    if (isEditMode) {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      try {
        if (type === 'thumbnail') {
          setUploadingThumbnail(true);
        } else {
          setUploadingOgImage(true);
        }

        const response = await axios.post(
          `${API}/pages/${pageId}/upload-image?athlete_id=${athleteId}&image_type=${type}`,
          formDataUpload,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        // Update form data with new image path
        setFormData(prev => ({
          ...prev,
          [type === 'thumbnail' ? 'thumbnail' : 'og_image']: response.data.path
        }));

        // Update preview
        const reader = new FileReader();
        reader.onloadend = () => {
          if (type === 'thumbnail') {
            setThumbnailPreview(reader.result);
          } else {
            setOgImagePreview(reader.result);
          }
        };
        reader.readAsDataURL(file);

        alert(`${type === 'thumbnail' ? 'Thumbnail' : 'OG Image'} uploaded successfully`);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image');
      } finally {
        if (type === 'thumbnail') {
          setUploadingThumbnail(false);
        } else {
          setUploadingOgImage(false);
        }
      }
    } else {
      // For new pages, just show preview (will upload on save)
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'thumbnail') {
          setThumbnailPreview(reader.result);
        } else {
          setOgImagePreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
      alert(`${type === 'thumbnail' ? 'Thumbnail' : 'OG Image'} will be uploaded when you save the page`);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      alert('Please enter a page title');
      return;
    }

    if (!formData.url_slug.trim()) {
      alert('Please enter a URL slug');
      return;
    }

    try {
      setSaving(true);

      if (isEditMode) {
        // Update existing page
        await axios.put(
          `${API}/pages/${pageId}?athlete_id=${athleteId}`,
          formData
        );
        alert('Page updated successfully');
      } else {
        // Create new page
        const response = await axios.post(
          `${API}/pages?athlete_id=${athleteId}`,
          formData
        );
        alert('Page created successfully');
        navigate(`/dashboard/pages/edit/${response.data.page.id}`);
      }
    } catch (error) {
      console.error('Error saving page:', error);
      alert(error.response?.data?.detail || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00C2A8] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard/pages')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pages
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {isEditMode ? 'Edit Page' : 'Create New Page'}
              </h1>
              <p className="text-gray-400 mt-1">
                {isEditMode ? 'Update page details and SEO settings' : 'Add a new page to your website'}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Page'}
            </button>
          </div>
        </div>

        {/* Page Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00C2A8]" />
            Page Details
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Page Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., About Us"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8]"
              />
            </div>

            {/* URL Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                URL Slug *
              </label>
              <input
                type="text"
                value={formData.url_slug}
                onChange={(e) => handleInputChange('url_slug', e.target.value)}
                placeholder="/about-us"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                This will be the page URL: {BACKEND_URL.replace('/api', '')}{formData.url_slug || '/your-page'}
              </p>
            </div>

            {/* Status and Index Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00C2A8]"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending Review</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Index Status
                </label>
                <select
                  value={formData.index_status}
                  onChange={(e) => handleInputChange('index_status', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00C2A8]"
                >
                  <option value="indexed">Indexed</option>
                  <option value="no-index">No-Index</option>
                </select>
              </div>
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Thumbnail Image (3:2 ratio recommended)
              </label>
              {thumbnailPreview ? (
                <div className="relative inline-block">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-48 h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setThumbnailPreview(null);
                      setFormData(prev => ({ ...prev, thumbnail: '' }));
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-48 h-32 bg-gray-900 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-[#00C2A8] transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload('thumbnail', e.target.files[0])}
                    className="hidden"
                  />
                  <div className="text-center">
                    <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Click to upload</p>
                  </div>
                </label>
              )}
              {uploadingThumbnail && (
                <p className="text-sm text-[#00C2A8] mt-2">Uploading...</p>
              )}
            </div>
          </div>
        </div>

        {/* SEO Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00C2A8]" />
            SEO Settings
          </h2>

          <div className="space-y-4">
            {/* Meta Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.meta_title}
                onChange={(e) => handleInputChange('meta_title', e.target.value)}
                placeholder="Leave empty to use page title"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                {(formData.meta_title || formData.title).length} / 60 characters (recommended)
              </p>
            </div>

            {/* Meta Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meta Description
              </label>
              <textarea
                value={formData.meta_description}
                onChange={(e) => handleInputChange('meta_description', e.target.value)}
                placeholder="Brief description for search engines"
                rows="3"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8]"
              />
              <p className="text-xs text-gray-400 mt-1">
                {(formData.meta_description || '').length} / 160 characters (recommended)
              </p>
            </div>

            {/* Focus Keyword */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Focus Keyword
              </label>
              <input
                type="text"
                value={formData.focus_keyword}
                onChange={(e) => handleInputChange('focus_keyword', e.target.value)}
                placeholder="e.g., running coach"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8]"
              />
            </div>

            {/* Open Graph Image */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Open Graph Image (1200x630 recommended)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Image shown when sharing on social media
              </p>
              {ogImagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={ogImagePreview}
                    alt="OG image preview"
                    className="w-64 h-auto object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setOgImagePreview(null);
                      setFormData(prev => ({ ...prev, og_image: '' }));
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-64 h-32 bg-gray-900 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-[#00C2A8] transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload('og_image', e.target.files[0])}
                    className="hidden"
                  />
                  <div className="text-center">
                    <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Click to upload</p>
                  </div>
                </label>
              )}
              {uploadingOgImage && (
                <p className="text-sm text-[#00C2A8] mt-2">Uploading...</p>
              )}
            </div>
          </div>
        </div>

        {/* Save Button (bottom) */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Page'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageEditor;
