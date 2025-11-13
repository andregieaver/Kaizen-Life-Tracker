import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronUp, ChevronDown, ShoppingCart, Download, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Orders = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'order_date', direction: 'desc' });
  const [filters, setFilters] = useState({
    plan: 'all',
    interval: 'all',
    orderType: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    fetchOrders();
  }, [athleteId]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [orders, searchTerm, filters, sortConfig]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/crm/orders`, {
        params: { athlete_id: athleteId }
      });
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let result = [...orders];

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(order =>
        order.order_id?.toLowerCase().includes(term) ||
        order.athlete_name?.toLowerCase().includes(term) ||
        order.athlete_email?.toLowerCase().includes(term) ||
        order.stripe_session_id?.toLowerCase().includes(term)
      );
    }

    // Apply filters
    if (filters.plan !== 'all') {
      result = result.filter(order => order.plan === filters.plan);
    }
    if (filters.interval !== 'all') {
      result = result.filter(order => order.interval === filters.interval);
    }
    if (filters.orderType !== 'all') {
      const isRenewal = filters.orderType === 'renewal';
      result = result.filter(order => order.is_renewal === isRenewal);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue = a[sortConfig.key] || '';
      let bValue = b[sortConfig.key] || '';

      // Handle date sorting
      if (sortConfig.key === 'order_date') {
        aValue = new Date(aValue).getTime() || 0;
        bValue = new Date(bValue).getTime() || 0;
      }

      // Handle amount sorting
      if (sortConfig.key === 'amount') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredOrders(result);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getPlanBadge = (plan) => {
    const styles = {
      pro: 'bg-blue-600 text-white',
      premium: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
    };
    return styles[plan] || 'bg-gray-600 text-gray-200';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const formatAmount = (amount, currency) => {
    // Amount is already in main currency units (€29.00, not cents)
    // Backend converts from cents when storing
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(amount);
  };

  const calculateTotalRevenue = () => {
    return filteredOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
  };

  const exportToCSV = () => {
    const csvData = filteredOrders.map(order => ({
      'Order ID': order.order_id,
      'Plan': order.plan,
      'Interval': order.interval,
      'Customer Name': order.athlete_name,
      'Customer Email': order.athlete_email,
      'Order Date': formatDate(order.order_date),
      'Type': order.is_renewal ? 'Renewal' : 'First Time',
      'Amount': formatAmount(order.amount, order.currency)
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stripe_orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-8 h-8" style={{ color: '#00C2A8' }} />
            {t('orders.title')}
          </h1>
          <p className="text-gray-300 mt-1">
            {t('orders.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-700 text-white">
            {t('orders.ordersCount', { filtered: filteredOrders.length, total: orders.length })}
          </Badge>
          <Badge className="bg-[#00C2A8] text-white">
            {t('orders.totalRevenue', { amount: formatAmount(calculateTotalRevenue(), 'EUR') })}
          </Badge>
          <Button
            onClick={exportToCSV}
            className="text-white border-0"
            style={{ backgroundColor: '#00C2A8' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('orders.exportCSV')}
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
                placeholder=t("orders.searchPlaceholder")
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
                <label className="text-sm font-medium text-gray-300 mb-2 block">Order Type</label>
                <select
                  value={filters.orderType}
                  onChange={(e) => setFilters(prev => ({ ...prev, orderType: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Types</option>
                  <option value="first">First Time</option>
                  <option value="renewal">Renewal</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-300">
              t("orders.loadingOrders")
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-200 mb-2">t("orders.noOrdersFound")</h3>
              <p className="text-gray-400 text-center">
                t("orders.adjustFilters")
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('order_id')}>
                      Order ID <SortIcon columnKey="order_id" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('plan')}>
                      Plan <SortIcon columnKey="plan" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('interval')}>
                      Interval <SortIcon columnKey="interval" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('athlete_name')}>
                      Customer <SortIcon columnKey="athlete_name" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('order_date')}>
                      Order Date <SortIcon columnKey="order_date" />
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('payment_status')}>
                      Payment Status <SortIcon columnKey="payment_status" />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('amount')}>
                      Amount <SortIcon columnKey="amount" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, index) => (
                    <tr
                      key={order.order_id}
                      onClick={() => navigate(`/dashboard/orders/${order.order_id}`)}
                      className={`border-b border-gray-600 hover:bg-gray-700/50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-800/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-white font-mono text-sm">{order.order_id}</div>
                        <div className="text-gray-400 text-xs">{order.stripe_session_id?.substring(0, 20)}...</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getPlanBadge(order.plan)}>
                          {order.plan?.charAt(0).toUpperCase() + order.plan?.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {order.interval === 'month' ? 'Monthly' : order.interval === 'year' ? 'Annually' : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{order.athlete_name}</div>
                        <div className="text-gray-400 text-sm">{order.athlete_email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.is_renewal ? (
                          <RefreshCw className="w-5 h-5 text-blue-400 mx-auto" title="Renewal" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-yellow-400 mx-auto" title="First Time" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={order.payment_status === 'paid' ? 'bg-green-600 text-white' : order.payment_status === 'pending' ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'}>
                          {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1) || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-white font-semibold">
                          {formatAmount(order.amount, order.currency)}
                        </div>
                        <div className="text-gray-400 text-xs">{order.currency}</div>
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
            Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
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
                // Show first page, last page, current page, and pages around current
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

export default Orders;
