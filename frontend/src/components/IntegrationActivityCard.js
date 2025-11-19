import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { RefreshCw, Activity, Clock, TrendingUp, MapPin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const INTEGRATION_CONFIG = {
  strava: {
    name: 'Strava',
    icon: Activity,
    color: '#FC4C02',
    endpoint: 'strava'
  },
  polar: {
    name: 'Polar',
    icon: Activity,
    color: '#ED1B24',
    endpoint: 'polar'
  },
  fitbit: {
    name: 'Fitbit',
    icon: Activity,
    color: '#00B0B9',
    endpoint: 'fitbit'
  },
  garmin: {
    name: 'Garmin',
    icon: Activity,
    color: '#007CC3',
    endpoint: 'garmin'
  },
  coros: {
    name: 'Coros',
    icon: Activity,
    color: '#E85D04',
    endpoint: 'coros'
  },
  whoop: {
    name: 'Whoop',
    icon: Activity,
    color: '#FFD700',
    endpoint: 'whoop'
  },
  suunto: {
    name: 'Suunto',
    icon: Activity,
    color: '#FF0000',
    endpoint: 'suunto'
  }
};

const IntegrationActivityCard = ({ athleteId, integration }) => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const config = INTEGRATION_CONFIG[integration];
  const Icon = config.icon;

  useEffect(() => {
    loadIntegrationData();
  }, [athleteId, integration]);

  const loadIntegrationData = async (forceSync = false) => {
    try {
      setIsLoading(true);
      
      // Check if integration is connected
      const statusResponse = await axios.get(`${API}/integrations/${config.endpoint}/${athleteId}/status`);
      
      setConnected(statusResponse.data.connected);
      
      if (!statusResponse.data.connected) {
        setIsLoading(false);
        return;
      }

      // If force sync, trigger a sync first
      if (forceSync) {
        try {
          await axios.post(`${API}/integrations/${config.endpoint}/${athleteId}/sync`);
          // Wait a moment for sync to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (syncError) {
          console.error(`Error syncing ${config.name} data:`, syncError);
        }
      }

      // Get latest activities from database
      const activitiesResponse = await axios.get(`${API}/integrations/${config.endpoint}/${athleteId}/activities?limit=5`);
      
      if (activitiesResponse.data && activitiesResponse.data.length > 0) {
        setActivities(activitiesResponse.data);
      } else {
        setActivities([]);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error(`Error loading ${config.name} data:`, error);
      setConnected(false);
      setIsLoading(false);
    }
  };

  // Don't render if not connected
  if (!connected && !isLoading) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden" style={{ 
      background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
      backdropFilter: 'blur(24px) saturate(140%)',
      WebkitBackdropFilter: 'blur(24px) saturate(140%)',
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
          <CardTitle className="flex items-center" style={{ color: 'var(--text-hi)' }}>
            <Icon className="w-5 h-5 mr-2" style={{ color: config.color }} />
            {t(`dashboard.${integration}.title`, config.name + ' Activities')}
          </CardTitle>
          <button 
            onClick={() => loadIntegrationData(true)}
            className="p-2 rounded-lg hover:bg-opacity-10 hover:bg-white transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-med)' }} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--text-med)' }} />
            <p className="mt-2" style={{ color: 'var(--text-med)' }}>{t(`dashboard.${integration}.loading`, 'Loading activities...')}</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6">
            <p style={{ color: 'var(--text-med)' }}>{t(`dashboard.${integration}.noActivities`, 'No recent activities')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity, index) => (
              <div 
                key={index} 
                className="p-3 rounded-lg" 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm" style={{ color: 'var(--text-hi)' }}>
                      {activity.name || activity.type || activity.activity_type || 'Activity'}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-med)' }}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activity.duration || activity.moving_time ? `${Math.floor((activity.duration || activity.moving_time) / 60)}m` : 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {activity.distance ? `${(activity.distance / 1000).toFixed(2)}km` : 'N/A'}
                      </span>
                      {(activity.elevation_gain || activity.total_elevation_gain) && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {activity.elevation_gain || activity.total_elevation_gain}m
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--text-lo)' }}>
                      {new Date(activity.start_date || activity.start_time || activity.created_at || activity.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IntegrationActivityCard;
