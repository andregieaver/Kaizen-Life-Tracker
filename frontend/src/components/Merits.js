import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trophy, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Merits = ({ athleteId }) => {
  const { t } = useTranslation();
  const [merits, setMerits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMerits();
  }, [athleteId]);

  const loadMerits = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/merits/${athleteId}`);
      setMerits(response.data);
    } catch (error) {
      console.error('Error loading merits:', error);
      setMerits([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '-';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const distances = [
    { key: '1km', label: t('recipeBrowser.distances.1km') },
    { key: '1mile', label: t('recipeBrowser.distances.1mile') },
    { key: '5km', label: t('recipeBrowser.distances.5km') },
    { key: '10km', label: t('recipeBrowser.distances.10km') },
    { key: 'half_marathon', label: t('recipeBrowser.distances.halfMarathon') },
    { key: 'marathon', label: t('recipeBrowser.distances.marathon') }
  ];

  if (isLoading) {
    return (
      <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4">
          <h2 className="flex items-center text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
            <Trophy className="w-5 h-5 mr-2" style={{ color: 'var(--c-warning)' }} />
            Merits
          </h2>
        </div>
        <div className="px-4 pb-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 rounded" style={{ background: 'var(--bg-800)' }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
      <div className="p-4 pb-3">
        <h2 className="flex items-center text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
          <Trophy className="w-5 h-5 mr-2" style={{ color: 'var(--c-warning)' }} />
          {t('merits.title')}
        </h2>
      </div>
      <div className="px-4 pb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-med)' }}>{t('merits.distance')}</th>
                <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-med)' }}>
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" style={{ color: 'var(--c-info)' }} />
                    {t('merits.last12Months')}
                  </div>
                </th>
                <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-med)' }}>
                  <Trophy className="w-4 h-4 inline mr-1" style={{ color: 'var(--c-warning)' }} />
                  {t('merits.allTimeBest')}
                </th>
              </tr>
            </thead>
            <tbody>
              {distances.map((distance) => {
                const merit = merits.find(m => m.distance === distance.key);
                const hasRecent = merit?.recent_best;
                const hasAllTime = merit?.all_time_best;
                const isPersonalBest = hasRecent && hasAllTime && merit.recent_best === merit.all_time_best;

                return (
                  <tr key={distance.key} className="transition-colors duration-150" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-2 font-medium" style={{ color: 'var(--text-hi)' }}>{distance.label}</td>
                    <td className="py-3 px-2">
                      {hasRecent ? (
                        <span className="font-mono" style={{ 
                          color: isPersonalBest ? 'var(--c-info)' : 'var(--text-med)',
                          fontFamily: 'var(--font-display)'
                        }}>
                          {formatTime(merit.recent_best)}
                          {isPersonalBest && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ 
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: 'var(--c-info)'
                            }}>{t('merits.personalBest')}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('merits.noData')}</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {hasAllTime ? (
                        <span className="font-mono font-semibold" style={{ color: 'var(--c-brand-500)', fontFamily: 'var(--font-display)' }}>{formatTime(merit.all_time_best)}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('merits.noData')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {merits.length === 0 && (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-med)' }}>{t('merits.noRecords')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('merits.completeWorkouts')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Merits;
