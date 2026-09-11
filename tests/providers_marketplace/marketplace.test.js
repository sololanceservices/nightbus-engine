const request = require('supertest');
const { app } = require('../../server');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Service = require('../../models/Service');

describe('Marketplace Controller', () => {
  let providerToken = '';
  let customerToken = '';
  let providerId = '';

  beforeAll(async () => {
    // 1. Create Provider
    const provEmail = `provider_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      name: 'Test Mechanic',
      email: provEmail,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      password: 'password123',
      role: 'provider',
      isServiceProvider: true,
      serviceType: 'Mechanic'
    });

    const provUser = await User.findOne({ email: provEmail });
    providerId = provUser._id.toString();

    const provLogin = await request(app).post('/api/auth/login').send({
      email: provEmail,
      password: 'password123'
    });
    providerToken = provLogin.body.token;

    // 2. Create Customer
    const custEmail = `cust_market_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      name: 'Market Customer',
      email: custEmail,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      password: 'password123',
      role: 'customer'
    });

    const custLogin = await request(app).post('/api/auth/login').send({
      email: custEmail,
      password: 'password123'
    });
    customerToken = custLogin.body.token;
  });

  it('provider should be able to create a service', async () => {
    const res = await request(app)
      .post('/api/marketplace/services')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        name: 'Emergency Bus Repair',
        description: '24/7 on-road bus repair',
        category: 'Mechanic',
        price: 1500,
        availability: true
      });
      
    // Assuming 201 Created or 200 OK
    expect(res.statusCode).toBeLessThan(300);
    if(res.body.success) {
      expect(res.body.data.service.name).toBe('Emergency Bus Repair');
    }
  });

  it('customer should be able to search for services', async () => {
    const res = await request(app)
      .get('/api/marketplace/services?category=Mechanic')
      .set('Authorization', `Bearer ${customerToken}`);
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.services)).toBe(true);
  });
});
