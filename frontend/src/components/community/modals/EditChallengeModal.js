import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, Trophy, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { compressBannerImageBase64 } from '../../../utils/imageCompression';
import { logger } from '../../../utils/logger';

const EditChallengeModal = ({ challengeData, setChallengeData, onClose, onSave }) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressBannerImageBase64(file);
        setChallengeData({ ...challengeData, [type]: compressed });
      } catch (error) {
        logger.error(null, 'Error compressing image:', error);
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Edit2 className="w-6 h-6 mr-2 text-[#32D3FF]" />
              Edit Challenge
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Title</label>
              <input
                type="text"
                value={challengeData.title}
                onChange={(e) => setChallengeData({ ...challengeData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">{t('common.description')}</label>
              <textarea
                value={challengeData.description}
                onChange={(e) => setChallengeData({ ...challengeData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Goal Value</label>
                <input
                  type="number"
                  value={challengeData.goal_value}
                  onChange={(e) => setChallengeData({ ...challengeData, goal_value: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">End Date</label>
                <input
                  type="date"
                  value={challengeData.end_date}
                  onChange={(e) => setChallengeData({ ...challengeData, end_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Visibility</label>
              <select
                value={challengeData.visibility}
                onChange={(e) => setChallengeData({ ...challengeData, visibility: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.coverPhoto')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'cover_photo')}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#32D3FF] file:text-white hover:file:bg-[#2ab8e6]"
                />
                {challengeData.cover_photo && (
                  <img src={challengeData.cover_photo} alt="Cover preview" className="mt-2 w-full h-32 object-cover rounded-lg" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.trophyBadge')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'trophy_image')}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
                />
                {challengeData.trophy_image && (
                  <img src={challengeData.trophy_image} alt="Trophy preview" className="mt-2 w-32 h-32 object-cover rounded-lg mx-auto" />
                )}
              </div>
            </div>

            {/* Advanced Section Toggle */}
            <div className="border-t border-gray-600 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-white hover:text-[#32D3FF] transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pl-6">
                  {/* Goal Field - AI Assistant Context */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Goal & Intent
                      <span className="text-gray-400 text-xs ml-2">(Optional - Helps AI assist you better)</span>
                    </label>
                    <textarea
                      value={challengeData.goal || ''}
                      onChange={(e) => setChallengeData({ ...challengeData, goal: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                      rows="4"
                      placeholder="Describe your intent and goals for this challenge. What do you hope to achieve? How can AI assist you? This helps personalize your experience..."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Share your deeper intentions to help AI assistants provide better support and recommendations
                    </p>
                  </div>

                  {/* Notes Field */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Notes
                      <span className="text-gray-400 text-xs ml-2">(Optional)</span>
                    </label>
                    <textarea
                      value={challengeData.notes || ''}
                      onChange={(e) => setChallengeData({ ...challengeData, notes: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                      rows="3"
                      placeholder="Add any additional notes or details about this challenge..."
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Internal notes for reference
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 pb-20 md:pb-4">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={onSave}
                className="px-6 py-2 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white rounded-lg transition-colors"
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default EditChallengeModal;
