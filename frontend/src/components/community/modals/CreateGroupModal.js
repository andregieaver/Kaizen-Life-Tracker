import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, Users as UsersIcon } from 'lucide-react';
import { compressThumbnail, compressBannerImage } from '../../../utils/imageCompression';
import { logger } from '../../../utils/logger';

const CreateGroupModal = ({ groupData, setGroupData, onClose, onCreate }) => {
  const { t } = useTranslation();
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image based on type
        const compressed = type === 'profile_image' 
          ? await compressThumbnail(file)
          : await compressBannerImage(file);
        setGroupData({ ...groupData, [type]: compressed });
      } catch (error) {
        logger.error(null, 'Error compressing image:', error);
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={(e) => {
        // Prevent closing when clicking on backdrop (only close with Cancel button)
        e.stopPropagation();
      }}
    >
      <div 
        className="rounded-none md:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden"
        style={{ background: 'var(--grad-surface)' }}
        onClick={(e) => {
          // Prevent backdrop click from propagating
          e.stopPropagation();
        }}
      >
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('community.modals.createGroup')}</h2>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupProfileImage')}</label>
            <div className="flex items-center space-x-4">
              {groupData.profile_image ? (
                <img src={groupData.profile_image} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'profile_image')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm">
                  {groupData.profile_image ? t('common.changeImage') : t('common.uploadImage')}
                </div>
              </label>
              {groupData.profile_image && (
                <button
                  onClick={() => setGroupData({ ...groupData, profile_image: null })}
                  className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Banner Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.bannerImage')}</label>
            {groupData.cover_photo && (
              <div className="relative mb-2">
                <img src={groupData.cover_photo} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => setGroupData({ ...groupData, cover_photo: null })}
                  className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover_photo')}
                className="hidden"
              />
              <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm inline-block">
                {groupData.cover_photo ? t('common.changeBanner') : t('common.uploadBanner')}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupName')}</label>
            <input
              type="text"
              value={groupData.name}
              onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
              placeholder={t('community.group.enterGroupName')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.description')}</label>
            <textarea
              value={groupData.description}
              onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
              placeholder={t('community.group.describeGroup')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none resize-none"
              rows="3"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.privacy')}</label>
            <select
              value={groupData.privacy}
              onChange={(e) => setGroupData({ ...groupData, privacy: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
            >
              <option value="public">{t('community.group.privacyPublic')}</option>
              <option value="private">{t('community.group.privacyPrivate')}</option>
            </select>
          </div>
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.group.groupRules')}</label>
            <textarea
              value={groupData.rules}
              onChange={(e) => setGroupData({ ...groupData, rules: e.target.value })}
              placeholder={t('community.group.enterGroupRules')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none resize-none"
              rows="4"
            />
            <p className="text-gray-400 text-xs mt-1">{t('community.group.rulesHelpText')}</p>
          </div>
        </div>
        
        <div className="p-6 pt-4 pb-20 md:pb-6 flex space-x-3">
          <Button
            onClick={onCreate}
            className="flex-1 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white"
          >
            {t('community.modals.createGroup')}
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;