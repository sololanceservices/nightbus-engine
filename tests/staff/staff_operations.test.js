const request = require('supertest');
const { app } = require('../../server');
const mongoose = require('mongoose');
const User = require('../../models/User');
const TripTimeline = require('../../models/TripTimeline');
const Bus = require('../../models/Bus');
const Segment = require('../../models/Segment');

describe('Staff Operations Controller', () => {
  let staffToken = '';
  let staffUser = null;
  let testBus = null;
  let testTrip = null;

  beforeAll(async () => {
    // Note: Depends on mongodb-memory-server running
    const busOwnerId = new mongoose.Types.ObjectId();
    
    testBus = await Bus.create({
      registrationNumber: `MP09ST${Math.floor(1000 + Math.random() * 9000)}`,
      busNumber: `MP09ST${Math.floor(1000 + Math.random() * 9000)}`,
      totalSeats: 40,
      capacity: 40,
      chassisNumber: `1HGCR2F83HA0${Math.floor(10000 + Math.random() * 90000)}`,
      ownerId: busOwnerId,
    });

    const staffEmail = `staff_ops_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      name: 'Ops Staff',
      email: staffEmail,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      password: 'password123',
      role: 'staff'
    });

    staffUser = await User.findOne({ email: staffEmail });
    staffUser.assignedBus = testBus._id;
    staffUser.permissions.set('op_controls', true);
    staffUser.permissions.set('update_location', true);
    await staffUser.save();

    const loginRes = await request(app).post('/api/auth/login').send({
      email: staffEmail,
      password: 'password123'
    });
    staffToken = loginRes.body.token;

    testTrip = await TripTimeline.create({
      busId: testBus._id,
      routeId: new mongoose.Types.ObjectId(),
      status: 'scheduled',
      serviceDate: new Date(),
      stops: [
        { name: 'Stop A', scheduledArrival: new Date(), sequence: 0 },
        { name: 'Stop B', scheduledArrival: new Date(), sequence: 1 }
      ]
    });
  });

  it('should successfully get active trip when status is running or boarding', async () => {
    testTrip.status = 'boarding';
    await testTrip.save();

    const res = await request(app)
      .get('/api/staff/active-trip')
      .set('Authorization', `Bearer ${staffToken}`);
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trip._id.toString()).toBe(testTrip._id.toString());
  });

  it('should allow staff to update trip status to running', async () => {
    const res = await request(app)
      .post('/api/staff/update-trip-status')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ tripId: testTrip._id.toString(), status: 'running' });
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    
    const updatedTrip = await TripTimeline.findById(testTrip._id);
    expect(updatedTrip.status).toBe('running');
  });

  it('should allow staff to update bus location (arrival)', async () => {
    const res = await request(app)
      .post('/api/staff/update-position')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ 
        tripId: testTrip._id.toString(), 
        stopIndex: 1, 
        isArrival: true,
        location: { latitude: 22.5, longitude: 80.1 }
      });
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    
    const updatedTrip = await TripTimeline.findById(testTrip._id);
    expect(updatedTrip.stops[1].status).toBe('arrived');
    expect(updatedTrip.stops[1].actualArrival).toBeDefined();
  });
  
  it('should return passenger manifest for active trip', async () => {
    // Create a mock segment to test manifest
    await Segment.create({
      busId: testBus._id,
      travelDate: new Date(),
      status: 'confirmed',
      fromStop: { name: 'Stop A' },
      toStop: { name: 'Stop B' },
      seatNumber: '1A'
    });

    const res = await request(app)
      .get(`/api/staff/trip/${testTrip._id.toString()}/manifest`)
      .set('Authorization', `Bearer ${staffToken}`);
      
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data.segments[0].seatNumber).toBe('1A');
  });
});
