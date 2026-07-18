const request = require('supertest');
const { app } = require('../../server');

describe('Provider Marketplace API', () => {
  const testUser = {
    name: 'Provider User',
    email: 'provider@example.com',
    phone: '2223334444',
    password: 'password123'
  };

  let token = '';

  beforeAll(async () => {
    // Register and login to get token
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    token = res.body.token;
  });

  describe('POST /api/marketplace/register-provider', () => {
    it('should successfully register a mechanic provider', async () => {
      const providerData = {
        serviceType: 'Mechanic',
        businessName: 'Test Mechanic Shop',
        description: 'We fix buses.',
        location: {
          city: 'Testville',
          coordinates: [77.1, 28.6]
        },
        pricing: '500 INR per visit',
        availability: '24/7'
      };

      const res = await request(app)
        .post('/api/marketplace/provider/register')
        .set('Authorization', `Bearer ${token}`)
        .send(providerData);

      expect(res.statusCode).toBe(200).or(201); // Depending on implementation
      expect(res.body.success).toBe(true);
    });

    it('should fail to register again if already registered', async () => {
      const providerData = {
        serviceType: 'Mechanic',
        businessName: 'Test Mechanic Shop 2'
      };

      const res = await request(app)
        .post('/api/marketplace/provider/register')
        .set('Authorization', `Bearer ${token}`)
        .send(providerData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered as a service provider');
    });

    it('should fail driver registration without fitness details', async () => {
      // Need a new user for this since previous is already a provider
      const testDriver = {
        name: 'Driver User',
        email: 'driver@example.com',
        phone: '3334445555',
        password: 'password123'
      };
      await request(app).post('/api/auth/register').send(testDriver);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testDriver.email, password: testDriver.password });
      const driverToken = loginRes.body.token;

      const providerData = {
        serviceType: 'Driver',
        businessName: 'Expert Driver',
        description: 'Driving safely.',
        location: { city: 'Testville' },
        licenseNumber: 'DL123456',
        licenseImage: 'image.jpg'
        // Missing fitness and insurance
      };

      const res = await request(app)
        .post('/api/marketplace/provider/register')
        .set('Authorization', `Bearer ${driverToken}`)
        .send(providerData);

      // In controller, it throws error if details are missing for Driver
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });
});
