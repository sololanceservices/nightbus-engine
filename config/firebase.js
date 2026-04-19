const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;

try {
    // Option 1: Load from file (Preferred)
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);

        // Ensure private key handles newlines correctly
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('🔥 Firebase Admin initialized successfully from file');
    }
    // Option 2: Load from ENV variables (Fallback)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle escaped newlines in private key
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
        console.log('🔥 Firebase Admin initialized successfully from ENV');
    } else {
        console.warn('⚠️ Firebase credentials not found. Push notifications will be disabled.');
    }
} catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
}

module.exports = firebaseApp;
