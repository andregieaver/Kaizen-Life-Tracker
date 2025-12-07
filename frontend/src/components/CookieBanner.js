import React, { useState, useEffect } from 'react';
import { X, Shield, Settings } from 'lucide-react';
import { Button } from './ui/button';
import axios from 'axios';
import { updateConsent } from '../lib/analytics';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [cookieSettings, setCookieSettings] = useState(null);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    functional: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCookieSettings();
  }, []);

  const loadCookieSettings = async () => {
    try {
      const response = await axios.get(`${API}/cookies/consent/public`);
      logger.debug(null, '🍪 Cookie consent settings loaded:', response.data);
      
      setCookieSettings(response.data);
      
      // Check if user has already given consent
      const savedConsent = localStorage.getItem('cookie_consent');
      
      if (!savedConsent && response.data.enabled) {
        // Show banner if no consent given and cookies are enabled
        setShowBanner(true);
      } else if (savedConsent) {
        // Apply saved preferences
        const consent = JSON.parse(savedConsent);
        setPreferences(consent.preferences);
        updateGTMConsent(consent.preferences);
      }
      
      setLoading(false);
    } catch (error) {
      logger.error(null, 'Error loading cookie settings:', error);
      setLoading(false);
    }
  };

  const updateGTMConsent = (prefs) => {
    // Google Consent Mode v2 implementation
    if (window.gtag && cookieSettings?.gtm_integration?.enabled) {
      window.gtag('consent', 'update', {
        'analytics_storage': prefs.analytics ? 'granted' : 'denied',
        'ad_storage': prefs.marketing ? 'granted' : 'denied',
        'functionality_storage': prefs.functional ? 'granted' : 'denied',
        'personalization_storage': prefs.functional ? 'granted' : 'denied',
        'security_storage': 'granted' // Always granted for necessary cookies
      });
      logger.debug(null, '🍪 GTM Consent updated:', prefs);
    } else if (window.dataLayer && cookieSettings?.gtm_integration?.enabled) {
      // Fallback for GTM via dataLayer
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'consent_update',
        analytics_storage: prefs.analytics ? 'granted' : 'denied',
        ad_storage: prefs.marketing ? 'granted' : 'denied',
        functionality_storage: prefs.functional ? 'granted' : 'denied',
        personalization_storage: prefs.functional ? 'granted' : 'denied',
        security_storage: 'granted'
      });
      logger.debug(null, '🍪 GTM Consent (dataLayer) updated:', prefs);
    }
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    
    setPreferences(allAccepted);
    saveConsent(allAccepted);
    updateGTMConsent(allAccepted);
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const allRejected = {
      necessary: true, // Always true
      analytics: false,
      marketing: false,
      functional: false
    };
    
    setPreferences(allRejected);
    saveConsent(allRejected);
    updateGTMConsent(allRejected);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
    updateGTMConsent(preferences);
    setShowBanner(false);
    setShowPreferences(false);
  };

  const saveConsent = (prefs) => {
    const consent = {
      preferences: prefs,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookie_consent', JSON.stringify(consent));
    logger.debug(null, '🍪 Cookie consent saved:', consent);
    
    // Update analytics consent via GTM
    updateConsent(prefs);
  };

  if (loading || !cookieSettings || !cookieSettings.enabled || !showBanner) {
    return null;
  }

  const texts = cookieSettings.consent_texts || {};

  return (
    <>
      {/* Cookie Banner Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-end sm:items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#32D3FF]" />
                <h2 className="text-xl font-bold text-white">
                  {texts.banner_title || 'We value your privacy'}
                </h2>
              </div>
              <button
                onClick={handleRejectAll}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              {texts.banner_description || 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.'}
            </p>

            {/* Preferences View */}
            {showPreferences && (
              <div className="space-y-3 pt-4 border-t border-gray-700">
                {/* Necessary Cookies */}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-white">
                        {texts.necessary_title || 'Necessary Cookies'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {texts.necessary_description || 'These cookies are essential for the website to function properly.'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="w-5 h-5 rounded border-gray-600 text-[#32D3FF] opacity-50 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-white">
                        {texts.analytics_title || 'Analytics Cookies'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {texts.analytics_description || 'These cookies help us understand how visitors interact with our website.'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        analytics: e.target.checked
                      })}
                      className="w-5 h-5 rounded border-gray-600 text-[#32D3FF] focus:ring-[#32D3FF]"
                    />
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-white">
                        {texts.marketing_title || 'Marketing Cookies'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {texts.marketing_description || 'These cookies are used to track visitors across websites for advertising purposes.'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        marketing: e.target.checked
                      })}
                      className="w-5 h-5 rounded border-gray-600 text-[#32D3FF] focus:ring-[#32D3FF]"
                    />
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-white">
                        {texts.functional_title || 'Functional Cookies'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {texts.functional_description || 'These cookies enable enhanced functionality and personalization.'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        functional: e.target.checked
                      })}
                      className="w-5 h-5 rounded border-gray-600 text-[#32D3FF] focus:ring-[#32D3FF]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cookie Policy Link */}
            {texts.cookie_policy_link && (
              <p className="text-xs text-gray-400 pt-2">
                For more information, see our{' '}
                <a 
                  href={texts.cookie_policy_link}
                  className="text-[#32D3FF] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {texts.cookie_policy_text || 'Cookie Policy'}
                </a>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-gray-700 flex flex-col sm:flex-row gap-3">
            {showPreferences ? (
              <>
                <Button
                  onClick={() => setShowPreferences(false)}
                  variant="outline"
                  className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSavePreferences}
                  className="flex-1 bg-[#32D3FF] hover:bg-[#1FC1FF] text-white"
                >
                  {texts.save_preferences_button || 'Save Preferences'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleRejectAll}
                  variant="outline"
                  className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  {texts.reject_all_button || 'Reject All'}
                </Button>
                <Button
                  onClick={() => setShowPreferences(true)}
                  variant="outline"
                  className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {texts.customize_button || 'Customize'}
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-[#32D3FF] hover:bg-[#1FC1FF] text-white"
                >
                  {texts.accept_all_button || 'Accept All'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CookieBanner;
