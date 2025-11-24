import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';
import ChallengeCard from '../cards/ChallengeCard';

const CommunityChallenges = ({
  challenges,
  athleteId,
  isSuperAdmin,
  challengeFilter,
  onFilterChange,
  onJoin,
  onLeave,
  onDelete,
  onEdit,
  onClick
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-0 sm:gap-4">
        {/* Filter buttons */}
        <div className="flex gap-0 md:gap-2 w-full sm:w-auto">
          {['all', 'active', 'completed', 'joined'].map(filter => (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-none md:rounded-lg text-sm font-medium transition-all ${
                challengeFilter === filter
                  ? 'bg-[#32D3FF] text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {t(`community.challenge.${filter}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-4">
        {challenges.map(challenge => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            athleteId={athleteId}
            onJoin={() => onJoin(challenge.id)}
            onLeave={() => onLeave(challenge.id)}
            onDelete={() => onDelete(challenge.id)}
            onEdit={onEdit}
            onClick={() => onClick(challenge.id)}
            isSuperAdmin={isSuperAdmin}
            t={t}
          />
        ))}
      </div>

      {challenges.length === 0 && (
        <div className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800" style={{ background: 'var(--grad-surface)' }}>
          <div className="p-12 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 text-lg">
              {challengeFilter === 'all' && t('community.challenge.noChallengesAll')}
              {challengeFilter === 'active' && t('community.challenge.noChallengesActive')}
              {challengeFilter === 'completed' && t('community.challenge.noChallengesCompleted')}
              {challengeFilter === 'joined' && t('community.challenge.noChallengesJoined')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityChallenges;
