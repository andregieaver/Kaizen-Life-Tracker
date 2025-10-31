# Phase 3 Implementation Guide: Ecommerce Tracking

## Overview
Phase 3 integrates ecommerce tracking into the Stripe checkout flow, capturing the complete purchase funnel from plan viewing to completed purchase.

## Complete Purchase Funnel

### 1. View Item List (Plan Viewing)

**When:** User lands on pricing page and plans are loaded

**Event:** `view_item_list`

**Implementation:** Automatically tracked in `Pricing.js` when plans load from API

```javascript
// In Pricing.js - useEffect after plans load
if (transformedPlans.length > 0) {
  const items = transformedPlans.map(plan => ({
    id: plan.id,
    name: plan.name,
    price: billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice,
    currency: 'EUR'
  }));
  ecommerce.viewItemList(items, 'Subscription Plans');
}
```

**Event Data:**
```javascript
{
  event: 'view_item_list',
  item_list_name: 'Subscription Plans',
  items: [
    {item_id: 'pro', item_name: 'Pro', price: 19.99, currency: 'EUR'},
    {item_id: 'premium', item_name: 'Premium', price: 29.99, currency: 'EUR'}
  ],
  anon_id: 'uuid...',
  utm_source: 'google',
  timestamp: '2024-01-31T12:00:00Z'
}
```

### 2. Select Item (Plan Selection)

**When:** User clicks "Choose Plan" button

**Event:** `select_item`

**Implementation:** Tracked in `handleSelectPlan()` function

```javascript
// Track select_item event
ecommerce.selectItem({
  id: plan.id,
  name: plan.name,
  price: price,
  currency: 'EUR'
});
```

**Event Data:**
```javascript
{
  event: 'select_item',
  item_list_name: 'Plans',
  items: [{
    item_id: 'premium',
    item_name: 'Premium',
    price: 29.99,
    currency: 'EUR'
  }],
  anon_id: 'uuid...',
  user_id: 'user_123',
  timestamp: '2024-01-31T12:00:00Z'
}
```

**Additional Events:**
- `signup_intent` - If user is not logged in (needs to sign up first)
- `select_plan` - For free plan selection

### 3. Begin Checkout

**When:** User proceeds to Stripe checkout (after Stripe session is created)

**Event:** `begin_checkout`

**Implementation:** Tracked before redirecting to Stripe

```javascript
// Track begin_checkout event
ecommerce.beginCheckout(
  {
    id: plan.id,
    name: plan.name,
    price: price
  },
  price,
  'EUR'
);

// Also track detailed checkout_started event
track('checkout_started', {
  plan: planId,
  billing_cycle: billingCycle,
  price: price,
  currency: 'EUR',
  has_coupon: !!couponCode,
  coupon_code: couponCode // if present
});
```

**Event Data:**
```javascript
{
  event: 'begin_checkout',
  value: 29.99,
  currency: 'EUR',
  items: [{
    item_id: 'premium',
    item_name: 'Premium',
    price: 29.99,
    quantity: 1
  }],
  user_id: 'user_123',
  timestamp: '2024-01-31T12:00:00Z'
}
```

### 4. Purchase (Completed)

**When:** Stripe webhook receives `checkout.session.completed` event

**Event:** `purchase`

**Implementation:** Automatically tracked in backend webhook handler

```python
# In stripe_webhook - after successful checkout
purchase_event = {
    "event": "purchase",
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "user_id": athlete_id,
    "transaction_id": webhook_response.session_id,
    "value": float(transaction.get("amount", 0)),
    "currency": transaction.get("currency", "EUR").upper(),
    "items": [{
        "item_id": transaction.get("plan_id"),
        "item_name": f"{transaction.get('tier', 'Unknown')} - {transaction.get('interval', 'month')}",
        "price": float(transaction.get("amount", 0)),
        "quantity": 1
    }],
    "payment_method": "stripe",
    "subscription_tier": transaction.get("tier"),
    "billing_interval": transaction.get("interval"),
    "coupon": coupon_code if coupon_code else None,
    "webhook_event": True
}

await db.analytics_events.insert_one(purchase_event)
```

