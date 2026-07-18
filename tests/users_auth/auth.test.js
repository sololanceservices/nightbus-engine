const request = require('supertest');
const { app } = require('../../server'); // Destructure app from the exported object
const mongoose = require('mongoose');

describe('Authentication API', () => {
  const testUser = {
    name: 'Test Customer',
    email: 'testcustomer@example.com',
    phone: '1234567890',
    password: 'password123'
  };

  const testProvider = {
    name: 'Test Provider',
    email: 'testprovider@example.com',
    phone: '0987654321',
    password: 'password123',
    role: 'customer',
    isServiceProvider: true,
    serviceType: 'Driver'
  };

  describe('POST /api/auth/register', () => {
    it('should successfully register a customer', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.phone).toBe(testUser.phone);
    });

    it('should successfully register a service provider', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testProvider);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.isServiceProvider).toBe(true);
      expect(res.body.user.serviceType).toBe('Driver');
    });

    it('should fail registration with duplicate phone number', async () => {
      // First, register
      await request(app).post('/api/auth/register').send(testUser);

      // Attempt to register with same phone, different email
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'newemail@example.com' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User with this phone number is already registered');
    });

    it('should fail registration with duplicate email but new phone', async () => {
      // First, register
      await request(app).post('/api/auth/register').send(testUser);

      // Attempt to register with same email, different phone
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, phone: '5555555555' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User with this email address is already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should successfully login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should fail login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });
  });
});
