import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { X, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const StravaCredentialsModal = ({ athleteId, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear status when user types
    if (status.message) {
      setStatus({ type: '', message: '' });
    }
  };

  const validateForm = () => {
    const required = ['clientId', 'clientSecret', 'accessToken', 'refreshToken'];
    for (const field of required) {
      if (!formData[field]?.trim()) {
        return t('strava.allFieldsRequired');
      }
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
      await axios.post(`${API}/integrations/strava/${athleteId}/credentials`, {
        client_id: formData.clientId.trim(),
        client_secret: formData.clientSecret.trim(),
        access_token: formData.accessToken.trim(),
        refresh_token: formData.refreshToken.trim()
      });
      
      setStatus({ type: 'success', message: t('strava.credentialsSaved') });
      
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
      
    } catch (error) {
      logger.error(null, 'Error saving Strava credentials:', error);
      const errorMessage = error.response?.data?.detail || t('strava.credentialsError');
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: ''
      });
      setStatus({ type: '', message: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center">
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="#FC4C02">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.008 13.828h4.172"/>
                  </svg>
                  {t('strava.setupCredentials')}
                </CardTitle>
                <CardDescription className="mt-2">
                  {t('strava.credentialsDescription')}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Instructions */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">{t('strava.howToGetCredentials')}</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. {t('strava.step1')}</li>
                <li>2. {t('strava.step2')}</li>
                <li>3. {t('strava.step3')}</li>
                <li>4. {t('strava.step4')}</li>
              </ol>
              <a 
                href="https://developers.strava.com/docs/getting-started/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm mt-2"
              >
                {t('strava.learnMore')} <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>

            {/* Form */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">{t('strava.clientId')} *</Label>
                  <Input
                    id="clientId"
                    name="clientId"
                    type="text"
                    value={formData.clientId}
                    onChange={handleInputChange}
                    placeholder="12345"
                    className="input-focus"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientSecret">{t('strava.clientSecret')} *</Label>
                  <Input
                    id="clientSecret"
                    name="clientSecret"
                    type="password"
                    value={formData.clientSecret}
                    onChange={handleInputChange}
                    placeholder="fdd4b7044a78c10de1b65e201a4ca931719f27d2"
                    className="input-focus"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">{t('strava.accessToken')} *</Label>
                <Input
                  id="accessToken"
                  name="accessToken"
                  type="password"
                  value={formData.accessToken}
                  onChange={handleInputChange}
                  placeholder="faec55280628b1f24bebe0ca303a8f8f29b7dc0a"
                  className="input-focus"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refreshToken">{t('strava.refreshToken')} *</Label>
                <Input
                  id="refreshToken"
                  name="refreshToken"
                  type="password"
                  value={formData.refreshToken}
                  onChange={handleInputChange}
                  placeholder="2de99353b9bd554b5175f5922446da138cb336a8"
                  className="input-focus"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {t('common.cancel')}
                </Button>
                
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('strava.saving')}
                    </div>
                  ) : (
                    t('strava.saveCredentials')
                  )}
                </Button>
              </div>
            </form>

            {/* Security Note */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>{t('common.note')}:</strong> {t('strava.securityNote')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StravaCredentialsModal;