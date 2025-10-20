import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { 
  Activity, Heart, Target, TrendingUp, Clock, BarChart3, 
  Brain, Calendar, FileText, LineChart, Zap, Shield, 
  ChevronRight, Check, Star
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scrollDirection, setScrollDirection] = useState('up');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasReferralCode, setHasReferralCode] = useState(false);

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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav 
        className={`fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50 transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Heart className="w-8 h-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">TrainSmart</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/pricing">
                <Button variant="ghost" className="hidden sm:inline-flex">
                  Pricing
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline">
                  Log In
                </Button>
              </Link>
              <Link to="/onboarding">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              <span>Your Journey to Better Health Starts Here</span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Optimize Your Health with
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Data-Driven Insights</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 leading-relaxed">
              Transform your wellbeing through intelligent tracking, personalized AI coaching, 
              and actionable analytics. Start your journey to longevity today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link to="/onboarding">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all"
                >
                  Start Your Free Journey
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6 h-auto"
                >
                  View Plans & Pricing
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Free to start</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Hero Stats */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-gray-600">AI Coach Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">All-in-One</div>
              <div className="text-gray-600">Complete Health Platform</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">Data-Driven</div>
              <div className="text-gray-600">Personalized Insights</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need for Optimal Health
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A comprehensive platform that combines AI coaching, fitness tracking, and health analytics 
              to help you achieve your wellness goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-blue-200 hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How TrainSmart Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Simple, automated, and designed to fit seamlessly into your life
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-blue-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits List */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Why Athletes Choose TrainSmart
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Join thousands of athletes who have transformed their health and fitness 
                with our comprehensive, data-driven platform.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-1">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-gray-700 text-lg">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
                <CardHeader>
                  <Brain className="w-10 h-10 text-blue-600 mb-2" />
                  <CardTitle>AI Coach</CardTitle>
                  <CardDescription className="text-gray-700">
                    24/7 personalized guidance from your intelligent training partner
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-0">
                <CardHeader>
                  <Calendar className="w-10 h-10 text-purple-600 mb-2" />
                  <CardTitle>Smart Planning</CardTitle>
                  <CardDescription className="text-gray-700">
                    Automated training calendar that adapts to your progress
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0">
                <CardHeader>
                  <FileText className="w-10 h-10 text-green-600 mb-2" />
                  <CardTitle>Full Tracking</CardTitle>
                  <CardDescription className="text-gray-700">
                    Journal, nutrition, documents - everything in one place
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-0">
                <CardHeader>
                  <LineChart className="w-10 h-10 text-orange-600 mb-2" />
                  <CardTitle>Analytics</CardTitle>
                  <CardDescription className="text-gray-700">
                    Visual insights that reveal your path to peak performance
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Trust */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
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
            From beginners to elite athletes, TrainSmart helps everyone achieve their health goals 
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Ready to Transform Your Health?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of athletes who are achieving their health and fitness goals 
            with TrainSmart's intelligent, data-driven platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/onboarding">
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all"
              >
                Start Your Free Journey
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 h-auto"
              >
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            No credit card required • Free to start • Cancel anytime
          </p>
        </div>
      </section>

      {/* Mobile Bottom Navigation */}
      <nav 
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 transition-transform duration-300 ease-in-out ${
          scrollDirection === 'up' ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="flex items-center justify-around py-3">
          <Link to="/pricing" className="flex flex-col items-center gap-1 px-4 py-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <span className="text-xs text-gray-600">Pricing</span>
          </Link>
          <Link to="/login" className="flex flex-col items-center gap-1 px-4 py-2">
            <Shield className="w-5 h-5 text-gray-600" />
            <span className="text-xs text-gray-600">Log In</span>
          </Link>
          <Link to="/onboarding" className="flex flex-col items-center gap-1 px-4 py-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">Get Started</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <Heart className="w-6 h-6 text-blue-400" />
                <span className="ml-2 text-lg font-bold text-white">TrainSmart</span>
              </div>
              <p className="text-sm text-gray-400">
                Your intelligent partner for health, fitness, and longevity.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to="/onboarding" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Features</h3>
              <ul className="space-y-2 text-sm">
                <li><span className="cursor-default">AI Coaching</span></li>
                <li><span className="cursor-default">Training Calendar</span></li>
                <li><span className="cursor-default">Analytics</span></li>
                <li><span className="cursor-default">Integrations</span></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login" className="hover:text-white transition-colors">Log In</Link></li>
                <li><Link to="/onboarding" className="hover:text-white transition-colors">Sign Up</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>© 2024 TrainSmart. All rights reserved. Built for athletes who demand more.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
