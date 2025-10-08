import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
      // Mock data for demo
      setRecommendations([
        {
          id: '1',
          title: 'Recovery Analysis: Yesterday\'s Interval Session',
          type: 'recovery_analysis',
          priority: 'high',
          generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          summary: 'Your interval session yesterday significantly impacted sleep quality and HRV recovery.',
          content: `## Recovery Analysis - October 7th Interval Session

**Workout Summary:**
- 6x800m intervals at 5K pace
- Total distance: 8.2 miles
- Average HR: 175 bpm
- Perceived effort: 8/10

**Sleep & Recovery Impact:**
- Sleep duration: 6.2 hours (1.8h below your average)
- Sleep efficiency: 76% (down from 85% baseline)
- HRV: 32ms (15% below baseline)
- Resting HR: 58 bpm (+6 bpm from baseline)

**Analysis:**
The high-intensity interval session created significant physiological stress, evidenced by elevated resting heart rate and suppressed HRV. Your body needed more recovery time than usual.

**Recommendations for Today:**
✅ Easy aerobic run: 4-6 miles at conversational pace
✅ Focus on hydration and nutrition
✅ Aim for 8+ hours sleep tonight
❌ Avoid another high-intensity session for 48 hours

**Future Adjustments:**
- Schedule interval sessions earlier in the week when you're more rested
- Consider reducing interval count to 5x800m for better recovery
- Ensure 2 easy days following hard sessions`,
          tags: ['intervals', 'recovery', 'hrv', 'sleep'],
          scheduled_prompt: 'Daily Recovery Review'
        },
        {
          id: '2', 
          title: 'Weekly Training Load Assessment',
          type: 'training_analysis',
          priority: 'medium',
          generated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Your training load this week is well-balanced with good recovery metrics.',
          content: `## Weekly Training Assessment - Week of September 30th

**Training Summary:**
- Total miles: 42.3 miles
- Hard sessions: 2 (tempo run, intervals)  
- Easy miles: 78% of total volume
- Average effort: 6.2/10

**Recovery Trends:**
- Average sleep: 7.8 hours/night
- HRV trend: Stable (35-42ms range)
- Readiness scores: Consistently 75-85

**Key Insights:**
Your 80/20 training distribution is excellent. Recovery metrics show you're adapting well to current training load.

**Next Week Recommendations:**
- Maintain current weekly volume
- Add one additional easy mile to long run
- Consider adding strides to one easy day
- Keep current hard/easy pattern

**Race Preparation:**
You're on track for your half marathon goal. Current fitness suggests a 1:26-1:28 finish time.`,
          tags: ['weekly_analysis', 'training_load', 'race_prep'],
          scheduled_prompt: 'Weekly Training Analysis'
        },
        {
          id: '3',
          title: 'Sleep Pattern Optimization',
          type: 'sleep_analysis', 
          priority: 'low',
          generated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Analysis of your sleep patterns shows opportunities for better recovery.',
          content: `## Sleep Pattern Analysis - Past 2 Weeks

**Sleep Metrics:**
- Average duration: 7.1 hours
- Average efficiency: 83%
- HRV during sleep: 38ms average
- Most restful night: Tuesday (8.2h, 91% efficiency)

**Patterns Identified:**
- Sunday nights: Consistently poor sleep (likely pre-week stress)
- Post-workout sleep: 15% reduction in REM sleep
- Optimal bedtime window: 9:45-10:15 PM

**Recommendations:**
1. Implement pre-Sunday wind-down routine
2. Finish hard workouts by 6 PM when possible  
3. Consider magnesium supplementation
4. Set consistent bedtime alarm for 10 PM

**Expected Benefits:**
Improving sleep consistency could increase average HRV by 8-12% and enhance training adaptation.`,
          tags: ['sleep', 'optimization', 'hrv'],
          scheduled_prompt: 'Sleep Analysis Weekly'
        }
      ]);
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
            AI Recommendations
          </h1>
          <p className="text-gray-600 mt-1">
            Automated analysis of your training and recovery data
          </p>
        </div>
        <Button 
          onClick={loadRecommendations}
          variant="outline"
          className="btn-transition"
          data-testid="refresh-recommendations-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {recommendations.length}
            </div>
            <div className="text-sm text-gray-600">Total Reports</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {recommendations.filter(r => r.priority === 'high').length}
            </div>
            <div className="text-sm text-gray-600">High Priority</div>
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
              <p className="text-gray-500 mb-4">No AI recommendations yet</p>
              <p className="text-sm text-gray-400">
                Set up automated schedules in Account → Schedules to start receiving AI analysis
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