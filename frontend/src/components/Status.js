import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { logger } from '../utils/logger';
import { 
  Activity, 
  Calendar, 
  Database, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Status = ({ athleteId }) => {
  const [connections, setConnections] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (athleteId) {
      loadStatusData();
    }
  }, [athleteId]);

  const loadStatusData = async () => {
    setLoading(true);
    
    try {
      const [connectionsRes, activitiesRes, dailyRes, healthRes] = await Promise.all([
        axios.get(`${API}/me/connections?user_id=${athleteId}`),
        axios.get(`${API}/me/activities?user_id=${athleteId}&limit=10`),
        axios.get(`${API}/me/daily?user_id=${athleteId}&limit=7`),
        axios.get(`${API}/health`)
      ]);
      
      setConnections(connectionsRes.data.connections || []);
      setActivities(activitiesRes.data.activities || []);
      setDailyMetrics(dailyRes.data.daily_metrics || []);
      setHealthStatus(healthRes.data);
    } catch (error) {
      logger.error(null, 'Error loading status data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConnectionHealth = () => {
    const activeConnections = connections.filter(c => c.status === 'active').length;
    const totalConnections = connections.length;
    
    if (totalConnections === 0) return { status: 'warning', message: 'No connections' };
    if (activeConnections === totalConnections) return { status: 'healthy', message: 'All connections active' };
    if (activeConnections > 0) return { status: 'warning', message: `${activeConnections}/${totalConnections} active` };
    return { status: 'error', message: 'No active connections' };
  };

  const getSyncHealth = () => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentSyncs = connections.filter(c => {
      if (!c.last_sync_at) return false;
      return new Date(c.last_sync_at) > last24h;
    }).length;
    
    const totalActive = connections.filter(c => c.status === 'active').length;
    
    if (totalActive === 0) return { status: 'warning', message: 'No active connections' };
    if (recentSyncs === totalActive) return { status: 'healthy', message: 'All providers synced' };
    if (recentSyncs > 0) return { status: 'warning', message: `${recentSyncs}/${totalActive} synced today` };
    return { status: 'error', message: 'No recent syncs' };
  };

  const getDataHealth = () => {
    const now = new Date();
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentActivities = activities.filter(a => 
      new Date(a.start_time) > last7days
    ).length;
    
    const recentDailyMetrics = dailyMetrics.filter(m => 
      new Date(m.date) > last7days.toISOString().split('T')[0]
    ).length;
    
    if (recentActivities > 0 || recentDailyMetrics > 0) {
      return { status: 'healthy', message: `${recentActivities} activities, ${recentDailyMetrics} daily records` };
    }
    
    return { status: 'warning', message: 'No recent data' };
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    const km = (meters / 1000).toFixed(1);
    const miles = (meters * 0.000621371).toFixed(1);
    return `${km} km (${miles} mi)`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">Loading status...</div>
      </div>
    );
  }

  const connectionHealth = getConnectionHealth();
  const syncHealth = getSyncHealth();
  const dataHealth = getDataHealth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Integration Hub Status
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor your data connections and sync status
          </p>
        </div>
        <Button 
          onClick={loadStatusData}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-500" />
              <div>
                <div className="font-medium">Connections</div>
                <div className="text-sm text-gray-600">{connectionHealth.message}</div>
              </div>
            </div>
            {getStatusIcon(connectionHealth.status)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-green-500" />
              <div>
                <div className="font-medium">Sync Status</div>
                <div className="text-sm text-gray-600">{syncHealth.message}</div>
              </div>
            </div>
            {getStatusIcon(syncHealth.status)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-purple-500" />
              <div>
                <div className="font-medium">Data Flow</div>
                <div className="text-sm text-gray-600">{dataHealth.message}</div>
              </div>
            </div>
            {getStatusIcon(dataHealth.status)}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-orange-500" />
              <div>
                <div className="font-medium">API Health</div>
                <div className="text-sm text-gray-600">
                  {healthStatus ? 'Online' : 'Checking...'}
                </div>
              </div>
            </div>
            {healthStatus ? getStatusIcon('healthy') : getStatusIcon('warning')}
          </CardContent>
        </Card>
      </div>

      {/* Provider Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Status</CardTitle>
          <CardDescription>
            Connection state and last sync per provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium">Provider</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Last Sync</th>
                  <th className="pb-3 font-medium">External ID</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.length > 0 ? (
                  connections.map((connection) => (
                    <tr key={connection.id} className="border-b">
                      <td className="py-3 font-medium capitalize">
                        {connection.provider_key}
                      </td>
                      <td className="py-3">
                        {getStatusBadge(connection.status)}
                      </td>
                      <td className="py-3 text-sm text-gray-600">
                        {connection.last_sync_at 
                          ? new Date(connection.last_sync_at).toLocaleDateString() + ' ' + 
                            new Date(connection.last_sync_at).toLocaleTimeString()
                          : 'Never'
                        }
                      </td>
                      <td className="py-3 text-sm font-mono text-gray-500">
                        {connection.external_user_id 
                          ? connection.external_user_id.slice(0, 12) + '...'
                          : 'N/A'
                        }
                      </td>
                      <td className="py-3">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {/* Trigger sync for this provider */}}
                        >
                          Sync Now
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-gray-500">
                      No provider connections found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Data */}
      {activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>
              Latest synchronized activities across all providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.slice(0, 5).map((activity, index) => (
                <div key={activity.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-medium capitalize">{activity.activity_type || 'Activity'}</div>
                      <div className="text-sm text-gray-600">
                        {activity.start_time ? new Date(activity.start_time).toLocaleDateString() : 'Unknown date'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">
                      {formatDistance(activity.distance_m)}
                    </div>
                    <div className="text-gray-600">
                      {formatDuration(activity.duration_s)}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {activity.provider_key}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Daily Metrics */}
      {dailyMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Daily Metrics</CardTitle>
            <CardDescription>
              Latest daily health and recovery data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyMetrics.slice(0, 6).map((metric, index) => (
                <div key={metric.id || index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{metric.date}</div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {metric.provider_key}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    {metric.readiness && (
                      <div className="flex justify-between">
                        <span>Readiness:</span>
                        <span className="font-medium">{metric.readiness}</span>
                      </div>
                    )}
                    {metric.steps && (
                      <div className="flex justify-between">
                        <span>Steps:</span>
                        <span className="font-medium">{metric.steps.toLocaleString()}</span>
                      </div>
                    )}
                    {metric.resting_hr && (
                      <div className="flex justify-between">
                        <span>Resting HR:</span>
                        <span className="font-medium">{metric.resting_hr} bpm</span>
                      </div>
                    )}
                    {metric.sleep_total_min && (
                      <div className="flex justify-between">
                        <span>Sleep:</span>
                        <span className="font-medium">{Math.round(metric.sleep_total_min / 60)}h {metric.sleep_total_min % 60}m</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Status;