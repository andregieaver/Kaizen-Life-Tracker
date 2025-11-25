import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Lock, CheckCircle } from 'lucide-react';
import { initializeSiteTitle } from '../utils/siteTitle';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    resetToken: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [siteTitle, setSiteTitle] = useState('');
  
  // Initialize site title with cached value and background fetch
  useEffect(() => {
    initializeSiteTitle(setSiteTitle);
  }, []);
  
  // Auto-fill token from URL parameters and verify it
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    
    logger.debug(null, 'Reset Password - Token from URL:', tokenFromUrl);
    
    if (tokenFromUrl) {
      logger.debug(null, 'Valid reset link detected');
      setFormData(prev => ({ 
        ...prev, 
        resetToken: tokenFromUrl 
      }));
      
      // Verify token is valid
      axios.post(`${API}/auth/verify-reset-token`, { token: tokenFromUrl })
        .then(() => {
          setError(''); // Token is valid
        })
        .catch((error) => {
          logger.error(null, 'Invalid reset token:', error);
          setError(error.response?.data?.detail || 'Invalid or expired reset link. Please request a new password reset.');
        });
    } else {
      logger.debug(null, 'Invalid reset link - missing token');
      setError('Invalid reset link. Please request a new password reset from the login page.');
    }
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.newPassword) {
      return 'Please enter a new password';
    }
    if (formData.newPassword.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      await axios.post(`${API}/auth/reset-password`, {
        token: formData.resetToken.trim(),
        password: formData.newPassword
      });
      
      setIsSuccess(true);
    } catch (error) {
      logger.error(null, 'Error resetting password:', error);
      setError(error.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-display font-bold text-white mb-2">
              {siteTitle}
            </h1>
            <p className="text-gray-300">{t('auth.passwordResetComplete')}</p>
          </div>

          {/* Success Card */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-600 to-gray-800">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <CardTitle className="text-2xl text-white">{t('auth.passwordReset')}</CardTitle>
              <CardDescription className="text-gray-300">
                {t('auth.passwordResetSuccessMessage')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate('/login')}
                className="w-full text-white font-medium py-3 btn-transition border-0"
                style={{ backgroundColor: '#32D3FF' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
              >
                {t('auth.loginNow')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation */}
        <Link
          to="/login"
          className="inline-flex items-center text-sm text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('auth.backToLogin')}
        </Link>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            {siteTitle}
          </h1>
          <p className="text-gray-300">{t('auth.resetPasswordSubtitle')}</p>
        </div>

        {/* Reset Password Card */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-600 to-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center text-white">
              <Lock className="w-6 h-6 mr-2" style={{ color: '#32D3FF' }} />
              {t('auth.resetPassword')}
            </CardTitle>
            <CardDescription className="text-gray-300">
              Create a new password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Show email for confirmation (read-only) */}
              {formData.email && (
                <div className="p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
                  <p className="text-sm text-gray-300">
                    Resetting password for: <span className="font-medium text-white">{formData.email}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  placeholder="Enter your new password"
                  className="input-focus bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Re-enter your new password"
                  className="input-focus bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full text-white font-medium py-3 btn-transition border-0"
                style={{ backgroundColor: '#32D3FF' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {t('common.processing')}
                  </div>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    {t('auth.resetPasswordButton')}
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-300">
                {t('auth.rememberPassword')}{' '}
                <Link 
                  to="/login" 
                  className="font-medium hover:underline"
                  style={{ color: '#32D3FF' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#009688'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#32D3FF'}
                >
                  {t('auth.loginHere')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;