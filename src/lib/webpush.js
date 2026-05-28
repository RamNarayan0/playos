import webpush from 'web-push';

// Development VAPID keys generated for testing
// In production, configure these via environment variables
export const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIsqP93bLezXwgG8g',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'sK__eZ_496K5eZ15-WwN-QnN7Y7x69i4q0-uWjA0uWw'
};

webpush.setVapidDetails(
  'mailto:support@playos.io',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export default webpush;
