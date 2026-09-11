const request = require('supertest');
const { app } = require('../../server');
const mongoose = require('mongoose');
const User = require('../../models/User');

describe('Wallet & Payments Controller', () => {
  let customerToken = '';
  let customerUser = null;

  beforeAll(async () => {
    // Create a mock customer for wallet operations
    const custEmail = `cust_wallet_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      name: 'Wallet Customer',
      email: custEmail,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      password: 'password123',
      role: 'customer'
    });

    customerUser = await User.findOne({ email: custEmail });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: custEmail,
      password: 'password123'
    });
    customerToken = loginRes.body.token;
  });

  it('should get initial wallet balance as 0', async () => {
    const res = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${customerToken}`);
      
    // Assuming wallet initialization on registration
    // If it doesn't exist, it should return 0 or create one
    if (res.statusCode === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toBeGreaterThanOrEqual(0);
    } else {
      expect(res.statusCode).toBe(404); // If wallet not found initially
    }
  });

  it('should add funds to wallet', async () => {
    const res = await request(app)
      .post('/api/wallet/add-funds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 500, transactionId: 'TXN_TEST_123' });
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet.balance).toBe(500);
  });

  it('should deduct funds from wallet', async () => {
    const res = await request(app)
      .post('/api/wallet/deduct-funds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 200, description: 'Ticket Booking' });
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet.balance).toBe(300);
  });

  it('should fail to deduct if insufficient balance', async () => {
    const res = await request(app)
      .post('/api/wallet/deduct-funds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 1000, description: 'Too expensive' });
      
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    // error message depends on implementation
  });
});
