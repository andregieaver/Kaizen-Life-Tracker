import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trophy, TrendingUp, Activity, Calendar, MapPin, Clock, Zap } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Merits = ({ athleteId }) => {
  const { t } = useTranslation();
  const [merits, setMerits] = useState([]);
  const [stravaStats, setStravaStats] = useState(null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  useEffect(() => {
    loadMerits();
    loadStravaStats();
    loadRecentActivities();
  }, [athleteId]);

  const loadMerits = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/merits/${athleteId}`);
      setMerits(response.data);
    } catch (error) {
      // Silently fail - non-critical feature
      setMerits([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStravaStats = async () => {
    try {
      const response = await axios.get(`${API}/integrations/strava/${athleteId}/stats`);
      setStravaStats(response.data);
    } catch (error) {
      // Silently fail - Strava might not be connected
      setStravaStats(null);
    }
  };

  const loadRecentActivities = async () => {
    try {
      setIsLoadingActivities(true);
      const response = await axios.get(`${API}/integrations/strava/${athleteId}/activities?limit=5`);
      setStravaActivities(response.data.activities || []);
    } catch (error) {
      setStravaActivities([]);
    } finally {
      setIsLoadingActivities(false);
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
      <div className="border-0 shadow-lg overflow-hidden" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
        borderRadius: '8px'
      }}>
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
    <div className="space-y-4">
      {/* Strava Stats Overview */}
      {stravaStats && stravaStats.total_activities > 0 && (
        <div className="border-0 shadow-lg overflow-hidden" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="flex items-center text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
              <Activity className="w-5 h-5 mr-2" style={{ color: '#FC4C02' }} />
              Strava Statistics
            </h2>
          </div>
          <div className="p-4">
            {/* YTD Stats Grid */}
            <div className="mb-3">
              <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-med)' }}>Year to Date 2025</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-800)' }}>
                <div className="text-xl font-bold truncate" style={{ color: 'var(--c-brand-500)', fontFamily: 'var(--font-display)' }}>
                  {stravaStats.total_activities}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-med)' }}>Activities</div>
              </div>
              <div className="text-center p-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-800)' }}>
                <div className="text-xl font-bold truncate" style={{ color: 'var(--c-brand-500)', fontFamily: 'var(--font-display)' }}>
                  {stravaStats.total_distance_km.toLocaleString()}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-med)' }}>Kilometers</div>
              </div>
              <div className="text-center p-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-800)' }}>
                <div className="text-xl font-bold truncate" style={{ color: 'var(--c-brand-500)', fontFamily: 'var(--font-display)' }}>
                  {stravaStats.total_time_hours.toLocaleString()}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-med)' }}>Hours</div>
              </div>
              <div className="text-center p-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-800)' }}>
                <div className="text-xl font-bold truncate" style={{ color: 'var(--c-brand-500)', fontFamily: 'var(--font-display)' }}>
                  {stravaStats.total_elevation_m.toLocaleString()}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-med)' }}>Elevation (m)</div>
              </div>
            </div>

            {/* Best Times Grid */}
            {stravaStats.best_times && Object.keys(stravaStats.best_times).length > 0 && (
              <div className="mt-4 mb-4">
                <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-med)' }}>Personal Records (All-Time)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(stravaStats.best_times).map(([distance, data]) => (
                    <div 
                      key={distance}
                      className="p-3 rounded-lg overflow-hidden" 
                      style={{ background: 'var(--bg-800)', border: '1px solid var(--border)' }}
                    >
                      <div className="text-xs mb-1" style={{ color: 'var(--text-med)' }}>{distance}</div>
                      <div className="text-lg font-bold truncate" style={{ color: '#FC4C02', fontFamily: 'var(--font-display)' }}>
                        {data.time}
                      </div>
                      <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                        {new Date(data.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activities */}
            {stravaActivities.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-hi)' }}>Recent Activities</h3>
                <div className="space-y-2">
                  {stravaActivities.map((activity, index) => (
                    <div 
                      key={activity.id || index}
                      className="p-3 rounded-lg transition-colors duration-150" 
                      style={{ 
                        background: 'var(--bg-800)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ 
                              background: 'rgba(252, 76, 2, 0.2)',
                              color: '#FC4C02'
                            }}>
                              {activity.type}
                            </span>
                            <h4 className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>
                              {activity.name}
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-med)' }}>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(activity.start_date).toLocaleDateString()}
                            </span>
                            {activity.distance > 0 && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {(activity.distance / 1000).toFixed(2)} km
                              </span>
                            )}
                            {activity.moving_time > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {Math.floor(activity.moving_time / 60)} min
                              </span>
                            )}
                            {activity.average_heartrate && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {Math.round(activity.average_heartrate)} bpm
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Merits Table */}
      <div className="border-0 shadow-lg overflow-hidden" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
        borderRadius: '8px'
      }}>
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
    </div>
  );
};

export default Merits;
