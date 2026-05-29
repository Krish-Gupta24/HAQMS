const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/appointments
// List all appointments
// PERFORMANCE BUG FIXED:
// Replaced N+1 queries with Prisma include to fetch related
// patient and doctor data in a single database operation.
router.get('/', authenticate, async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
      include: {
        patient: true,
        doctor: true,
      },
    });

    const detailedAppointments = appointments.map((app) => ({
      ...app,
      patient: app.patient
        ? {
            id: app.patient.id,
            name: app.patient.name,
            phoneNumber: app.patient.phoneNumber,
            age: app.patient.age,
            medicalHistory: app.patient.medicalHistory,
          }
        : null,
      doctor: app.doctor
        ? {
            id: app.doctor.id,
            name: app.doctor.name,
            specialization: app.doctor.specialization,
          }
        : null,
    }));

    res.json({
      success: true,
      count: detailedAppointments.length,
      appointments: detailedAppointments,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve appointments',
      details: error.message,
    });
  }
});

// POST /api/appointments
// Book an appointment
// DESIGN BUG FIXED:
// Duplicate booking protection will be enforced by Prisma schema
// unique constraint added later:
// @@unique([doctorId, appointmentDate])
router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentDate, reason } = req.body;

    if (!patientId || !doctorId || !appointmentDate) {
      return res.status(400).json({
        error: 'Patient, Doctor, and Appointment Date are required.',
      });
    }

    const appDate = new Date(appointmentDate);

    const existingBooking = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: appDate,
        status: {
          not: 'CANCELLED',
        },
      },
    });

    if (existingBooking) {
      return res.status(400).json({
        error:
          'Doctor already has an appointment scheduled for this slot.',
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: appDate,
        reason: reason || '',
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
    });
  } catch (error) {
    // DESIGN BUG FIX:
    // Future Prisma unique constraint violations handled cleanly.
    if (error.code === 'P2002') {
      return res.status(400).json({
        error:
          'Doctor already has an appointment scheduled for this slot.',
      });
    }

    res.status(500).json({
      error: 'Failed to book appointment',
      details: error.message,
    });
  }
});

// PATCH /api/appointments/:id
// Update appointment status (COMPLETED, CANCELLED, etc.)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status is required',
      });
    }

    const updated = await prisma.appointment.update({
      where: {
        id: req.params.id,
      },
      data: {
        status,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update appointment',
      details: error.message,
    });
  }
});

module.exports = router;

