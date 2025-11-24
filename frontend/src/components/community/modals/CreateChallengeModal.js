import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, Trophy, Target, TrendingUp, Award, PlusCircle } from 'lucide-react';
import { compressBannerImage } from '../../../utils/imageCompression';
import { logger } from '../../../utils/logger';

const CreateChallengeModal = ({ challengeData, setChallengeData, onClose, onCreate }) => {
  const { t } = useTranslation();
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressBannerImage(file);
        setChallengeData({ ...challengeData, cover_photo: compressed });
      } catch (error) {
        logger.error(null, 'Error compressing image:', error);
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  const handleChallengeTypeChange = (type) => {
    let unit = 'km';
    if (type === 'activity_count') unit = 'activities';
    if (type === 'duration') unit = 'minutes';
    
    setChallengeData({ ...challengeData, challenge_type: type, goal_unit: unit });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="rounded-none md:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Trophy className="w-6 h-6 mr-2 text-[#32D3FF]" />
              {t('common.createChallenge')}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.title')}</label>
              <input
                type="text"
                value={challengeData.title}
                onChange={(e) => setChallengeData({ ...challengeData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                placeholder={t('community.challenge.enterChallengeName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">{t('common.description')}</label>
              <textarea
                value={challengeData.description}
                onChange={(e) => setChallengeData({ ...challengeData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                rows="3"
                placeholder={t('community.challenge.describeChallenge')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.challengeType')}</label>
                <select
                  value={challengeData.challenge_type}
                  onChange={(e) => handleChallengeTypeChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="distance">{t('community.challenge.typeDistance')}</option>
                  <option value="activity_count">{t('community.challenge.typeActivityCount')}</option>
                  <option value="duration">{t('community.challenge.typeDuration')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.goalValue')}</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={challengeData.goal_value}
                    onChange={(e) => setChallengeData({ ...challengeData, goal_value: e.target.value })}
                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    placeholder={t('community.challenge.targetValue')}
                    step="any"
                  />
                  <span className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400">
                    {challengeData.goal_unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.timePeriod')}</label>
                <select
                  value={challengeData.time_period}
                  onChange={(e) => setChallengeData({ ...challengeData, time_period: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="total">{t('community.challenge.periodTotal')}</option>
                  <option value="daily">{t('community.challenge.periodDaily')}</option>
                  <option value="weekly">{t('community.challenge.periodWeekly')}</option>
                  <option value="monthly">{t('community.challenge.periodMonthly')}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {t('community.challenge.timePeriodHelp')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.startDate')}</label>
                <input
                  type="date"
                  value={challengeData.start_date}
                  onChange={(e) => setChallengeData({ ...challengeData, start_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.endDate')}</label>
                <input
                  type="date"
                  value={challengeData.end_date}
                  onChange={(e) => setChallengeData({ ...challengeData, end_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.visibility')}</label>
                <select
                  value={challengeData.visibility}
                  onChange={(e) => setChallengeData({ ...challengeData, visibility: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="public">{t('community.challenge.visibilityPublic')}</option>
                  <option value="private">{t('community.challenge.visibilityPrivate')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.competitionType')}</label>
                <select
                  value={challengeData.competition_type}
                  onChange={(e) => setChallengeData({ ...challengeData, competition_type: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="individual">{t('community.challenge.typeIndividual')}</option>
                  <option value="team">{t('community.challenge.typeTeam')}</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={challengeData.is_recurring}
                  onChange={(e) => setChallengeData({ ...challengeData, is_recurring: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-white">{t('community.challenge.recurringChallenge')}</label>
              </div>

              {challengeData.is_recurring && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                    <select
                      value={challengeData.recurrence_frequency}
                      onChange={(e) => setChallengeData({ ...challengeData, recurrence_frequency: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Repeat Count</label>
                    <input
                      type="number"
                      value={challengeData.recurrence_count}
                      onChange={(e) => setChallengeData({ ...challengeData, recurrence_count: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                      min="1"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">{t('community.challenge.coverPhoto')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
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
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      try {
                        const compressed = await compressBannerImage(file);
                        setChallengeData({ ...challengeData, trophy_image: compressed });
                      } catch (error) {
                        logger.error(null, 'Error compressing trophy image:', error);
                        alert('Failed to process trophy image');
                      }
                    }
                  }}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
                />
                {challengeData.trophy_image && (
                  <img src={challengeData.trophy_image} alt="Trophy preview" className="mt-2 w-32 h-32 object-cover rounded-lg mx-auto" />
                )}
                <p className="text-xs text-gray-400 mt-1">{t('community.challenge.trophyHelp')}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={onCreate}
                className="px-6 py-2 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white rounded-lg transition-colors"
              >
                <Trophy className="w-4 h-4 inline mr-2" />
                Create Challenge
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ChallengeDetailModal Component


export default CreateChallengeModal;
