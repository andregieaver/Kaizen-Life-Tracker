import { useState } from 'react';
import { compressPostImage } from '../../utils/imageCompression';
import { logger } from '../../utils/logger';
import axios from 'axios';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for handling media uploads (images and videos)
 * Supports multiple media files, compression, drag-and-drop reordering
 */
const useMediaUpload = () => {
  // Media state
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  /**
   * Handle image selection (single image, legacy)
   */
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image to WebP format
        const compressed = await compressPostImage(file);
        return { file: compressed, preview: URL.createObjectURL(compressed) };
      } catch (error) {
        logger.error(null, 'Error compressing image:', error);
        throw error;
      }
    }
    return null;
  };

  /**
   * Handle mixed media selection (images + videos)
   * Max 5 media items total, max 1 video
   */
  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Max 5 media items total (images + videos), but max 1 video
    const currentVideoCount = selectedMedia.filter(m => m.type === 'video').length;
    const remainingSlots = 5 - selectedMedia.length;
    
    if (remainingSlots <= 0) {
      alert('Maximum 5 media items allowed');
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const newVideos = filesToProcess.filter(f => f.type.startsWith('video/'));
    
    if (currentVideoCount > 0 && newVideos.length > 0) {
      alert('Only one video allowed per post');
      return;
    }
    
    if (newVideos.length > 1) {
      alert('Only one video allowed per post');
      return;
    }

    setIsUploadingMedia(true);

    try {
      const processedMedia = [];

      for (const file of filesToProcess) {
        if (file.type.startsWith('image/')) {
          // Compress image
          const compressed = await compressPostImage(file);
          processedMedia.push({
            id: Date.now() + Math.random(),
            type: 'image',
            file: compressed,
            preview: URL.createObjectURL(compressed),
            uploading: false
          });
        } else if (file.type.startsWith('video/')) {
          // For videos, just use the original file
          processedMedia.push({
            id: Date.now() + Math.random(),
            type: 'video',
            file: file,
            preview: URL.createObjectURL(file),
            uploading: false
          });
        }
      }

      setSelectedMedia(prev => [...prev, ...processedMedia]);
    } catch (error) {
      logger.error(null, 'Error processing media:', error);
      alert('Error processing media files');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  /**
   * Remove media from selection
   */
  const handleRemoveMedia = (index) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Clear all selected media
   */
  const clearMedia = () => {
    setSelectedMedia([]);
    setIsUploadingMedia(false);
    setDraggedIndex(null);
  };

  /**
   * Drag and drop handlers for reordering media
   */
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    
    const items = Array.from(selectedMedia);
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(dropIndex, 0, draggedItem);

    setSelectedMedia(items);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  /**
   * Upload media files to server and return URLs
   */
  const uploadMediaFiles = async () => {
    if (selectedMedia.length === 0) return [];

    const uploadedUrls = [];

    for (const media of selectedMedia) {
      const formData = new FormData();
      formData.append('file', media.file);

      try {
        const endpoint = media.type === 'video' ? '/community/upload-video' : '/community/upload-image';
        const response = await axios.post(`${API}${endpoint}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (media.type === 'video') {
          uploadedUrls.push({
            type: 'video',
            url: response.data.url,
            thumbnail: response.data.thumbnail
          });
        } else {
          uploadedUrls.push({
            type: 'image',
            url: response.data.url
          });
        }
      } catch (error) {
        logger.error(null, `Error uploading ${media.type}:`, error);
        throw error;
      }
    }

    return uploadedUrls;
  };

  return {
    // State
    selectedMedia,
    setSelectedMedia,
    isUploadingMedia,
    setIsUploadingMedia,
    draggedIndex,
    
    // Handlers
    handleImageSelect,
    handleMediaSelect,
    handleRemoveMedia,
    clearMedia,
    uploadMediaFiles,
    
    // Drag & drop
    dragHandlers: {
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd
    }
  };
};

export default useMediaUpload;
