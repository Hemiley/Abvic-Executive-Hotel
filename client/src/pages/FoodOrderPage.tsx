import { useEffect, useState } from "react";
import { api, type KitchenOrder, type KitchenOrderItem } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type OrderSource = "reception" | "bar";

const STATUS_COLORS: Record<string, string> = {
  new: "#6366f1",
  accepted: "#3b82f6",
  preparing: "#f59e0b",
  ready: "#4ade80",
  served: "#94a3b8",
  cancelled: "#f87171",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready ✅",
  served: "Served",
  cancelled: "Cancelled",
};

type OrderWithItems = KitchenOrder & { items: KitchenOrderItem[] };

interface Props {
  source: OrderSource;
}

export default function FoodOrderPage({ source }: Props) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<OrderWithItems | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    staffName: user?.fullName || "",
    tableOrRoom: "",
    customerName: "",
    priority: "normal" as "normal" | "urgent" | "vip",
    specialInstructions: "",
  });
  const [items, setItems] = useState([{ mealName: "", quantity: 1, notes: "" }]);

  function load() {
    api.getKitchenOrders()
      .then(all => {
        // Show only orders from this source, newest first
        const mine = all
          .filter(o => o.source === source)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(mine);
      })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);

  // Poll every 20s to pick up status changes from the kitchen
  useEffect(() => {
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(i => i.mealName.trim());
    if (validItems.length === 0) { setError("Add at least one meal item."); return; }
    setError(""); setSaving(true);
    try {
      await api.createKitchenOrder({
        ...form,
        source,
        items: validItems,
      });
      setShowForm(false);
      setItems([{ mealName: "", quantity: 1, notes: "" }]);
      setForm(f => ({ ...f, tableOrRoom: "", customerName: "", specialInstructions: "", priority: "normal" }));
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const priorityColor = (p: string) =>
    p === "vip" ? "#f59e0b" : p === "urgent" ? "#f87171" : "var(--muted)";

  const activeOrders = orders.filter(o => !["served", "cancelled"].includes(o.status));
  const pastOrders = orders.filter(o => ["served", "cancelled"].includes(o.status)).slice(0, 20);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🍽️ Order Food</h1>
          <p className="page-sub">Send a food order to the kitchen</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>+ New Food Order</button>
      </div>

      {/* Active orders */}
      <h2 style={{ marginBottom: 12 }}>Active Orders</h2>
      {activeOrders.length === 0 ? (
        <div className="glass" style={{ borderRadius: 12, padding: 32, textAlign: "center", color: "var(--muted)", marginBottom: 24 }}>
          No active orders. Place one to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 28 }}>
          {activeOrders.map(order => (
            <div key={order.id} className="glass" style={{ borderRadius: 12, padding: 16, cursor: "pointer", borderLeft: `4px solid ${STATUS_COLORS[order.status]}` }}
              onClick={() => setViewing(order)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>#{order.orderNumber}</strong>
                <span style={{ background: `${STATUS_COLORS[order.status]}22`, color: STATUS_COLORS[order.status], padding: "2px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600 }}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              {order.tableOrRoom && <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 4 }}>📍 {order.tableOrRoom}</div>}
              {order.customerName && <div style={{ fontSize: "0.82rem", marginBottom: 4 }}>👤 {order.customerName}</div>}
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 6 }}>
                <span style={{ color: priorityColor(order.priority), fontWeight: 700, textTransform: "uppercase" }}>{order.priority}</span>
              </div>
              {order.items && (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {order.items.slice(0, 3).map(i => <div key={i.id}>• {i.mealName} ×{i.quantity}</div>)}
                  {order.items.length > 3 && <div>+{order.items.length - 3} more</div>}
                </div>
              )}
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 8 }}>
                {new Date(order.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <>
          <h2 style={{ marginBottom: 12 }}>Recent Orders</h2>
          <div className="glass" style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {["Order #", "Customer", "Location", "Items", "Status", "Time"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastOrders.map(o => (
                  <tr key={o.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }} onClick={() => setViewing(o)}>
                    <td style={{ padding: "8px 14px", fontFamily: "monospace" }}>#{o.orderNumber}</td>
                    <td style={{ padding: "8px 14px" }}>{o.customerName || "—"}</td>
                    <td style={{ padding: "8px 14px" }}>{o.tableOrRoom || "—"}</td>
                    <td style={{ padding: "8px 14px" }}>{o.items?.length ?? 0} item(s)</td>
                    <td style={{ padding: "8px 14px" }}>
                      <span style={{ color: STATUS_COLORS[o.status], fontWeight: 600 }}>{STATUS_LABELS[o.status]}</span>
                    </td>
                    <td style={{ padding: "8px 14px", color: "var(--muted)" }}>{new Date(o.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* New Order Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal glass" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>New Food Order</h2>
            <p className="page-sub" style={{ marginBottom: 16 }}>
              Source: <strong style={{ textTransform: "capitalize" }}>{source === "reception" ? "Reception" : "Bar"}</strong>
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Staff Name *</label>
                  <input value={form.staffName} onChange={e => setForm(f => ({ ...f, staffName: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Table / Room</label>
                  <input value={form.tableOrRoom} onChange={e => setForm(f => ({ ...f, tableOrRoom: e.target.value }))} placeholder="e.g. Table 4 / Room 12" />
                </div>
                <div className="field">
                  <label>Customer Name</label>
                  <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="field">
                  <label>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1/-1" }}>
                  <label>Special Instructions</label>
                  <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))} rows={2} style={{ width: "100%", resize: "vertical" }} placeholder="Allergies, preparation notes…" />
                </div>
              </div>

              <div style={{ margin: "14px 0 8px", fontWeight: 600 }}>Meal Items</div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 72px 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input placeholder="Meal name *" value={item.mealName} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, mealName: e.target.value } : x))} />
                  <input type="number" min={1} placeholder="Qty" value={item.quantity} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <input placeholder="Notes" value={item.notes} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} />
                  {items.length > 1 && (
                    <button type="button" className="btn danger" style={{ padding: "4px 10px" }} onClick={() => setItems(it => it.filter((_, i) => i !== idx))}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn secondary" style={{ marginBottom: 14 }} onClick={() => setItems(it => [...it, { mealName: "", quantity: 1, notes: "" }])}>
                + Add Item
              </button>

              {error && <p className="error-text" style={{ marginBottom: 10 }}>{error}</p>}

              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Sending…" : "🍳 Send to Kitchen"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal glass" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h2>Order #{viewing.orderNumber}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.875rem", marginBottom: 16 }}>
              <div>
                <span style={{ color: "var(--muted)" }}>Status: </span>
                <strong style={{ color: STATUS_COLORS[viewing.status] }}>{STATUS_LABELS[viewing.status]}</strong>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Priority: </span>
                <strong style={{ color: priorityColor(viewing.priority), textTransform: "capitalize" }}>{viewing.priority}</strong>
              </div>
              {viewing.tableOrRoom && <div><span style={{ color: "var(--muted)" }}>Location: </span>{viewing.tableOrRoom}</div>}
              {viewing.customerName && <div><span style={{ color: "var(--muted)" }}>Customer: </span>{viewing.customerName}</div>}
              <div><span style={{ color: "var(--muted)" }}>Staff: </span>{viewing.staffName}</div>
              <div><span style={{ color: "var(--muted)" }}>Placed: </span>{new Date(viewing.createdAt).toLocaleString()}</div>
            </div>

            <div style={{ fontWeight: 600, marginBottom: 8 }}>Items</div>
            <div style={{ marginBottom: 16 }}>
              {viewing.items?.map(i => (
                <div key={i.id} style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.875rem" }}>
                  <strong>{i.mealName}</strong> ×{i.quantity}
                  {i.notes && <span style={{ color: "var(--muted)" }}> — {i.notes}</span>}
                </div>
              ))}
            </div>

            {viewing.specialInstructions && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(99,102,241,0.12)", borderRadius: 8, fontSize: "0.875rem" }}>
                📝 {viewing.specialInstructions}
              </div>
            )}

            {viewing.estimatedMinutes && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(74,222,128,0.1)", borderRadius: 8, fontSize: "0.875rem", color: "#4ade80" }}>
                ⏱️ Kitchen estimates: <strong>{viewing.estimatedMinutes} min</strong>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
