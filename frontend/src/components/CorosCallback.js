import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

const CorosCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing COROS connection...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('Failed to connect to COROS');
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      if (!code) {
        setStatus('No authorization code received');
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      try {
        // Send code to backend to complete OAuth
        await axios.post(`${API}/auth/coros/callback`, {
          code,
          state
        });

        setStatus('✅ Successfully connected to COROS!');
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (error) {
        logger.error(null, 'COROS callback error:', error);
        setStatus('Failed to complete COROS connection');
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-lg text-gray-700">{status}</p>
      </div>
    </div>
  );
};

export default CorosCallback;
