import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/auth/forgot-password`, {
        email: email.trim()
      });
      
      setIsSubmitted(true);
      // In development, we get the reset token back
      if (response.data.reset_token) {
        setResetToken(response.data.reset_token);
      }
    } catch (error) {
      logger.error(null, 'Error requesting password reset:', error);
      setError(error.response?.data?.detail || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-display font-bold text-white mb-2">
              My Health Tracker
            </h1>
            <p className="text-gray-300">{t('auth.checkYourEmail')}</p>
          </div>

          {/* Success Card */}
          <Card className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-[#32D3FF]/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-[#32D3FF]" />
              </div>
              <CardTitle className="text-2xl text-white">{t('auth.emailSent')}</CardTitle>
              <CardDescription className="text-gray-300">
                {t('auth.passwordResetInstructions')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Development only - show reset token */}
              {resetToken && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm font-medium text-yellow-400 mb-2">
                    {t('auth.devModeToken')}:
                  </p>
                  <code className="text-xs bg-gray-950 text-gray-300 p-2 rounded border border-gray-700 block break-all">
                    {resetToken}
                  </code>
                  <p className="text-xs text-yellow-400/80 mt-2">
                    {t('auth.tokenExpires')}
                  </p>
                </div>
              )}
              
              <div className="text-center space-y-3">
                <Link
                  to="/reset-password"
                  className="inline-flex items-center text-[#32D3FF] hover:text-[#1FC1FF] font-medium hover:underline"
                >
                  {t('auth.resetPasswordNow')}
                </Link>
                <div>
                  <Link
                    to="/login"
                    className="inline-flex items-center text-gray-400 hover:text-gray-300 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('auth.backToLogin')}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation */}
        <Link
          to="/login"
          className="inline-flex items-center text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('auth.backToLogin')}
        </Link>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            My Health Tracker
          </h1>
          <p className="text-gray-300">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

        {/* Forgot Password Card */}
        <Card className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center text-white">
              <Mail className="w-6 h-6 mr-2 text-teal-400" />
              {t('auth.forgotPassword')}
            </CardTitle>
            <CardDescription className="text-gray-300">
              {t('auth.enterEmailForReset')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 btn-transition"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {t('common.processing')}
                  </div>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t('auth.sendResetEmail')}
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                {t('auth.rememberPassword')}{' '}
                <Link 
                  to="/login" 
                  className="text-teal-400 hover:text-teal-300 font-medium hover:underline"
                >
                  {t('auth.loginHere')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-400">
          {t('auth.resetSecurityNote')}
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;