const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  builderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:        { type: String, required: true },
  projectName: { type: String, required: true },
  location:    { type: String, required: true },
  area:        { type: String },
  city:        { type: String, default: 'Hyderabad' },
  type:        { type: String, required: true },
  priceMin:    { type: Number, required: true },
  priceMax:    { type: Number, required: true },
  status:      { type: String, default: 'available', enum: ['available', 'sold_out', 'coming_soon'] },
  possession:  { type: String },
  amenities:   [String],
  images:      [String],
  description: { type: String },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Property', PropertySchema);