const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5000/api';
// Use the secret from .env
const JWT_SECRET = 'your_jwt_secret_key_change_this_in_production'; // From .env

async function runTests() {
  console.log('🧪 Starting Notification Tests...\n');
  
  try {
    // 1. Create a dummy token for a fake customer
    console.log('1. Generating mock customer token...');
    const userToken = jwt.sign({ id: '60d5ecb54d2a1b1234567890', role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Mock user authenticated.\n');

    // 2. Test active-topics endpoint
    console.log('2. Testing GET /api/notifications/active-topics...');
    const topicsRes = await axios.get(`${API_URL}/notifications/active-topics`, {
        headers: { Authorization: `Bearer ${userToken}` }
    });
    
    console.log('✅ Active topics retrieved:');
    console.log(topicsRes.data.topics);
    console.log();
    
    if (!topicsRes.data.topics.includes('all_users')) {
        throw new Error('all_users topic is missing!');
    }

    // 3. Test Notification Sending Endpoint (acting as admin)
    console.log('3. Generating mock admin token...');
    const adminToken = jwt.sign({ id: '60d5ecb54d2a1b1234567891', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    
    console.log('4. Triggering global broadcast notification...');
    const sendRes = await axios.post(`${API_URL}/notifications/send`, {
        title: 'Test Broadcast',
        message: 'This is an end-to-end test',
        type: 'admin_msg',
        isBroadcast: true
    }, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('✅ Broadcast success:', sendRes.data.message);
    
    console.log('\n🎉 All backend notification tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed!');
    console.error(error.response ? error.response.data : error.message);
  }
}

runTests();
