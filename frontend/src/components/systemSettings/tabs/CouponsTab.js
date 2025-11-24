import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';

const CouponsTab = ({
  newCoupon,
  coupons,
  showDisabledCoupons,
  onUpdateNewCoupon,
  onCreateCoupon,
  onToggleCoupon,
  onDeleteCoupon,
  onToggleShowDisabled,
  isLoading
}) => {
  const { t } = useTranslation();

  const filteredCoupons = showDisabledCoupons 
    ? coupons 
    : coupons.filter(c => c.enabled);

  return (
    <div className="space-y-6">
      <div className="text-gray-400 text-sm">
        {t('systemSettings.coupons.description')}
      </div>
      
      {/* Create Coupon Card */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Plus className="w-5 h-5 mr-2 text-[#32D3FF]" />
            {t('systemSettings.coupons.addCoupon')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Coupon Code */}
            <div>
              <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.couponCode')} *</label>
              <input
                type="text"
                placeholder={t('systemSettings.coupons.couponCodePlaceholder')}
                value={newCoupon.code}
                onChange={(e) => onUpdateNewCoupon('code', e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
                style={{ textTransform: 'uppercase' }}
              />
              <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.couponCodeHelp')}</p>
            </div>
            
            {/* Coupon Name */}
            <div>
              <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.displayNameRequired')}</label>
              <input
                type="text"
                placeholder={t('systemSettings.coupons.displayNamePlaceholder')}
                value={newCoupon.name}
                onChange={(e) => onUpdateNewCoupon('name', e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              />
            </div>
            
            {/* Discount Type */}
            <div>
              <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.discountType')} *</label>
              <select 
                value={newCoupon.type}
                onChange={(e) => onUpdateNewCoupon('type', e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              >
                <option value="percentage">{t('systemSettings.coupons.percentage')} ({t('systemSettings.coupons.percentageOff')})</option>
                <option value="fixed">{t('systemSettings.coupons.fixedAmount')} ({t('systemSettings.coupons.amountOff')})</option>
              </select>
            </div>
            
            {/* Discount Value */}
            <div>
              <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.discountValue')} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="20"
                value={newCoupon.value}
                onChange={(e) => onUpdateNewCoupon('value', e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              />
              <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.discountValueHelp')}</p>
            </div>
            
            {/* Max Uses */}
            <div>
              <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.maxUses')}</label>
              <input
                type="number"
                min="1"
                placeholder="100"
                value={newCoupon.max_uses}
                onChange={(e) => onUpdateNewCoupon('max_uses', e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              />
              <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.maxUsesPlaceholder')}</p>
            </div>
            
            {/* Expiration Date */}
            <div>
              <label className="block text-gray-300 mb-2">{t('systemSettings.coupons.expiryDate')}</label>
              <input
                type="datetime-local"
                value={newCoupon.expires_at}
                onChange={(e) => onUpdateNewCoupon('expires_at', e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-[#32D3FF]"
              />
              <p className="text-gray-500 text-xs mt-1">{t('systemSettings.coupons.expiryPlaceholder')}</p>
            </div>
          </div>
          
          <div className="mt-6">
            <Button
              onClick={onCreateCoupon}
              className="w-full sm:w-auto bg-[#32D3FF] hover:bg-[#2ab8e6] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('systemSettings.coupons.createCoupon')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coupons List */}
      <Card className="border-0 shadow-lg bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              <Ticket className="w-5 h-5 mr-2 text-[#32D3FF]" />
              {t('systemSettings.coupons.existingCoupons')}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleShowDisabled}
              className="text-gray-300 border-gray-600"
            >
              {showDisabledCoupons ? (
                <><ToggleRight className="w-4 h-4 mr-2" /> {t('systemSettings.coupons.hideDisabled')}</>
              ) : (
                <><ToggleLeft className="w-4 h-4 mr-2" /> {t('systemSettings.coupons.showDisabled')}</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">{t('systemSettings.coupons.loading')}</div>
          ) : filteredCoupons.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {t('systemSettings.coupons.noCoupons')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700 border-b border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.coupons.code')}</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden md:table-cell">{t('systemSettings.coupons.name')}</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.coupons.discount')}</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden lg:table-cell">{t('systemSettings.coupons.uses')}</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold hidden lg:table-cell">{t('systemSettings.coupons.expires')}</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.coupons.status')}</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-sm font-semibold">{t('systemSettings.coupons.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredCoupons.map((coupon) => (
                    <tr key={coupon.code} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-[#32D3FF] font-semibold">{coupon.code}</span>
                      </td>
                      <td className="px-4 py-3 text-white text-sm hidden md:table-cell">{coupon.name}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {coupon.type === 'percentage' ? `${coupon.value}%` : `$${coupon.value}`}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                        {coupon.uses || 0} {coupon.max_uses ? `/ ${coupon.max_uses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                        {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onToggleCoupon(coupon.code, coupon.enabled)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            coupon.enabled 
                              ? 'bg-green-600/20 text-green-400' 
                              : 'bg-gray-600/20 text-gray-400'
                          }`}
                        >
                          {coupon.enabled ? t('systemSettings.coupons.active') : t('systemSettings.coupons.disabled')}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeleteCoupon(coupon.code)}
                          className="text-red-400 border-red-600 hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CouponsTab;
