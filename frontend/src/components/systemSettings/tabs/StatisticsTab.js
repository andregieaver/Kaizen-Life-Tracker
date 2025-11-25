import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Users, DollarSign, Link as LinkIcon, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { logger } from '../../../utils/logger';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatisticsTab = ({
  athleteId,
  subscriberStats,
  selectedPeriod,
  compareEnabled,
  chartData,
  chartOptions,
  isLoading,
  onChangePeriod,
  onToggleCompare
}) => {
  const { t } = useTranslation();
  const [waitlistIntegrations, setWaitlistIntegrations] = useState({ distribution: [], total_entries: 0 });
  const [connectedIntegrations, setConnectedIntegrations] = useState({ distribution: [], total_connections: 0 });
  const [genderDistribution, setGenderDistribution] = useState({ distribution: [], total_users: 0 });
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  
  useEffect(() => {
    if (athleteId) {
      logger.debug(null, 'Found athleteId prop, loading stats:', athleteId);
      loadIntegrationStats();
    } else {
      logger.error(null, 'No athleteId prop provided');
      setLoadingIntegrations(false);
    }
  }, [athleteId]);
  
  const loadIntegrationStats = async () => {
    if (!athleteId) {
      logger.error(null, 'Cannot load stats: No athleteId provided');
      setLoadingIntegrations(false);
      return;
    }
    
    try {
      setLoadingIntegrations(true);
      
      logger.debug(null, 'Loading integration stats with athleteId:', athleteId);
      
      // Fetch waitlist integration stats
      const waitlistResponse = await axios.get(`${API}/system/waitlist-integration-stats`, {
        params: { athlete_id: athleteId }
      });
      logger.debug(null, 'Waitlist response:', waitlistResponse.data);
      setWaitlistIntegrations(waitlistResponse.data);
      
      // Fetch connected integration stats
      const connectedResponse = await axios.get(`${API}/system/connected-integration-stats`, {
        params: { athlete_id: athleteId }
      });
      logger.debug(null, 'Connected response:', connectedResponse.data);
      setConnectedIntegrations(connectedResponse.data);
      
      // Fetch gender distribution stats
      const genderResponse = await axios.get(`${API}/system/gender-distribution-stats`, {
        params: { athlete_id: athleteId }
      });
      logger.debug(null, 'Gender response:', genderResponse.data);
      setGenderDistribution(genderResponse.data);
    } catch (error) {
      logger.error(null, 'Error loading integration stats:', error);
      logger.error(null, 'Error response:', error.response?.data);
    } finally {
      setLoadingIntegrations(false);
    }
  };
  
  // Prepare chart data for waitlist integrations
  const waitlistChartData = {
    labels: waitlistIntegrations.distribution.map(item => item.name),
    datasets: [{
      label: 'Number of Requests',
      data: waitlistIntegrations.distribution.map(item => item.count),
      backgroundColor: 'rgba(50, 211, 255, 0.8)',
      borderColor: 'rgba(50, 211, 255, 1)',
      borderWidth: 1
    }]
  };
  
  // Prepare chart data for connected integrations
  const connectedChartData = {
    labels: connectedIntegrations.distribution.map(item => item.name),
    datasets: [{
      label: 'Number of Connections',
      data: connectedIntegrations.distribution.map(item => item.count),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: 'rgba(34, 197, 94, 1)',
      borderWidth: 1
    }]
  };
  
  // Prepare chart data for gender distribution (Pie/Doughnut style colors)
  const genderColors = {
    male: 'rgba(59, 130, 246, 0.8)',      // Blue
    female: 'rgba(236, 72, 153, 0.8)',    // Pink
    other: 'rgba(168, 85, 247, 0.8)',     // Purple
    prefer_not_to_say: 'rgba(156, 163, 175, 0.8)',  // Gray
    not_specified: 'rgba(107, 114, 128, 0.8)'       // Dark Gray
  };
  
  const genderChartData = {
    labels: genderDistribution.distribution.map(item => item.name),
    datasets: [{
      label: 'Number of Users',
      data: genderDistribution.distribution.map(item => item.count),
      backgroundColor: genderDistribution.distribution.map(item => genderColors[item.value] || 'rgba(156, 163, 175, 0.8)'),
      borderColor: genderDistribution.distribution.map(item => genderColors[item.value]?.replace('0.8', '1') || 'rgba(156, 163, 175, 1)'),
      borderWidth: 1
    }]
  };
  
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9CA3AF',
          stepSize: 1
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)'
        }
      },
      x: {
        ticks: {
          color: '#9CA3AF'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)'
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <div className="flex flex-wrap gap-3">
        {['7d', '30d', '90d', '1y', 'all'].map((period) => (
          <Button
            key={period}
            size="sm"
            variant={selectedPeriod === period ? 'default' : 'outline'}
            onClick={() => onChangePeriod(period)}
            className={selectedPeriod === period ? 'bg-[#32D3FF]' : 'text-gray-300 border-gray-600'}
          >
            {period === '7d' && 'Last 7 Days'}
            {period === '30d' && 'Last 30 Days'}
            {period === '90d' && 'Last 90 Days'}
            {period === '1y' && 'Last Year'}
            {period === 'all' && 'All Time'}
          </Button>
        ))}
        
        <Button
          size="sm"
          variant={compareEnabled ? 'default' : 'outline'}
          onClick={onToggleCompare}
          className={compareEnabled ? 'bg-purple-600' : 'text-gray-300 border-gray-600 ml-auto'}
        >
          {compareEnabled ? 'Comparison: ON' : 'Compare Period'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Subscribers */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-600 to-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">{t('systemSettings.statistics.totalSubscribers')}</p>
                <p className="text-white text-3xl font-bold mt-2">{subscriberStats.total || 0}</p>
              </div>
              <Users className="w-12 h-12 text-blue-300 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Active Subscribers */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-600 to-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm font-medium">{t('systemSettings.statistics.active')}</p>
                <p className="text-white text-3xl font-bold mt-2">{subscriberStats.active || 0}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-300 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Trial Users */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-600 to-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-200 text-sm font-medium">{t('systemSettings.statistics.trial')}</p>
                <p className="text-white text-3xl font-bold mt-2">{subscriberStats.trial || 0}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-yellow-300 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Cancelled */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-600 to-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-200 text-sm font-medium">{t('systemSettings.statistics.cancelled')}</p>
                <p className="text-white text-3xl font-bold mt-2">{subscriberStats.cancelled || 0}</p>
              </div>
              <DollarSign className="w-12 h-12 text-red-300 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Card */}
      {compareEnabled && subscriberStats.comparison && (
        <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-gray-400 text-sm">{t('systemSettings.statistics.comparedToPrevious')}</p>
                <p className="text-white text-2xl font-bold mt-1">
                  {subscriberStats.comparison.change >= 0 ? '+' : ''}
                  {subscriberStats.comparison.change}%
                </p>
              </div>
              <div className={`text-4xl ${
                subscriberStats.comparison.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {subscriberStats.comparison.change >= 0 ? '📈' : '📉'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Growth Chart */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-[#32D3FF]" />
            {t('systemSettings.statistics.subscriberGrowth')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center text-gray-400">
              {t('systemSettings.statistics.loading')}
            </div>
          ) : chartData.labels.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-gray-400">
              {t('systemSettings.statistics.noData')}
            </div>
          ) : (
            <div className="h-80">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Demographics Section */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-400" />
              Gender Distribution
            </div>
            <span className="text-sm text-gray-400">
              {genderDistribution.total_users} users
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingIntegrations ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              {t('systemSettings.statistics.loading')}
            </div>
          ) : genderDistribution.distribution.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No gender data available
            </div>
          ) : (
            <div className="h-64">
              <Bar data={genderChartData} options={barChartOptions} />
            </div>
          )}
          {genderDistribution.distribution.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-gray-400 text-sm">Breakdown:</p>
              {genderDistribution.distribution.map((item, index) => {
                const percentage = ((item.count / genderDistribution.total_users) * 100).toFixed(1);
                const colorMap = {
                  male: 'text-blue-400',
                  female: 'text-pink-400',
                  other: 'text-purple-400',
                  prefer_not_to_say: 'text-gray-400',
                  not_specified: 'text-gray-500'
                };
                return (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`${colorMap[item.value]} font-semibold`}>{item.count}</span>
                      <span className="text-gray-500 text-xs">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Statistics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waitlist Integration Requests */}
        <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-[#32D3FF]" />
                Desired Integrations (Waitlist)
              </div>
              <span className="text-sm text-gray-400">
                {waitlistIntegrations.total_entries} entries
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingIntegrations ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                {t('systemSettings.statistics.loading')}
              </div>
            ) : waitlistIntegrations.distribution.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No integration requests yet
              </div>
            ) : (
              <div className="h-64">
                <Bar data={waitlistChartData} options={barChartOptions} />
              </div>
            )}
            {waitlistIntegrations.distribution.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-gray-400 text-sm">Top Requested Integrations:</p>
                {waitlistIntegrations.distribution.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{item.name}</span>
                    <span className="text-[#32D3FF] font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Integrations */}
        <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="w-5 h-5 mr-2 text-green-400" />
                Connected Integrations
              </div>
              <span className="text-sm text-gray-400">
                {connectedIntegrations.unique_users} users
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingIntegrations ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                {t('systemSettings.statistics.loading')}
              </div>
            ) : connectedIntegrations.distribution.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No integrations connected yet
              </div>
            ) : (
              <div className="h-64">
                <Bar data={connectedChartData} options={barChartOptions} />
              </div>
            )}
            {connectedIntegrations.distribution.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-gray-400 text-sm">Most Popular Integrations:</p>
                {connectedIntegrations.distribution.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{item.name}</span>
                    <span className="text-green-400 font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatisticsTab;
