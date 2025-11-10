import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { 
  Activity, Heart, Target, TrendingUp, Clock, BarChart3, 
  Brain, Calendar, FileText, LineChart, Zap, Shield, 
  ChevronRight, Check, Star, Mail, User, Globe, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import { loadAndInjectPageSEO } from '../utils/seoUtils';
import { useScrollDepth, useTimeOnPage } from '../lib/useViewTracker';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WaitingListSection = () => {
  // Track scroll depth on landing page
  useScrollDepth();
  // Track time on page (30 seconds threshold)
  useTimeOnPage(30);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    nationality: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'it', name: 'Italian (Italiano)' },
    { code: 'pt', name: 'Portuguese (Português)' },
    { code: 'nl', name: 'Dutch (Nederlands)' },
    { code: 'ru', name: 'Russian (Русский)' },
    { code: 'zh', name: 'Chinese (中文)' },
    { code: 'ja', name: 'Japanese (日本語)' },
    { code: 'ko', name: 'Korean (한국어)' },
    { code: 'ar', name: 'Arabic (العربية)' },
    { code: 'hi', name: 'Hindi (हिन्दी)' },
    { code: 'sv', name: 'Swedish (Svenska)' },
    { code: 'no', name: 'Norwegian (Norsk)' },
    { code: 'da', name: 'Danish (Dansk)' },
    { code: 'fi', name: 'Finnish (Suomi)' },
    { code: 'pl', name: 'Polish (Polski)' },
    { code: 'tr', name: 'Turkish (Türkçe)' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: '', message: '' });

    try {
      await axios.post(`${API}/waiting-list`, formData);
      setSubmitStatus({
        type: 'success',
        message: '🎉 Success! You\'re on the waiting list. We\'ll be in touch soon!'
      });
      setFormData({ name: '', email: '', nationality: '' });
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error.response?.data?.detail || 'Failed to join waiting list. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="waiting-list-section" className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-2xl border-0 overflow-hidden bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 sm:p-8">
            <CardHeader className="text-center p-0">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Join the Waiting List
              </CardTitle>
              <CardDescription className="text-blue-100 text-base sm:text-lg">
                Be the first to know when we launch. Get early access and exclusive benefits!
              </CardDescription>
            </CardHeader>
          </div>
          
          <CardContent className="p-6 sm:p-8">
            {submitStatus.message && (
              <div className={`mb-6 p-4 rounded-lg ${
                submitStatus.type === 'success' 
                  ? 'bg-green-500/20 border border-green-500 text-green-400' 
                  : 'bg-red-500/20 border border-red-500 text-red-400'
              }`}>
                {submitStatus.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <User className="w-4 h-4 mr-2 text-blue-400" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <Globe className="w-4 h-4 mr-2 text-blue-400" />
                    Preferred Language *
                  </label>
                  <select
                    required
                    value={formData.nationality}
                    onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-gray-700">Select your language...</option>
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.name} className="bg-gray-700">
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    To prioritize your language at launch of the app
                  </p>
                </div>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                  <Mail className="w-4 h-4 mr-2 text-blue-400" />
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-4 text-lg shadow-lg hover:shadow-xl transition-all"
              >
                {isSubmitting ? (
                  <>Processing...</>
                ) : (
                  <>
                    Join Waiting List
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center mt-4">
                We respect your privacy. Your information will never be shared.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scrollDirection, setScrollDirection] = useState('up');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [siteTitle, setSiteTitle] = useState('TrainSmart');
  const [logoUrl, setLogoUrl] = useState(null);
  const [faviconUrl, setFaviconUrl] = useState(null);
  const [headerMenu, setHeaderMenu] = useState([]);

  // Fetch SEO settings (site title, logo, favicon) and menu
  useEffect(() => {
    const fetchSEOSettings = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/system/settings/public`);
        if (response.data?.seo) {
          const seo = response.data.seo;
          if (seo.siteTitle) {
            setSiteTitle(seo.siteTitle);
          }
          if (seo.logoUrl) {
            setLogoUrl(seo.logoUrl);
          }
          if (seo.faviconUrl) {
            setFaviconUrl(seo.faviconUrl);
            // Update favicon in DOM
            const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = `${BACKEND_URL}${seo.faviconUrl}`;
            document.getElementsByTagName('head')[0].appendChild(link);
          }
        }
      } catch (error) {
        console.error('Error fetching SEO settings:', error);
        // Keep defaults
      }
    };
    
    const fetchHeaderMenu = async () => {
      try {
        const response = await axios.get(`${API}/menus/public`);
        console.log('Fetched menus:', response.data);
        if (response.data && response.data.header_logged_out) {
          // Response.data has menu types as keys with arrays as values
          const menuItems = response.data.header_logged_out;
          console.log('Found header_logged_out menu items:', menuItems);
          if (Array.isArray(menuItems) && menuItems.length > 0) {
            const sortedItems = menuItems.sort((a, b) => (a.order || 0) - (b.order || 0));
            console.log('Setting header menu items:', sortedItems);
            setHeaderMenu(sortedItems);
          }
        }
      } catch (error) {
        console.error('Error fetching header menu:', error);
        // Keep empty menu as default
      }
    };
    
    fetchSEOSettings();
    fetchHeaderMenu();
    
    // Load page-level SEO meta tags for home page
    loadAndInjectPageSEO('/');
  }, []);

  // Capture referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      // Store referral code in localStorage
      localStorage.setItem('referralCode', refCode);
      setHasReferralCode(true);
      console.log('Referral code captured:', refCode);
    }
  }, [searchParams]);

  useEffect(() => {
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;

      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }

      if (scrollY > lastScrollY && scrollY > 80) {
        // Scrolling down
        setScrollDirection('down');
        setIsVisible(false);
      } else if (scrollY < lastScrollY) {
        // Scrolling up
        setScrollDirection('up');
        setIsVisible(true);
      }

      setLastScrollY(scrollY > 0 ? scrollY : 0);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, [lastScrollY]);

  const features = [
    {
      icon: Activity,
      title: 'AI-Powered Coaching',
      description: 'Personalized training guidance powered by advanced AI that learns from your data'
    },
    {
      icon: Heart,
      title: 'Health Monitoring',
      description: 'Track vital metrics, readiness scores, and recovery to optimize your wellbeing'
    },
    {
      icon: Target,
      title: 'Goal Achievement',
      description: 'Set and crush your fitness goals with data-driven training plans'
    },
    {
      icon: TrendingUp,
      title: 'Progress Analytics',
      description: 'Visualize your improvement with detailed charts and performance metrics'
    },
    {
      icon: Clock,
      title: 'Time Efficient',
      description: 'Automated tracking and insights save you hours while maximizing results'
    },
    {
      icon: BarChart3,
      title: 'Test & Track',
      description: 'Monitor fitness tests over time and watch your progress accelerate'
    }
  ];

  const benefits = [
    'Comprehensive health and fitness tracking in one place',
    'AI coach available 24/7 for personalized advice',
    'Seamless integration with Strava, Oura, and Coros',
    'Training calendar with detailed workout planning',
    'Nutrition and journal logging for complete lifestyle tracking',
    'Document storage for medical records and test results',
    'Multi-language support for global accessibility',
    'Mobile-optimized for tracking on the go'
  ];

  const howItWorks = [
    {
      step: '1',
      title: 'Create Your Profile',
      description: 'Sign up in 60 seconds and set your health and fitness goals'
    },
    {
      step: '2',
      title: 'Connect Your Data',
      description: 'Link your fitness trackers or manually log your activities and metrics'
    },
    {
      step: '3',
      title: 'Get Personalized Insights',
      description: 'Receive AI-powered coaching and recommendations based on your unique data'
    },
    {
      step: '4',
      title: 'Track Your Progress',
      description: 'Watch your health improve with visual analytics and achievement tracking'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900">
      {/* Navigation */}
      <nav 
        className={`fixed top-0 left-0 right-0 backdrop-blur-md z-50 transition-transform duration-300 ease-in-out border-b ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ 
          background: 'rgba(17, 24, 39, 0.7)',
          borderColor: 'rgba(55, 65, 81, 0.3)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              {logoUrl ? (
                <img 
                  src={`${BACKEND_URL}${logoUrl}`} 
                  alt={siteTitle}
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <Heart className="w-8 h-8 text-[#32D3FF]" />
              )}
              <span className="ml-2 text-xl font-bold text-white" style={{ fontFamily: 'var(--font-logo)' }}>{siteTitle}</span>
            </div>
            <div className="flex items-center gap-4">
              {(console.log('Header menu length:', headerMenu.length, 'Items:', headerMenu), headerMenu.length > 0) ? (
                // Render dynamic logged-out header menu from Menu Editor
                headerMenu.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(item.url)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32D3FF] disabled:pointer-events-none disabled:opacity-50 bg-[#32D3FF] text-white hover:bg-[#1FC1FF] h-9 px-4 py-2 shadow-md hover:shadow-lg"
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                // Fallback to default Login button if no menu configured
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32D3FF] disabled:pointer-events-none disabled:opacity-50 bg-[#32D3FF] text-white hover:bg-[#1FC1FF] h-9 px-4 py-2 shadow-md hover:shadow-lg"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto">
          {/* Referral Banner */}
          {hasReferralCode && (
            <div className="mb-8 max-w-2xl mx-auto">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-6 shadow-lg text-center">
                <div className="flex items-center justify-center mb-3">
                  <Check className="w-8 h-8 text-white mr-2" />
                  <h3 className="text-2xl font-bold text-white">You've Been Referred!</h3>
                </div>
                <p className="text-white text-lg mb-4">
                  🎉 Get <span className="font-bold">20% OFF</span> your first month when you sign up now!
                </p>
                <Link to="/onboarding">
                  <Button className="bg-white text-green-600 hover:bg-gray-100 font-bold px-8 py-3 text-lg">
                    Claim Your Discount →
                  </Button>
                </Link>
              </div>
            </div>
          )}
          
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium mb-6 border border-blue-500/30">
              <Zap className="w-4 h-4" />
              <span>Your Journey to Better Health Starts Here</span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Optimize Your Health with
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Data-Driven Insights</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 mb-8 leading-relaxed">
              Transform your wellbeing through intelligent tracking, personalized AI coaching, 
              and actionable analytics. Start your journey to longevity today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all"
                onClick={() => {
                  const waitingListSection = document.querySelector('#waiting-list-section');
                  if (waitingListSection) {
                    waitingListSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                Join the wait list today!
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-400" />
                <span>Free to start</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Hero Stats */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">24/7</div>
              <div className="text-gray-300">AI Coach Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-cyan-400 mb-2">All-in-One</div>
              <div className="text-gray-300">Complete Health Platform</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">Data-Driven</div>
              <div className="text-gray-300">Personalized Insights</div>
            </div>
          </div>
        </div>
      </section>

      {/* Waiting List Sign-up */}
      <WaitingListSection />

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Everything You Need for Optimal Health
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              A comprehensive platform that combines AI coaching, fitness tracking, and health analytics 
              to help you achieve your wellness goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600 hover:border-blue-500 hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                  <CardDescription className="text-base text-gray-300">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - HIDDEN BUT NOT DELETED */}
      <section className="hidden py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              How {siteTitle} Works
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Simple, automated, and designed to fit seamlessly into your life
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-gradient-to-b from-gray-700 to-gray-800 border border-gray-600 rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-300">{item.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-blue-400/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits List */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Why Athletes Choose {siteTitle}
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                Join thousands of athletes who have transformed their health and fitness 
                with our comprehensive, data-driven platform.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center mt-1">
                      <Check className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-gray-200 text-lg">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600">
                <CardHeader>
                  <Brain className="w-10 h-10 text-blue-400 mb-2" />
                  <CardTitle className="text-white">AI Coach</CardTitle>
                  <CardDescription className="text-gray-300">
                    24/7 personalized guidance from your intelligent training partner
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600">
                <CardHeader>
                  <Calendar className="w-10 h-10 text-cyan-400 mb-2" />
                  <CardTitle className="text-white">Smart Planning</CardTitle>
                  <CardDescription className="text-gray-300">
                    Automated training calendar that adapts to your progress
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600">
                <CardHeader>
                  <FileText className="w-10 h-10 text-emerald-400 mb-2" />
                  <CardTitle className="text-white">Full Tracking</CardTitle>
                  <CardDescription className="text-gray-300">
                    Journal, nutrition, documents - everything in one place
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600">
                <CardHeader>
                  <LineChart className="w-10 h-10 text-orange-400 mb-2" />
                  <CardTitle className="text-white">Analytics</CardTitle>
                  <CardDescription className="text-gray-300">
                    Visual insights that reveal your path to peak performance
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Trust - HIDDEN BUT NOT DELETED */}
      <section className="hidden py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-700 via-teal-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-8 h-8 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Trusted by Athletes Worldwide
          </h2>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-12">
            From beginners to elite athletes, {siteTitle} helps everyone achieve their health goals 
            through intelligent, data-driven coaching.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="text-blue-100">Data-Driven Approach</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">Automated</div>
              <div className="text-blue-100">Intelligent Tracking</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">Easy</div>
              <div className="text-blue-100">Simple to Use</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Health?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of athletes who are achieving their health and fitness goals 
            with {siteTitle}'s intelligent, data-driven platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all"
              onClick={() => {
                const waitingListSection = document.querySelector('#waiting-list-section');
                if (waitingListSection) {
                  waitingListSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              Join the wait list today!
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            No credit card required • Free to start • Cancel anytime
          </p>
        </div>
      </section>

      {/* Mobile Bottom Navigation - HIDDEN BUT NOT DELETED */}
      <nav 
        className={`hidden md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-br from-cyan-700 via-teal-600 to-cyan-600 border-t border-blue-500/30 shadow-lg z-50 transition-transform duration-300 ease-in-out ${
          scrollDirection === 'up' ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="flex items-center justify-around py-3">
          <Link to="/pricing" className="flex flex-col items-center gap-1 px-4 py-2">
            <BarChart3 className="w-5 h-5 text-white" />
            <span className="text-xs text-white">Pricing</span>
          </Link>
          <Link to="/login" className="flex flex-col items-center gap-1 px-4 py-2">
            <Shield className="w-5 h-5 text-white" />
            <span className="text-xs text-white">Log In</span>
          </Link>
          <Link to="/onboarding" className="flex flex-col items-center gap-1 px-4 py-2">
            <Zap className="w-5 h-5 text-white" />
            <span className="text-xs text-white font-medium">Get Started</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                {logoUrl ? (
                  <img 
                    src={`${BACKEND_URL}${logoUrl}`} 
                    alt={siteTitle}
                    className="w-6 h-6 object-contain"
                  />
                ) : (
                  <Heart className="w-6 h-6 text-blue-400" />
                )}
                <span className="ml-2 text-lg font-bold text-white" style={{ fontFamily: 'var(--font-logo)' }}>{siteTitle}</span>
              </div>
              <p className="text-sm text-gray-400">
                Your intelligent partner for health, fitness, and longevity.
              </p>
            </div>
            
            {/* PRODUCT - HIDDEN BUT NOT DELETED */}
            <div className="hidden">
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/onboarding" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            
            {/* FEATURES - HIDDEN BUT NOT DELETED */}
            <div className="hidden">
              <h3 className="text-white font-semibold mb-4">Features</h3>
              <ul className="space-y-2 text-sm">
                <li><span className="cursor-default">AI Coaching</span></li>
                <li><span className="cursor-default">Training Calendar</span></li>
                <li><span className="cursor-default">Analytics</span></li>
                <li><span className="cursor-default">Integrations</span></li>
              </ul>
            </div>
            
            {/* ACCOUNT - HIDDEN BUT NOT DELETED */}
            <div className="hidden">
              <h3 className="text-white font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login" className="hover:text-white transition-colors">Log In</Link></li>
                <li><Link to="/onboarding" className="hover:text-white transition-colors">Sign Up</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
              <p>© {new Date().getFullYear()} {siteTitle}. All rights reserved.</p>
              <div className="flex gap-6">
                <Link to="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-blue-400 transition-colors">Terms & Conditions</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
