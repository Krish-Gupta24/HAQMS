"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HistoryRecordsPage() {
  const { id } = useParams();
  const { token, API_BASE_URL } = useAuth();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPatientHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load patient record");
        }

        setPatient(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id && token) {
      fetchPatientHistory();
    }
  }, [id, token, API_BASE_URL]);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Loading patient records...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-red-500">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Patient not found</h2>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Diagnostic History Records</h1>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Patient Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p>
            <strong>Name:</strong> {patient.name}
          </p>

          <p>
            <strong>Age:</strong> {patient.age}
          </p>

          <p>
            <strong>Gender:</strong> {patient.gender}
          </p>

          <p>
            <strong>Phone:</strong> {patient.phoneNumber}
          </p>

          <p>
            <strong>Email:</strong> {patient.email || "Not Provided"}
          </p>
        </div>

        <div className="mt-4">
          <strong>Medical History:</strong>

          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {patient.medicalHistory || "No medical history available"}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Appointment History</h2>

        {patient.appointments?.length > 0 ? (
          <div className="space-y-4">
            {patient.appointments.map((appointment) => (
              <div key={appointment.id} className="border rounded-lg p-4">
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(appointment.appointmentDate).toLocaleString()}
                </p>

                <p>
                  <strong>Status:</strong> {appointment.status}
                </p>

                <p>
                  <strong>Reason:</strong> {appointment.reason || "N/A"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>No appointment history found.</p>
        )}
      </div>
    </div>
  );
}
