import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronUp, ChevronDown, Users, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import ConfirmationModal from './ConfirmationModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CRM = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [filters, setFilters] = useState({
    subscription: 'all',
    renewal: 'all',
    nationality: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [athleteId]);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [users, searchTerm, filters, sortConfig]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/crm/users`, {
        params: { athlete_id: athleteId }
      });
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    try {
      await axios.delete(`${API}/crm/users/${deleteUserId}`, {
        params: { athlete_id: athleteId }
      });
      
      // Remove user from list
      setUsers(users.filter(u => u.id !== deleteUserId));
      setShowDeleteConfirm(false);
      setDeleteUserId(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(t('crm.deleteUserFailed'));
    }
  };

  const applyFiltersAndSearch = () => {
    let result = [...users];

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user =>
        user.name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.nationality?.toLowerCase().includes(term)
      );
    }

    // Apply filters
    if (filters.subscription !== 'all') {
      result = result.filter(user => user.subscription_tier === filters.subscription);
    }
    if (filters.renewal !== 'all') {
      result = result.filter(user => user.subscription_interval === filters.renewal);
    }
    if (filters.nationality !== 'all') {
      result = result.filter(user => user.nationality === filters.nationality);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue = a[sortConfig.key] || '';
      let bValue = b[sortConfig.key] || '';

      // Handle date sorting
      if (sortConfig.key === 'created_at') {
        aValue = new Date(aValue).getTime() || 0;
        bValue = new Date(bValue).getTime() || 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredUsers(result);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSubscriptionBadge = (tier) => {
    const styles = {
      free: 'bg-gray-600 text-gray-200',
      pro: 'bg-blue-600 text-white',
      premium: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
    };
    return styles[tier] || styles.free;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const exportToCSV = () => {
    const csvData = filteredUsers.map(user => ({
      Name: user.name,
      Email: user.email,
      'Subscription Plan': user.subscription_tier,
      'Renewal': user.subscription_interval || 'N/A',
      'Nationality': user.nationality || 'N/A',
      'Registration Date': formatDate(user.created_at)
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
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

  const uniqueNationalities = [...new Set(users.map(u => u.nationality).filter(Boolean))].sort();

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white flex items-center gap-2">
            <Users className="w-8 h-8" style={{ color: '#00C2A8' }} />
            {t('crm.title')}
          </h1>
          <p className="text-gray-300 mt-1">
            {t('crm.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-700 text-white">
            {t('crm.usersCount', { filtered: filteredUsers.length, total: users.length })}
          </Badge>
          <Button
            onClick={exportToCSV}
            className="text-white border-0"
            style={{ backgroundColor: '#00C2A8' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('crm.exportCSV')}
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
                placeholder="Search by name, email, or nationality..."
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
                <label className="text-sm font-medium text-gray-300 mb-2 block">Subscription Plan</label>
                <select
                  value={filters.subscription}
                  onChange={(e) => setFilters(prev => ({ ...prev, subscription: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Renewal Type</label>
                <select
                  value={filters.renewal}
                  onChange={(e) => setFilters(prev => ({ ...prev, renewal: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Types</option>
                  <option value="month">Monthly</option>
                  <option value="year">Annually</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Nationality</label>
                <select
                  value={filters.nationality}
                  onChange={(e) => setFilters(prev => ({ ...prev, nationality: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg"
                >
                  <option value="all">All Nationalities</option>
                  {uniqueNationalities.map(nat => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-300">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-200 mb-2">No users found</h3>
              <p className="text-gray-400 text-center">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('subscription_tier')}>
                      Plan <SortIcon columnKey="subscription_tier" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('subscription_interval')}>
                      Renewal <SortIcon columnKey="subscription_interval" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('nationality')}>
                      Nationality <SortIcon columnKey="nationality" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 cursor-pointer hover:text-white" onClick={() => handleSort('created_at')}>
                      Registration <SortIcon columnKey="created_at" />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/dashboard/crm/user/${user.id}`)}
                      className={`border-b border-gray-600 hover:bg-gray-700/50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-800/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                            {user.profile_picture ? (
                              <img src={user.profile_picture} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-medium">{user.name?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">{user.name}</div>
                            <div className="text-gray-400 text-sm">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getSubscriptionBadge(user.subscription_tier)}>
                          {user.subscription_tier?.charAt(0).toUpperCase() + user.subscription_tier?.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {user.subscription_tier === 'free' ? 'N/A' : 
                          user.subscription_interval === 'month' ? 'Monthly' :
                          user.subscription_interval === 'year' ? 'Annually' : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {user.nationality || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteUserId(user.id);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4 text-red-500 hover:text-red-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteUserId(null);
        }}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone and will permanently remove all their data including posts, comments, and subscriptions."
      />
    </div>
  );
};

export default CRM;
