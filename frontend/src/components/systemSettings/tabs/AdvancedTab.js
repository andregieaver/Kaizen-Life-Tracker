import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, Eye, EyeOff, Upload } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

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
            <div className="flex gap-2">
              <input
                type="text"
                value={advancedSettings.seo?.logoUrl || ''}
                onChange={(e) => onUpdateSEOSetting('logoUrl', e.target.value)}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                placeholder="URL or upload image"
              />
              <Button
                size="sm"
                onClick={() => document.getElementById('logo-upload').click()}
                className="bg-gray-700 hover:bg-gray-600"
              >
                <Upload className="w-4 h-4" />
              </Button>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files[0] && onUploadSEOImage('logoUrl', e.target.files[0])}
                className="hidden"
              />
            </div>
            {advancedSettings.seo?.logoUrl && (
              <div className="mt-2">
                <img 
                  src={advancedSettings.seo.logoUrl.startsWith('http') ? advancedSettings.seo.logoUrl : `${process.env.REACT_APP_BACKEND_URL}${advancedSettings.seo.logoUrl}`}
                  alt="Logo preview"
                  className="h-12 object-contain bg-gray-900 p-2 rounded"
                />
              </div>
            )}
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
          className="px-6 py-2 bg-[#32D3FF] hover:bg-[#00a890] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('systemSettings.advanced.saving') : t('systemSettings.advanced.saveSettings')}
        </Button>
      </div>
    </div>
  );
};

export default AdvancedTab;
