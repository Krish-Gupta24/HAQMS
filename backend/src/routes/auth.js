const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// FIXED: Removed insecure hardcoded fallback secret.
const JWT_SECRET = process.env.JWT_SECRET;

// Simple validation helpers
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    // SENSITIVE CONSOLE LOG FIXED:
    // Log only non-sensitive registration information.
    console.log(`[AUTH] Registering user: ${req.body.email}`);

    const { email, password, name, role } = req.body;

    // MISSING VALIDATION FIXED
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'All fields are required',
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists with this email',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'RECEPTIONIST',
      },
    });

    // INCONSISTENT API RESPONSE FIXED:
    // Do not expose password hash.
    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // IMPROPER ERROR HANDLING FIXED:
    // Do not leak database internals.
    res.status(500).json({
      error: 'Server error during registration',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    // SENSITIVE CONSOLE LOG FIXED:
    // Never log plaintext passwords.
    console.log(`[AUTH] Login attempt for email: ${req.body.email}`);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Weak JWT token generation FIXED:
    // Reduced token lifetime to a more reasonable duration.
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      {
        expiresIn: '1d',
      }
    );

    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    // IMPROPER ERROR HANDLING FIXED:
    // Do not expose stack traces.
    res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});

// GET /api/auth/me
// Returns current user details based on JWT
const { authenticate } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // INCONSISTENT API RESPONSE FIXED:
    // Match login/register response style.
    res.json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve user profile',
    });
  }
});

module.exports = router;
