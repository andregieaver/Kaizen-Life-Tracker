import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { X, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { logger } from '../../../utils/logger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GroupRulesModal = ({ groupId, onAccept, onCancel, rulesAccepted, setRulesAccepted }) => {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroupRules = async () => {
      try {
        const response = await axios.get(`${API}/community/groups/${groupId}`);
        setGroup(response.data);
      } catch (error) {
        logger.error(null, 'Error loading group rules:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGroupRules();
  }, [groupId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 md:p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Group Rules</h2>
        
        {group && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-2">{group.name}</h3>
              <p className="text-gray-300 text-sm mb-4">{group.description}</p>
            </div>

            {group.rules && (
              <div className="mb-6">
                <h4 className="text-white font-semibold mb-2">Rules:</h4>
                <div className="bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-gray-300 whitespace-pre-wrap">{group.rules}</p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="w-5 h-5 text-[#00C2A8] bg-gray-700 border-gray-600 rounded focus:ring-[#00C2A8] focus:ring-2"
                />
                <span className="text-white">I agree to follow the group rules</span>
              </label>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={onAccept}
                disabled={!rulesAccepted}
                className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Group
              </Button>
              <Button
                onClick={onCancel}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


// EventCard Component


export default GroupRulesModal;
