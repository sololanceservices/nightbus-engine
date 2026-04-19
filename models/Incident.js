const incidentSchema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ["damage", "delay", "accident", "harassment", "theft", "medical", "other"],
    required: true
  },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  status: {
    type: String,
    enum: ["reported", "acknowledged", "investigating", "resolved", "closed"],
    default: "reported"
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  }
}, { timestamps: true });

incidentSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Incident', incidentSchema);
