const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats
// Highly inefficient nested loop aggregate reporting for admin/receptionists dashboard
// PERFORMANCE BUG FIXED:
// Related data is loaded once and aggregated in memory instead of
// executing multiple sequential queries per doctor.
router.get('/doctor-stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Load all required data in a single query
    const doctors = await prisma.doctor.findMany({
      include: {
        appointments: {
          select: {
            status: true,
          },
        },
        queueTokens: {
          where: {
            createdAt: {
              gte: today,
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const reportData = doctors.map((doc) => {
      const totalAppointments = doc.appointments.length;

      const completedAppointments = doc.appointments.filter(
        (app) => app.status === 'COMPLETED'
      ).length;

      const cancelledAppointments = doc.appointments.filter(
        (app) => app.status === 'CANCELLED'
      ).length;

      const queueTokensCount = doc.queueTokens.length;

      const revenue =
        completedAppointments * doc.consultationFee;

      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        department: doc.department,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        todayQueueSize: queueTokensCount,
        revenue,
      };
    });

    const durationMs = Date.now() - start;

    res.json({
      success: true,
      timeTakenMs: durationMs,
      data: reportData,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate report',
    });
  }
});

module.exports = router;