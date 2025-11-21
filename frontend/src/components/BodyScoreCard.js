import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateBodyScore } from '../utils/bodyScoreCalculations';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BodyScoreCard = ({ athleteId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [streak, setStreak] = useState(0);
  
  // Fetch health data from backend
  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add cache-busting headers to force fresh data
      const response = await axios.get(`${API}/health/body-score-data/${athleteId}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        params: {
          _t: Date.now() // Cache-busting timestamp
        }
      });
      
      console.log('[BodyScoreCard] API Response:', response.data);
      console.log('[BodyScoreCard] oura_sleep_score:', response.data.oura_sleep_score);
      console.log('[BodyScoreCard] resting_heart_rate:', response.data.resting_heart_rate);
      console.log('[BodyScoreCard] missing_data:', response.data.missing_data);
      setHealthData(response.data);
    } catch (err) {
      console.error('Error fetching body score data:', err);
      setError(err.response?.data?.detail || 'Failed to load body score data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (athleteId) {
      fetchHealthData();
    }
  }, [athleteId]);
  
  // Calculate body score using the utility function
  const scoreResult = useMemo(() => {
    if (!healthData) return null;
    return calculateBodyScore(healthData);
  }, [healthData]);
  
  const getScoreColor = (score) => {
    if (score >= 85) return { text: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' };
    if (score >= 70) return { text: '#32D3FF', bg: 'rgba(50, 211, 255, 0.1)', border: 'rgba(50, 211, 255, 0.3)' };
    if (score >= 50) return { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' };
    return { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return t('bodyScore.excellent');
    if (score >= 70) return t('bodyScore.good');
    if (score >= 50) return t('bodyScore.fair');
    return t('bodyScore.poor');
  };

  const getScoreIcon = (score) => {
    if (score >= 70) return <TrendingUp className="w-5 h-5" />;
    if (score >= 50) return <Minus className="w-5 h-5" />;
    return <TrendingDown className="w-5 h-5" />;
  };
  
  if (loading) {
    return (
      <Card className="border-0 shadow-lg" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
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
        `,
        borderRadius: '8px',
        color: 'var(--text-hi)'
      }}>
        <CardHeader>
          <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>{t('bodyScore.title')}</CardTitle>
          <CardDescription style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="skeleton h-20 rounded-lg" style={{ background: 'var(--bg-700)' }}></div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="border-0 shadow-lg" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `
          inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
          inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
          inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
          inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
          inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
          inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(--glass-reflex-dark) * 20%), transparent),
          inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
        `,
        borderRadius: '8px',
        color: 'var(--text-hi)'
      }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>{t('bodyScore.title')}</CardTitle>
              <CardDescription style={{ color: 'var(--text-muted)' }}>{t('bodyScore.error')}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchHealthData}
              className="hover-lift"
              style={{ 
                borderColor: 'var(--border)', 
                background: 'var(--bg-700)',
                color: 'var(--text-med)'
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!scoreResult || scoreResult.available === 0) {
    return (
      <Card className="border-0 shadow-lg" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
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
        `,
        borderRadius: '8px',
        color: 'var(--text-hi)'
      }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>{t('bodyScore.title')}</CardTitle>
              <CardDescription style={{ color: 'var(--text-muted)' }}>{t('bodyScore.noData')}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchHealthData}
              className="hover-lift"
              style={{ 
                borderColor: 'var(--border)', 
                background: 'var(--bg-700)',
                color: 'var(--text-med)'
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('bodyScore.connectIntegrations')}
            </p>
            {healthData?.missing_data && healthData.missing_data.length > 0 && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{t('bodyScore.missingData')}: </span>
                <span className="font-medium">{healthData.missing_data.join(', ')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreColors = getScoreColor(scoreResult.totalScore);

  return (
    <Card className="border-0 shadow-lg overflow-hidden" style={{ 
      background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
      backdropFilter: 'blur(24px) saturate(140%)',
      WebkitBackdropFilter: 'blur(24px) saturate(140%)',
      borderRadius: '12px',
      color: 'var(--text-hi)',
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
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>{t('bodyScore.title')}</CardTitle>
            <CardDescription style={{ color: 'var(--text-muted)' }}>
              {t('bodyScore.description')}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHealthData}
            disabled={loading}
            className="hover-lift"
            data-testid="refresh-body-score-btn"
            style={{ 
              borderColor: 'var(--border)', 
              background: 'var(--bg-700)',
              color: 'var(--text-med)',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="text-center">
          <div 
            className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 body-score"
            style={{
              color: scoreColors.text,
              backgroundColor: scoreColors.bg,
              borderColor: scoreColors.border
            }}
          >
            <div>
              <div className="text-3xl font-bold" style={{ color: scoreColors.text }}>{scoreResult.totalScore}</div>
              <div className="text-xs font-medium" style={{ color: scoreColors.text }}>/ 100</div>
            </div>
          </div>
          <div className="mt-3">
            <Badge 
              variant="secondary" 
              className="border font-medium"
              style={{
                color: scoreColors.text,
                backgroundColor: scoreColors.bg,
                borderColor: scoreColors.border
              }}
            >
              {getScoreIcon(scoreResult.totalScore)}
              <span className="ml-1">{getScoreLabel(scoreResult.totalScore)}</span>
            </Badge>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {t('bodyScore.componentsUsed', { count: scoreResult.available, total: scoreResult.total })}
          </p>
        </div>

        {/* Expandable Components Breakdown */}
        {scoreResult.components && scoreResult.components.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between p-2"
              style={{ color: 'var(--text-med)' }}
            >
              <span className="font-medium">{t('bodyScore.viewBreakdown')}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {expanded && (
              <div className="space-y-2 mt-3">
                {scoreResult.components.map((component) => (
                  <div key={component.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>
                        {component.label} ({component.nWeight.toFixed(1)}%)
                      </span>
                      <span className="font-medium" style={{ color: 'var(--text-med)' }}>
                        {component.score}/100
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-700)' }}>
                      <div 
                        className="h-2 transition-all duration-300"
                        style={{ 
                          width: `${component.score}%`,
                          backgroundColor: '#32D3FF'
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drivers & Drags */}
        {expanded && (scoreResult.drivers.length > 0 || scoreResult.drags.length > 0) && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: '#22C55E' }}>{t('bodyScore.topDrivers')}</h4>
              {scoreResult.drivers.length > 0 ? scoreResult.drivers.map(d => (
                <div key={d.key} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {d.label}: <span className="font-medium">{Math.round(d.score)}/100</span>
                </div>
              )) : <div className="text-xs" style={{ color: 'var(--text-muted)' }}>—</div>}
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: '#EF4444' }}>{t('bodyScore.topDrags')}</h4>
              {scoreResult.drags.length > 0 ? scoreResult.drags.map(d => (
                <div key={d.key} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {d.label}: <span className="font-medium">{Math.round(d.score)}/100</span>
                </div>
              )) : <div className="text-xs" style={{ color: 'var(--text-muted)' }}>—</div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BodyScoreCard;
