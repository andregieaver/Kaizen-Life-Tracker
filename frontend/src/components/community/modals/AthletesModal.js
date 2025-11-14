import React from 'react';
import { X, UserPlus, UserMinus, Search } from 'lucide-react';
import SubscriptionBadge from '../../SubscriptionBadge';
import FlagIcon from '../../FlagIcon';

const AthletesModal = ({ athletes, loading, searchQuery, onSearchChange, onClose, onFollowToggle, onViewProfile, t }) => {
  const [nationalityFilter, setNationalityFilter] = React.useState('all');
  
  // Get unique nationalities
  const uniqueNationalities = React.useMemo(() => {
    return [...new Set(athletes.map(a => a.nationality).filter(n => n))].sort();
  }, [athletes]);
  
  // Filter athletes by nationality
  const filteredAthletes = React.useMemo(() => {
    if (nationalityFilter === 'all') return athletes;
    return athletes.filter(a => a.nationality === nationalityFilter);
  }, [athletes, nationalityFilter]);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4">
      <div className="rounded-none md:rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col border-0 shadow-lg overflow-hidden" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Find Athletes</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={t('community.group.searchByName')}
              className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-3 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none"
            />
          </div>
        </div>

        {/* Nationality Filter */}
        <div className="mb-4">
          <select
            value={nationalityFilter}
            onChange={(e) => setNationalityFilter(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-[#00C2A8] focus:ring-2 focus:ring-[#00C2A8]/20 outline-none text-sm"
          >
            <option value="all">{t('community.post.allNationalities')}</option>
            {uniqueNationalities.map(nationality => (
              <option key={nationality} value={nationality}>{nationality}</option>
            ))}
          </select>
        </div>

        {/* Athletes List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredAthletes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No athletes found</p>
            </div>
          ) : (
            filteredAthletes.map(athlete => (
              <div
                key={athlete.id}
                className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div
                    className="cursor-pointer relative"
                    onClick={() => {
                      onViewProfile(athlete.id);
                      onClose();
                    }}
                  >
                    {athlete.profile_picture ? (
                      <>
                        <img
                          src={athlete.profile_picture}
                          alt={athlete.name}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        <FlagIcon nationality={athlete.nationality} size="medium" />
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xl">
                            {athlete.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <FlagIcon nationality={athlete.nationality} size="medium" />
                      </>
                    )}
                  </div>
                  
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      onViewProfile(athlete.id);
                      onClose();
                    }}
                  >
                    <p className="text-white font-semibold hover:underline flex items-center">
                      {athlete.name}
                      <SubscriptionBadge subscriptionTier={athlete.subscription_tier} />
                    </p>
                    {athlete.bio && (
                      <p className="text-gray-400 text-sm line-clamp-1">{athlete.bio}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-gray-400 text-xs">{athlete.posts_count} {t('community.posts').toLowerCase()}</span>
                      <span className="text-gray-400 text-xs">{athlete.followers_count} {t('community.followers').toLowerCase()}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => onFollowToggle(athlete.id)}
                    className={`${
                      athlete.is_following
                        ? 'bg-gray-600 hover:bg-gray-500'
                        : 'bg-[#00C2A8] hover:bg-[#00a890]'
                    } text-white text-sm p-2`}
                    title={athlete.is_following ? t('athlete.unfollow') : t('athlete.follow')}
                  >
                    {athlete.is_following ? (
                      <UserMinus className="w-5 h-5" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

// GroupRulesModal Component


export default AthletesModal;
