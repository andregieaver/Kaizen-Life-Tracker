import React from 'react';
import GroupCard from '../cards/GroupCard';

const CommunityGroups = ({
  groups,
  athleteId,
  isSuperAdmin,
  onJoin,
  onEdit,
  onDelete,
  onClick
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            athleteId={athleteId}
            onJoin={onJoin}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </div>

      {groups.length === 0 && (
        <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-12 text-center">
            <p className="text-gray-400 text-lg">No groups available yet. Create the first one!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityGroups;
