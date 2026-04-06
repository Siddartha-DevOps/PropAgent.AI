const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// In-memory bookings (wire to MongoDB Booking model in production)
const bookings = new Map();

// POST /api/booking/create
router.post('/create', optionalAuth, async (req, res) => {
  const { sessionId, leadId, type, scheduledDate, scheduledTime, guestName, guestPhone, propertyName } = req.body;
  if (!scheduledDate || !scheduledTime || !guestName || !guestPhone) {
    return res.status(400).json({ error: 'Date, time, name, and phone are required.' });
  }

  const booking = {
    id:            'bk_' + Date.now(),
    sessionId:     sessionId || null,
    leadId:        leadId    || null,
    builderId:     req.userId || null,
    type:          type || 'site_visit',
    scheduledDate, scheduledTime, guestName, guestPhone, propertyName,
    status:        'confirmed',
    createdAt:     new Date().toISOString(),
  };

  // Save to MongoDB if available
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Booking = require('../models/Booking');
      const scheduledAt = new Date(`${scheduledDate} ${scheduledTime}`);
      if (!isNaN(scheduledAt)) {
        await Booking.create({
          leadId:      leadId || null,
          builderId:   req.userId || null,
          type:        type || 'site_visit',
          scheduledAt,
          status:      'confirmed',
          notes:       `${guestName} | ${guestPhone} | ${propertyName || 'General inquiry'}`,
        });
      }
    }
  } catch (err) {
    console.warn('Booking DB save error (non-blocking):', err.message);
  }

  bookings.set(booking.id, booking);

  // Send confirmation email
  try {
    const { sendBookingConfirmation } = require('../services/emailService');
    await sendBookingConfirmation({ booking });
  } catch {}

  console.log(`📅 Booking confirmed: ${guestName} | ${scheduledDate} ${scheduledTime} | ${type}`);
  res.status(201).json({ success: true, booking, message: `Booking confirmed for ${scheduledDate} at ${scheduledTime}` });
});

// GET /api/booking/list (for dashboard)
router.get('/list', async (req, res) => {
  const all = Array.from(bookings.values());
  res.json({ bookings: all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// PATCH /api/booking/:id/status
router.patch('/:id/status', async (req, res) => {
  const booking = bookings.get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.status = req.body.status;
  bookings.set(req.params.id, booking);
  res.json({ booking });
});

module.exports = router;