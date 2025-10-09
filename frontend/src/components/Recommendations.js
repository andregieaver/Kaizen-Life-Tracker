import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Brain, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Heart, 
  Activity,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Recommendations = ({ athleteId }) => {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  useEffect(() => {
    loadRecommendations();
  }, [athleteId]);

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/recommendations/${athleteId}`);
      setRecommendations(response.data);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'recovery_analysis':
        return <Heart className="w-5 h-5 text-red-600" />;
      case 'training_analysis':
        return <Activity className="w-5 h-5 text-blue-600" />;
      case 'sleep_analysis':
        return <Brain className="w-5 h-5 text-purple-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now - time) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-8 w-64 mb-6"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900">
            {t('reports.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('reports.description')}
          </p>
        </div>
        <Button 
          onClick={loadRecommendations}
          variant="outline"
          className="btn-transition"
          data-testid="refresh-recommendations-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('common.sync')}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {recommendations.length}
            </div>
            <div className="text-sm text-gray-600">{t('reports.totalReports')}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {recommendations.filter(r => r.priority === 'high').length}
            </div>
            <div className="text-sm text-gray-600">{t('reports.highPriority')}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {recommendations.filter(r => 
                new Date(r.generated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
              ).length}
            </div>
            <div className="text-sm text-gray-600">Today</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(recommendations.flatMap(r => r.tags || [])).size}
            </div>
            <div className="text-sm text-gray-600">Topics</div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-12">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">{t('reports.noReports')}</p>
              <p className="text-sm text-gray-400">
                {t('reports.setupSchedules')}
              </p>
            </CardContent>
          </Card>
        ) : (
          recommendations.map((recommendation) => (
            <Card 
              key={recommendation.id} 
              className="border-0 shadow-lg hover-lift cursor-pointer"
              onClick={() => setSelectedRecommendation(recommendation)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1">
                      {getTypeIcon(recommendation.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {recommendation.title}
                      </h3>
                      <p className="text-gray-600 mb-3">
                        {recommendation.summary}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTimeAgo(recommendation.generated_at)}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {recommendation.scheduled_prompt}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      className={`${getPriorityColor(recommendation.priority)} border font-medium`}
                    >
                      {recommendation.priority}
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                
                {recommendation.tags && (
                  <div className="flex flex-wrap gap-2">
                    {recommendation.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recommendation Detail Modal */}
      {selectedRecommendation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(selectedRecommendation.type)}
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedRecommendation.title}
                  </h2>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => setSelectedRecommendation(null)}
                  data-testid="close-recommendation-btn"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                  {selectedRecommendation.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recommendations;