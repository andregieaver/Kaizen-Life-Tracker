import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Upload, Bot } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VOICES = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'verse', label: 'Verse' },
];

const PERSONALITIES = [
  { value: 'zen', label: 'Zen', description: 'Calm, grounded, focused on consistency' },
  { value: 'science', label: 'Science', description: 'Data-driven, analytical, evidence-based' },
  { value: 'tough', label: 'Tough', description: 'Direct, firm, disciplined' },
  { value: 'cheerleader', label: 'Cheerleader', description: 'Positive, energetic, encouraging' },
  { value: 'therapist', label: 'Therapist', description: 'Empathetic, supportive, understanding' },
  { value: 'stoic', label: 'Stoic', description: 'Composed, philosophical, patient' },
  { value: 'gamified', label: 'Gamified', description: 'Playful, quest-based, reward-focused' },
  { value: 'recovery', label: 'Recovery', description: 'Health-focused, long-term oriented' },
  { value: 'executive', label: 'Executive', description: 'Efficient, time-conscious, practical' },
  { value: 'realist', label: 'Realist', description: 'Honest, relatable, flexible' },
];

const ACCESSIBILITY_LEVELS = [
  { value: 'frontend', label: 'Frontend (Public)', description: 'Available to logged-out users via traditional chatbot interface' },
  { value: 'logged_in', label: 'Logged In', description: 'Available to members via traditional chatbot interface and support' },
  { value: 'admin', label: 'Admin', description: 'Full access admin management agent with voice and navigation' },
];

const AgentModal = ({ athleteId, agent, onClose }) => {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    custom_instructions: agent?.custom_instructions || '',
    voice: agent?.voice || 'alloy',
    personality: agent?.personality || '',
    accessibility: agent?.accessibility || 'frontend',
    is_active: agent?.is_active ?? true,
  });
  
  const [profileImage, setProfileImage] = useState(agent?.profile_image_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const isEditing = !!agent;

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result);
    };
    reader.readAsDataURL(file);

    // If editing existing agent, upload immediately
    if (isEditing) {
      try {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(
          `${API}/agents/${agent.id}/upload-image?athlete_id=${athleteId}`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );

        setProfileImage(response.data.url);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image');
        setProfileImage(agent?.profile_image_url || null);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter an agent name');
      return;
    }

    if (!formData.custom_instructions.trim()) {
      alert('Please enter custom instructions');
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        // Update existing agent
        await axios.put(
          `${API}/agents/${agent.id}?athlete_id=${athleteId}`,
          formData
        );
      } else {
        // Create new agent
        const response = await axios.post(
          `${API}/agents?athlete_id=${athleteId}`,
          formData
        );

        // If there's a profile image, upload it
        if (profileImage && profileImage.startsWith('data:')) {
          const newAgentId = response.data.id;
          const file = fileInputRef.current.files[0];
          if (file) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            await axios.post(
              `${API}/agents/${newAgentId}/upload-image?athlete_id=${athleteId}`,
              uploadFormData,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
              }
            );
          }
        }
      }

      onClose(true); // Close and reload
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Agent' : 'Create New Agent'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Profile Image */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Agent profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-gray-700">
                  <Bot className="w-12 h-12 text-white" />
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Profile Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            <p className="text-xs text-gray-400">JPEG, PNG, or WebP (max 5MB)</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Fitness Coach Sarah"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Voice */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voice
            </label>
            <select
              value={formData.voice}
              onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {VOICES.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>

          {/* Personality */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Personality
            </label>
            <select
              value={formData.personality}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {PERSONALITIES.map((personality) => (
                <option key={personality.value} value={personality.value}>
                  {personality.label} - {personality.description}
                </option>
              ))}
            </select>
          </div>

          {/* Accessibility */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Accessibility Level *
            </label>
            <select
              value={formData.accessibility}
              onChange={(e) => setFormData({ ...formData, accessibility: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {ACCESSIBILITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} - {level.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Controls where and how this agent is accessible
            </p>
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Instructions *
            </label>
            <textarea
              value={formData.custom_instructions}
              onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
              placeholder="Describe how this agent should behave, what it should help with, and any specific guidelines..."
              rows={8}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Be specific about the agent's role, tone, and capabilities
            </p>
          </div>

          {/* Is Active */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-300">
              Active (agent is available for use)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentModal;
