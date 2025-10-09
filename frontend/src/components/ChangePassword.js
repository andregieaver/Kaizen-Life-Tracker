import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
      console.error('Error changing password:', error);
      const errorMessage = error.response?.data?.detail || t('auth.passwordChangeError');
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Lock className="w-5 h-5 mr-2 text-gray-700" />
          {t('account.changePassword')}
        </CardTitle>
        <CardDescription>
          {t('account.changePasswordDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {status.message && (
            <div className={`p-3 rounded-lg text-sm flex items-center ${
              status.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-600'
                : 'bg-red-50 border border-red-200 text-red-600'
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
            <Label htmlFor="currentPassword">{t('auth.currentPassword')}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleInputChange}
              placeholder={t('auth.enterCurrentPassword')}
              className="input-focus"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder={t('auth.enterNewPassword')}
              className="input-focus"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmNewPassword')}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              className="input-focus"
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
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
              onClick={() => {
                setFormData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                });
                setStatus({ type: '', message: '' });
              }}
              disabled={isLoading}
              className="flex-1 sm:flex-none"
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>{t('common.note')}:</strong> {t('auth.passwordSecurityNote')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChangePassword;