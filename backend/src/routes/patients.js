const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorizeAdminOnlyLegacy } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9]{10,15}$/;

// GET /api/patients
// Get all patients with search, filtering, and pagination
// PERFORMANCE BUG FIXED:
// Filtering and pagination now happen in the database
// instead of loading all rows into memory.
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, gender } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phoneNumber: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (gender && gender !== 'All') {
      where.gender = {
        equals: gender,
        mode: 'insensitive',
      };
    }

    const [patients, totalPatients] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.patient.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(totalPatients / limit);

    res.json({
      success: true,
      patients,
      pagination: {
        page,
        limit,
        totalPatients,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch patients',
    });
  }
});

// GET /api/patients/:id
// Get patient details by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        appointments: true,
      },
    });

    if (!patient) {
      return res.status(404).json({
        error: 'Patient not found',
      });
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve patient',
    });
  }
});

// POST /api/patients (Register patient)
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      age,
      gender,
      medicalHistory,
    } = req.body;

    // INCONSISTENT VALIDATION FIXED
    if (!name || !phoneNumber || !age || !gender) {
      return res.status(400).json({
        error:
          'Name, phoneNumber, age, and gender are required.',
      });
    }

    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format.',
      });
    }

    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        error: 'Invalid phone number format.',
      });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        email: email || null,
        phoneNumber,
        age: parseInt(age),
        gender,
        medicalHistory: medicalHistory || null,
      },
    });

    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to register patient',
    });
  }
});

// DELETE /api/patients/:id
// SECURITY BUG FIXED:
// authorizeAdminOnlyLegacy now properly validates ADMIN role.
router.delete(
  '/:id',
  authenticate,
  authorizeAdminOnlyLegacy,
  async (req, res) => {
    try {
      const { id } = req.params;

      const patient = await prisma.patient.findUnique({
        where: {
          id,
        },
      });

      if (!patient) {
        return res.status(404).json({
          error: 'Patient not found',
        });
      }

      await prisma.patient.delete({
        where: {
          id,
        },
      });

      res.json({
        message: `Successfully deleted patient ${patient.name}`,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete patient',
      });
    }
  }
);

module.exports = router;