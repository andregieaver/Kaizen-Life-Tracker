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
      <Card className="border-0 shadow-lg" style={{ background: 'var(--bg-800)', color: 'var(--text-hi)' }}>
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

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-display">{t('readiness.title')}</CardTitle>
            <CardDescription>
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
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 readiness-score ${getScoreColor(readiness.readiness_score)}`}>
            <div>
              <div className="text-3xl font-bold">{readiness.readiness_score}</div>
              <div className="text-xs font-medium">/ {t('readiness.maxScore')}</div>
            </div>
          </div>
          <div className="mt-3">
            <Badge 
              variant="secondary" 
              className={`${getScoreColor(readiness.readiness_score)} border font-medium`}
            >
              {getScoreIcon(readiness.readiness_score)}
              <span className="ml-1">{getScoreLabel(readiness.readiness_score)}</span>
            </Badge>
          </div>
        </div>

        {/* Contributing Factors */}
        {readiness.factors && Object.keys(readiness.factors).length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">{t('readiness.contributingFactors')}</h4>
            <div className="space-y-2">
              {Object.entries(readiness.factors).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">
                    {key.replace('_', ' ')}
                  </span>
                  <span className="text-gray-900 font-medium">{translateBackendMessage(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {readiness.recommendations && readiness.recommendations.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">{t('readiness.todaysRecommendations')}</h4>
            <div className="space-y-2">
              {readiness.recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800"
                  data-testid={`recommendation-${index}`}
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
