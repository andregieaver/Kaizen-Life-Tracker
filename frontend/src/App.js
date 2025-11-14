import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// Core components - loaded immediately
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import CookieBanner from './components/CookieBanner';
import { ThemeProvider } from './contexts/ThemeContext';
import { usePageViews } from './lib/usePageViews';
import { logger } from './utils/logger';
import './App.css';

// Lazy loaded components - loaded on demand
const Dashboard = lazy(() => import('./components/Dashboard'));
const OnboardingForm = lazy(() => import('./components/OnboardingForm'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const Pricing = lazy(() => import('./components/Pricing'));
const Journal = lazy(() => import('./components/Journal'));
const Supplements = lazy(() => import('./components/Supplements'));
const Schedules = lazy(() => import('./components/Schedules'));
const OuraCallback = lazy(() => import('./components/OuraCallback'));
const CorosCallback = lazy(() => import('./components/CorosCallback'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const TermsConditions = lazy(() => import('./components/TermsConditions'));
const CmsPage = lazy(() => import('./components/CmsPage'));

// Loading component shown during code splitting
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg-950)',
    color: 'var(--text-hi)'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid var(--c-brand-500)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 16px'
      }} />
      <p>Loading...</p>
    </div>
  </div>
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Analytics Provider Component
// Initializes analytics tracking and page views
function AnalyticsProvider() {
  usePageViews();
  return null;
}

// Signup redirect component that preserves ref parameter
const SignupRedirect = () => {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  
  // Redirect to home with ref parameter if present
  if (ref) {
    return <Navigate to={`/?ref=${ref}`} replace />;
  }
  return <Navigate to="/" replace />;
};

function App() {
  const { t } = useTranslation();
  const [athleteId, setAthleteId] = useState(localStorage.getItem('athleteId'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if athlete exists in localStorage and validate
    const storedAthleteId = localStorage.getItem('athleteId');
    if (storedAthleteId) {
      validateAthlete(storedAthleteId);
    } else {
      setIsLoading(false);
    }
    
    // Load and apply SEO settings
    loadSeoSettings();
  }, []);

  const loadSeoSettings = async () => {
    try {
      // Try to load global SEO settings and GTM codes (no auth required)
      const response = await axios.get(`${API}/system/settings/public`);
      if (response.data.seo) {
        applySeoSettings(response.data.seo);
      }
      if (response.data.googleTagManager) {
        injectGTMCodes(response.data.googleTagManager);
      }
      if (response.data.microsoftClarity) {
        injectMicrosoftClarity(response.data.microsoftClarity);
      }
    } catch (error) {
      // If endpoint doesn't exist or fails, use defaults
      logger.debug(null, 'Using default SEO settings');
    }
  };

  const injectMicrosoftClarity = (clarityData) => {
    // Inject Microsoft Clarity tracking script
    if (clarityData.scriptCode && clarityData.scriptCode.trim()) {
      // Check if Clarity is already injected
      if (!document.querySelector('[data-clarity]')) {
        const clarityScript = document.createElement('div');
        clarityScript.setAttribute('data-clarity', 'true');
        clarityScript.innerHTML = clarityData.scriptCode;
        
        // Extract and execute scripts from the HTML string
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = clarityData.scriptCode;
        const scripts = tempDiv.querySelectorAll('script');
        
        scripts.forEach(script => {
          const newScript = document.createElement('script');
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.textContent = script.textContent;
          }
          Array.from(script.attributes).forEach(attr => {
            if (attr.name !== 'src') {
              newScript.setAttribute(attr.name, attr.value);
            }
          });
          document.head.appendChild(newScript);
        });
        
        logger.debug(null, '✅ Microsoft Clarity tracking code injected');
      }
    }
  };

  const injectGTMCodes = (gtmData) => {
    // Inject GTM head code
    if (gtmData.headCode && gtmData.headCode.trim()) {
      // Check if GTM head code is already injected
      if (!document.querySelector('[data-gtm-head]')) {
        const headScript = document.createElement('div');
        headScript.setAttribute('data-gtm-head', 'true');
        headScript.innerHTML = gtmData.headCode;
        
        // Extract and execute scripts from the HTML string
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = gtmData.headCode;
        const scripts = tempDiv.querySelectorAll('script');
        
        scripts.forEach(script => {
          const newScript = document.createElement('script');
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.textContent = script.textContent;
          }
          Array.from(script.attributes).forEach(attr => {
            if (attr.name !== 'src') {
              newScript.setAttribute(attr.name, attr.value);
            }
          });
          document.head.appendChild(newScript);
        });
        
        logger.debug(null, '✅ GTM head code injected');
      }
    }
    
    // Inject GTM body code
    if (gtmData.bodyCode && gtmData.bodyCode.trim()) {
      // Check if GTM body code is already injected
      if (!document.querySelector('[data-gtm-body]')) {
        const bodyDiv = document.createElement('div');
        bodyDiv.setAttribute('data-gtm-body', 'true');
        bodyDiv.innerHTML = gtmData.bodyCode;
        
        // Insert at the beginning of body
        if (document.body.firstChild) {
          document.body.insertBefore(bodyDiv, document.body.firstChild);
        } else {
          document.body.appendChild(bodyDiv);
        }
        
        logger.debug(null, '✅ GTM body code injected');
      }
    }
  };

  const applySeoSettings = (seoData) => {
    // Update document title
    if (seoData.siteTitle) {
      document.title = seoData.siteTitle;
    }
    
    // Update meta description
    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.setAttribute('name', 'description');
      document.head.appendChild(metaDescTag);
    }
    metaDescTag.setAttribute('content', seoData.metaDescription || '');
    
    // Update OG title
    let ogTitleTag = document.querySelector('meta[property="og:title"]');
    if (!ogTitleTag) {
      ogTitleTag = document.createElement('meta');
      ogTitleTag.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitleTag);
    }
    ogTitleTag.setAttribute('content', seoData.siteTitle || '');
    
    // Update OG description
    let ogDescTag = document.querySelector('meta[property="og:description"]');
    if (!ogDescTag) {
      ogDescTag = document.createElement('meta');
      ogDescTag.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescTag);
    }
    ogDescTag.setAttribute('content', seoData.metaDescription || '');
    
    // Update OG image
    if (seoData.ogImage) {
      let ogImageTag = document.querySelector('meta[property="og:image"]');
      if (!ogImageTag) {
        ogImageTag = document.createElement('meta');
        ogImageTag.setAttribute('property', 'og:image');
        document.head.appendChild(ogImageTag);
      }
      // Use full URL for OG image
      const fullImageUrl = seoData.ogImage.startsWith('http') 
        ? seoData.ogImage 
        : `${BACKEND_URL}${seoData.ogImage}`;
      ogImageTag.setAttribute('content', fullImageUrl);
      
      // Add OG image width and height for better social media display
      let ogImageWidthTag = document.querySelector('meta[property="og:image:width"]');
      if (!ogImageWidthTag) {
        ogImageWidthTag = document.createElement('meta');
        ogImageWidthTag.setAttribute('property', 'og:image:width');
        document.head.appendChild(ogImageWidthTag);
      }
      ogImageWidthTag.setAttribute('content', '1200');
      
      let ogImageHeightTag = document.querySelector('meta[property="og:image:height"]');
      if (!ogImageHeightTag) {
        ogImageHeightTag = document.createElement('meta');
        ogImageHeightTag.setAttribute('property', 'og:image:height');
        document.head.appendChild(ogImageHeightTag);
      }
      ogImageHeightTag.setAttribute('content', '630');
    }
    
    // Update OG type
    let ogTypeTag = document.querySelector('meta[property="og:type"]');
    if (!ogTypeTag) {
      ogTypeTag = document.createElement('meta');
      ogTypeTag.setAttribute('property', 'og:type');
      document.head.appendChild(ogTypeTag);
    }
    ogTypeTag.setAttribute('content', 'website');
    
    // Update OG URL
    let ogUrlTag = document.querySelector('meta[property="og:url"]');
    if (!ogUrlTag) {
      ogUrlTag = document.createElement('meta');
      ogUrlTag.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrlTag);
    }
    ogUrlTag.setAttribute('content', window.location.href);
    
    // Update favicon
    if (seoData.faviconUrl) {
      let faviconLink = document.querySelector('link[rel="icon"]');
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.setAttribute('rel', 'icon');
        document.head.appendChild(faviconLink);
      }
      faviconLink.setAttribute('href', `${BACKEND_URL}${seoData.faviconUrl}`);
    }
  };

  const validateAthlete = async (id) => {
    try {
      await axios.get(`${API}/athlete/${id}`);
      setAthleteId(id);
    } catch (error) {
      logger.error(null, 'Invalid athlete ID, clearing localStorage');
      localStorage.removeItem('athleteId');
      setAthleteId(null);
    }
    setIsLoading(false);
  };

  const handleAthleteCreated = (id) => {
    localStorage.setItem('athleteId', id);
    setAthleteId(id);
  };

  const handleAthleteLogin = (id) => {
    localStorage.setItem('athleteId', id);
    setAthleteId(id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <AnalyticsProvider />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
          <Route 
            path="/" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage />
              )
            } 
          />
          <Route 
            path="/signup" 
            element={<SignupRedirect />} 
          />

          <Route 
            path="/onboarding" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingForm onAthleteCreated={handleAthleteCreated} />
              )
            } 
          />
          <Route 
            path="/login" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onAthleteLogin={handleAthleteLogin} />
              )
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <ForgotPassword />
              )
            } 
          />
          <Route 
            path="/reset-password" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <ResetPassword />
              )
            } 
          />
          <Route 
            path="/pricing" 
            element={<Pricing />} 
          />
          <Route 
            path="/dashboard" 
            element={
              athleteId ? (
                <Dashboard athleteId={athleteId} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/dashboard/:tab" 
            element={
              athleteId ? (
                <Dashboard athleteId={athleteId} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/dashboard/:tab/*" 
            element={
              athleteId ? (
                <Dashboard athleteId={athleteId} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/auth/oura/callback" 
            element={<OuraCallback />} 
          />
          <Route 
            path="/auth/coros/callback" 
            element={<CorosCallback />} 
          />
          <Route 
            path="/privacy" 
            element={<PrivacyPolicy />} 
          />
          <Route 
            path="/terms" 
            element={<TermsConditions />} 
          />
          {/* Dynamic CMS Pages - Must be before catch-all route */}
          <Route 
            path="/:slug" 
            element={<CmsPage />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        
        {/* Cookie Consent Banner - Google Consent Mode v2 */}
        <CookieBanner />
      </BrowserRouter>
    </div>
    </ThemeProvider>
  );
}

export default App;
