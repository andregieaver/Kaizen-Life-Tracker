import React from 'react';
import { Crown, Shield } from 'lucide-react';

const SubscriptionBadge = ({ subscriptionTier }) => {
  if (!subscriptionTier || subscriptionTier === 'free') {
    return null;
  }

  const isPro = subscriptionTier === 'pro';
  const isPremium = subscriptionTier === 'premium';

  if (!isPro && !isPremium) {
    return null;
  }

  return (
    <span 
      className="inline-flex items-center ml-1" 
      title={isPro ? 'Pro Member' : 'Premium Member'}
    >
      {isPro ? (
        <Shield 
          className="w-4 h-4" 
          style={{ color: '#00C2A8' }}
          fill="#00C2A8"
        />
      ) : (
        <Crown 
          className="w-4 h-4" 
          style={{ color: '#FFD700' }}
          fill="#FFD700"
        />
      )}
    </span>
  );
};

export default SubscriptionBadge;
