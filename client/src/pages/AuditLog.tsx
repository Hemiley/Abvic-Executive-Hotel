import { useEffect, useState } from "react";
import { api, type AuditLog as AuditLogEntry } from "../lib/api";

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAuditLogs().then(setLogs).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit Trail</h1>
          <p className="page-sub">Immutable log of all bookings, payments, and shift activity</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card glass">
        <table className="table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Receptionist</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.receptionistName || "System"}</td>
                <td>
                  <span className="badge status-confirmed">{log.action.replace(/_/g, " ")}</span>
                </td>
                <td className="muted">{log.details}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4}>No audit records yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
