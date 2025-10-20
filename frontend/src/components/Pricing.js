import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ArrowLeft, Zap, TrendingUp, Crown, Shield, Users, Clock, Gift, Tag } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const Pricing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'annual'
  const [referralCode, setReferralCode] = useState(null);
  const [discount, setDiscount] = useState(0);

  // Check for referral code on component mount
  useEffect(() => {
    const storedRefCode = localStorage.getItem('referralCode');
    if (storedRefCode) {
      setReferralCode(storedRefCode);
      setDiscount(20); // 20% discount for referrals
      console.log('Referral discount applied:', storedRefCode);
    }
  }, []);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      icon: Shield,
      description: 'Perfect for getting started',
      monthlyPrice: 0,
      annualPrice: 0,
      popular: false,
      features: [
        'Basic AI Coach access (10 questions/month)',
        '1 scheduled AI analysis',
        'Track up to 3 fitness tests',
        'Manual workout logging',
        'Basic readiness score',
        '30-day history',
        'Connect 1 device',
        'Email support',
      ],
      cta: 'Get Started Free',
      ctaVariant: 'outline',
    },
    {
      id: 'pro',
      name: 'Pro',
      icon: TrendingUp,
      description: 'For serious athletes',
      monthlyPrice: 9.99,
      annualPrice: 99,
      popular: true,
      features: [
        'Unlimited AI Coach access',
        'Up to 5 scheduled AI analyses',
        'Track up to 10 fitness tests',
        'All integrations (Strava, Oura, COROS)',
        'Advanced analytics & reports',
        'Unlimited history',
        'Connect unlimited devices',
        'Custom training schedules',
        'Priority email support',
        'Chart generation',
      ],
      cta: 'Start Pro Trial',
      ctaVariant: 'default',
    },
    {
      id: 'premium',
      name: 'Premium',
      icon: Crown,
      description: 'Maximum performance',
      monthlyPrice: 19.99,
      annualPrice: 199,
      popular: false,
      features: [
        'Everything in Pro',
        'Unlimited scheduled AI analyses',
        'Unlimited fitness test tracking',
        'Personalized training plans',
        'Recovery optimization',
        'Injury prevention insights',
        'Nutrition recommendations',
        'Performance predictions',
        '1-on-1 coaching sessions (2/month)',
        '24/7 priority support',
        'Early access to new features',
      ],
      cta: 'Go Premium',
      ctaVariant: 'default',
    },
  ];

  const calculateSavings = (monthlyPrice, annualPrice) => {
    if (monthlyPrice === 0) return 0;
    const annualEquivalent = monthlyPrice * 12;
    return ((annualEquivalent - annualPrice) / annualEquivalent * 100).toFixed(0);
  };

  const getDisplayPrice = (plan) => {
    let baseAmount;
    if (billingCycle === 'monthly') {
      baseAmount = plan.monthlyPrice;
    } else {
      baseAmount = plan.annualPrice;
    }
    
    // Apply referral discount if available
    const discountedAmount = discount > 0 ? baseAmount * (1 - discount / 100) : baseAmount;
    
    return { 
      amount: discountedAmount, 
      originalAmount: baseAmount,
      period: billingCycle === 'monthly' ? '/month' : '/year' 
    };
  };

  const handleSelectPlan = async (planId) => {
    if (planId === 'free') {
      navigate('/onboarding');
      return;
    }

    // Check if user is logged in
    const athleteId = localStorage.getItem('athleteId');
    if (!athleteId) {
      alert('Please log in or sign up to subscribe');
      navigate('/login');
      return;
    }

    // Create plan_id based on selection
    const plan_id = `${planId}_${billingCycle === 'monthly' ? 'monthly' : 'annual'}`;
    
    try {
      // Get origin URL
      const originUrl = window.location.origin;
      
      // Call backend to create checkout session
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/subscriptions/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: plan_id,
          origin_url: originUrl,
          athlete_id: athleteId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-br from-cyan-700 via-teal-600 to-cyan-600 shadow-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-white hover:text-gray-200 transition-colors flex items-center"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </button>
              <h1 className="font-display text-2xl font-bold text-white">
                My Health Tracker
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/login')}
                className="border-white text-white hover:bg-white hover:text-teal-600"
              >
                Log In
              </Button>
              <Button 
                onClick={() => navigate('/onboarding')}
                className="bg-white text-teal-600 hover:bg-gray-100"
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Referral Discount Banner */}
        {referralCode && discount > 0 && (
          <div className="mb-8 mx-auto max-w-2xl">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-4 shadow-lg border-2 border-green-400">
              <div className="flex items-center justify-center space-x-3">
                <Gift className="w-6 h-6 text-white" />
                <div className="text-center">
                  <p className="text-white font-bold text-lg">
                    🎉 Referral Discount Applied!
                  </p>
                  <p className="text-green-100 text-sm">
                    You're getting <span className="font-bold">{discount}% OFF</span> with code: <span className="font-mono font-bold">{referralCode}</span>
                  </p>
                </div>
                <Tag className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 bg-gradient-to-br from-cyan-700 via-teal-600 to-cyan-600 text-white border-0">
            <Zap className="w-3 h-3 mr-1" />
            Subscription Plans
          </Badge>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Get personalized AI coaching, advanced analytics, and seamless integrations
            to optimize your training and reach your goals.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center space-x-4 bg-gradient-to-b from-gray-700 to-gray-800 rounded-full p-2 shadow-md inline-flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-full font-medium transition-all flex items-center ${
                billingCycle === 'annual'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Annual
              <Badge variant="default" className="ml-2 bg-green-500 text-white border-0">
                Save 17%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = getDisplayPrice(plan);
            const savings = calculateSavings(plan.monthlyPrice, plan.annualPrice);

            return (
              <Card
                key={plan.id}
                className={`relative bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600 ${
                  plan.popular
                    ? 'border-teal-500 border-2 shadow-xl scale-105 z-10'
                    : 'hover:shadow-lg transition-shadow'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-teal-600 text-white px-4 py-1 border-0">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-8">
                  <div className="mx-auto w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-2 text-white">{plan.name}</CardTitle>
                  <CardDescription className="text-base text-gray-300">
                    {plan.description}
                  </CardDescription>
                  
                  <div className="mt-6">
                    <div className="flex items-baseline justify-center">
                      <span className="text-5xl font-bold text-white">
                        €{price.amount}
                      </span>
                      <span className="text-gray-300 ml-2">{price.period}</span>
                    </div>
                    {billingCycle === 'annual' && plan.monthlyPrice > 0 && (
                      <p className="text-sm text-green-400 mt-2 font-medium">
                        Save {savings}% compared to monthly
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-teal-400 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-200">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plan.ctaVariant === 'outline' ? 'bg-transparent border-teal-600 text-teal-400 hover:bg-teal-600 hover:text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="bg-gradient-to-b from-gray-700 to-gray-800 rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-display font-bold text-center mb-8 text-white">
            Why Choose My Health Tracker?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">AI-Powered Coaching</h3>
              <p className="text-gray-300">
                Get personalized insights and recommendations powered by advanced AI
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">Comprehensive Analytics</h3>
              <p className="text-gray-300">
                Track your progress with detailed analytics and beautiful visualizations
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">Seamless Integrations</h3>
              <p className="text-gray-300">
                Connect your favorite fitness devices and apps in one place
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center mb-8 text-white">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg text-white">Can I switch plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately,
                  and we'll prorate any differences in billing.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg text-white">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  We accept all major credit cards (Visa, Mastercard, American Express) and support
                  secure payment processing through Stripe.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg text-white">Is there a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  Yes! Pro and Premium plans come with a 7-day free trial. No credit card required
                  for the Free plan, and you can cancel anytime during the trial period.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg text-white">Can I cancel my subscription?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  Absolutely. You can cancel your subscription at any time from your account settings.
                  You'll continue to have access until the end of your current billing period.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-gradient-to-br from-teal-600 to-cyan-700 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-display font-bold mb-4">
            Ready to Transform Your Training?
          </h2>
          <p className="text-xl mb-8 text-teal-100">
            Join thousands of athletes optimizing their performance with My Health Tracker
          </p>
          <Button
            size="lg"
            className="bg-white text-teal-600 hover:bg-gray-100"
            onClick={() => navigate('/onboarding')}
          >
            Start Your Free Trial Today
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-cyan-700 via-teal-600 to-cyan-600 py-8">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-200">
          <p>&copy; 2024 My Health Tracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
