const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Bus = require('../../models/Bus');
const User = require('../../models/User');
const busOwnerController = require('../../controllers/busOwnerController');

// Setup mock express app
const app = express();
app.use(express.json());

// Mock middleware to simulate authenticated user
app.post('/owner/buses', (req, res, next) => {
  req.userId = req.headers['user-id']; // simple mock for testing
  next();
}, busOwnerController.createBus);

describe('Bus Owner Controller - Integration Tests', () => {
  let ownerId;

  beforeEach(async () => {
    // Create a mock owner user
    const owner = new User({
      name: 'Test Owner',
      email: 'owner@test.com',
      phone: '9999999999',
      password: 'password123',
      role: 'owner'
    });
    await owner.save();
    ownerId = owner._id.toString();
  });

  describe('POST /owner/buses (createBus)', () => {
    it('should create a bus and automatically generate seat layout if empty', async () => {
      const busPayload = {
        chassisNumber: '1234567890123456A',
        busType: 'AC Seater',
        totalSeats: 20,
        registrationNumber: 'TN01AB1234',
        insurancePolicyNumber: 'INS123',
        permitNumber: 'PERM123',
        fitnessNumber: 'FIT123',
      };

      const response = await request(app)
        .post('/owner/buses')
        .set('user-id', ownerId)
        .send(busPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Fetch from DB to verify seat generation
      const savedBus = await Bus.findOne({ chassisNumber: '1234567890123456A' });
      expect(savedBus).not.toBeNull();
      expect(savedBus.totalSeats).toBe(20);
      expect(savedBus.seatConfiguration).toBeDefined();
      expect(savedBus.seatConfiguration.length).toBe(20); // Automatically generated 20 seats
      
      // Verify first seat structure
      const firstSeat = savedBus.seatConfiguration[0];
      expect(firstSeat.seatNumber).toBe('1');
      expect(firstSeat.isAvailable).toBe(true);
    });

    it('should fail if required documents (permit, insurance, fitness) are missing', async () => {
      const busPayload = {
        chassisNumber: '1234567890123456B',
        busType: 'AC Seater',
        totalSeats: 20,
        registrationNumber: 'TN01AB1235',
        // Missing documents
      };

      const response = await request(app)
        .post('/owner/buses')
        .set('user-id', ownerId)
        .send(busPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permit number is mandatory');
    });

    it('should save a custom seat layout if provided by frontend', async () => {
      const customSeats = [
        { seatNumber: '1A', isAvailable: true, position: 'window' },
        { seatNumber: '1B', isAvailable: true, position: 'aisle' }
      ];

      const busPayload = {
        chassisNumber: '1234567890123456C',
        busType: 'AC Sleeper',
        totalSeats: 2,
        registrationNumber: 'TN01AB1236',
        insurancePolicyNumber: 'INS123',
        permitNumber: 'PERM123',
        fitnessNumber: 'FIT123',
        seatConfiguration: customSeats
      };

      const response = await request(app)
        .post('/owner/buses')
        .set('user-id', ownerId)
        .send(busPayload);

      expect(response.status).toBe(201);
      
      const savedBus = await Bus.findOne({ chassisNumber: '1234567890123456C' });
      expect(savedBus.seatConfiguration.length).toBe(2);
      expect(savedBus.seatConfiguration[0].seatNumber).toBe('1A');
    });
  });
});
