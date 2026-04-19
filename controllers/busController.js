// ==================== controllers/busController.js ====================
const Bus = require('../models/Bus');

// Get all buses
exports.getAllBuses = async (req, res) => {
  try {
    const buses = await Bus.find().populate('ownerId');
    res.status(200).json({ success: true, buses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get bus by ID
exports.getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).populate('ownerId');
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    res.status(200).json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get bus seats
exports.getBusSeats = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    res.status(200).json({ success: true, seats: bus.seats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create bus
exports.createBus = async (req, res) => {
  try {
    const { name, registrationNumber, totalSeats, type, ownerId } = req.body;
    
    const bus = new Bus({
      name,
      registrationNumber,
      totalSeats,
      type,
      ownerId: ownerId || req.userId,
      seats: generateSeats(totalSeats)
    });
    
    await bus.save();
    res.status(201).json({ success: true, message: 'Bus created', bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update bus
exports.updateBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    res.status(200).json({ success: true, message: 'Bus updated', bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete bus
exports.deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }
    res.status(200).json({ success: true, message: 'Bus deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update availability
exports.updateAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      { isAvailable },
      { new: true }
    );
    res.status(200).json({ success: true, message: 'Availability updated', bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to generate seats
function generateSeats(total) {
  const seats = [];
  const rows = Math.ceil(total / 4);
  const cols = 4;
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (seats.length < total) {
        seats.push({
          number: `${i + 1}${String.fromCharCode(65 + j)}`,
          isAvailable: true,
          gender: 'any'
        });
      }
    }
  }
  return seats;
}
