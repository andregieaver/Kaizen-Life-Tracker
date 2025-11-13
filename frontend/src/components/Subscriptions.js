import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Filter, 
  ChevronUp, 
  ChevronDown, 
  Users, 
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Subscriptions = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'start_date', direction: 'desc' });
  const [filters, setFilters] = useState({
    plan: 'all',
    interval: 'all',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    filterAndSortSubscriptions();
  }, [subscriptions, searchTerm, filters, sortConfig]);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/crm/subscriptions`, {
        params: { athlete_id: athleteId }
      });
      setSubscriptions(response.data.subscriptions || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortSubscriptions = () => {
    let filtered = [...subscriptions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.user_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply plan filter
    if (filters.plan !== 'all') {
      filtered = filtered.filter(sub => sub.plan === filters.plan);
    }

    // Apply interval filter
    if (filters.interval !== 'all') {
      filtered = filtered.filter(sub => sub.interval === filters.interval);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(sub => sub.status === filters.status);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle numeric values
      if (sortConfig.key === 'lifetime_value') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredSubscriptions(filtered);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportToCSV = () => {
    const headers = ['Customer', 'Email', 'Plan', 'Interval', 'Status', 'Start Date', 'End Date', 'Next Renewal', 'Lifetime Value'];
    const csvData = filteredSubscriptions.map(sub => [
      sub.customer_name,
      sub.customer_email,
      sub.plan,
      sub.interval,
      sub.status,
      formatDate(sub.start_date),
      sub.is_cancelled ? `Cancelled: ${formatDate(sub.end_date)}` : (sub.end_date ? formatDate(sub.end_date) : 'Ongoing'),
      sub.next_renewal ? formatDate(sub.next_renewal) : 'N/A',
      sub.lifetime_value
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getPlanBadge = (tier) => {
    const styles = {
      free: 'bg-gray-600 text-white',
      pro: 'bg-blue-600 text-white',
      premium: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
    };
    return styles[tier] || styles.free;
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-600 text-white',
      inactive: 'bg-gray-600 text-white',
      cancelled: 'bg-red-600 text-white',
      past_due: 'bg-orange-600 text-white',
      trialing: 'bg-blue-500 text-white'
    };
    return styles[status] || 'bg-gray-600 text-white';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'trialing':
      case 'past_due':
        return <Clock className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredSubscriptions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Calculate totals
  const totalRevenue = filteredSubscriptions.reduce((sum, sub) => sum + (sub.lifetime_value || 0), 0);
  const activeCount = filteredSubscriptions.filter(sub => sub.status === 'active').length;

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="text-center text-gray-300 py-12">{t('subscriptions.loadingSubscriptions')}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-[#00C2A8]" />
          {t('subscriptions.title')}
        </h1>
        <p className="text-gray-400">{t('subscriptions.description')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{t('subscriptions.totalSubscriptions')}</p>
                <p className="text-3xl font-bold text-white mt-1">{filteredSubscriptions.length}</p>
              </div>
              <Users className="w-12 h-12 text-[#00C2A8] opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{t('subscriptions.activeSubscriptions')}</p>
                <p className="text-3xl font-bold text-green-400 mt-1">{activeCount}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{t('subscriptions.totalRevenue')}</p>
                <p className="text-3xl font-bold text-[#00C2A8] mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-[#00C2A8] opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#00C2A8] text-white">
            {filteredSubscriptions.length} {filteredSubscriptions.length === 1 ? t('subscriptions.subscription') : t('subscriptions.subscriptions')}
          </Badge>
          <Button
            onClick={exportToCSV}
            className="text-white border-0"
            style={{ backgroundColor: '#00C2A8' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('subscriptions.exportCSV')}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t('subscriptions.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-700"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-600">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Plan</label>
                <select
                  value={filters.plan}
                  onChange={(e) => setFilters(prev => ({ ...prev, plan: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Interval</label>
                <select
                  value={filters.interval}
                  onChange={(e) => setFilters(prev => ({ ...prev, interval: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Intervals</option>
                  <option value="month">Monthly</option>
                  <option value="year">Annually</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past Due</option>
                  <option value="trialing">Trialing</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg mt-6">
        <CardContent className="p-0">
          {filteredSubscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-200 mb-2">No subscriptions found</h3>
              <p className="text-gray-400 text-center">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('customer_name')}>
                      Customer <SortIcon columnKey="customer_name" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('plan')}>
                      Plan <SortIcon columnKey="plan" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('interval')}>
                      Interval <SortIcon columnKey="interval" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('status')}>
                      Status <SortIcon columnKey="status" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('start_date')}>
                      Start <SortIcon columnKey="start_date" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('end_date')}>
                      End <SortIcon columnKey="end_date" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('next_renewal')}>
                      Next Renewal <SortIcon columnKey="next_renewal" />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('lifetime_value')}>
                      Lifetime Value <SortIcon columnKey="lifetime_value" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubscriptions.map((sub, index) => (
                    <tr
                      key={sub.user_id}
                      onClick={() => navigate(`/dashboard/crm/user/${sub.user_id}`)}
                      className={`border-b border-gray-600 hover:bg-gray-700/50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-800/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{sub.customer_name}</div>
                        <div className="text-gray-400 text-sm">{sub.customer_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getPlanBadge(sub.plan)}>
                          {sub.plan?.charAt(0).toUpperCase() + sub.plan?.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {sub.interval === 'month' ? 'Monthly' : sub.interval === 'year' ? 'Annually' : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusBadge(sub.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(sub.status)}
                            {sub.status?.charAt(0).toUpperCase() + sub.status?.slice(1).replace('_', ' ')}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(sub.start_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {sub.is_cancelled ? (
                          <div className="text-red-400 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            {formatDate(sub.end_date)}
                          </div>
                        ) : sub.end_date ? (
                          formatDate(sub.end_date)
                        ) : (
                          <span className="text-green-400">Ongoing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {sub.next_renewal ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-[#00C2A8]" />
                            {formatDate(sub.next_renewal)}
                          </div>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-white font-semibold">
                          {formatCurrency(sub.lifetime_value)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-gray-300 text-sm">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredSubscriptions.length)} of {filteredSubscriptions.length} subscriptions
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed border-0"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[40px] border-0 ${
                        currentPage === pageNum
                          ? 'bg-[#00C2A8] text-white'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </Button>
                  );
                } else if (
                  (pageNum === currentPage - 2 && pageNum > 1) ||
                  (pageNum === currentPage + 2 && pageNum < totalPages)
                ) {
                  return <span key={pageNum} className="text-gray-400 px-2">...</span>;
                }
                return null;
              })}
            </div>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed border-0"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
