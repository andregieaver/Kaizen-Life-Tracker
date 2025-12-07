import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const ChangePassword = ({ athleteId }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear status when user starts typing
    if (status.message) {
      setStatus({ type: '', message: '' });
    }
  };

  const validateForm = () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      return t('auth.allFieldsRequired');
    }
    if (formData.newPassword.length < 6) {
      return t('validation.passwordTooShort');
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return t('validation.passwordsDoNotMatch');
    }
    if (formData.currentPassword === formData.newPassword) {
      return t('auth.passwordsMustBeDifferent');
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    const validationError = validateForm();
    if (validationError) {
      setStatus({ type: 'error', message: validationError });
      return;
    }

    setIsLoading(true);

    try {
      await axios.post(`${API}/auth/change-password`, {
        athlete_id: athleteId,
        current_password: formData.currentPassword,
        new_password: formData.newPassword
      });
      
      setStatus({ type: 'success', message: t('auth.passwordChangedSuccess') });
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      logger.error(null, 'Error changing password:', error);
      const errorMessage = error.response?.data?.detail || t('auth.passwordChangeError');
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center text-lg text-white">
          <Lock className="w-5 h-5 mr-2 text-[#32D3FF]" />
          {t('account.changePassword')}
        </CardTitle>
        <CardDescription className="text-gray-400">
          {t('account.changePasswordDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {status.message && (
            <div className={`p-3 rounded-lg text-sm flex items-center ${
              status.type === 'success' 
                ? 'bg-blue-900/30 border border-blue-700 text-blue-400'
                : 'bg-red-900/30 border border-red-700 text-red-400'
            }`}>
              {status.type === 'success' ? (
                <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              {status.message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-sm font-medium text-white">{t('auth.currentPassword')}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleInputChange}
              placeholder={t('auth.enterCurrentPassword')}
              className="text-white placeholder:text-gray-500"
              style={{ backgroundColor: '#111827', borderColor: '#374151' }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium text-white">{t('auth.newPassword')}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder={t('auth.enterNewPassword')}
              className="text-white placeholder:text-gray-500"
              style={{ backgroundColor: '#111827', borderColor: '#374151' }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-white">{t('auth.confirmNewPassword')}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              className="text-white placeholder:text-gray-500"
              style={{ backgroundColor: '#111827', borderColor: '#374151' }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1 bg-[#32D3FF] hover:bg-[#1FC1FF] text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {t('auth.changingPassword')}
                </div>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  {t('auth.changePasswordButton')}
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none border-gray-600 text-white hover:bg-gray-700"
              onClick={() => {
                setFormData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                });
                setStatus({ type: '', message: '' });
              }}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong>{t('common.note')}:</strong> {t('auth.passwordSecurityNote')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChangePassword;