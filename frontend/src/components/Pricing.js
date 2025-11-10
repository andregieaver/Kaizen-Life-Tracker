import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ArrowLeft, Zap, TrendingUp, Crown, Shield, Users, Clock, Gift, Tag } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { loadAndInjectPageSEO } from '../utils/seoUtils';
import { ecommerce, track } from '../lib/analytics';

const Pricing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'annual'
  const [referralCode, setReferralCode] = useState(null);
  const [discount, setDiscount] = useState(0);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Dynamic plans from API
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Load page-level SEO meta tags
  useEffect(() => {
    loadAndInjectPageSEO('/pricing');
  }, []);

  // Load plans from API
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/subscription-plans-public`);
        const data = await response.json();
        
        console.log('Loaded plans from API:', data.plans);
        
        // Transform API data to component format
        const transformedPlans = data.plans.map(plan => {
          // Get monthly and annual variations
          const monthlyVar = plan.variations?.find(v => v.interval === 'month');
          const annualVar = plan.variations?.find(v => v.interval === 'year');
          
          // Determine icon based on tier
          let icon = Shield;
          if (plan.tier === 'pro') icon = Zap;
          if (plan.tier === 'premium') icon = Crown;
          
          // Ensure features is an array
          const features = Array.isArray(plan.features) ? plan.features : [];
          
          console.log(`Plan ${plan.name} features:`, features);
          
          return {
            id: plan.tier,
            name: plan.name,
            icon: icon,
            description: plan.description || '',
            monthlyPrice: monthlyVar?.price || 0,
            annualPrice: annualVar?.price || 0,
            monthlyPlanId: monthlyVar?.plan_id || null,
            annualPlanId: annualVar?.plan_id || null,
            features: features,
            popular: plan.tier === 'pro',
            sort_order: plan.sort_order || 0
          };
        });
        
        // Sort by sort_order
        transformedPlans.sort((a, b) => a.sort_order - b.sort_order);
        
        console.log('Transformed plans:', transformedPlans);
        setPlans(transformedPlans);
        
        // Track view_item_list event (ecommerce)
        if (transformedPlans.length > 0) {
          const items = transformedPlans.map(plan => ({
            id: plan.id,
            name: plan.name,
            price: billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice,
            currency: 'EUR'
          }));
          ecommerce.viewItemList(items, 'Subscription Plans');
        }
      } catch (error) {
        console.error('Error loading plans:', error);
        // Fallback to empty array or default plans
        setPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    
    loadPlans();
  }, []);

  // Check for referral code on component mount
  useEffect(() => {
    const storedRefCode = localStorage.getItem('referralCode');
    if (storedRefCode) {
      setReferralCode(storedRefCode);
      setDiscount(20); // 20% discount for referrals
      console.log('Referral discount applied:', storedRefCode);
    }
  }, []);

  // Re-validate coupon when billing cycle changes
  useEffect(() => {
    if (appliedCoupon && couponCode) {
      // Recalculate for the new billing cycle
      const proPlan = plans.find(p => p.id === 'pro');
      if (proPlan) {
        const price = billingCycle === 'annual' ? proPlan.annualPrice : proPlan.monthlyPrice;
        const planId = billingCycle === 'annual' ? 'pro_annual' : 'pro_monthly';
        applyCoupon(price, planId);
      }
    }
  }, [billingCycle]);

  // Validate and apply coupon
  const applyCoupon = async (planPrice, planId = null) => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setValidatingCoupon(true);
    setCouponError('');

    try {
      let url = `${process.env.REACT_APP_BACKEND_URL}/api/coupons/validate?code=${encodeURIComponent(couponCode)}&amount=${planPrice}&purchase_type=subscriptions`;
      if (planId) {
        url += `&plan_id=${planId}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid coupon code');
      }

      const data = await response.json();
      setAppliedCoupon(data);
      setCouponError('');
      console.log('Coupon applied:', data);
    } catch (error) {
      console.error('Coupon validation error:', error);
      setCouponError(error.message || 'Failed to apply coupon');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Remove applied coupon
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

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
    let discountedAmount = discount > 0 ? baseAmount * (1 - discount / 100) : baseAmount;
    
    // Apply coupon discount if available
    if (appliedCoupon && baseAmount > 0) {
      const couponType = appliedCoupon.coupon.type;
      const couponValue = appliedCoupon.coupon.value;
      
      if (couponType === 'percentage') {
        discountedAmount = discountedAmount * (1 - couponValue / 100);
      } else {
        // Fixed amount discount
        discountedAmount = Math.max(0, discountedAmount - couponValue);
      }
    }
    
    return { 
      amount: discountedAmount, 
      originalAmount: baseAmount,
      period: billingCycle === 'monthly' ? '/month' : '/year',
      hasCouponDiscount: appliedCoupon && baseAmount > 0
    };
  };

  const handleSelectPlan = async (planId) => {
    if (planId === 'free') {
      // Track free plan selection
      track('select_plan', { plan: 'free' });
      navigate('/onboarding');
      return;
    }

    // Get plan details for tracking
    const plan = plans.find(p => p.id === planId);
    const price = billingCycle === 'monthly' ? plan?.monthlyPrice : plan?.annualPrice;
    const plan_id = billingCycle === 'monthly' ? plan?.monthlyPlanId : plan?.annualPlanId;
    
    // Track select_item event (ecommerce)
    if (plan && price) {
      ecommerce.selectItem({
        id: plan.id,
        name: plan.name,
        price: price,
        currency: 'EUR'
      });
    }

    // Check if user is logged in
    const athleteId = localStorage.getItem('athleteId');
    if (!athleteId) {
      // New user - Store selected plan for after signup
      const planInfo = {
        planId: planId,
        billingCycle: billingCycle,
        hasDiscount: discount > 0,
        discountAmount: discount
      };
      localStorage.setItem('selectedPlan', JSON.stringify(planInfo));
      
      // Track signup intent
      track('signup_intent', {
        plan: planId,
        billing_cycle: billingCycle,
        price: price
      });
      
      // Redirect to onboarding/signup
      navigate('/onboarding');
      return;
    }
    
    if (!plan_id) {
      console.error('No plan_id found for selected plan');
      return;
    }
    
    try {
      // Get origin URL
      const originUrl = window.location.origin;
      
      // Call backend to create checkout session
      const checkoutData = {
        plan_id: plan_id,
        origin_url: originUrl,
        athlete_id: athleteId
      };

      // Add coupon if applied
      let couponCode = null;
      if (appliedCoupon) {
        checkoutData.coupon_code = appliedCoupon.coupon.code;
        couponCode = appliedCoupon.coupon.code;
      }

      // Track begin_checkout event (ecommerce)
      ecommerce.beginCheckout(
        {
          id: plan.id,
          name: plan.name,
          price: price
        },
        price,
        'EUR'
      );
      
      // Track checkout initiation with details
      track('checkout_started', {
        plan: planId,
        billing_cycle: billingCycle,
        price: price,
        currency: 'EUR',
        has_coupon: !!couponCode,
        ...(couponCode && { coupon_code: couponCode })
      });

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/subscriptions/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.url) {
        // Track redirect to Stripe
        track('redirect_to_stripe', {
          plan: planId,
          session_id: data.session_id || 'unknown'
        });
        
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      
      // Track checkout error
      track('checkout_error', {
        plan: planId,
        billing_cycle: billingCycle,
        error_message: error.message
      });
      
      alert('Failed to start checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
    }}>
      {/* Header */}
      <header 
        className="backdrop-blur-md border-b shadow-sm" 
        style={{ 
          background: 'rgba(17, 24, 39, 0.7)',
          borderColor: 'rgba(55, 65, 81, 0.3)'
        }}
      >
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-white hover:text-[#32D3FF] transition-colors flex items-center"
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
                className="border-gray-600 text-white hover:bg-gray-700"
              >
                Log In
              </Button>
              <Button 
                onClick={() => navigate('/onboarding')}
                className="bg-[#32D3FF] hover:bg-[#1FC1FF] text-white"
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
          <Badge variant="secondary" className="mb-4 bg-[#32D3FF]/20 text-[#32D3FF] border border-[#32D3FF]/30">
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
          <div className="flex items-center justify-center space-x-4 rounded-full p-2 shadow-md inline-flex" style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#32D3FF] text-white shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-full font-medium transition-all flex items-center ${
                billingCycle === 'annual'
                  ? 'bg-[#32D3FF] text-white shadow-md'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Annual
              <Badge variant="default" className="ml-2 bg-green-500 text-white border-0">
                Save 17%
              </Badge>
            </button>
          </div>

          {/* Coupon Code Section */}
          <div className="mt-8 max-w-md mx-auto">
            <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-5 h-5 text-blue-400" />
                  <h3 className="text-white font-semibold">Have a coupon code?</h3>
                </div>
                
                {!appliedCoupon ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 bg-gray-600 text-white px-4 py-2 rounded border border-gray-500 focus:border-teal-500 focus:outline-none"
                        disabled={validatingCoupon}
                      />
                      <Button
                        onClick={() => {
                          // Calculate price for validation (use Pro plan as default)
                          const proPlan = plans.find(p => p.id === 'pro');
                          const price = billingCycle === 'annual' ? proPlan.annualPrice : proPlan.monthlyPrice;
                          const planId = billingCycle === 'annual' ? 'pro_annual' : 'pro_monthly';
                          applyCoupon(price, planId);
                        }}
                        disabled={validatingCoupon || !couponCode.trim()}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-6"
                      >
                        {validatingCoupon ? 'Checking...' : 'Apply'}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-sm text-red-400">{couponError}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-green-400 font-semibold">
                          ✓ Coupon Applied: {appliedCoupon.coupon.code}
                        </p>
                        <p className="text-gray-300 text-sm">{appliedCoupon.coupon.name}</p>
                      </div>
                      <button
                        onClick={removeCoupon}
                        className="text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-white">
                      <p className="text-sm">
                        Discount: <span className="font-bold text-green-400">
                          {appliedCoupon.coupon.type === 'percentage' 
                            ? `${appliedCoupon.coupon.value}%` 
                            : `€${appliedCoupon.coupon.value}`
                          }
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Discount will be applied at checkout
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pricing Cards */}
        {loadingPlans ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            <p className="text-gray-400 mt-4">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">No subscription plans available at this time.</p>
          </div>
        ) : (
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
                    <div className="flex items-baseline justify-center flex-wrap gap-2">
                      {(discount > 0 || price.hasCouponDiscount) && price.originalAmount > 0 && (
                        <span className="text-2xl font-bold text-gray-500 line-through">
                          €{price.originalAmount.toFixed(2)}
                        </span>
                      )}
                      <span className={`text-5xl font-bold ${(discount > 0 || price.hasCouponDiscount) && price.originalAmount > 0 ? 'text-green-400' : 'text-white'}`}>
                        €{price.amount.toFixed(2)}
                      </span>
                      <span className="text-gray-300 ml-2">{price.period}</span>
                    </div>
                    {discount > 0 && price.originalAmount > 0 && !price.hasCouponDiscount && (
                      <p className="text-sm text-green-400 mt-2 font-bold">
                        🎉 {discount}% referral discount applied!
                      </p>
                    )}
                    {price.hasCouponDiscount && price.originalAmount > 0 && (
                      <p className="text-sm text-green-400 mt-2 font-bold">
                        🎟️ Coupon discount applied: {appliedCoupon.coupon.type === 'percentage' 
                          ? `${appliedCoupon.coupon.value}%` 
                          : `€${appliedCoupon.coupon.value}`} off!
                      </p>
                    )}
                    {billingCycle === 'annual' && plan.monthlyPrice > 0 && (
                      <p className="text-sm text-green-400 mt-2 font-medium">
                        Save {savings}% compared to monthly
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features && plan.features.length > 0 ? (
                      plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <Check className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-200">{feature}</span>
                        </li>
                      ))
                    ) : (
                      <li className="flex items-start">
                        <span className="text-gray-400 text-sm italic">No features listed yet. Add features in Plan Editor.</span>
                      </li>
                    )}
                  </ul>

                  <Button
                    className={`w-full ${plan.ctaVariant === 'outline' ? 'bg-transparent border-teal-600 text-blue-400 hover:bg-teal-600 hover:text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {plan.id === 'free' ? 'Get Started Free' : `Start ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}

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
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of athletes optimizing their performance with My Health Tracker
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-100"
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
