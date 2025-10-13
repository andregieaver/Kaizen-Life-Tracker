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
  Info,
  Trash2,
  X
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

  const deleteRecommendation = async (recommendationId, e) => {
    e.stopPropagation(); // Prevent card click when clicking delete
    
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await axios.delete(`${API}/recommendations/${recommendationId}`);
      setRecommendations(recommendations.filter(r => r.id !== recommendationId));
      if (selectedRecommendation && selectedRecommendation.id === recommendationId) {
        setSelectedRecommendation(null);
      }
    } catch (error) {
      console.error('Error deleting recommendation:', error);
      alert('Failed to delete report. Please try again.');
    }
  };

  const markAsRead = async (recommendationId) => {
    try {
      await axios.put(`${API}/recommendations/${recommendationId}/read`);
      setRecommendations(recommendations.map(r => 
        r.id === recommendationId ? { ...r, read: true } : r
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleCardClick = (recommendation) => {
    setSelectedRecommendation(recommendation);
    if (!recommendation.read) {
      markAsRead(recommendation.id);
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
      case 'scheduled_analysis':
        return <Calendar className="w-5 h-5 text-green-600" />;
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

  const formatContent = (content) => {
    // Convert markdown-style formatting to plain text with line breaks
    return content
      .replace(/#{1,6}\s?/g, '') // Remove markdown headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links but keep text
      .split('\n')
      .map((line, idx) => (
        <p key={idx} className="mb-2 last:mb-0">
          {line || <br />}
        </p>
      ));
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto space-y-4">
        <div className="skeleton h-8 w-64 mb-6"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
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
            <div className="text-2xl font-bold text-orange-600">
              {recommendations.filter(r => !r.read).length}
            </div>
            <div className="text-sm text-gray-600">Unread</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {recommendations.filter(r => 
                new Date(r.generated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
              ).length}
            </div>
            <div className="text-sm text-gray-600">{t('reports.today')}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(recommendations.flatMap(r => r.tags || [])).size}
            </div>
            <div className="text-sm text-gray-600">{t('reports.topics')}</div>
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
              className={`border-0 shadow-lg hover-lift cursor-pointer transition-all ${
                !recommendation.read 
                  ? 'ring-2 ring-blue-400 bg-white' 
                  : 'hover:shadow-xl'
              }`}
              onClick={() => handleCardClick(recommendation)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1">
                      {getTypeIcon(recommendation.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {recommendation.title}
                        </h3>
                        {!recommendation.read && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTimeAgo(recommendation.generated_at)}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => deleteRecommendation(recommendation.id, e)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                
                {recommendation.tags && (
                  <div className="flex flex-wrap gap-2 mt-3">
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
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(selectedRecommendation.type)}
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedRecommendation.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      deleteRecommendation(selectedRecommendation.id, e);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setSelectedRecommendation(null)}
                    data-testid="close-recommendation-btn"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                {new Date(selectedRecommendation.generated_at).toLocaleDateString()} at {new Date(selectedRecommendation.generated_at).toLocaleTimeString()}
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="text-gray-700 leading-relaxed space-y-2">
                {formatContent(selectedRecommendation.content)}
              </div>
              
              {selectedRecommendation.tags && (
                <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-200">
                  {selectedRecommendation.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recommendations;