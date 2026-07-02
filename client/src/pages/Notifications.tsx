import { useState } from "react";
import { useNotifications } from "../context/NotificationsContext";
import type { Notification } from "../lib/api";

const TYPE_ICONS: Record<string, string> = {
  guest_arrival: "🛎️",
  new_reservation: "📋",
  payment: "💳",
  system: "⚙️",
  checkout: "🚪",
  checkin: "✅",
};

function typeIcon(type: string) {
  return TYPE_ICONS[type] || "🔔";
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const [selected, setSelected] = useState<Notification | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  async function openNotif(n: Notification) {
    setSelected(n);
    if (!n.read) await markRead(n.id);
  }

  const displayed = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="page-sub">
            {unread > 0
              ? `${unread} unread message${unread !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn secondary" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="notif-page-tabs">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            className={`notif-tab-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "unread" && unread > 0 && (
              <span className="notif-tab-count">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="notif-empty-page">
          <div className="notif-empty-icon">🔔</div>
          <p>No {filter !== "all" ? filter : ""} notifications</p>
        </div>
      ) : (
        <div className="notif-page-list">
          {displayed.map((n) => (
            <div
              key={n.id}
              className={`notif-page-item glass ${n.read ? "notif-read" : "notif-unread"}`}
              onClick={() => openNotif(n)}
            >
              <div className="notif-page-icon">{typeIcon(n.type)}</div>
              <div className="notif-page-body">
                <div className="notif-page-msg">{n.message}</div>
                <div className="notif-page-meta">
                  <span className="notif-page-time">{relativeTime(n.createdAt)}</span>
                  <span className="notif-page-full-time">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="notif-page-status">
                {!n.read && <span className="notif-dot-live" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div
            className="modal glass notif-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notif-detail-icon">{typeIcon(selected.type)}</div>
            <div className="notif-detail-type">
              {selected.type.replace(/_/g, " ")}
            </div>
            <p className="notif-detail-msg">{selected.message}</p>
            <div className="notif-detail-time">
              {new Date(selected.createdAt).toLocaleString()}
            </div>
            <button className="btn full" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
