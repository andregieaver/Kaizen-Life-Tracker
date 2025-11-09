import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    <div className="w-full max-w-[1600px] mx-auto space-y-2 md:space-y-6 pt-6 md:pt-10 px-2 md:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
            {t('reports.title')}
          </h1>
          <p className="text-gray-300 mt-1">
            {t('reports.description')}
          </p>
        </div>
        <Button 
          onClick={() => navigate('/dashboard/schedules')}
          variant="outline"
          className="btn-transition text-white border-gray-600 hover:bg-gray-700"
          data-testid="schedules-btn"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Schedules
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Card className="border-0 shadow-lg" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: '#32D3FF' }}>
              {recommendations.length}
            </div>
            <div className="text-sm text-gray-200">{t('reports.totalReports')}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: '#32D3FF' }}>
              {recommendations.filter(r => !r.read).length}
            </div>
            <div className="text-sm text-gray-200">Unread</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: '#32D3FF' }}>
              {recommendations.filter(r => 
                new Date(r.generated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
              ).length}
            </div>
            <div className="text-sm text-gray-200">{t('reports.today')}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg" style={{ 
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
          borderRadius: '8px'
        }}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: '#32D3FF' }}>
              {new Set(recommendations.flatMap(r => r.tags || [])).size}
            </div>
            <div className="text-sm text-gray-200">{t('reports.topics')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations List */}
      <div className="space-y-2 md:space-y-4">
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Brain className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-200 mb-2">{t('reports.noReports')}</h3>
            <p className="text-gray-400 text-center">
              {t('reports.setupSchedules')}
            </p>
          </div>
        ) : (
          recommendations.map((recommendation) => (
            <Card 
              key={recommendation.id} 
              className="border-0 shadow-lg hover-lift cursor-pointer transition-all"
              style={{
                background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
                backdropFilter: 'blur(12px) saturate(140%)',
                WebkitBackdropFilter: 'blur(12px) saturate(140%)',
                border: !recommendation.read ? '2px solid #32D3FF' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'inset 0 1px 3px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
                borderRadius: '8px'
              }}
              onClick={() => handleCardClick(recommendation)}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  {/* Mobile: Stack vertically, Desktop: Row layout */}
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1 text-white flex-shrink-0">
                      {getTypeIcon(recommendation.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-sm md:text-base">
                          {recommendation.title}
                        </h3>
                        {!recommendation.read && (
                          <span className="inline-flex h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#32D3FF' }}></span>
                        )}
                      </div>
                      <div className="flex items-center text-xs md:text-sm text-gray-300">
                        <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        {formatTimeAgo(recommendation.generated_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions row - better mobile spacing */}
                  <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3 ml-9 md:ml-0">
                    <Badge 
                      className={`${getPriorityColor(recommendation.priority)} border font-medium text-xs`}
                    >
                      {recommendation.priority}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => deleteRecommendation(recommendation.id, e)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recommendation Detail Modal */}
      {selectedRecommendation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-br from-gray-600 to-gray-800 border-b border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-white">{getTypeIcon(selectedRecommendation.type)}</span>
                  <h2 className="text-xl font-semibold text-white">
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
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setSelectedRecommendation(null)}
                    className="text-white border-gray-600 hover:bg-gray-700"
                    data-testid="close-recommendation-btn"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-300">
                <Clock className="w-4 h-4" />
                {new Date(selectedRecommendation.generated_at).toLocaleDateString()} at {new Date(selectedRecommendation.generated_at).toLocaleTimeString()}
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="text-white leading-relaxed space-y-2">
                {formatContent(selectedRecommendation.content)}
              </div>
              
              {selectedRecommendation.tags && (
                <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-700">
                  {selectedRecommendation.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-gray-700 text-gray-200 text-sm rounded-full"
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