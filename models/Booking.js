const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  leadId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  builderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  propertyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  type:        { type: String, default: 'site_visit', enum: ['site_visit', 'video_call', 'phone_call'] },
  scheduledAt: { type: Date, required: true },
  status:      { type: String, default: 'pending', enum: ['pending', 'confirmed', 'completed', 'cancelled'] },
  notes:       { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);