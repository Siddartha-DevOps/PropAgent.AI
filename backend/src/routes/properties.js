const express = require('express');
const router = express.Router();

const PROPERTIES = [
  { id: 'p-001', name: 'Prestige Skyline', location: 'Banjara Hills', city: 'Hyderabad', type: '3BHK', priceMin: 9500000, priceMax: 12000000, status: 'available', possession: 'Ready to move', amenities: ['Pool', 'Gym', 'Clubhouse', '24/7 Security'] },
  { id: 'p-002', name: 'Lodha Banjara Grand', location: 'Banjara Hills', city: 'Hyderabad', type: '2BHK', priceMin: 8000000, priceMax: 11000000, status: 'available', possession: 'Dec 2025', amenities: ['Pool', 'Gym', 'Rooftop Garden'] },
  { id: 'p-003', name: 'My Home Avatar', location: 'Gachibowli', city: 'Hyderabad', type: '2BHK', priceMin: 5500000, priceMax: 8500000, status: 'available', possession: 'Ready to move', amenities: ['Pool', 'Gym', 'Jogging Track'] },
  { id: 'p-004', name: 'Aparna Serene Park', location: 'Kondapur', city: 'Hyderabad', type: '2BHK', priceMin: 6000000, priceMax: 7500000, status: 'available', possession: 'Mar 2026', amenities: ['Pool', 'Garden', 'Gym'] },
  { id: 'p-005', name: 'Prestige Jubilee Heights', location: 'Jubilee Hills', city: 'Hyderabad', type: '4BHK', priceMin: 18000000, priceMax: 30000000, status: 'available', possession: 'Ready', amenities: ['Pool', 'Concierge', 'Home Theatre'] },
  { id: 'p-006', name: 'Shriram Blue Design', location: 'Kompally', city: 'Hyderabad', type: '2BHK', priceMin: 4500000, priceMax: 7000000, status: 'available', possession: 'Jun 2026', amenities: ['Pool', 'Gym'] },
  { id: 'p-007', name: 'Aparna Kanopy', location: 'Manikonda', city: 'Hyderabad', type: '3BHK', priceMin: 7200000, priceMax: 9500000, status: 'available', possession: 'Ready to move', amenities: ['Pool', 'Gym', 'Park'] },
];

router.get('/', (req, res) => {
  let props = [...PROPERTIES];
  if (req.query.type) props = props.filter(p => p.type.includes(req.query.type));
  if (req.query.location) props = props.filter(p => p.location.toLowerCase().includes(req.query.location.toLowerCase()));
  if (req.query.maxPrice) props = props.filter(p => p.priceMin <= parseInt(req.query.maxPrice));
  res.json(props);
});

router.get('/:id', (req, res) => {
  const prop = PROPERTIES.find(p => p.id === req.params.id);
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  res.json(prop);
});

module.exports = router;