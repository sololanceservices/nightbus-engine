// ==================== controllers/reviewController.js ====================
const Review = require('../models/Review');
const ServiceProvider = require('../models/ServiceProvider');

exports.submitReview = async (req, res) => {
  try {
    const { providerId, rating, comment, contextType, contextId } = req.body;
    const userId = req.user.id;

    if (!providerId || !rating || !contextType || !contextId) {
      return res.status(400).json({ success: false, message: 'providerId, rating, contextType, and contextId are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Upsert: allow updating your own review
    const review = await Review.findOneAndUpdate(
      { userId, contextType, contextId },
      { userId, providerId, rating, comment, contextType, contextId },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getProviderRating = async (req, res) => {
  try {
    const { providerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const [stats, reviews, total] = await Promise.all([
      Review.aggregate([
        { $match: { providerId: require('mongoose').Types.ObjectId(providerId) } },
        { $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          distribution: {
            $push: '$rating'
          }
        }}
      ]),
      Review.find({ providerId })
        .populate('userId', 'name profilePicture')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments({ providerId })
    ]);

    const rating = stats[0] || { averageRating: 0, totalReviews: 0 };

    res.status(200).json({
      success: true,
      data: {
        averageRating: Math.round(rating.averageRating * 10) / 10,
        totalReviews: rating.totalReviews,
        reviews,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Error fetching provider rating:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