**Event Data:**
```javascript
{
  event: 'purchase',
  transaction_id: 'cs_test_...',
  value: 29.99,
  currency: 'EUR',
  items: [{
    item_id: 'price_premium_monthly',
    item_name: 'Premium - month',
    price: 29.99,
    quantity: 1
  }],
  payment_method: 'stripe',
  subscription_tier: 'premium',
  billing_interval: 'month',
  coupon: 'WELCOME10', // if coupon was used
  user_id: 'user_123',
  webhook_event: true,
  timestamp: '2024-01-31T12:00:00Z'
}
```

## Coupon Tracking

Coupons are automatically tracked when applied:

```javascript
// In handleSelectPlan - if coupon is applied
if (appliedCoupon) {
  checkoutData.coupon_code = appliedCoupon.coupon.code;
  couponCode = appliedCoupon.coupon.code;
}

// Coupon info is included in checkout events
{
  has_coupon: true,
  coupon_code: 'WELCOME10'
}

// And in purchase event
{
  coupon: 'WELCOME10'
}
```

## Error Tracking

Checkout errors are automatically tracked:

```javascript
// In handleSelectPlan - catch block
catch (error) {
  track('checkout_error', {
    plan: planId,
    billing_cycle: billingCycle,
    error_message: error.message
  });
  
  alert('Failed to start checkout. Please try again.');
}
```

## Additional Events

### Billing Cycle Toggle

Track when users switch between monthly/annual:

```javascript
// Add to your billing cycle toggle handler
const handleBillingCycleChange = (newCycle) => {
  setBillingCycle(newCycle);
  
  track('billing_cycle_change', {
    from: billingCycle,
    to: newCycle,
    page: 'pricing'
  });
};
```

### Coupon Application

Track when users apply coupons:

```javascript
// In your coupon application handler
track('coupon_applied', {
  coupon_code: couponCode,
  discount_type: coupon.type, // percentage or fixed
  discount_value: coupon.value
});
```

## Revenue Validation

### Server-Side Tracking
Purchase events are tracked server-side in the webhook handler, ensuring:
- ✅ No ad-blockers can prevent tracking
- ✅ Accurate revenue data
- ✅ Transaction IDs match Stripe
- ✅ Coupon data is preserved

### Data Integrity
```javascript
// Webhook handler ensures:
1. Transaction exists in payment_transactions collection
2. Athlete subscription is updated
3. Analytics event is stored
4. Coupon usage is recorded
```

## Complete Funnel Example

```
User Journey:
1. Lands on /pricing
   → view_item_list (3 plans shown)

2. Clicks "Choose Premium"
   → select_item (premium selected)
   → signup_intent (if not logged in)

3. Signs up / Logs in
   → login (tracked in Login.js)
   → setUserId (identity set)

4. Returns to pricing, clicks "Choose Premium" again
   → select_item (premium selected)
   → begin_checkout (Stripe session created)
   → checkout_started (detailed tracking)
   → redirect_to_stripe

5. Completes payment in Stripe
   → Stripe webhook fires
   → purchase (server-side tracking)
   → Subscription activated
```

## Testing Your Implementation

### 1. Enable Stripe Test Mode

Make sure Stripe is in test mode in System Settings → Advanced → Stripe.

### 2. Use Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
```

### 3. Monitor Events

**Frontend Console:**
```javascript
// Should see:
📊 Analytics Event: view_item_list {items: [...]}
📊 Analytics Event: select_item {item_id: 'premium'}
📊 Analytics Event: begin_checkout {value: 29.99}
📊 Analytics Event: checkout_started {plan: 'premium'}
```

**Backend Logs:**
```bash
tail -f /var/log/supervisor/backend.out.log | grep -i "purchase\|analytics"

