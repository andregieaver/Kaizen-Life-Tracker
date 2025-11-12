import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ChangeEmail = ({ athleteId, currentEmail }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    newEmail: '',
    password: ''
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

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    if (!formData.newEmail || !formData.password) {
      return 'All fields are required';
    }
    if (!validateEmail(formData.newEmail)) {
      return 'Please enter a valid email address';
    }
    if (formData.newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      return 'New email must be different from current email';
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
      await axios.post(`${API}/auth/change-email`, {
        athlete_id: athleteId,
        new_email: formData.newEmail,
        password: formData.password
      });
      
      setStatus({ type: 'success', message: 'Email changed successfully! Please log in again with your new email.' });
      setFormData({
        newEmail: '',
        password: ''
      });
      
      // Optionally refresh the page after a delay
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (error) {
      console.error('Error changing email:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to change email. Please try again.';
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center text-lg text-white">
          <Mail className="w-5 h-5 mr-2 text-[#00C2A8]" />
          {t('account.changeEmail')}
        </CardTitle>
        <CardDescription className="text-gray-400">
          {t('account.changeEmailDescription')}
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
            <Label htmlFor="currentEmail" className="text-sm font-medium text-white">{t('account.currentEmail')}</Label>
            <Input
              id="currentEmail"
              type="email"
              value={currentEmail}
              disabled
              className="text-gray-400 bg-gray-700/50 border-gray-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newEmail" className="text-sm font-medium text-white">{t('account.newEmailAddress')}</Label>
            <Input
              id="newEmail"
              name="newEmail"
              type="email"
              value={formData.newEmail}
              onChange={handleInputChange}
              placeholder={t('account.enterNewEmail')}
              className="text-white placeholder:text-gray-500"
              style={{ backgroundColor: '#111827', borderColor: '#374151' }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-white">{t('account.confirmPassword')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder={t('account.enterPasswordConfirm')}
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
                  {t('account.changingEmail')}
                </div>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  {t('account.changeEmailButton')}
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none border-gray-600 text-white hover:bg-gray-700"
              onClick={() => {
                setFormData({
                  newEmail: '',
                  password: ''
                });
                setStatus({ type: '', message: '' });
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
          <p className="text-sm text-gray-300">
            <strong>Note:</strong> After changing your email, you'll need to log in again using your new email address.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChangeEmail;
