import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RefreshCw, Moon, Zap, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OuraVitalsCard = ({ athleteId }) => {
  const { t } = useTranslation();
  const [ouraData, setOuraData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadOuraData();
  }, [athleteId]);

  const loadOuraData = async () => {
    try {
      setIsLoading(true);
      
      // Check if Oura is connected
      const statusResponse = await axios.get(`${API}/integrations/oura/${athleteId}/status`);
      setIsConnected(statusResponse.data.connected);
      
      if (!statusResponse.data.connected) {
        setIsLoading(false);
        return;
      }

      // Get latest Oura data
      const activitiesResponse = await axios.get(`${API}/integrations/oura/${athleteId}/activities?limit=10`);
      const activities = activitiesResponse.data.activities || [];
      
      // Find most recent of each type
      const latestSleep = activities.find(a => a.type === 'Sleep');
      const latestReadiness = activities.find(a => a.type === 'Readiness');
      const latestActivity = activities.find(a => a.type === 'Activity');
      
      setOuraData({
        sleep: latestSleep,
        readiness: latestReadiness,
        activity: latestActivity
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading Oura data:', error);
      setIsLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (!score) return { text: 'var(--text-muted)', bg: 'var(--bg-700)', border: 'var(--border)' };
    if (score >= 85) return { text: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' };
    if (score >= 70) return { text: '#A855F7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)' };
    if (score >= 50) return { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' };
    return { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
  };

  const getScoreIcon = (score) => {
    if (!score) return <Minus className="w-4 h-4" />;
    if (score >= 70) return <TrendingUp className="w-4 h-4" />;
    if (score >= 50) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  if (!isConnected && !isLoading) {
    return null; // Don't show card if Oura is not connected
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
        backdropFilter: 'blur(8px) saturate(150%)',
        WebkitBackdropFilter: 'blur(8px) saturate(150%)',
        borderRadius: '12px',
        boxShadow: `
          inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
          inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
          inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
          inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
          inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
          inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
        `
      }}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
              <Moon className="w-5 h-5" style={{ color: '#A855F7' }} />
            </div>
            <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>Oura Ring</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="skeleton h-32 rounded-lg" style={{ background: 'var(--bg-700)' }}></div>
        </CardContent>
      </Card>
    );
  }

  if (!ouraData || (!ouraData.sleep && !ouraData.readiness && !ouraData.activity)) {
    return (
      <Card className="border-0 shadow-lg" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
        backdropFilter: 'blur(8px) saturate(150%)',
        WebkitBackdropFilter: 'blur(8px) saturate(150%)',
        borderRadius: '12px',
        boxShadow: `
          inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
          inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
          inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
          inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
          inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
          inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
        `
      }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
                <Moon className="w-5 h-5" style={{ color: '#A855F7' }} />
              </div>
              <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>Oura Ring</CardTitle>
            </div>
            <button 
              onClick={loadOuraData}
              className="p-2 rounded-lg hover:bg-opacity-10 hover:bg-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-med)' }} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            No recent Oura data. Sync your ring to see vitals.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden" style={{ 
      background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
      backdropFilter: 'blur(12px) saturate(140%)',
      WebkitBackdropFilter: 'blur(12px) saturate(140%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
      borderRadius: '8px'
    }}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
              <Moon className="w-5 h-5" style={{ color: '#A855F7' }} />
            </div>
            <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>Oura Ring</CardTitle>
          </div>
          <button 
            onClick={loadOuraData}
            className="p-2 rounded-lg hover:bg-opacity-10 hover:bg-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-med)' }} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sleep Score */}
          {ouraData.sleep && (
            <div className="flex flex-col p-4 rounded-lg" style={{ 
              background: getScoreColor(ouraData.sleep.score).bg,
              border: `1px solid ${getScoreColor(ouraData.sleep.score).border}`
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Moon className="w-5 h-5" style={{ color: getScoreColor(ouraData.sleep.score).text }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>Sleep</span>
                </div>
                {getScoreIcon(ouraData.sleep.score)}
              </div>
              <div className="text-3xl font-bold font-display" style={{ color: getScoreColor(ouraData.sleep.score).text }}>
                {ouraData.sleep.score || '--'}
              </div>
              {ouraData.sleep.duration && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {Math.floor(ouraData.sleep.duration / 3600)}h {Math.floor((ouraData.sleep.duration % 3600) / 60)}m
                </div>
              )}
            </div>
          )}

          {/* Readiness Score */}
          {ouraData.readiness && (
            <div className="flex flex-col p-4 rounded-lg" style={{ 
              background: getScoreColor(ouraData.readiness.score).bg,
              border: `1px solid ${getScoreColor(ouraData.readiness.score).border}`
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" style={{ color: getScoreColor(ouraData.readiness.score).text }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>Readiness</span>
                </div>
                {getScoreIcon(ouraData.readiness.score)}
              </div>
              <div className="text-3xl font-bold font-display" style={{ color: getScoreColor(ouraData.readiness.score).text }}>
                {ouraData.readiness.score || '--'}
              </div>
              {ouraData.readiness.temperature_deviation !== undefined && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {ouraData.readiness.temperature_deviation > 0 ? '+' : ''}{ouraData.readiness.temperature_deviation.toFixed(1)}°C
                </div>
              )}
            </div>
          )}

          {/* Activity Score */}
          {ouraData.activity && (
            <div className="flex flex-col p-4 rounded-lg" style={{ 
              background: getScoreColor(ouraData.activity.score).bg,
              border: `1px solid ${getScoreColor(ouraData.activity.score).border}`
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" style={{ color: getScoreColor(ouraData.activity.score).text }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-hi)' }}>Activity</span>
                </div>
                {getScoreIcon(ouraData.activity.score)}
              </div>
              <div className="text-3xl font-bold font-display" style={{ color: getScoreColor(ouraData.activity.score).text }}>
                {ouraData.activity.score || '--'}
              </div>
              {ouraData.activity.steps && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {ouraData.activity.steps.toLocaleString()} steps
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OuraVitalsCard;
