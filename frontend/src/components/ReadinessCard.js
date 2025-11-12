import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ReadinessCard = ({ readiness, onRefresh }) => {
  const { t } = useTranslation();
  
  // Helper function to translate backend messages
  const translateBackendMessage = (message) => {
    if (typeof message !== 'string') return message;
    
    // Translate common backend messages
    if (message === 'Insufficient data for accurate calculation') {
      return t('readiness.insufficientData');
    }
    if (message === 'Log more workout and sleep data for better insights') {
      return t('readiness.logMoreData');
    }
    
    return message;
  };
  
  if (!readiness) {
    return (
      <Card className="border-0 shadow-lg" style={{ 
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
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
          <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>{t('readiness.title')}</CardTitle>
          <CardDescription style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="skeleton h-20 rounded-lg" style={{ background: 'var(--bg-700)' }}></div>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 85) return { text: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' };
    if (score >= 70) return { text: '#32D3FF', bg: 'rgba(50, 211, 255, 0.1)', border: 'rgba(50, 211, 255, 0.3)' };
    if (score >= 50) return { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' };
    return { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return t('readiness.excellent');
    if (score >= 70) return t('readiness.good');
    if (score >= 50) return t('readiness.fair');
    return t('readiness.poor');
  };

  const getScoreIcon = (score) => {
    if (score >= 70) return <TrendingUp className="w-5 h-5" />;
    if (score >= 50) return <Minus className="w-5 h-5" />;
    return <TrendingDown className="w-5 h-5" />;
  };

  const scoreColors = getScoreColor(readiness.readiness_score);

  return (
    <Card className="border-0 shadow-lg overflow-hidden" style={{ 
      background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
      backdropFilter: 'blur(12px) saturate(140%)',
      WebkitBackdropFilter: 'blur(12px) saturate(140%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
      borderRadius: '8px',
      color: 'var(--text-hi)'
    }}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-display" style={{ color: 'var(--text-hi)' }}>{t('readiness.title')}</CardTitle>
            <CardDescription style={{ color: 'var(--text-muted)' }}>
              {new Date(readiness.date).toLocaleDateString(undefined, { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="hover-lift"
            data-testid="refresh-readiness-btn"
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
      
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="text-center">
          <div 
            className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 readiness-score"
            style={{
              color: scoreColors.text,
              backgroundColor: scoreColors.bg,
              borderColor: scoreColors.border
            }}
          >
            <div>
              <div className="text-3xl font-bold" style={{ color: scoreColors.text }}>{readiness.readiness_score}</div>
              <div className="text-xs font-medium" style={{ color: scoreColors.text }}>/ {t('readiness.maxScore')}</div>
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
              {getScoreIcon(readiness.readiness_score)}
              <span className="ml-1">{getScoreLabel(readiness.readiness_score)}</span>
            </Badge>
          </div>
        </div>

        {/* Contributing Factors */}
        {readiness.factors && Object.keys(readiness.factors).length > 0 && (
          <div>
            <h4 className="font-medium mb-3" style={{ color: 'var(--text-hi)' }}>{t('readiness.contributingFactors')}</h4>
            <div className="space-y-2">
              {Object.entries(readiness.factors).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="capitalize" style={{ color: 'var(--text-muted)' }}>
                    {key.replace('_', ' ')}
                  </span>
                  <span className="font-medium" style={{ color: 'var(--text-med)' }}>{translateBackendMessage(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {readiness.recommendations && readiness.recommendations.length > 0 && (
          <div>
            <h4 className="font-medium mb-3" style={{ color: 'var(--text-hi)' }}>{t('readiness.todaysRecommendations')}</h4>
            <div className="space-y-2">
              {readiness.recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="p-3 rounded-lg text-sm"
                  data-testid={`recommendation-${index}`}
                  style={{
                    backgroundColor: 'rgba(50, 211, 255, 0.1)',
                    border: '1px solid rgba(50, 211, 255, 0.3)',
                    color: '#32D3FF'
                  }}
                >
                  {translateBackendMessage(rec)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReadinessCard;
