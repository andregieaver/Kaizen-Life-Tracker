import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, MapPin, Edit3, Edit2, Trash2, Star } from 'lucide-react';

const EventCard = ({ event, athleteId, onRSVP, onEdit, onDelete, onClick, isSuperAdmin = false }) => {
  const { t } = useTranslation();
  return (
  <div 
    className="border-0 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow rounded-none md:rounded-3xl"
    style={{ background: 'var(--grad-surface)' }}
    onClick={() => onClick(event.id)}
  >
    <div className="p-0 sm:p-6">
      {event.cover_photo && (
        <div className="mb-4 sm:mb-4 relative">
          <img src={event.cover_photo} alt={event.name} className="w-full h-48 object-cover rounded-none sm:rounded-lg" />
          
          {/* Event Icon - Positioned on Banner */}
          <div className="absolute bottom-3 left-3">
            {event.profile_image ? (
              <img src={event.profile_image} alt={event.name} className="w-16 h-16 rounded-full object-cover border-4 border-gray-800 shadow-lg" />
            ) : (
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-800 shadow-lg">
                <Calendar className="w-8 h-8 text-[#00C2A8]" />
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="px-3 sm:px-0">
        <div className="mb-3">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-xl font-bold text-white truncate">{event.name}</h3>
            {(event.creator_id === athleteId || isSuperAdmin) && (
              <div className="flex space-x-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(event);
                  }}
                  className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(event.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}
          </div>
          <p className="text-gray-300 text-sm line-clamp-2 mb-2">{event.description}</p>
          
          <div className="space-y-1">
            <div className="flex items-center text-gray-400 text-sm">
              <Clock className="w-4 h-4 mr-2" />
              {new Date(event.event_date).toLocaleDateString()} {t('community.event.at')} {event.event_time}
            </div>
            {event.location && (
              <div className="flex items-center text-gray-400 text-sm">
                <MapPin className="w-4 h-4 mr-2" />
                {event.location}
              </div>
            )}
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-gray-400">{event.interested_count || 0} {t('community.event.interested')}</span>
              <span className="text-gray-400">{event.going_count || 0} {t('community.event.going')}</span>
              <span className="text-gray-400">{event.comments_count || 0} {t('community.challenge.comments')}</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2 mt-4 pb-3 sm:pb-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRSVP(event.id, event.user_status === 'interested' ? 'not_going' : 'interested');
            }}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              event.user_status === 'interested'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
          >
            <Star className={`w-4 h-4 inline mr-2 ${event.user_status === 'interested' ? 'fill-current' : ''}`} />
            {t('community.event.interested')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRSVP(event.id, event.user_status === 'going' ? 'not_going' : 'going');
            }}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              event.user_status === 'going'
                ? 'bg-[#00C2A8] text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
          >
            {t('community.event.going')}!
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};

// ============================================================================


export default EventCard;
