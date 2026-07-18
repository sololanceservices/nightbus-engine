const request = require('supertest');
const { app } = require('../../server');

describe('Roles and Edge Cases API', () => {
  const edgeUser = {
    name: 'Edge User',
    email: 'edge@example.com',
    phone: '9998887777',
    password: 'password123'
  };

  let token = '';
  let userId = '';

  beforeAll(async () => {
    // Register
    await request(app).post('/api/auth/register').send(edgeUser);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: edgeUser.email, password: edgeUser.password });
    token = res.body.token;
    userId = res.body.user.id;
  });

  describe('User Role Edge Cases', () => {
    it('should be created as a customer by default', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.user.role).toBe('customer');
    });
    
    // Additional test cases can be added here for upgrading roles
    // if there are specific endpoints for it.
  });
});
