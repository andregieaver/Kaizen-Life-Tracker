import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  CalendarClock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Pages = ({ athleteId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [indexFilter, setIndexFilter] = useState('');
  const [sortField, setSortField] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadPages();
  }, [athleteId]);

  const loadPages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('athlete_id', athleteId);
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      if (indexFilter) params.append('index_status', indexFilter);

      const response = await axios.get(`${API}/pages?${params.toString()}`);
      setPages(response.data.pages || []);
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPages();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleDelete = async (pageId, pageTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${pageTitle}"?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/pages/${pageId}?athlete_id=${athleteId}`);
      loadPages();
    } catch (error) {
      console.error('Error deleting page:', error);
      alert('Failed to delete page');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'draft':
        return <FileText className="w-4 h-4 text-gray-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'scheduled':
        return <CalendarClock className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const sortedPages = [...pages].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === 'updated_at' || sortField === 'created_at') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Pages</h1>
            <p className="text-gray-400 mt-1">Manage your website pages</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/pages/new')}
            className="bg-[#00C2A8] hover:bg-[#00a890] text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Page
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search pages..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C2A8]"
                />
                <Search className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00C2A8]"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            {/* Index Status Filter */}
            <div>
              <select
                value={indexFilter}
                onChange={(e) => setIndexFilter(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00C2A8]"
              >
                <option value="">All Index Status</option>
                <option value="indexed">Indexed</option>
                <option value="no-index">No-Index</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSearch}
            className="mt-4 bg-[#00C2A8] hover:bg-[#00a890] text-white px-6 py-2 rounded-lg transition-colors"
          >
            Search
          </button>
        </div>

        {/* Pages Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading pages...</div>
          ) : sortedPages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No pages found. Create your first page!
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-700">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Thumbnail</th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('title')}
                  >
                    Page Title {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('status')}
                  >
                    Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('index_status')}
                  >
                    Index Status {sortField === 'index_status' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('updated_at')}
                  >
                    Last Modified {sortField === 'updated_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPages.map((page) => (
                  <tr key={page.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="p-4">
                      {page.thumbnail ? (
                        <img
                          src={`${BACKEND_URL}${page.thumbnail}`}
                          alt={page.title}
                          className="w-24 h-16 object-cover"
                        />
                      ) : (
                        <div className="w-24 h-16 bg-gray-700 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {page.is_home && <span className="text-xl" title="Home Page">🏠</span>}
                          {page.title}
                        </div>
                        <div className="text-sm text-gray-400">{page.url_slug}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(page.status)}
                        <span className="capitalize text-sm">{page.status}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        page.index_status === 'indexed' 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {page.index_status === 'indexed' ? 'Indexed' : 'No-Index'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {formatDate(page.updated_at)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.open(page.url_slug, '_blank')}
                          className="p-2 hover:bg-gray-700 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => navigate(`/dashboard/pages/edit/${page.id}`)}
                          className="p-2 hover:bg-gray-700 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-[#00C2A8]" />
                        </button>
                        <button
                          onClick={() => handleDelete(page.id, page.title)}
                          className="p-2 hover:bg-gray-700 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Total count */}
        {!loading && sortedPages.length > 0 && (
          <div className="mt-4 text-gray-400 text-sm">
            Showing {sortedPages.length} page{sortedPages.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pages;
