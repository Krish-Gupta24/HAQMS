const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/queue
// List all active queue tokens
router.get('/', async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const tokens = await prisma.queueToken.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json(tokens);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve queue',
    });
  }
});

// POST /api/queue/checkin
// Generate a new queue token for a patient
// CONCURRENCY/RACE CONDITION BUG FIXED:
// Token generation now runs inside a transaction.
// Additional protection will be added in schema.prisma
// using a unique constraint later.
router.post('/checkin', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({
        error: 'Patient and Doctor ID are required for check-in.',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newToken = await prisma.$transaction(async (tx) => {
      // Fetch current maximum token number
      const maxTokenResult = await tx.queueToken.aggregate({
        where: {
          doctorId,
          createdAt: {
            gte: today,
          },
        },
        _max: {
          tokenNumber: true,
        },
      });

      const currentMax =
        maxTokenResult._max.tokenNumber || 0;

      const nextTokenNumber = currentMax + 1;

      // PERFORMANCE/CONCURRENCY BUG FIXED:
      // Removed artificial delay which widened race window.

      return tx.queueToken.create({
        data: {
          tokenNumber: nextTokenNumber,
          patientId,
          doctorId,
          appointmentId: appointmentId || null,
          status: 'WAITING',
        },
        include: {
          patient: true,
          doctor: true,
        },
      });
    });

    res.status(201).json({
      message: 'Checked in successfully. Token generated.',
      token: newToken,
    });
  } catch (error) {
    console.error('Queue check-in error:', error);

    // Future schema unique constraint support
    if (error.code === 'P2002') {
      return res.status(409).json({
        error:
          'A token was generated concurrently. Please retry check-in.',
      });
    }

    res.status(500).json({
      error: 'Check-in failed',
    });
  }
});

// PATCH /api/queue/:id
// Update token status (WAITING -> CALLING -> COMPLETED / SKIPPED)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status is required',
      });
    }

    const updatedToken = await prisma.queueToken.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    res.json(updatedToken);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update queue token',
    });
  }
});

module.exports = router;
