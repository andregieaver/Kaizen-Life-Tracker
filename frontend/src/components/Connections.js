import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { logger } from '../utils/logger';
import { 
  Zap, 
  Heart, 
  Activity, 
  Watch, 
  Mountain, 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const Connections = ({ athleteId }) => {
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState(null);

  useEffect(() => {
    if (athleteId) {
      loadData();
    }
  }, [athleteId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersRes, connectionsRes] = await Promise.all([
        axios.get(`${API}/providers`),
        axios.get(`${API}/me/connections?user_id=${athleteId}`)
      ]);
      
      setProviders(providersRes.data.providers || []);
      setConnections(connectionsRes.data.connections || []);
    } catch (error) {
      logger.error(null, 'Error loading connections data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (key) => {
    const iconMap = {
      strava: <Zap className="w-8 h-8 text-orange-500" />,
      oura: <Heart className="w-8 h-8 text-purple-500" />,
      polar: <Activity className="w-8 h-8 text-blue-500" />,
      garmin: <Watch className="w-8 h-8 text-blue-600" />,
      coros: <Mountain className="w-8 h-8 text-green-600" />
    };
    return iconMap[key] || <Activity className="w-8 h-8 text-gray-500" />;
  };

  const getConnectionStatus = (providerKey) => {
    const connection = connections.find(c => c.provider_key === providerKey);
    if (!connection) return { status: 'disconnected', connection: null };
    
    // Check if token is expired
    if (connection.expires_at) {
      const expiresAt = new Date(connection.expires_at);
      const now = new Date();
      if (expiresAt < now) {
        return { status: 'expired', connection };
      }
    }
    
    return { 
      status: connection.status || 'active', 
      connection,
      lastSync: connection.last_sync_at
    };
  };

  const handleConnect = async (providerKey) => {
    setConnectingProvider(providerKey);
    
    try {
      // Get auth URL from backend
      const response = await axios.get(`${API}/auth/${providerKey}?user_id=${athleteId}`);
      
      if (response.data.authorization_url) {
        // Redirect to provider's OAuth page
        window.location.href = response.data.authorization_url;
      }
    } catch (error) {
      logger.error(null, `Error connecting to ${providerKey}:`, error);
      alert(`Failed to connect to ${providerKey}. Please try again.`);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (providerKey) => {
    if (!window.confirm(`Are you sure you want to disconnect ${providerKey}?`)) {
      return;
    }

    try {
      await axios.post(`${API}/me/connections/${providerKey}/disconnect?user_id=${athleteId}`);
      await loadData();
    } catch (error) {
      logger.error(null, `Error disconnecting ${providerKey}:`, error);
      alert(`Failed to disconnect ${providerKey}. Please try again.`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Needs Reauth
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
            Not Connected
          </Badge>
        );
    }
  };

  const formatLastSync = (lastSyncAt) => {
    if (!lastSyncAt) return 'Never';
    
    const syncDate = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return syncDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">Loading connections...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Provider Connections
          </h1>
          <p className="text-gray-600 mt-1">
            Connect your wearables and fitness apps to sync your data
          </p>
        </div>
        <Button 
          onClick={loadData}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </Button>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => {
          const { status, connection, lastSync } = getConnectionStatus(provider.key);
          const isConnecting = connectingProvider === provider.key;
          
          return (
            <Card 
              key={provider.key}
              className={`transition-all hover:shadow-lg ${
                status === 'active' ? 'border-green-200 bg-green-50' : ''
              } ${!provider.enabled ? 'opacity-50' : ''}`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getProviderIcon(provider.key)}
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {provider.description}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Connection Details */}
                {connection && (
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Last Sync:</span>
                      <span className="font-medium">
                        {formatLastSync(lastSync)}
                      </span>
                    </div>
                    {connection.external_user_id && (
                      <div className="flex justify-between">
                        <span>User ID:</span>
                        <span className="font-mono text-xs">
                          {connection.external_user_id.slice(0, 8)}...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {status === 'disconnected' && provider.enabled ? (
                    <Button
                      onClick={() => handleConnect(provider.key)}
                      disabled={isConnecting}
                      className="w-full"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Connect {provider.name}
                        </>
                      )}
                    </Button>
                  ) : status === 'active' ? (
                    <div className="flex gap-2 w-full">
                      <Button
                        onClick={() => handleConnect(provider.key)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Sync Now
                      </Button>
                      <Button
                        onClick={() => handleDisconnect(provider.key)}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-red-600 hover:text-red-700"
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : status === 'expired' ? (
                    <Button
                      onClick={() => handleConnect(provider.key)}
                      variant="outline"
                      className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Reconnect
                    </Button>
                  ) : !provider.enabled ? (
                    <Button disabled className="w-full" variant="outline">
                      Coming Soon
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connection Statistics */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Summary</CardTitle>
            <CardDescription>
              Overview of your connected providers and data sync status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {connections.filter(c => c.status === 'active').length}
                </div>
                <div className="text-sm text-gray-600">Active Connections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {connections.filter(c => c.last_sync_at).length}
                </div>
                <div className="text-sm text-gray-600">Synced Providers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {connections.filter(c => {
                    if (!c.expires_at) return false;
                    return new Date(c.expires_at) < new Date();
                  }).length}
                </div>
                <div className="text-sm text-gray-600">Need Reauth</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Connections;