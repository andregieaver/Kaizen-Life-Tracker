import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

const ModulesTab = ({
  moduleSettings,
  toggleModule,
  toggleModuleExpansion,
  saveModuleSettings,
  isSaving
}) => {
  const { t } = useTranslation();

  return (
    <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">{t('systemSettings.modules.title')}</CardTitle>
        <CardDescription className="text-gray-400">
          {t('systemSettings.modules.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Affiliate Program Module */}
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {t('systemSettings.modules.affiliateProgram.title')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('systemSettings.modules.affiliateProgram.description')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => toggleModule('affiliateProgram')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#32D3FF] focus:ring-offset-2 focus:ring-offset-gray-900 ${
                    moduleSettings?.affiliateProgram?.enabled 
                      ? 'bg-[#32D3FF]' 
                      : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      moduleSettings?.affiliateProgram?.enabled 
                        ? 'translate-x-6' 
                        : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-white min-w-[60px]">
                  {moduleSettings?.affiliateProgram?.enabled ? t('common.connect') : t('common.disconnect')}
                </span>
                {moduleSettings?.affiliateProgram?.enabled && (
                  <button
                    type="button"
                    onClick={() => toggleModuleExpansion('affiliateProgram')}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                  >
                    {moduleSettings.affiliateProgram.expanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Expanded Content */}
          {moduleSettings?.affiliateProgram?.enabled && moduleSettings?.affiliateProgram?.expanded && (
            <div className="p-4 bg-gray-900/50 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                {t('systemSettings.modules.configAffiliateProgram')}
              </p>
            </div>
          )}
        </div>

        {/* Community Module */}
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {t('systemSettings.modules.community.title')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('systemSettings.modules.community.description')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => toggleModule('community')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#32D3FF] focus:ring-offset-2 focus:ring-offset-gray-900 ${
                    moduleSettings?.community?.enabled 
                      ? 'bg-[#32D3FF]' 
                      : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      moduleSettings?.community?.enabled 
                        ? 'translate-x-6' 
                        : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-white min-w-[60px]">
                  {moduleSettings?.community?.enabled ? t('systemSettings.modules.enabled') : t('systemSettings.modules.disabled')}
                </span>
                {moduleSettings?.community?.enabled && (
                  <button
                    type="button"
                    onClick={() => toggleModuleExpansion('community')}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                  >
                    {moduleSettings.community.expanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Expanded Content */}
          {moduleSettings?.community?.enabled && moduleSettings?.community?.expanded && (
            <div className="p-4 bg-gray-900/50 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                {t('systemSettings.modules.configCommunity')}
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button
            onClick={saveModuleSettings}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2 bg-[#32D3FF] hover:bg-[#00a890] text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Module Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModulesTab;
