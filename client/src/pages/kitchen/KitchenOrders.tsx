import { useEffect, useState } from "react";
import { api, type KitchenOrder, type KitchenOrderItem, type KitchenInventoryItem } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const STATUSES = ["new", "accepted", "preparing", "ready", "served", "cancelled"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "#6366f1",
  accepted: "#3b82f6",
  preparing: "#f59e0b",
  ready: "#4ade80",
  served: "#94a3b8",
  cancelled: "#f87171",
};
const STATUS_LABELS: Record<string, string> = {
  new: "New Order",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  served: "Served",
  cancelled: "Cancelled",
};

type OrderWithItems = KitchenOrder & { items: KitchenOrderItem[] };
type IngredientLine = { itemId: string; quantity: number };

export default function KitchenOrders() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [viewing, setViewing] = useState<OrderWithItems | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    staffName: user?.fullName || "",
    tableOrRoom: "",
    customerName: "",
    source: "restaurant" as const,
    priority: "normal" as const,
    specialInstructions: "",
  });
  const [items, setItems] = useState([{ mealName: "", quantity: 1, notes: "" }]);

  // Ingredient modal state
  const [ingredientOrder, setIngredientOrder] = useState<OrderWithItems | null>(null);
  const [inventory, setInventory] = useState<KitchenInventoryItem[]>([]);
  const [ingredientLines, setIngredientLines] = useState<IngredientLine[]>([{ itemId: "", quantity: 1 }]);
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientError, setIngredientError] = useState("");

  function load() {
    api.getKitchenOrders(filterStatus !== "all" ? filterStatus : undefined)
      .then(setOrders).catch(e => setError(e.message));
  }

  useEffect(() => { load(); }, [filterStatus]);

  // Poll for new orders every 15s
  useEffect(() => {
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [filterStatus]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.createKitchenOrder({
        ...form,
        items: items.filter(i => i.mealName.trim()),
      });
      setShowNew(false);
      setItems([{ mealName: "", quantity: 1, notes: "" }]);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(order: OrderWithItems, status: string) {
    try {
      await api.updateKitchenOrderStatus(order.id, status);
      load();
      if (viewing?.id === order.id) setViewing(prev => prev ? { ...prev, status } : null);
    } catch (e: any) { setError(e.message); }
  }

  // Open the ingredient-selection modal before transitioning to "preparing"
  async function openIngredientModal(order: OrderWithItems) {
    setIngredientError("");
    setIngredientLines([{ itemId: "", quantity: 1 }]);
    setIngredientOrder(order);
    try {
      const inv = await api.getKitchenInventory();
      setInventory(inv.filter(i => i.status !== "out_of_stock"));
    } catch (e: any) {
      setInventory([]);
    }
  }

  /** Deducts selected ingredients then starts preparing. */
  async function handleDeductAndPrepare() {
    if (!ingredientOrder) return;
    setIngredientError(""); setIngredientSaving(true);
    try {
      const chosen = ingredientLines.filter(l => l.itemId && l.quantity > 0);
      await api.startPreparingWithIngredients(ingredientOrder.id, chosen);
      setIngredientOrder(null);
      load();
      if (viewing?.id === ingredientOrder.id) setViewing(prev => prev ? { ...prev, status: "preparing" } : null);
    } catch (e: any) {
      setIngredientError(e.message);
    } finally {
      setIngredientSaving(false);
    }
  }

  /** Starts preparing without deducting any ingredients (sends empty list). */
  async function handleSkipAndPrepare() {
    if (!ingredientOrder) return;
    setIngredientError(""); setIngredientSaving(true);
    try {
      await api.startPreparingWithIngredients(ingredientOrder.id, []);
      setIngredientOrder(null);
      load();
      if (viewing?.id === ingredientOrder.id) setViewing(prev => prev ? { ...prev, status: "preparing" } : null);
    } catch (e: any) {
      setIngredientError(e.message);
    } finally {
      setIngredientSaving(false);
    }
  }

  const filtered = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);
  const priorityColor = (p: string) =>
    p === "vip" ? "#f59e0b" : p === "urgent" ? "#f87171" : "var(--muted)";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Kitchen Orders</h1>
          <p className="page-sub">Manage food orders in real time</p>
        </div>
        {isAdmin && <button className="btn" onClick={() => setShowNew(true)}>+ New Order</button>}
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ v: "all", l: "All" }, ...STATUSES.map(s => ({ v: s, l: STATUS_LABELS[s] }))].map(({ v, l }) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", border: "none",
              background: filterStatus === v ? "var(--accent)" : "rgba(255,255,255,0.08)",
              color: filterStatus === v ? "#fff" : "var(--muted)",
            }}>{l}</button>
        ))}
      </div>

      {/* Orders grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.length === 0 && (
          <div className="glass" style={{ borderRadius: 12, padding: 32, textAlign: "center", color: "var(--muted)", gridColumn: "1/-1" }}>
            No orders found
          </div>
        )}
        {filtered.map(order => (
          <div key={order.id} className="glass" style={{ borderRadius: 12, padding: 16, cursor: "pointer", borderLeft: `4px solid ${STATUS_COLORS[order.status]}` }}
            onClick={() => setViewing(order)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: "0.95rem" }}>#{order.orderNumber}</strong>
              <span style={{ background: `${STATUS_COLORS[order.status]}22`, color: STATUS_COLORS[order.status], padding: "2px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600 }}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 6 }}>
              {order.tableOrRoom && <span>📍 {order.tableOrRoom} &nbsp;</span>}
              <span style={{ color: priorityColor(order.priority), fontWeight: 700, textTransform: "uppercase" }}>{order.priority}</span>
            </div>
            <div style={{ fontSize: "0.82rem", marginBottom: 6 }}>
              👤 {order.staffName} &nbsp;·&nbsp; {order.source.replace("_", " ")}
            </div>
            {order.items && (
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                {order.items.slice(0, 2).map(i => <div key={i.id}>• {i.mealName} ×{i.quantity}</div>)}
                {order.items.length > 2 && <div>+{order.items.length - 2} more</div>}
              </div>
            )}
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 8 }}>
              {new Date(order.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      {/* New Order Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal glass" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <h2>New Kitchen Order</h2>
            <form onSubmit={handleCreate}>
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
                  <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as any }))}>
                    <option value="restaurant">Restaurant</option>
                    <option value="bar">Bar</option>
                    <option value="room_service">Room Service</option>
                    <option value="reception">Reception</option>
                  </select>
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
                  <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))} rows={2} style={{ width: "100%", resize: "vertical" }} />
                </div>
              </div>

              <div style={{ margin: "12px 0 6px", fontWeight: 600 }}>Order Items</div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input placeholder="Meal name *" value={item.mealName} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, mealName: e.target.value } : x))} required />
                  <input type="number" min={1} placeholder="Qty" value={item.quantity} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <input placeholder="Notes" value={item.notes} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} />
                  {items.length > 1 && <button type="button" className="btn danger" style={{ padding: "4px 10px" }} onClick={() => setItems(it => it.filter((_, i) => i !== idx))}>✕</button>}
                </div>
              ))}
              <button type="button" className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setItems(it => [...it, { mealName: "", quantity: 1, notes: "" }])}>+ Add Item</button>

              {error && <p className="error-text">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>{saving ? "Placing..." : "Place Order"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal glass" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2>Order #{viewing.orderNumber}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.875rem", marginBottom: 16 }}>
              <div><span style={{ color: "var(--muted)" }}>Status:</span> <strong style={{ color: STATUS_COLORS[viewing.status] }}>{STATUS_LABELS[viewing.status]}</strong></div>
              <div><span style={{ color: "var(--muted)" }}>Priority:</span> <strong style={{ color: priorityColor(viewing.priority), textTransform: "capitalize" }}>{viewing.priority}</strong></div>
              <div><span style={{ color: "var(--muted)" }}>Staff:</span> {viewing.staffName}</div>
              <div><span style={{ color: "var(--muted)" }}>Source:</span> {viewing.source.replace("_", " ")}</div>
              {viewing.tableOrRoom && <div><span style={{ color: "var(--muted)" }}>Location:</span> {viewing.tableOrRoom}</div>}
              {viewing.customerName && <div><span style={{ color: "var(--muted)" }}>Customer:</span> {viewing.customerName}</div>}
              <div><span style={{ color: "var(--muted)" }}>Time:</span> {new Date(viewing.createdAt).toLocaleString()}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Items</div>
              {viewing.items?.map(i => (
                <div key={i.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.875rem" }}>
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

            {/* Status actions */}
            <div style={{ marginBottom: 12, fontWeight: 600 }}>Update Status</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {viewing.status === "new" && (
                <button className="btn" onClick={() => updateStatus(viewing, "accepted")}>✓ Accept</button>
              )}
              {viewing.status === "accepted" && (
                <button className="btn" style={{ background: "#f59e0b" }} onClick={() => { setViewing(null); openIngredientModal(viewing); }}>🔥 Start Preparing</button>
              )}
              {viewing.status === "preparing" && (
                <button className="btn" style={{ background: "#4ade80", color: "#000" }} onClick={() => updateStatus(viewing, "ready")}>✅ Mark Ready</button>
              )}
              {viewing.status === "ready" && (
                <button className="btn" onClick={() => updateStatus(viewing, "served")}>🍽️ Mark Served</button>
              )}
              {!["served", "cancelled"].includes(viewing.status) && (
                <button className="btn danger" onClick={() => updateStatus(viewing, "cancelled")}>✕ Cancel</button>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn secondary" onClick={() => setViewing(null)}>Close</button>
              <button className="btn secondary" onClick={() => window.print()}>🖨️ Print Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredient Selection Modal */}
      {ingredientOrder && (
        <div className="modal-overlay" onClick={() => setIngredientOrder(null)}>
          <div className="modal glass" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>🧂 Select Ingredients</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: 16 }}>
              Order <strong>#{ingredientOrder.orderNumber}</strong> — choose ingredients to deduct from inventory.
              You can skip this step if no inventory deduction is needed.
            </p>

            {/* Ingredient lines */}
            <div style={{ marginBottom: 8 }}>
              {ingredientLines.map((line, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={line.itemId}
                    onChange={e => setIngredientLines(ls => ls.map((l, i) => i === idx ? { ...l, itemId: e.target.value } : l))}
                    style={{ width: "100%" }}
                  >
                    <option value="">— Select ingredient —</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category}) — {Number(item.currentStock).toFixed(2)} {item.unit} available
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={e => setIngredientLines(ls => ls.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value) } : l))}
                  />
                  {ingredientLines.length > 1 && (
                    <button type="button" className="btn danger" style={{ padding: "4px 10px" }}
                      onClick={() => setIngredientLines(ls => ls.filter((_, i) => i !== idx))}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" className="btn secondary" style={{ marginBottom: 16 }}
              onClick={() => setIngredientLines(ls => [...ls, { itemId: "", quantity: 1 }])}>
              + Add Ingredient
            </button>

            {inventory.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 8 }}>
                No inventory items found. You can still start preparing without selecting ingredients.
              </p>
            )}

            {ingredientError && <p className="error-text" style={{ marginBottom: 8 }}>{ingredientError}</p>}

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setIngredientOrder(null)}>Cancel</button>
              <button className="btn secondary" onClick={handleSkipAndPrepare} disabled={ingredientSaving}>
                {ingredientSaving ? "Starting..." : "Skip & Start Preparing"}
              </button>
              <button
                className="btn"
                style={{ background: "#f59e0b" }}
                onClick={handleDeductAndPrepare}
                disabled={ingredientSaving || ingredientLines.every(l => !l.itemId)}
              >
                {ingredientSaving ? "Deducting..." : "🔥 Deduct & Start Preparing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
