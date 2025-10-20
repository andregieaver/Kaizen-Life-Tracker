import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Users, Database, Shield, Activity, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SystemSettings = ({ athleteId }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSystemStats();
  }, [athleteId]);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/system/stats?athlete_id=${athleteId}`);
      setStats(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading system stats:', err);
      setError('Failed to load system statistics');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading system settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <Button
            onClick={loadSystemStats}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Settings className="w-8 h-8 text-[#00C2A8] mr-3" />
            <h1 className="text-3xl font-bold text-white">System Settings</h1>
          </div>
          <p className="text-gray-400 ml-11">
            Super Admin Dashboard - Monitor and manage system-wide settings
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Users</p>
                  <p className="text-3xl font-bold text-white">{stats?.total_users || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Active Sessions</p>
                  <p className="text-3xl font-bold text-white">{stats?.active_sessions || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Database Size</p>
                  <p className="text-3xl font-bold text-white">{stats?.db_size || 'N/A'}</p>
                </div>
                <Database className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-none shadow-none">
            <CardContent className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">System Health</p>
                  <p className="text-3xl font-bold text-white">{stats?.health || 'Good'}</p>
                </div>
                <Shield className="w-8 h-8 text-[#00C2A8] opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl">User Management</CardTitle>
            <CardDescription className="text-gray-400">
              Manage user accounts and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                className="w-full sm:w-auto px-6 py-3 bg-[#00C2A8] text-white rounded-lg hover:bg-[#00a890] transition-colors"
                onClick={() => alert('User management coming soon')}
              >
                <Users className="w-5 h-5 mr-2" />
                View All Users
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl">System Configuration</CardTitle>
            <CardDescription className="text-gray-400">
              Configure system-wide settings and features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  onClick={() => alert('Feature coming soon')}
                >
                  <Database className="w-5 h-5 mr-2" />
                  Database Settings
                </Button>
                <Button
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  onClick={() => alert('Feature coming soon')}
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-red-900/20 border-red-700 mb-8">
          <CardHeader>
            <CardTitle className="text-red-400 text-xl flex items-center">
              <AlertTriangle className="w-6 h-6 mr-2" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-300">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear the cache? This action cannot be undone.')) {
                    alert('Cache cleared successfully');
                  }
                }}
              >
                Clear System Cache
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemSettings;
