import React from 'react';
import GroupCard from '../cards/GroupCard';

const CommunityMyGroups = ({
  myGroups,
  athleteId,
  isSuperAdmin,
  onEdit,
  onDelete,
  onClick
}) => {
  return (
    <div className="space-y-6 pt-12 md:pt-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myGroups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            athleteId={athleteId}
            isMember={true}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </div>

      {myGroups.length === 0 && (
        <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-12 text-center">
            <p className="text-gray-400 text-lg">You haven't joined any groups yet.</p>
            <p className="text-gray-500 text-sm mt-2">Browse the Groups tab to find communities to join!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityMyGroups;
