import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Bot, Mic } from 'lucide-react';
import AgentModal from '../modals/AgentModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AgentsTab = ({ athleteId }) => {
  const { t } = useTranslation();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    loadAgents();
  }, [athleteId]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/agents?athlete_id=${athleteId}`);
      setAgents(response.data);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setShowModal(true);
  };

  const handleEditAgent = (agent) => {
    setSelectedAgent(agent);
    setShowModal(true);
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      await axios.delete(`${API}/agents/${agentId}?athlete_id=${athleteId}`);
      loadAgents();
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent');
    }
  };

  const handleModalClose = (shouldReload) => {
    setShowModal(false);
    setSelectedAgent(null);
    if (shouldReload) {
      loadAgents();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Agents</h2>
          <p className="text-gray-400 mt-1">
            Manage your custom AI agents with different personalities and voices
          </p>
        </div>
        <button
          onClick={handleCreateAgent}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Agent</span>
        </button>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700">
          <Bot className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No agents yet</h3>
          <p className="text-gray-400 mb-4">Create your first AI agent to get started</p>
          <button
            onClick={handleCreateAgent}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Your First Agent</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-all overflow-hidden"
            >
              {/* Agent Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {agent.profile_image_url ? (
                      <img
                        src={`${BACKEND_URL}${agent.profile_image_url}`}
                        alt={agent.name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          console.error('Image failed to load:', e.target.src);
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : null}
                    {(!agent.profile_image_url || document.querySelector(`img[alt="${agent.name}"]`)?.style.display === 'none') && (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                      {agent.personality && (
                        <span className="text-xs text-gray-400 capitalize">{agent.personality}</span>
                      )}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    agent.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>

                {/* Instructions Preview */}
                <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                  {agent.custom_instructions}
                </p>

                {/* Voice and Accessibility Badges */}
                <div className="flex items-center space-x-4 text-sm mb-4">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Mic className="w-4 h-4" />
                    <span className="capitalize">{agent.voice}</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    agent.accessibility === 'admin'
                      ? 'bg-purple-500/20 text-purple-400'
                      : agent.accessibility === 'logged_in'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {agent.accessibility === 'admin'
                      ? 'Admin'
                      : agent.accessibility === 'logged_in'
                      ? 'Logged In'
                      : 'Public'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 px-6 py-3 bg-gray-800/80 border-t border-gray-700">
                <button
                  onClick={() => handleEditAgent(agent)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Modal */}
      {showModal && (
        <AgentModal
          athleteId={athleteId}
          agent={selectedAgent}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default AgentsTab;
