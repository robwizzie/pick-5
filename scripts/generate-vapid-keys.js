// Script to generate VAPID keys for web push notifications
// Run with: node scripts/generate-vapid-keys.js

const webPush = require('web-push');

const vapidKeys = webPush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env.local file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('\nAlso add your contact email:');
console.log('VAPID_SUBJECT=mailto:your-email@example.com\n');
console.log('Or use your website URL:');
console.log('VAPID_SUBJECT=https://www.sportspick5.com\n');
