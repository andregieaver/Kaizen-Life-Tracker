import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Save, FileText, Plus, GripVertical, Trash2 } from 'lucide-react';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, ContentState, convertToRaw } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import { StrictModeDroppable } from '../utils/StrictModeDroppable';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PageEditor = ({ athleteId, pageId }) => {
  const navigate = useNavigate();
  const isEditMode = pageId && pageId !== 'new';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' or 'html'
  const [formData, setFormData] = useState({
    title: '',
    url_slug: '',
    is_home: false,
    thumbnail: '',
    status: 'draft',
    index_status: 'indexed',
    meta_title: '',
    meta_description: '',
    focus_keyword: '',
    og_image: '',
    use_cms_content: false,
    content_blocks: []
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
      
      logger.debug(null, 'Loaded page data:', {
        use_cms_content: response.data.use_cms_content,
        content_blocks_count: (response.data.content_blocks || []).length
      });
      
      // Initialize content blocks with EditorState
      const contentBlocks = (response.data.content_blocks || []).map(block => {
        let editorState = EditorState.createEmpty();
        if (block.content) {
          const contentBlock = htmlToDraft(block.content);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            editorState = EditorState.createWithContent(contentState);
          }
        }
        return { ...block, editorState };
      });
      
      // Ensure content_blocks is always an array
      const pageData = {
        ...response.data,
        use_cms_content: response.data.use_cms_content || false,
        content_blocks: contentBlocks
      };
      
      logger.debug(null, 'Setting form data with use_cms_content:', pageData.use_cms_content);
      setFormData(pageData);
      
      if (response.data.thumbnail) {
        setThumbnailPreview(`${BACKEND_URL}${response.data.thumbnail}`);
      }
      if (response.data.og_image) {
        setOgImagePreview(`${BACKEND_URL}${response.data.og_image}`);
      }
    } catch (error) {
      logger.error(null, 'Error loading page:', error);
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

    // Handle is_home toggle - set URL slug to "/" when enabled
    if (field === 'is_home') {
      if (value) {
        setFormData(prev => ({
          ...prev,
          url_slug: '/'
        }));
      } else {
        // Generate new slug from title when is_home is disabled
        const slug = '/' + (formData.title || 'page').toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        setFormData(prev => ({
          ...prev,
          url_slug: slug
        }));
      }
    }

    // Auto-generate URL slug from title if not manually edited and not home page
    if (field === 'title' && !isEditMode && !formData.is_home) {
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
        logger.error(null, 'Error uploading image:', error);
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

      // Prepare data for saving - remove editorState (not serializable)
      const saveData = {
        ...formData,
        content_blocks: (formData.content_blocks || []).map(block => {
          // Get HTML content from editorState if available
          let content = block.content || '';
          if (block.editorState) {
            const contentState = block.editorState.getCurrentContent();
            content = draftToHtml(convertToRaw(contentState));
          }
          return {
            id: block.id,
            content: content,
            order: block.order || 0
          };
        })
      };

      logger.debug(null, 'Saving page data:', {
        use_cms_content: saveData.use_cms_content,
        content_blocks_count: saveData.content_blocks.length,
        content_blocks: saveData.content_blocks
      });

      if (isEditMode) {
        // Update existing page
        const response = await axios.put(
          `${API}/pages/${pageId}?athlete_id=${athleteId}`,
          saveData
        );
        logger.debug(null, 'Page update response:', response.data);
        alert('Page updated successfully');
      } else {
        // Create new page
        const response = await axios.post(
          `${API}/pages?athlete_id=${athleteId}`,
          saveData
        );
        logger.debug(null, 'Page create response:', response.data);
        alert('Page created successfully');
        navigate(`/dashboard/pages/edit/${response.data.page.id}`);
      }
    } catch (error) {
      logger.error(null, 'Error saving page:', error);
      logger.error(null, 'Error response:', error.response?.data);
      alert(error.response?.data?.detail || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  // Content Block Management Functions
  const addContentBlock = () => {
    const currentBlocks = formData.content_blocks || [];
    const newBlock = {
      id: `block-${Date.now()}`,
      content: '',
      order: currentBlocks.length,
      editorState: EditorState.createEmpty()
    };
    setFormData(prev => ({
      ...prev,
      content_blocks: [...currentBlocks, newBlock]
    }));
  };

  const removeContentBlock = (blockId) => {
    const currentBlocks = formData.content_blocks || [];
    setFormData(prev => ({
      ...prev,
      content_blocks: currentBlocks.filter(block => block.id !== blockId)
    }));
  };

  const updateContentBlock = (blockId, editorState) => {
    const currentBlocks = formData.content_blocks || [];
    const contentHtml = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({
      ...prev,
      content_blocks: currentBlocks.map(block =>
        block.id === blockId ? { ...block, content: contentHtml, editorState } : block
      )
    }));
  };

  const updateContentBlockHtml = (blockId, htmlContent) => {
    const currentBlocks = formData.content_blocks || [];
    
    // Parse HTML to create new editor state
    let editorState = EditorState.createEmpty();
    try {
      const contentBlock = htmlToDraft(htmlContent);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
        editorState = EditorState.createWithContent(contentState);
      }
    } catch (error) {
      logger.error(null, 'Error parsing HTML:', error);
    }
    
    setFormData(prev => ({
      ...prev,
      content_blocks: currentBlocks.map(block =>
        block.id === blockId ? { ...block, content: htmlContent, editorState } : block
      )
    }));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(formData.content_blocks || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update order field
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));
    
    setFormData(prev => ({
      ...prev,
      content_blocks: updatedItems
    }));
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

            {/* Set as Home Page Toggle */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🏠</div>
                  <div>
                    <label className="text-sm font-medium text-white">
                      Set as Home Page
                    </label>
                    <p className="text-xs text-gray-400 mt-0.5">
                      This page will be accessible at the root URL (/)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInputChange('is_home', !formData.is_home)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_home ? 'bg-[#00C2A8]' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_home ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {formData.is_home && (
                <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-300">
                  ℹ️ Only one page can be the home page. Setting this will remove the home page status from any other page.
                </div>
              )}
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
                disabled={formData.is_home}
                className={`w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8] ${
                  formData.is_home ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <p className="text-xs text-gray-400 mt-1">
                {formData.is_home 
                  ? '🏠 Home page URL is locked to /'
                  : `This will be the page URL: ${BACKEND_URL.replace('/api', '')}${formData.url_slug || '/your-page'}`
                }
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

        {/* CMS Content Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00C2A8]" />
            Page Content
          </h2>

          {/* CMS Toggle */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📝</div>
                <div>
                  <label className="text-sm font-medium text-white">
                    Use CMS Content
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Toggle between hard-coded React components and flexible CMS content blocks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleInputChange('use_cms_content', !formData.use_cms_content)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.use_cms_content ? 'bg-[#00C2A8]' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.use_cms_content ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {formData.use_cms_content && (
              <div className="mt-3 p-2 bg-green-900/20 border border-green-700/50 rounded text-xs text-green-300">
                ✓ CMS mode active. Create content blocks below. The hard-coded page component will be replaced with your custom content.
              </div>
            )}
            {!formData.use_cms_content && (
              <div className="mt-3 p-2 bg-gray-700/20 border border-gray-600/50 rounded text-xs text-gray-400">
                ℹ️ Hard-coded mode. The React component for this page will be displayed.
              </div>
            )}
          </div>

          {/* Content Blocks (only shown when CMS mode is enabled) */}
          {formData.use_cms_content && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-400">Content Blocks ({(formData.content_blocks || []).length})</p>
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('visual')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        viewMode === 'visual' 
                          ? 'bg-[#00C2A8] text-white' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('html')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        viewMode === 'html' 
                          ? 'bg-[#00C2A8] text-white' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addContentBlock}
                  className="flex items-center gap-2 bg-[#00C2A8] hover:bg-[#00a890] text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Content Block
                </button>
              </div>

              {(!formData.content_blocks || formData.content_blocks.length === 0) ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
                  <p className="text-gray-400 mb-4">No content blocks yet. Click "Add Content Block" to start building your page.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <StrictModeDroppable droppableId="content-blocks">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                        {formData.content_blocks.map((block, index) => (
                          <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-gray-900 border rounded-lg overflow-hidden transition-shadow ${
                                  snapshot.isDragging ? 'border-[#00C2A8] shadow-lg' : 'border-gray-700'
                                }`}
                              >
                                <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
                                  <div className="flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <span className="text-sm font-medium text-white">Block {index + 1}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeContentBlock(block.id)}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="p-4">
                                  {viewMode === 'visual' ? (
                                    // Visual Editor
                                    <Editor
                                      editorState={block.editorState || EditorState.createEmpty()}
                                      onEditorStateChange={(editorState) => updateContentBlock(block.id, editorState)}
                                      wrapperClassName="demo-wrapper"
                                      editorClassName="demo-editor bg-white text-gray-900 border border-gray-300 rounded p-2 min-h-[200px]"
                                      toolbarClassName="demo-toolbar bg-gray-800 border border-gray-600 rounded mb-2"
                                      toolbar={{
                                        options: ['inline', 'blockType', 'fontSize', 'list', 'textAlign', 'link'],
                                        inline: { 
                                          inDropdown: false,
                                          options: ['bold', 'italic', 'underline']
                                        },
                                        blockType: { 
                                          inDropdown: true,
                                          options: ['Normal', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
                                        },
                                        fontSize: { 
                                          inDropdown: true,
                                          options: [10, 12, 14, 16, 18, 20, 24, 30, 36]
                                        },
                                        list: { 
                                          inDropdown: false,
                                          options: ['unordered', 'ordered'] 
                                        },
                                        textAlign: { 
                                          inDropdown: false,
                                          options: ['left', 'center', 'right', 'justify'] 
                                        },
                                        link: { 
                                          inDropdown: false,
                                          options: ['link', 'unlink']
                                        }
                                      }}
                                    />
                                  ) : (
                                    // HTML Editor
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-gray-400 font-mono">HTML Content</label>
                                        <span className="text-xs text-gray-500">Edit raw HTML</span>
                                      </div>
                                      <textarea
                                        value={block.content || ''}
                                        onChange={(e) => updateContentBlockHtml(block.id, e.target.value)}
                                        className="w-full bg-gray-950 text-gray-300 border border-gray-700 rounded p-3 font-mono text-sm min-h-[300px] focus:outline-none focus:border-[#00C2A8]"
                                        placeholder="<p>Enter your HTML here...</p>"
                                        spellCheck={false}
                                      />
                                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                                        <p className="flex items-start gap-1">
                                          <span className="text-green-400">✓</span>
                                          <span><strong>Inline CSS:</strong> Use style attributes like <code className="bg-gray-800 px-1 rounded">style="color: red; font-size: 20px;"</code></span>
                                        </p>
                                        <p className="flex items-start gap-1">
                                          <span className="text-green-400">✓</span>
                                          <span><strong>JavaScript:</strong> Add <code className="bg-gray-800 px-1 rounded">&lt;script&gt;</code> tags or inline handlers like <code className="bg-gray-800 px-1 rounded">onclick="alert('Hello')"</code></span>
                                        </p>
                                        <p className="flex items-start gap-1">
                                          <span className="text-blue-400">💡</span>
                                          <span><strong>Tip:</strong> Use standard HTML tags like &lt;h1&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;div&gt;, &lt;strong&gt;, etc.</span>
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </StrictModeDroppable>
                </DragDropContext>
              )}
            </div>
          )}
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
