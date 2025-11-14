import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie, Save, Scan } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

const CookiesTab = ({
  cookieSettings,
  isScanning,
  isSaving,
  onToggleCookieConsent,
  onUpdateBannerText,
  onToggleCategory,
  onScanCookies,
  onSaveCookieSettings
}) => {
  const { t } = useTranslation();

  return (
    <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Cookie className="w-5 h-5 mr-2 text-[#32D3FF]" />
          {t('systemSettings.cookies.title')}
        </CardTitle>
        <CardDescription className="text-gray-400">
          {t('systemSettings.cookies.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Cookie Consent */}
        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <div>
            <h3 className="text-white font-semibold">
              {t('systemSettings.cookies.enableConsent')}
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {t('systemSettings.cookies.enableDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleCookieConsent}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              cookieSettings.enabled ? 'bg-[#32D3FF]' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                cookieSettings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {cookieSettings.enabled && (
          <>
            {/* Banner Text */}
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">
                {t('systemSettings.cookies.bannerText')}
              </label>
              <textarea
                value={cookieSettings.bannerText}
                onChange={(e) => onUpdateBannerText(e.target.value)}
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#32D3FF]"
                placeholder={t('systemSettings.cookies.bannerPlaceholder')}
              />
            </div>

            {/* Cookie Categories */}
            <div className="space-y-4">
              <h3 className="text-white font-semibold">
                {t('systemSettings.cookies.categories')}
              </h3>
              
              {/* Necessary Cookies */}
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-white font-medium">
                      {t('systemSettings.cookies.necessary')}
                    </h4>
                    <p className="text-gray-400 text-xs mt-1">
                      {t('systemSettings.cookies.necessaryDescription')}
                    </p>
                  </div>
                  <div className="text-gray-500 text-sm">
                    {t('systemSettings.cookies.alwaysActive')}
                  </div>
                </div>
                {cookieSettings.categories?.necessary?.cookies?.length > 0 && (
                  <div className="text-gray-400 text-xs mt-2">
                    {cookieSettings.categories.necessary.cookies.length} cookies detected
                  </div>
                )}
              </div>

              {/* Functional Cookies */}
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-white font-medium">
                      {t('systemSettings.cookies.functional')}
                    </h4>
                    <p className="text-gray-400 text-xs mt-1">
                      {t('systemSettings.cookies.functionalDescription')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCategory('functional')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      cookieSettings.categories?.functional?.enabled ? 'bg-[#32D3FF]' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cookieSettings.categories?.functional?.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {cookieSettings.categories?.functional?.cookies?.length > 0 && (
                  <div className="text-gray-400 text-xs mt-2">
                    {cookieSettings.categories.functional.cookies.length} cookies detected
                  </div>
                )}
              </div>

              {/* Analytics Cookies */}
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-white font-medium">
                      {t('systemSettings.cookies.analytics')}
                    </h4>
                    <p className="text-gray-400 text-xs mt-1">
                      {t('systemSettings.cookies.analyticsDescription')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCategory('analytics')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      cookieSettings.categories?.analytics?.enabled ? 'bg-[#32D3FF]' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cookieSettings.categories?.analytics?.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {cookieSettings.categories?.analytics?.cookies?.length > 0 && (
                  <div className="text-gray-400 text-xs mt-2">
                    {cookieSettings.categories.analytics.cookies.length} cookies detected
                  </div>
                )}
              </div>

              {/* Marketing Cookies */}
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-white font-medium">
                      {t('systemSettings.cookies.marketing')}
                    </h4>
                    <p className="text-gray-400 text-xs mt-1">
                      {t('systemSettings.cookies.marketingDescription')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCategory('marketing')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      cookieSettings.categories?.marketing?.enabled ? 'bg-[#32D3FF]' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cookieSettings.categories?.marketing?.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {cookieSettings.categories?.marketing?.cookies?.length > 0 && (
                  <div className="text-gray-400 text-xs mt-2">
                    {cookieSettings.categories.marketing.cookies.length} cookies detected
                  </div>
                )}
              </div>
            </div>

            {/* Scan Cookies Button */}
            <Button
              onClick={onScanCookies}
              disabled={isScanning}
              className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 text-white"
            >
              <Scan className="w-4 h-4 mr-2" />
              {isScanning ? t('systemSettings.cookies.scanning') : t('systemSettings.cookies.scanCookies')}
            </Button>
          </>
        )}

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-700">
          <Button
            onClick={onSaveCookieSettings}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2 bg-[#32D3FF] hover:bg-[#00a890] text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Cookie Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CookiesTab;
