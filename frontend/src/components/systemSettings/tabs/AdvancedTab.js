import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, Eye, EyeOff, Upload, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdvancedTab = ({
  advancedSettings,
  onUpdateSEOSetting,
  onUpdateSimpleSetting,
  onUpdateStripeMode,
  onUpdateStripeCredentials,
  onUpdateIntegration,
  onToggleVisibility,
  onUploadSEOImage,
  onSaveAdvancedSettings,
  isSaving
}) => {
  const { t } = useTranslation();
  
  // Test integration dialog state
  const [testDialog, setTestDialog] = useState({
    open: false,
    integration: '',
    testing: false,
    success: null,
    message: '',
    details: ''
  });

  // Reload email service state
  const [reloadingEmail, setReloadingEmail] = useState(false);
  const [reloadMessage, setReloadMessage] = useState(null);

  const testIntegration = async (integrationType) => {
    setTestDialog({
      open: true,
      integration: integrationType,
      testing: true,
      success: null,
      message: 'Testing connection...',
      details: ''
    });

    try {
      const response = await axios.post(`${BACKEND_URL}/api/system/test-integration`, {
        type: integrationType,
        config: integrationType === 'openai' ? advancedSettings.integrations?.openaiApiKey :
               integrationType === 'sendgrid' ? advancedSettings.sendgrid :
               integrationType === 'stripe' ? advancedSettings.stripe : null
      });

      setTestDialog({
        open: true,
        integration: integrationType,
        testing: false,
        success: response.data.success,
        message: response.data.message,
        details: response.data.details || ''
      });
    } catch (error) {
      setTestDialog({
        open: true,
        integration: integrationType,
        testing: false,
        success: false,
        message: error.response?.data?.message || 'Connection failed',
        details: error.response?.data?.details || error.message
      });
    }
  };

  const reloadEmailService = async () => {
    setReloadingEmail(true);
    setReloadMessage(null);
    
    try {
      const athleteId = localStorage.getItem('athleteId');
      const response = await axios.post(
        `${BACKEND_URL}/api/system/reload-email-service`,
        {},
        { params: { athlete_id: athleteId } }
      );
      
      setReloadMessage({
        type: 'success',
        text: response.data.message || 'Email service reloaded successfully'
      });
      
      // Clear success message after 5 seconds
      setTimeout(() => setReloadMessage(null), 5000);
    } catch (error) {
      setReloadMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to reload email service'
      });
      
      // Clear error message after 5 seconds
      setTimeout(() => setReloadMessage(null), 5000);
    } finally {
      setReloadingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SEO Settings */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Settings className="w-5 h-5 mr-2 text-[#32D3FF]" />
            {t('systemSettings.advanced.seoSettings')}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {t('systemSettings.advanced.seoDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              {t('systemSettings.advanced.siteTitle')}
            </label>
            <input
              type="text"
              value={advancedSettings.seo?.siteTitle || ''}
              onChange={(e) => onUpdateSEOSetting('siteTitle', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              placeholder="TrainSmart"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              Logo / Header Image
            </label>
            <div className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
              {/* Logo Preview */}
              <div className="relative flex-shrink-0">
                {advancedSettings.seo?.logoUrl ? (
                  <img
                    src={advancedSettings.seo.logoUrl.startsWith('http') ? advancedSettings.seo.logoUrl : `${process.env.REACT_APP_BACKEND_URL}${advancedSettings.seo.logoUrl}`}
                    alt="Logo"
                    className="w-20 h-20 object-contain bg-gray-900 rounded border-2 border-gray-600"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-800 flex items-center justify-center rounded border-2 border-gray-600">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Upload Button */}
              <div className="flex-1">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && onUploadSEOImage('logoUrl', e.target.files[0])}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {advancedSettings.seo?.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG or GIF. Max size 5MB
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              {t('systemSettings.advanced.metaDescription')}
            </label>
            <textarea
              value={advancedSettings.seo?.metaDescription || ''}
              onChange={(e) => onUpdateSEOSetting('metaDescription', e.target.value)}
              rows={3}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              placeholder={t('systemSettings.advanced.metaDescriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2 text-sm font-semibold">
                {t('systemSettings.advanced.favicon')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={advancedSettings.seo?.faviconUrl || ''}
                  onChange={(e) => onUpdateSEOSetting('faviconUrl', e.target.value)}
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                  placeholder="URL"
                />
                <Button
                  size="sm"
                  onClick={() => document.getElementById('favicon-upload').click()}
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  id="favicon-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && onUploadSEOImage('faviconUrl', e.target.files[0])}
                  className="hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2 text-sm font-semibold">
                {t('systemSettings.advanced.ogImage')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={advancedSettings.seo?.ogImage || ''}
                  onChange={(e) => onUpdateSEOSetting('ogImage', e.target.value)}
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                  placeholder="URL"
                />
                <Button
                  size="sm"
                  onClick={() => document.getElementById('og-image-upload').click()}
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  id="og-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && onUploadSEOImage('ogImage', e.target.files[0])}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Settings */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">{t('systemSettings.advanced.stripeSettings')}</CardTitle>
          <CardDescription className="text-gray-400">
            {t('systemSettings.advanced.stripeDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              {t('systemSettings.advanced.stripeMode')}
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={advancedSettings.stripe?.mode === 'test' ? 'default' : 'outline'}
                onClick={() => onUpdateStripeMode('test')}
                className={advancedSettings.stripe?.mode === 'test' ? 'bg-yellow-600' : 'border-gray-600'}
              >
                {t('systemSettings.advanced.testMode')}
              </Button>
              <Button
                size="sm"
                variant={advancedSettings.stripe?.mode === 'live' ? 'default' : 'outline'}
                onClick={() => onUpdateStripeMode('live')}
                className={advancedSettings.stripe?.mode === 'live' ? 'bg-green-600' : 'border-gray-600'}
              >
                {t('systemSettings.advanced.liveMode')}
              </Button>
            </div>
          </div>

          {/* Live Credentials */}
          {advancedSettings.stripe?.mode === 'live' && (
            <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h4 className="text-white font-semibold text-sm">{t('systemSettings.advanced.liveCredentials')}</h4>
              
              <div>
                <label className="block text-gray-300 mb-2 text-xs">{t('systemSettings.advanced.publishableKey')}</label>
                <input
                  type="text"
                  value={advancedSettings.stripe?.live?.publishableKey || ''}
                  onChange={(e) => onUpdateStripeCredentials('live', 'publishableKey', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                  placeholder="pk_live_..."
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-xs">{t('systemSettings.advanced.secretKey')}</label>
                <div className="flex gap-2">
                  <input
                    type={advancedSettings.showStripeLiveKey ? 'text' : 'password'}
                    value={advancedSettings.stripe?.live?.apiKey || ''}
                    onChange={(e) => onUpdateStripeCredentials('live', 'apiKey', e.target.value)}
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                    placeholder="sk_live_..."
                  />
                  <Button
                    size="sm"
                    onClick={() => onToggleVisibility('showStripeLiveKey')}
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    {advancedSettings.showStripeLiveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Test Credentials */}
          {advancedSettings.stripe?.mode === 'test' && (
            <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h4 className="text-white font-semibold text-sm">{t('systemSettings.advanced.testCredentials')}</h4>
              
              <div>
                <label className="block text-gray-300 mb-2 text-xs">{t('systemSettings.advanced.publishableKey')}</label>
                <input
                  type="text"
                  value={advancedSettings.stripe?.sandbox?.publishableKey || ''}
                  onChange={(e) => onUpdateStripeCredentials('sandbox', 'publishableKey', e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                  placeholder="pk_test_..."
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-xs">{t('systemSettings.advanced.secretKey')}</label>
                <div className="flex gap-2">
                  <input
                    type={advancedSettings.showStripeSandboxKey ? 'text' : 'password'}
                    value={advancedSettings.stripe?.sandbox?.apiKey || ''}
                    onChange={(e) => onUpdateStripeCredentials('sandbox', 'apiKey', e.target.value)}
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                    placeholder="sk_test_..."
                  />
                  <Button
                    size="sm"
                    onClick={() => onToggleVisibility('showStripeSandboxKey')}
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    {advancedSettings.showStripeSandboxKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OpenAI API Key */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Settings className="w-5 h-5 mr-2 text-[#32D3FF]" />
            {t('systemSettings.advanced.openaiSettings')}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {t('systemSettings.advanced.openaiDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              {t('systemSettings.advanced.openaiApiKey')}
            </label>
            <div className="flex gap-2">
              <input
                type={advancedSettings.showKey ? 'text' : 'password'}
                value={advancedSettings.openaiApiKey || ''}
                onChange={(e) => onUpdateSimpleSetting('openaiApiKey', e.target.value)}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                placeholder="sk-..."
              />
              <Button
                size="sm"
                onClick={() => onToggleVisibility('showKey')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                {advancedSettings.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t('systemSettings.advanced.openaiKeyHelp')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SendGrid Email Service */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Settings className="w-5 h-5 mr-2 text-[#32D3FF]" />
            SendGrid Email Service
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure SendGrid for sending emails (support forms, notifications, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              SendGrid API Key
            </label>
            <div className="flex gap-2">
              <input
                type={advancedSettings.showSendGridKey ? 'text' : 'password'}
                value={advancedSettings.sendgrid?.apiKey || ''}
                onChange={(e) => onUpdateIntegration('sendgrid', 'apiKey', e.target.value)}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <Button
                size="sm"
                onClick={() => onToggleVisibility('showSendGridKey')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                {advancedSettings.showSendGridKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-[#32D3FF] hover:underline">SendGrid Settings</a>
            </p>
          </div>

          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              Sender Email Address
            </label>
            <input
              type="email"
              value={advancedSettings.sendgrid?.senderEmail || ''}
              onChange={(e) => onUpdateIntegration('sendgrid', 'senderEmail', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              placeholder="noreply@yourdomain.com"
            />
            <p className="text-xs text-gray-400 mt-1">
              Must be a verified sender in SendGrid
            </p>
          </div>

          <div>
            <label className="block text-gray-300 mb-2 text-sm font-semibold">
              Sender Name (Optional)
            </label>
            <input
              type="text"
              value={advancedSettings.sendgrid?.senderName || ''}
              onChange={(e) => onUpdateIntegration('sendgrid', 'senderName', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              placeholder="TrainSmart"
            />
            <p className="text-xs text-gray-400 mt-1">
              The name that appears in the "From" field
            </p>
          </div>

          {advancedSettings.sendgrid?.apiKey && advancedSettings.sendgrid?.senderEmail && (
            <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
              <p className="text-green-400 text-sm">
                ✓ SendGrid configured - Email service is enabled
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Settings */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">{t('systemSettings.advanced.integrations')}</CardTitle>
          <CardDescription className="text-gray-400">
            {t('systemSettings.advanced.integrationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {['strava', 'oura', 'polar', 'fitbit', 'garmin', 'coros', 'whoop', 'suunto'].map((integration) => (
            <div key={integration} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <h4 className="text-white font-semibold text-sm capitalize mb-2">{integration}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={advancedSettings[integration]?.clientId || ''}
                  onChange={(e) => onUpdateIntegration(integration, 'clientId', e.target.value)}
                  className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-xs"
                  placeholder="Client ID"
                />
                <input
                  type="password"
                  value={advancedSettings[integration]?.clientSecret || ''}
                  onChange={(e) => onUpdateIntegration(integration, 'clientSecret', e.target.value)}
                  className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-xs"
                  placeholder="Client Secret"
                />
              </div>
              {/* Callback Domain for OAuth integrations */}
              {['strava', 'oura', 'polar', 'fitbit', 'garmin', 'coros', 'whoop', 'suunto'].includes(integration) && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={advancedSettings[integration]?.callbackDomain || ''}
                    onChange={(e) => onUpdateIntegration(integration, 'callbackDomain', e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-xs"
                    placeholder="Callback Domain (e.g., https://yourdomain.com)"
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-700">
        <Button
          onClick={onSaveAdvancedSettings}
          disabled={isSaving}
          className="px-6 py-2 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('systemSettings.advanced.saving') : t('systemSettings.advanced.saveSettings')}
        </Button>
      </div>
    </div>
  );
};

export default AdvancedTab;
