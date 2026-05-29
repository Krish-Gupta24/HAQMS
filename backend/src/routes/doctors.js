const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/doctors
// Retrieve list of doctors with special search filtering
// SECURITY BUG FIXED:
// Replaced queryRawUnsafe string concatenation with parameterized query.
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, specialization } = req.query;

    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(Prisma.sql`name ILIKE ${values[values.length - 1]}`);
    }

    if (specialization && specialization !== "All") {
      values.push(specialization);
      conditions.push(
        Prisma.sql`specialization = ${values[values.length - 1]}`,
      );
    }

    let doctors;

    if (conditions.length === 0) {
      doctors = await prisma.$queryRaw`
        SELECT * FROM "Doctor"
      `;
    } else {
      const whereClause = Prisma.join(conditions, " AND ");

      doctors = await prisma.$queryRaw(
        Prisma.sql`
          SELECT * FROM "Doctor"
          WHERE ${whereClause}
        `,
      );
    }

    // SQL DEBUG FIXED:
    // Avoid logging full generated SQL queries.
    console.log(
      `[DOCTORS] Search executed. search=${search || ""}, specialization=${specialization || ""}`,
    );

    // Keep original response format because frontend
    // expects an array and calls doctorsList.map(...)
    res.json(doctors);
  } catch (error) {
    // SQL error leakage FIXED
    res.status(500).json({
      error: 'Database execution failure',
    });
  }
});

// GET /api/doctors/stats
// Returns aggregation details about available doctors
// PERFORMANCE BUG FIXED:
// Independent database operations execute concurrently using Promise.all().
router.get('/stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();

    const [
      totalDoctors,
      surgeonsCount,
      averageFee,
      highestExperience,
    ] = await Promise.all([
      prisma.doctor.count(),
      prisma.doctor.count({
        where: {
          department: 'Surgery',
        },
      }),
      prisma.doctor.aggregate({
        _avg: {
          consultationFee: true,
        },
      }),
      prisma.doctor.aggregate({
        _max: {
          experience: true,
        },
      }),
    ]);

    const durationMs = Date.now() - start;

    res.json({
      success: true,
      data: {
        total: totalDoctors,
        surgeons: surgeonsCount,
        averageFee: Math.round(
          averageFee._avg.consultationFee || 0
        ),
        maxExperience:
          highestExperience._max.experience || 0,
      },
      debugInfo: {
        executionTimeMs: durationMs,
        notes: 'Optimized using Promise.all()',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve doctor statistics',
    });
  }
});

// GET /api/doctors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor not found',
      });
    }

    res.json(doctor);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve doctor',
    });
  }
});

module.exports = router;
