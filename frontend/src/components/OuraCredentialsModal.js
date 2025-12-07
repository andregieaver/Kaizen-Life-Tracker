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

const OuraCredentialsModal = ({ athleteId, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: ''
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
    const required = ['clientId', 'clientSecret'];
    for (const field of required) {
      if (!formData[field]?.trim()) {
        return t('oura.allFieldsRequired');
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
      await axios.post(`${API}/integrations/oura/${athleteId}/credentials`, {
        client_id: formData.clientId.trim(),
        client_secret: formData.clientSecret.trim()
      });
      
      setStatus({ type: 'success', message: t('oura.credentialsSaved') });
      
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
      
    } catch (error) {
      logger.error(null, 'Error saving Oura credentials:', error);
      const errorMessage = error.response?.data?.detail || t('oura.credentialsError');
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        clientId: '',
        clientSecret: ''
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
                  <div className="w-6 h-6 mr-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                  {t('oura.setupCredentials')}
                </CardTitle>
                <CardDescription className="mt-2">
                  {t('oura.credentialsDescription')}
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
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">{t('oura.howToGetCredentials')}</h4>
              <ol className="text-sm text-purple-800 space-y-1">
                <li>1. {t('oura.step1')}</li>
                <li>2. {t('oura.step2')}</li>
                <li>3. {t('oura.step3')}</li>
                <li>4. {t('oura.step4')}</li>
              </ol>
              <a 
                href="https://cloud.ouraring.com/docs/authentication" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium text-sm mt-2"
              >
                {t('oura.learnMore')} <ExternalLink className="w-3 h-3 ml-1" />
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">{t('oura.clientId')} *</Label>
                  <Input
                    id="clientId"
                    name="clientId"
                    type="text"
                    value={formData.clientId}
                    onChange={handleInputChange}
                    placeholder="your-client-id"
                    className="input-focus"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientSecret">{t('oura.clientSecret')} *</Label>
                  <Input
                    id="clientSecret"
                    name="clientSecret"
                    type="password"
                    value={formData.clientSecret}
                    onChange={handleInputChange}
                    placeholder="your-client-secret"
                    className="input-focus"
                    required
                    disabled={isLoading}
                  />
                </div>
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
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('oura.saving')}
                    </div>
                  ) : (
                    t('oura.saveCredentials')
                  )}
                </Button>
              </div>
            </form>

            {/* Security Note */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>{t('common.note')}:</strong> {t('oura.securityNote')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OuraCredentialsModal;