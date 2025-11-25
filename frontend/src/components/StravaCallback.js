import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

import { logger } from '../utils/logger';
const StravaCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [siteTitle, setSiteTitle] = useState('TrainSmart');

  useEffect(() => {
    handleCallback();
    
    // Fetch site title
    const fetchSiteTitle = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system/settings/public`);
        const data = await response.json();
        if (data?.seo?.siteTitle) {
          setSiteTitle(data.seo.siteTitle);
        }
      } catch (error) {
        logger.error(null, 'Error fetching site title:', error);
      }
    };
    fetchSiteTitle();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Strava authorization failed: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorization parameters');
      return;
    }

    try {
      // The callback will be handled by the backend automatically
      // Just show success and redirect
      setStatus('success');
      setMessage('Strava connected successfully!');
      
      // Extract athlete ID from state and redirect to account page
      const athleteId = state.split('_')[0];
      
      setTimeout(() => {
        navigate('/dashboard', { state: { activeTab: 'account', showStravaSuccess: true } });
      }, 2000);
      
    } catch (error) {
      logger.error(null, 'Callback error:', error);
      setStatus('error');
      setMessage('Failed to complete Strava connection');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting to Strava
              </h2>
              <p className="text-gray-600">
                Please wait while we complete your Strava integration...
              </p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center">
              <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
              <h2 className="text-xl font-semibold text-green-900 mb-2">
                Strava Connected!
              </h2>
              <p className="text-green-700 mb-4">{message}</p>
              {importedCount > 0 && (
                <p className="text-sm text-gray-600">
                  Imported {importedCount} activities from your Strava account
                </p>
              )}
              <p className="text-sm text-gray-500 mt-4">
                Redirecting to your account settings...
              </p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex flex-col items-center">
              <XCircle className="w-12 h-12 text-red-600 mb-4" />
              <h2 className="text-xl font-semibold text-red-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-red-700 mb-4">{message}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          My Health Tracker × Strava Integration
        </div>
      </div>
    </div>
  );
};

export default StravaCallback;