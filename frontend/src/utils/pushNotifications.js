// Push Notification Utilities

import { logger } from '../utils/logger';

const API = process.env.REACT_APP_BACKEND_URL;

// Convert base64 URL-safe string to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register service worker
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      logger.debug(null, 'Service Worker registered:', registration);
      return registration;
    } catch (error) {
      logger.error(null, 'Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported in this browser');
  }
}

// Check if push notifications are supported
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Get current push subscription
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    logger.error(null, 'Error getting subscription:', error);
    return null;
  }
}

// Subscribe to push notifications
export async function subscribeToPush(athleteId) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    // Get VAPID public key from backend
    const keyResponse = await fetch(`${API}/api/push/vapid-public-key`);
    const { publicKey } = await keyResponse.json();

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to backend
    const subscriptionData = {
      athlete_id: athleteId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
      }
    };

    const response = await fetch(`${API}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription to backend');
    }

    logger.debug(null, 'Successfully subscribed to push notifications');
    return subscription;

  } catch (error) {
    logger.error(null, 'Error subscribing to push:', error);
    throw error;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(athleteId) {
  try {
    const subscription = await getCurrentSubscription();
    
    if (subscription) {
      // Unsubscribe from browser
      await subscription.unsubscribe();
      
      // Remove from backend
      await fetch(`${API}/api/push/unsubscribe/${athleteId}?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: 'DELETE'
      });
      
      logger.debug(null, 'Successfully unsubscribed from push notifications');
    }
  } catch (error) {
    logger.error(null, 'Error unsubscribing from push:', error);
    throw error;
  }
}

// Check if user is subscribed
export async function isSubscribed() {
  const subscription = await getCurrentSubscription();
  return subscription !== null;
}

// Test push notification
export async function testPushNotification(athleteId) {
  try {
    const response = await fetch(`${API}/api/push/test/${athleteId}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to send test notification');
    }
    
    return await response.json();
  } catch (error) {
    logger.error(null, 'Error sending test notification:', error);
    throw error;
  }
}
