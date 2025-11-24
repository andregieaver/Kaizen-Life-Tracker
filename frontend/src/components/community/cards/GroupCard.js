import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Users as UsersIcon, Lock, Globe, Edit3, Edit2, Trash2, Crown, Shield } from 'lucide-react';

const GroupCard = ({ group, athleteId, isMember, onJoin, onEdit, onDelete, onClick, isSuperAdmin = false }) => {
  const { t } = useTranslation();
  const isAdmin = group.member_role === 'admin';
  const canEditDelete = isAdmin || isSuperAdmin;
  
  return (
    <div 
      className="border-0 shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all rounded-none md:rounded-3xl" 
      style={{ background: 'var(--grad-surface)' }}
      onClick={onClick}
    >
      <div className="p-0 sm:p-6">
        {group.cover_photo && (
          <div className="mb-4 sm:mb-4">
            <img src={group.cover_photo} alt={group.name} className="w-full h-48 object-cover rounded-none sm:rounded-lg" />
          </div>
        )}
        
        <div className="px-3 sm:px-0 pt-4">
          <div className="flex items-start space-x-3 mb-3">
            {group.profile_image ? (
              <img src={group.profile_image} alt={group.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                <UsersIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white truncate">{group.name}</h3>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                  {group.privacy === 'private' ? (
                    <Lock className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Globe className="w-5 h-5 text-gray-400" />
                  )}
                  {canEditDelete && onEdit && onDelete && (
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(group);
                        }}
                        className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(group.id);
                        }}
                        className="p-1 hover:bg-gray-600 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-gray-300 text-sm line-clamp-2">{group.description}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pb-3 sm:pb-0">
            <span className="text-gray-400 text-sm">{group.members_count} {t('community.group.members')}</span>
            {!isMember && !group.is_member && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin(group.id, group.rules);
                }}
                className="bg-[#32D3FF] hover:bg-[#00a890] text-white text-sm px-4 py-1"
              >
                Join
              </Button>
            )}
            {group.member_role && (
              <span className="text-[#32D3FF] text-sm font-semibold flex items-center">
                {group.member_role === 'admin' && <Crown className="w-4 h-4 mr-1" />}
                {group.member_role === 'manager' && <Shield className="w-4 h-4 mr-1" />}
                {group.member_role === 'moderator' && <Shield className="w-4 h-4 mr-1" />}
                {group.member_role}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupCard;
