import React from 'react';
import EventCard from '../cards/EventCard';

const CommunityEvents = ({
  events,
  athleteId,
  isSuperAdmin,
  onRSVP,
  onEdit,
  onDelete,
  onClick
}) => {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-4">
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            athleteId={athleteId}
            onRSVP={onRSVP}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </div>

      {events.length === 0 && (
        <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-12 text-center">
            <p className="text-gray-400 text-lg">No events yet. Create the first event!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityEvents;