# Should see:
Purchase event tracked for athlete abc123: cs_test_...
```

**Database:**
```javascript
// Query analytics_events collection
db.analytics_events.find({event: 'purchase'}).sort({timestamp: -1}).limit(10)

// Should show purchase events with:
- transaction_id
- value
- items
- coupon (if used)
```

### 4. Check GTM/GA4

1. Open GTM Preview mode
2. Complete a test purchase
3. Verify events fire:
   - view_item_list
   - select_item
   - begin_checkout
   - purchase

4. Check GA4 Real-Time reports:
   - Conversions → purchase
   - Ecommerce purchases
   - Revenue data

## Funnel Analysis

### In GA4

**Ecommerce Purchase Funnel:**
```
Explorations → Funnel Exploration

Steps:
1. view_item_list
2. select_item
3. begin_checkout
4. purchase

Dimensions:
- Plan name (item_name)
- Billing cycle (billing_interval)
- Coupon usage (coupon)
```

### Conversion Rates

**Calculate:**
```javascript
// In analytics dashboard
View → Select: (select_item / view_item_list) * 100
Select → Checkout: (begin_checkout / select_item) * 100
Checkout → Purchase: (purchase / begin_checkout) * 100

Overall: (purchase / view_item_list) * 100
```

## Revenue Metrics

### Key Metrics Tracked

1. **Total Revenue**
   - Sum of `value` in purchase events
   - Grouped by period (day/week/month)

2. **Average Order Value (AOV)**
   - Total revenue / number of purchases

3. **Revenue by Plan**
   - Group purchases by `subscription_tier`

4. **Revenue by Billing Cycle**
   - Group by `billing_interval` (month/year)

5. **Coupon Impact**
   - Purchases with vs without coupons
   - Revenue with coupon discount applied

### Query Examples

**Total Revenue (Last 30 days):**
```javascript
db.analytics_events.aggregate([
  {
    $match: {
      event: 'purchase',
      timestamp: {
        $gte: new Date(Date.now() - 30*24*60*60*1000).toISOString()
      }
    }
  },
  {
    $group: {
      _id: null,
      total_revenue: { $sum: '$value' },
      total_purchases: { $sum: 1 },
      avg_order_value: { $avg: '$value' }
    }
  }
])
```

**Revenue by Plan:**
```javascript
db.analytics_events.aggregate([
  {
    $match: { event: 'purchase' }
  },
  {
    $group: {
      _id: '$subscription_tier',
      revenue: { $sum: '$value' },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { revenue: -1 }
  }
])
```

## Common Issues

### Purchase not tracked?

**Check:**
1. Webhook received? (check backend logs)
2. Transaction in payment_transactions collection?
3. Athlete_id in webhook metadata?
4. Analytics event in analytics_events collection?

**Debug:**
```bash
# Check webhook deliveries in Stripe Dashboard
# Resend webhook if needed

# Check backend logs
tail -f /var/log/supervisor/backend.out.log | grep webhook

# Check database
db.analytics_events.find({event: 'purchase'}).sort({timestamp: -1})
```

### Duplicate purchases tracked?

- Webhooks can be sent multiple times
- Use `transaction_id` to deduplicate in GA4
- Backend stores in database (not creating duplicates via upsert)

### Revenue doesn't match Stripe?

- Check currency conversions
- Verify coupon discounts are applied correctly
- Ensure all webhooks are processed
- Compare `transaction_id` with Stripe Dashboard

## Next Steps

### Phase 4: Advanced Features

1. **E2E Testing with Playwright**
   - Test complete checkout flow
   - Verify events fire correctly
   - Automate testing

2. **Analytics Dashboard**
   - Build revenue dashboard in admin panel
   - Real-time purchase tracking
   - Funnel visualization

3. **BigQuery Integration**
   - Export events to BigQuery
   - Advanced analysis
   - Data warehouse

## Support

For issues:
1. Check console logs
2. Verify Stripe webhooks are received
3. Check database for events
4. Review this documentation
5. Check GTM Preview mode
