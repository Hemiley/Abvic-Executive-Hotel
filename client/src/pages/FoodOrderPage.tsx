import { useEffect, useState } from "react";
import { api, type KitchenInventoryItem, type KitchenOrder, type KitchenOrderItem } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type OrderSource = "reception" | "bar";

type CartItem = { item: KitchenInventoryItem; quantity: number };

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

const fmt = (n: number | string) =>
  `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export default function FoodOrderPage({ source }: Props) {
  const { user } = useAuth();
  const [menu, setMenu] = useState<KitchenInventoryItem[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [view, setView] = useState<"order" | "history">("order");
  const [viewing, setViewing] = useState<OrderWithItems | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successOrder, setSuccessOrder] = useState<OrderWithItems | null>(null);
  const [extraItems, setExtraItems] = useState<{ mealName: string; quantity: number; notes: string }[]>([]);
  const [form, setForm] = useState({
    staffName: user?.fullName || "",
    tableOrRoom: "",
    customerName: "",
    priority: "normal" as "normal" | "urgent" | "vip",
    specialInstructions: "",
  });

  function loadMenu() {
    api.getKitchenMenu().then(setMenu).catch(() => {});
  }

  function loadOrders() {
    api.getKitchenOrders()
      .then(all => {
        const mine = all
          .filter(o => o.source === source)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(mine);
      })
      .catch(() => {});
  }

  useEffect(() => { loadMenu(); loadOrders(); }, []);
  useEffect(() => { const iv = setInterval(loadOrders, 20000); return () => clearInterval(iv); }, []);

  function addToCart(item: KitchenInventoryItem) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1 }];
    });
  }

  function updateQty(itemId: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(c => c.item.id !== itemId));
    else setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, quantity: qty } : c));
  }

  const cartTotal = cart.reduce((s, c) => s + Number(c.item.pricePerUnit) * c.quantity, 0);

  const categories = ["All", ...Array.from(new Set(menu.map(m => m.category)))];
  const filteredMenu = menu.filter(m =>
    (filterCat === "All" || m.category === filterCat) &&
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  function openOrderForm() {
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cartItemsMapped = cart.map(c => ({
      mealName: c.item.name,
      quantity: c.quantity,
      notes: `₦${Number(c.item.pricePerUnit).toLocaleString("en-NG")}/${c.item.unit}`,
    }));
    const validExtra = extraItems.filter(i => i.mealName.trim());
    const allItems = [...cartItemsMapped, ...validExtra];
    if (allItems.length === 0) { setError("Add at least one item to the order."); return; }
    setError(""); setSaving(true);
    try {
      const order = await api.createKitchenOrder({
        ...form,
        source,
        items: allItems,
      });
      setSuccessOrder(order);
      setCart([]);
      setExtraItems([]);
      setForm(f => ({ ...f, tableOrRoom: "", customerName: "", specialInstructions: "", priority: "normal" }));
      setShowForm(false);
      loadOrders();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const priorityColor = (p: string) =>
    p === "vip" ? "#f59e0b" : p === "urgent" ? "#f87171" : "var(--muted)";

  const activeOrders = orders.filter(o => !["served", "cancelled"].includes(o.status));
  const pastOrders = orders.filter(o => ["served", "cancelled"].includes(o.status)).slice(0, 30);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🍽️ Order Food</h1>
          <p className="page-sub">Browse the kitchen menu and send food orders</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className={`btn ${view === "order" ? "" : "secondary"}`}
            onClick={() => setView("order")}
          >🛒 Order</button>
          <button
            className={`btn ${view === "history" ? "" : "secondary"}`}
            onClick={() => setView("history")}
          >📋 My Orders {activeOrders.length > 0 && `(${activeOrders.length} active)`}</button>
        </div>
      </div>

      {/* ── ORDER VIEW ── */}
      {view === "order" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>

          {/* Menu grid */}
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <input
                className="search-input"
                placeholder="Search menu…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {menu.length === 0 && (
              <div className="glass" style={{ borderRadius: 12, padding: 32, textAlign: "center", color: "var(--muted)" }}>
                No menu items available. The kitchen hasn't added any inventory yet.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {filteredMenu.map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  disabled={item.status === "out_of_stock"}
                  style={{
                    background: "var(--glass-bg, rgba(255,255,255,0.06))",
                    border: `1px solid ${item.status === "low_stock" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 12, padding: 14, cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s", color: "inherit", opacity: item.status === "out_of_stock" ? 0.45 : 1,
                  }}
                  onMouseOver={e => { if (item.status !== "out_of_stock") e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)"; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = item.status === "low_stock" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"; }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: 3 }}>{item.name}</div>
                  <div style={{ fontSize: "0.73rem", color: "var(--muted)", marginBottom: 6 }}>{item.category}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#6366f1" }}>{fmt(item.pricePerUnit)}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 3 }}>per {item.unit}</div>
                  {item.status === "low_stock" && (
                    <div style={{ fontSize: "0.7rem", color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>⚠ Low stock</div>
                  )}
                  {item.status === "out_of_stock" && (
                    <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: 4, fontWeight: 600 }}>Out of stock</div>
                  )}
                </button>
              ))}
              {filteredMenu.length === 0 && menu.length > 0 && (
                <p style={{ color: "var(--muted)", gridColumn: "1/-1", padding: 24, textAlign: "center" }}>No items match your search.</p>
              )}
            </div>
          </div>

          {/* Cart / Order panel */}
          <div className="glass" style={{ borderRadius: 14, padding: 16, position: "sticky", top: 16 }}>
            <h3 style={{ marginBottom: 12 }}>🧾 Order</h3>

            {cart.length === 0 && (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0", fontSize: "0.85rem" }}>
                Click menu items to add them
              </p>
            )}

            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 8 }}>
              {cart.map(c => (
                <div key={c.item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{c.item.name}</div>
                    <div style={{ fontSize: "0.73rem", color: "var(--muted)" }}>{fmt(c.item.pricePerUnit)}/{c.item.unit}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <button onClick={() => updateQty(c.item.id, c.quantity - 1)}
                      style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", color: "inherit", fontSize: 14 }}>−</button>
                    <span style={{ minWidth: 18, textAlign: "center", fontWeight: 600, fontSize: "0.85rem" }}>{c.quantity}</span>
                    <button onClick={() => updateQty(c.item.id, c.quantity + 1)}
                      style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", color: "inherit", fontSize: 14 }}>+</button>
                  </div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, minWidth: 60, textAlign: "right" }}>
                    {fmt(Number(c.item.pricePerUnit) * c.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.05rem", padding: "10px 0", borderTop: "2px solid rgba(255,255,255,0.12)", marginBottom: 12 }}>
                <span>Total</span>
                <span style={{ color: "#6366f1" }}>{fmt(cartTotal)}</span>
              </div>
            )}

            <button
              className="btn full"
              onClick={openOrderForm}
              disabled={cart.length === 0}
              style={{ marginBottom: cart.length > 0 ? 8 : 0 }}
            >
              {cart.length === 0 ? "Select items to order" : `🍳 Place Order · ${fmt(cartTotal)}`}
            </button>
            {cart.length > 0 && (
              <button className="btn secondary full" onClick={() => setCart([])}>Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === "history" && (
        <div>
          {activeOrders.length > 0 && (
            <>
              <h2 style={{ marginBottom: 12 }}>Active Orders</h2>
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
                    <div style={{ fontSize: "0.8rem", marginBottom: 6 }}>
                      <span style={{ color: priorityColor(order.priority), fontWeight: 700, textTransform: "uppercase" }}>{order.priority}</span>
                    </div>
                    {order.items && (
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {order.items.slice(0, 3).map(i => <div key={i.id}>• {i.mealName} ×{i.quantity}</div>)}
                        {order.items.length > 3 && <div>+{order.items.length - 3} more</div>}
                      </div>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 8 }}>{new Date(order.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeOrders.length === 0 && pastOrders.length === 0 && (
            <div className="glass" style={{ borderRadius: 12, padding: 40, textAlign: "center", color: "var(--muted)" }}>
              No orders yet. Switch to the Order tab to place one.
            </div>
          )}

          {pastOrders.length > 0 && (
            <>
              <h2 style={{ marginBottom: 12 }}>Recent Orders</h2>
              <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
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
                        <td style={{ padding: "8px 14px" }}><span style={{ color: STATUS_COLORS[o.status], fontWeight: 600 }}>{STATUS_LABELS[o.status]}</span></td>
                        <td style={{ padding: "8px 14px", color: "var(--muted)" }}>{new Date(o.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PLACE ORDER MODAL ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal glass" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <h2>Confirm Order</h2>
            <p className="page-sub" style={{ marginBottom: 16 }}>
              Source: <strong>{source === "reception" ? "Reception" : "Bar"}</strong>
            </p>

            {/* Order summary */}
            <div className="glass" style={{ borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              {cart.map(c => (
                <div key={c.item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.875rem" }}>
                  <span>{c.item.name} × {c.quantity} <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>({fmt(c.item.pricePerUnit)}/{c.item.unit})</span></span>
                  <strong>{fmt(Number(c.item.pricePerUnit) * c.quantity)}</strong>
                </div>
              ))}
              {extraItems.filter(i => i.mealName.trim()).map((i, idx) => (
                <div key={`extra-${idx}`} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.875rem" }}>
                  <span>{i.mealName} × {i.quantity}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>no price</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 8, marginTop: 4, fontWeight: 700, fontSize: "1rem" }}>
                <span>Grand Total</span>
                <span style={{ color: "#6366f1" }}>{fmt(cartTotal)}</span>
              </div>
            </div>

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
                  <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))} rows={2} style={{ width: "100%", resize: "vertical" }} placeholder="Allergies, prep notes…" />
                </div>
              </div>

              {/* Extra unlisted items */}
              <div style={{ margin: "12px 0 6px", fontWeight: 600, fontSize: "0.9rem" }}>
                Additional items not in menu
                <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "0.8rem", marginLeft: 8 }}>optional</span>
              </div>
              {extraItems.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 72px 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input placeholder="Meal name" value={item.mealName} onChange={e => setExtraItems(it => it.map((x, i) => i === idx ? { ...x, mealName: e.target.value } : x))} />
                  <input type="number" min={1} placeholder="Qty" value={item.quantity} onChange={e => setExtraItems(it => it.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <input placeholder="Notes" value={item.notes} onChange={e => setExtraItems(it => it.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} />
                  <button type="button" className="btn danger" style={{ padding: "4px 10px" }} onClick={() => setExtraItems(it => it.filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
              <button type="button" className="btn secondary" style={{ marginBottom: 14, fontSize: "0.82rem" }}
                onClick={() => setExtraItems(it => [...it, { mealName: "", quantity: 1, notes: "" }])}>
                + Add unlisted item
              </button>

              {error && <p className="error-text" style={{ marginBottom: 10 }}>{error}</p>}

              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Back</button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? "Sending…" : `🍳 Send to Kitchen · ${fmt(cartTotal)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUCCESS MODAL ── */}
      {successOrder && (
        <div className="modal-overlay">
          <div className="modal glass" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
              <h2>Order Sent!</h2>
              <p className="page-sub" style={{ marginTop: 4 }}>Order #{successOrder.orderNumber} is in the kitchen queue</p>
            </div>
            <div className="glass" style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16 }}>
              {successOrder.items?.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.9rem" }}>
                  <span>{i.mealName} × {i.quantity}</span>
                  {i.notes && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{i.notes}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn full" onClick={() => { setSuccessOrder(null); setView("history"); }}>
                📋 Track Order
              </button>
              <button className="btn secondary full" onClick={() => setSuccessOrder(null)}>New Order</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ── */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal glass" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h2>Order #{viewing.orderNumber}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.875rem", marginBottom: 16 }}>
              <div><span style={{ color: "var(--muted)" }}>Status: </span>
                <strong style={{ color: STATUS_COLORS[viewing.status] }}>{STATUS_LABELS[viewing.status]}</strong>
              </div>
              <div><span style={{ color: "var(--muted)" }}>Priority: </span>
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
                <div key={i.id} style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
                  <span><strong>{i.mealName}</strong> ×{i.quantity}</span>
                  {i.notes && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{i.notes}</span>}
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
