import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for managing subscription statistics
 * Handles loading analytics data, period selection, and comparison
 */
const useSubscriptionStats = (athleteId, autoLoad = false) => {
  const [subscriberStats, setSubscriberStats] = useState({
    total: 0,
    active: 0,
    trial: 0,
    cancelled: 0,
    growth: [],
    comparison: null
  });

  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('90d'); // '7d', '30d', '90d', '1y', 'all'
  const [compareEnabled, setCompareEnabled] = useState(false);

  /**
   * Load subscriber statistics for the selected period
   */
  const loadSubscriberStats = useCallback(async (period = selectedPeriod, compare = compareEnabled) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/system/subscriber-stats`, {
        params: { 
          athlete_id: athleteId,
          period: period,
          compare: compare
        }
      });
      
      logger.debug(null, 'Subscriber stats response:', response.data);
      
      // Map API response to component state format
      const mappedStats = {
        total: response.data.total_subscribers || 0,
        active: response.data.paid_subscribers || 0,
        trial: response.data.free_subscribers || 0, // Trials shown as free for now
        cancelled: 0, // Calculate from other metrics if needed
        growth: response.data.time_series || [],
        comparison: response.data.comparison || null,
        // Keep all original data for detailed views
        ...response.data
      };
      
      setSubscriberStats(mappedStats);
      return { success: true, stats: mappedStats };
    } catch (error) {
      logger.error(null, 'Error loading subscriber stats:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId, selectedPeriod, compareEnabled]);

  /**
   * Change the selected period and reload stats
   */
  const changePeriod = useCallback((newPeriod) => {
    setSelectedPeriod(newPeriod);
    loadSubscriberStats(newPeriod, compareEnabled);
  }, [compareEnabled, loadSubscriberStats]);

  /**
   * Toggle comparison mode and reload stats
   */
  const toggleCompare = useCallback(() => {
    const newCompareValue = !compareEnabled;
    setCompareEnabled(newCompareValue);
    loadSubscriberStats(selectedPeriod, newCompareValue);
  }, [selectedPeriod, compareEnabled, loadSubscriberStats]);

  /**
   * Get chart data formatted for Chart.js
   */
  const getChartData = useCallback(() => {
    if (!subscriberStats.growth || subscriberStats.growth.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = subscriberStats.growth.map(item => item.date);
    const data = subscriberStats.growth.map(item => item.count);

    return {
      labels,
      datasets: [
        {
          label: 'Subscribers',
          data,
          borderColor: '#32D3FF',
          backgroundColor: 'rgba(50, 211, 255, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }, [subscriberStats]);

  /**
   * Get chart options for Chart.js
   */
  const getChartOptions = useCallback(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#32D3FF',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#9CA3AF'
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#9CA3AF'
          },
          beginAtZero: true
        }
      }
    };
  }, []);

  /**
   * Get period display label
   */
  const getPeriodLabel = useCallback((period) => {
    const labels = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      '1y': 'Last Year',
      'all': 'All Time'
    };
    return labels[period] || period;
  }, []);

  /**
   * Get comparison period label
   */
  const getComparisonPeriodLabel = useCallback(() => {
    const labels = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '1y': 'year',
      'all': 'period'
    };
    return labels[selectedPeriod] || 'period';
  }, [selectedPeriod]);

  /**
   * Calculate growth rate
   */
  const getGrowthRate = useCallback(() => {
    if (!subscriberStats.comparison) {
      return 0;
    }
    return subscriberStats.comparison.change || 0;
  }, [subscriberStats]);

  /**
   * Check if growth is positive
   */
  const isPositiveGrowth = useCallback(() => {
    return getGrowthRate() >= 0;
  }, [getGrowthRate]);

  // Auto-load stats on mount if enabled
  useEffect(() => {
    if (autoLoad && athleteId) {
      loadSubscriberStats();
    }
  }, [autoLoad, athleteId, loadSubscriberStats]);

  return {
    // State
    subscriberStats,
    isLoading,
    selectedPeriod,
    compareEnabled,
    
    // Computed
    chartData: getChartData(),
    chartOptions: getChartOptions(),
    periodLabel: getPeriodLabel(selectedPeriod),
    comparisonPeriodLabel: getComparisonPeriodLabel(),
    growthRate: getGrowthRate(),
    isPositiveGrowth: isPositiveGrowth(),
    
    // Actions
    loadSubscriberStats,
    changePeriod,
    toggleCompare,
    
    // Setters
    setSubscriberStats,
    setSelectedPeriod,
    setCompareEnabled
  };
};

export default useSubscriptionStats;
