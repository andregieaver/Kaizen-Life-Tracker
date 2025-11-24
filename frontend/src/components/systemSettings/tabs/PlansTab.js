import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

const PlansTab = ({
  planSettings,
  onUpdatePlanField,
  onAddFeature,
  onRemoveFeature,
  onUpdateFeature,
  onSavePlanSettings,
  dragHandlers,
  isSaving
}) => {
  const { t } = useTranslation();
  const { handleFeatureDragStart, handleFeatureDragOver, handleFeatureDrop, handleFeatureDragEnd } = dragHandlers;

  const renderPlanCard = (planType, planKey) => (
    <Card key={planKey} className="border-0 shadow-lg bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-[#32D3FF]" />
          {planSettings[planKey]?.title || planType}
        </CardTitle>
        <CardDescription className="text-gray-400">
          {t(`systemSettings.plans.${planKey}Description`)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Title */}
        <div>
          <label className="block text-gray-300 mb-2 text-sm font-semibold">
            {t('systemSettings.plans.planTitle')}
          </label>
          <input
            type="text"
            value={planSettings[planKey]?.title || ''}
            onChange={(e) => onUpdatePlanField(planKey, 'title', e.target.value)}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF] focus:outline-none"
            placeholder={`${planType} Plan`}
          />
        </div>

        {/* Plan Description */}
        <div>
          <label className="block text-gray-300 mb-2 text-sm font-semibold">
            {t('systemSettings.plans.description')}
          </label>
          <textarea
            value={planSettings[planKey]?.description || ''}
            onChange={(e) => onUpdatePlanField(planKey, 'description', e.target.value)}
            rows={2}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF] focus:outline-none"
            placeholder={t('systemSettings.plans.descriptionPlaceholder')}
          />
        </div>

        {/* Features */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-gray-300 text-sm font-semibold">
              {t('systemSettings.plans.features')}
            </label>
            <Button
              size="sm"
              onClick={() => onAddFeature(planKey)}
              className="bg-[#32D3FF] hover:bg-[#2ab8e6] text-white text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              {t('systemSettings.plans.addFeature')}
            </Button>
          </div>

          <div className="space-y-2">
            {planSettings[planKey]?.features?.map((feature, index) => (
              <div
                key={index}
                draggable
                onDragStart={(e) => handleFeatureDragStart(e, planKey, index)}
                onDragOver={handleFeatureDragOver}
                onDrop={(e) => handleFeatureDrop(e, planKey, index)}
                onDragEnd={handleFeatureDragEnd}
                className="flex items-center gap-2 p-2 bg-gray-700 rounded border border-gray-600 hover:border-gray-500 cursor-move transition-colors"
              >
                <GripVertical className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input
                  type="text"
                  value={feature}
                  onChange={(e) => onUpdateFeature(planKey, index, e.target.value)}
                  className="flex-1 bg-gray-600 text-white px-3 py-2 rounded border-0 focus:ring-2 focus:ring-[#32D3FF] focus:outline-none text-sm"
                  placeholder={t('systemSettings.plans.featurePlaceholder')}
                />
                <button
                  onClick={() => onRemoveFeature(planKey, index)}
                  className="p-2 text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="text-gray-400 text-sm">
        {t('systemSettings.plans.description')}
      </div>

      {/* Free Plan */}
      {renderPlanCard('Free', 'free')}

      {/* Pro Plan */}
      {renderPlanCard('Pro', 'pro')}

      {/* Premium Plan */}
      {renderPlanCard('Premium', 'premium')}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-700">
        <Button
          onClick={onSavePlanSettings}
          disabled={isSaving}
          className="px-6 py-2 bg-[#32D3FF] hover:bg-[#2ab8e6] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('systemSettings.plans.saving') : t('systemSettings.plans.savePlanSettings')}
        </Button>
      </div>
    </div>
  );
};

export default PlansTab;
