import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { 
  Brain, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  X,
  Calendar,
  Tag,
  AlertCircle,
  CheckCircle,
  Star
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const CATEGORIES = [
  { value: 'goals', label: 'Goals', color: 'bg-blue-100 text-blue-800' },
  { value: 'prs', label: 'Personal Records', color: 'bg-green-100 text-green-800' },
  { value: 'injuries', label: 'Injuries', color: 'bg-red-100 text-red-800' },
  { value: 'preferences', label: 'Preferences', color: 'bg-purple-100 text-purple-800' },
  { value: 'progress', label: 'Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'equipment', label: 'Equipment', color: 'bg-gray-100 text-gray-800' }
];

const Memories = ({ athleteId }) => {
  const [memories, setMemories] = useState([]);
  const [filteredMemories, setFilteredMemories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);
  const [formData, setFormData] = useState({
    category: 'preferences',
    content: '',
    importance: 5
  });
  
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    loadMemories();
    loadCategories();
  }, [athleteId]);

  useEffect(() => {
    filterMemories();
  }, [memories, searchTerm, selectedCategory]);

  const loadMemories = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/api/memories/${athleteId}`);
      setMemories(response.data.memories || []);
    } catch (error) {
      console.error('Error loading memories:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load memories' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${API}/api/memories/${athleteId}/categories`);
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const filterMemories = () => {
    let filtered = [...memories];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.content.toLowerCase().includes(term)
      );
    }

    setFilteredMemories(filtered);
  };

  const handleCreateMemory = () => {
    setEditingMemory(null);
    setFormData({
      category: 'preferences',
      content: '',
      importance: 5
    });
    setShowModal(true);
  };

  const handleEditMemory = (memory) => {
    setEditingMemory(memory);
    setFormData({
      category: memory.category,
      content: memory.content,
      importance: memory.importance
    });
    setShowModal(true);
  };

  const handleSaveMemory = async (e) => {
    e.preventDefault();

    if (!formData.content.trim()) {
      setSaveStatus({ type: 'error', message: 'Memory content is required' });
      return;
    }

    try {
      if (editingMemory) {
        // Update existing memory
        await axios.put(`${API}/api/memories/${editingMemory.id}`, formData);
        setSaveStatus({ type: 'success', message: 'Memory updated successfully!' });
      } else {
        // Create new memory
        await axios.post(`${API}/api/memories/${athleteId}`, {
          ...formData,
          athlete_id: athleteId
        });
        setSaveStatus({ type: 'success', message: 'Memory created successfully!' });
      }

      setShowModal(false);
      loadMemories();
      loadCategories();
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error saving memory:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to save memory' 
      });
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    if (!window.confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API}/api/memories/${memoryId}`);
      setSaveStatus({ type: 'success', message: 'Memory deleted successfully!' });
      loadMemories();
      loadCategories();
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error deleting memory:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to delete memory' 
      });
    }
  };

  const getCategoryColor = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.color : 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 pt-4 px-2 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7" style={{ color: '#00C2A8' }} />
            AI Coach Memories
          </h2>
          <p className="text-sm text-gray-300 mt-1">
            Manage what your AI coach remembers about you
          </p>
        </div>
        <Button 
          onClick={handleCreateMemory}
          className="text-white border-0"
          style={{ backgroundColor: '#00C2A8' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Memory
        </Button>
      </div>

      {/* Save Status */}
      {saveStatus.message && (
        <div className={`p-4 flex items-center gap-2 ${
          saveStatus.type === 'success' 
            ? 'bg-green-900/30 text-green-400 border border-green-700' 
            : 'bg-red-900/30 text-red-400 border border-red-700'
        }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {saveStatus.message}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label className="text-white">Search Memories</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label className="text-white">Filter by Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories ({memories.length})</SelectItem>
                  {CATEGORIES.map(cat => {
                    const count = categories.find(c => c.category === cat.value)?.count || 0;
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Memories Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00C2A8] mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading memories...</p>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8">
          <div className="text-center py-12">
            <Brain className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-display font-medium text-white mb-2">
              {searchTerm || selectedCategory !== 'all' ? 'No memories found' : 'No memories yet'}
            </h3>
            <p className="text-gray-300 mb-4">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your filters'
                : 'Your AI coach will remember important details from your conversations'
              }
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <Button 
                onClick={handleCreateMemory}
                className="text-white border-0"
                style={{ backgroundColor: '#00C2A8' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Memory
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredMemories.map((memory) => (
            <Card key={memory.id} className="hover:shadow-md transition-shadow bg-gradient-to-br from-gray-600 to-gray-800 border-0">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Category and Importance */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-gray-700 text-white border-0">
                        <Tag className="w-3 h-3 mr-1" />
                        {getCategoryLabel(memory.category)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {[...Array(memory.importance || 5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className="w-3 h-3 fill-yellow-400 text-yellow-400" 
                          />
                        ))}
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-white">{memory.content}</p>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(memory.created_at)}
                      </span>
                      {memory.updated_at && memory.updated_at !== memory.created_at && (
                        <span>(Updated: {formatDate(memory.updated_at)})</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEditMemory(memory)}
                      className="bg-gray-700 text-white border-0 hover:bg-gray-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="bg-red-900/30 text-red-400 border-0 hover:bg-red-900/50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingMemory ? 'Edit Memory' : 'Add New Memory'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <CardDescription>
                {editingMemory 
                  ? 'Update the memory details below'
                  : 'Add important information for your AI coach to remember'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveMemory} className="space-y-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData({...formData, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label>Memory Content *</Label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="What should the AI coach remember?"
                    className="w-full min-h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Importance */}
                <div className="space-y-2">
                  <Label>Importance (1-10)</Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={formData.importance}
                      onChange={(e) => setFormData({...formData, importance: parseInt(e.target.value)})}
                      className="flex-1"
                    />
                    <span className="font-semibold text-lg w-8 text-center">{formData.importance}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Less important</span>
                    <span>Very important</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {editingMemory ? 'Update Memory' : 'Create Memory'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Memories;
