import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  User, 
  Calendar, 
  DollarSign,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  ShoppingCart,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

const OrderDetail = ({ athleteId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  // Extract orderId from pathname
  const orderId = location.pathname.split('/').pop();

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(`${API}/crm/orders/${orderId}`, {
        params: { athlete_id: athleteId }
      });
      setOrderData(response.data.order);
      setOrderHistory(response.data.order_history || []);
    } catch (error) {
      logger.error(null, 'Error fetching order details:', error);
      setError('Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefund = async (type) => {
    if (type === 'partial' && (!refundAmount || parseFloat(refundAmount) <= 0)) {
      alert('Please enter a valid refund amount');
      return;
    }

    const amount = type === 'full' ? orderData.amount : parseFloat(refundAmount);
    
    if (amount > orderData.amount) {
      alert('Refund amount cannot exceed order amount');
      return;
    }

    if (!window.confirm(`Are you sure you want to refund ${formatCurrency(amount, orderData.currency)}?`)) {
      return;
    }

    try {
      setIsRefunding(true);
      await axios.post(`${API}/crm/orders/${orderId}/refund`, {
        athlete_id: athleteId,
        amount: amount,
        type: type
      });
      setRefundSuccess(true);
      setTimeout(() => {
        fetchOrderDetails();
        setRefundSuccess(false);
        setRefundAmount('');
      }, 2000);
    } catch (error) {
      logger.error(null, 'Error processing refund:', error);
      alert('Failed to process refund: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsRefunding(false);
    }
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

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
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

  const getPaymentStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-600 text-white',
      pending: 'bg-yellow-600 text-white',
      failed: 'bg-red-600 text-white',
      refunded: 'bg-gray-600 text-white'
    };
    return styles[status] || 'bg-gray-600 text-white';
  };

  const getPaymentStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'refunded':
        return <RefreshCw className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="text-center text-gray-300 py-12">Loading order details...</div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <Button
          onClick={() => navigate('/dashboard/orders')}
          className="mb-4 bg-gray-700 hover:bg-gray-600 text-white border-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
        <div className="text-center text-red-400 py-12">{error || 'Order not found'}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-6">
        <Button
          onClick={() => navigate('/dashboard/orders')}
          className="bg-gray-700 hover:bg-gray-600 text-white border-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
        {refundSuccess && (
          <Badge className="bg-green-600 text-white">
            <CheckCircle className="w-4 h-4 mr-1" />
            Refund Processed Successfully
          </Badge>
        )}
      </div>

      {/* Order Details Card */}
      <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="text-2xl text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#32D3FF]" />
            Order Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Order ID */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Order ID</p>
              <p className="text-white font-mono font-semibold">{orderData.order_id}</p>
              <p className="text-gray-400 text-xs mt-1">Session: {orderData.stripe_session_id?.substring(0, 24)}...</p>
            </div>

            {/* Plan */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Plan</p>
              <Badge className={getPlanBadge(orderData.plan)}>
                {orderData.plan?.charAt(0).toUpperCase() + orderData.plan?.slice(1)}
              </Badge>
              <p className="text-gray-300 text-sm mt-1">
                {orderData.interval === 'month' ? 'Monthly' : orderData.interval === 'year' ? 'Annually' : 'N/A'}
              </p>
            </div>

            {/* Customer */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Customer</p>
              <Button
                onClick={() => navigate(`/dashboard/crm/user/${orderData.athlete_id}`)}
                variant="link"
                className="p-0 h-auto text-[#32D3FF] hover:text-[#009688] flex items-center gap-1"
              >
                <User className="w-4 h-4" />
                {orderData.athlete_name}
                <ExternalLink className="w-3 h-3" />
              </Button>
              <p className="text-gray-400 text-sm">{orderData.athlete_email}</p>
            </div>

            {/* Order Date */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Order Date</p>
              <div className="flex items-center gap-2 text-white">
                <Calendar className="w-4 h-4 text-[#32D3FF]" />
                {formatDate(orderData.order_date)}
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Amount</p>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#32D3FF]" />
                <span className="text-2xl font-bold text-white">
                  {formatCurrency(orderData.amount, orderData.currency)}
                </span>
              </div>
            </div>

            {/* Payment Status */}
            <div>
              <p className="text-sm text-gray-400 mb-1">Payment Status</p>
              <div className="flex items-center gap-2">
                {getPaymentStatusIcon(orderData.payment_status)}
                <Badge className={getPaymentStatusBadge(orderData.payment_status)}>
                  {orderData.payment_status?.charAt(0).toUpperCase() + orderData.payment_status?.slice(1)}
                </Badge>
              </div>
            </div>

            {/* Order Type */}
            <div className="md:col-span-2 lg:col-span-3">
              <p className="text-sm text-gray-400 mb-1">Order Type</p>
              <div className="flex items-center gap-2">
                {orderData.is_renewal ? (
                  <>
                    <RefreshCw className="w-5 h-5 text-blue-400" />
                    <span className="text-white">Renewal Order</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <span className="text-white">First Time Purchase</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order History (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#32D3FF]" />
                Complete Order History for {orderData.athlete_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orderHistory.length > 0 ? (
                <div className="space-y-3">
                  {orderHistory.map((order, index) => (
                    <div
                      key={order.order_id}
                      onClick={() => order.order_id !== orderId && navigate(`/dashboard/orders/${order.order_id}`)}
                      className={`p-4 rounded-lg border transition-all ${
                        order.order_id === orderId
                          ? 'bg-[#32D3FF]/20 border-[#32D3FF]'
                          : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Badge className={getPlanBadge(order.plan)}>
                              {order.plan?.charAt(0).toUpperCase() + order.plan?.slice(1)}
                            </Badge>
                            <span className="text-gray-300 text-sm">
                              {order.interval === 'month' ? 'Monthly' : 'Annually'}
                            </span>
                            {order.is_renewal ? (
                              <RefreshCw className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-yellow-400" />
                            )}
                            <Badge className={getPaymentStatusBadge(order.payment_status)}>
                              {order.payment_status}
                            </Badge>
                          </div>
                          <div className="text-gray-400 text-sm mt-2">
                            {formatDate(order.order_date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold text-lg">
                            {formatCurrency(order.amount, order.currency)}
                          </p>
                          <p className="text-gray-400 text-xs font-mono">{order.order_id}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No order history available for this customer
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Refund Actions (1/3 width) */}
        <div className="lg:col-span-1">
          <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg sticky top-6">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#32D3FF]" />
                Refund Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orderData.payment_status === 'paid' ? (
                <div className="space-y-4">
                  {/* Full Refund */}
                  <div>
                    <Button
                      onClick={() => handleRefund('full')}
                      disabled={isRefunding}
                      className="w-full bg-red-600 hover:bg-red-700 text-white border-0"
                    >
                      {isRefunding ? 'Processing...' : `Full Refund (${formatCurrency(orderData.amount, orderData.currency)})`}
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-800 px-2 text-gray-400">Or</span>
                    </div>
                  </div>

                  {/* Partial Refund */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Partial Refund Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={orderData.amount}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                    <Button
                      onClick={() => handleRefund('partial')}
                      disabled={isRefunding || !refundAmount}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white border-0"
                    >
                      {isRefunding ? 'Processing...' : 'Partial Refund'}
                    </Button>
                  </div>

                  <div className="text-xs text-gray-400 mt-4 p-3 bg-gray-800/50 rounded border border-gray-600">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Refunds are processed immediately and cannot be undone.
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                  <p>Refunds are only available for paid orders</p>
                  <Badge className={getPaymentStatusBadge(orderData.payment_status)} style={{ marginTop: '12px' }}>
                    Current Status: {orderData.payment_status}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
