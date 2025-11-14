import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, Calendar } from 'lucide-react';
import { compressThumbnail, compressBannerImage } from '../../../utils/imageCompression';
import EmojiPickerButton from '../../EmojiPickerButton';
import { logger } from '../../../utils/logger';

const CreateEventModal = ({ eventData, setEventData, onClose, onCreate, myGroups, onEmojiSelect }) => {
  const { t } = useTranslation();
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image based on type
        const compressed = type === 'profile_image' 
          ? await compressThumbnail(file)
          : await compressBannerImage(file);
        setEventData({ ...eventData, [type]: compressed });
      } catch (error) {
        logger.error(null, 'Error compressing image:', error);
        alert(t('community.messages.failedToProcessImage'));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="rounded-none md:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden"
        style={{ background: 'var(--grad-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('community.modals.createEvent')}</h2>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Profile Image */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.eventIcon')}</label>
            <div className="flex items-center space-x-4">
              {eventData.profile_image ? (
                <img src={eventData.profile_image} alt="Icon" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'profile_image')} className="hidden" />
                <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm">
                  {eventData.profile_image ? t('common.change') : t('common.upload')}
                </div>
              </label>
              {eventData.profile_image && (
                <button onClick={() => setEventData({ ...eventData, profile_image: null })} className="p-2 bg-red-500 hover:bg-red-600 rounded-lg">
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Banner */}
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.banner')}</label>
            {eventData.cover_photo && (
              <div className="relative mb-2">
                <img src={eventData.cover_photo} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                <button onClick={() => setEventData({ ...eventData, cover_photo: null })} className="absolute top-2 right-2 p-1 bg-red-500 rounded-full">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'cover_photo')} className="hidden" />
              <div className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm inline-block">
                {eventData.cover_photo ? t('common.change') : t('common.upload')}
              </div>
            </label>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.eventName')}</label>
            <input
              type="text"
              value={eventData.name}
              onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
              placeholder={t('community.event.enterEventName')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('common.description')}</label>
            <div className="relative">
              <textarea
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                placeholder={t('community.event.describeEvent')}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none resize-none"
                rows="3"
              />
              <div className="absolute bottom-2 right-2">
                <EmojiPickerButton onEmojiSelect={onEmojiSelect} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.date')}</label>
              <input
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.time')}</label>
              <input
                type="time"
                value={eventData.event_time}
                onChange={(e) => setEventData({ ...eventData, event_time: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.location')}</label>
            <input
              type="text"
              value={eventData.location}
              onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
              placeholder={t('community.event.eventLocation')}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
          
          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.visibility')}</label>
            <select
              value={eventData.visibility}
              onChange={(e) => setEventData({ ...eventData, visibility: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="open">{t('community.event.visibilityOpen')}</option>
              <option value="private">{t('community.event.visibilityPrivate')}</option>
            </select>
          </div>

          <div>
            <label className="text-white text-sm font-semibold mb-2 block">{t('community.event.connectToGroup')}</label>
            <select
              value={eventData.group_id || ''}
              onChange={(e) => setEventData({ ...eventData, group_id: e.target.value || null })}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            >
              <option value="">{t('community.event.noGroup')}</option>
              {myGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">{t('community.event.groupNotificationHelp')}</p>
          </div>
        </div>
        
        <div className="p-6 pt-4 flex space-x-3">
          <Button onClick={onCreate} className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white">
            {t('common.createEvent')}
          </Button>
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateEventModal;