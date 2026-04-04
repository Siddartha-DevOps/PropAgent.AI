const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const DEMO_USER = {
  id: 'usr-001',
  name: 'Demo Builder',
  email: 'demo@propagent.ai',
  company: 'Prestige Group',
  plan: 'growth'
};

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'demo@propagent.ai' && password === 'demo123') {
    const token = jwt.sign(
      { userId: DEMO_USER.id, email: DEMO_USER.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user: DEMO_USER });
  } else {
    res.status(401).json({ error: 'Invalid credentials. Use demo@propagent.ai / demo123' });
  }
});

router.post('/register', (req, res) => {
  // Wire to MongoDB User model in production
  res.json({ message: 'Registration received. Connect MongoDB to activate.', received: req.body });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');
    res.json({ user: DEMO_USER });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;