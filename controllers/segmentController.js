// ==================== controllers/segmentController.js ====================
const Segment = require('../models/Segment');
const Bus = require('../models/Bus');

// Get segment by ID
exports.getSegmentById = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id)
      .populate('journeyId')
      .populate('routeId')
      .populate('busId');
    
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }
    
    res.status(200).json({ success: true, segment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update segment status
exports.updateSegmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const segment = await Segment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }
    
    res.status(200).json({ success: true, message: 'Segment status updated', segment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get journey segments
exports.getJourneySegments = async (req, res) => {
  try {
    const segments = await Segment.find({ journeyId: req.params.journeyId })
      .populate('routeId')
      .populate('busId');
    
    res.status(200).json({ success: true, segments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get pending segments for owner
exports.getPendingSegments = async (req, res) => {
  try {
    const ownerId = req.userId;
    
    // Find buses belonging to this owner
    const buses = await Bus.find({ ownerId }, '_id');
    const busIds = buses.map(b => b._id);

    const segments = await Segment.find({
      busId: { $in: busIds },
      status: { $in: ['requested', 'pending_approval'] }
    })
    .populate('journeyId')
    .populate('routeId')
    .populate('busId');

    res.status(200).json({
      success: true,
      segments
    });
  } catch (error) {
    console.error('❌ Get pending segments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
