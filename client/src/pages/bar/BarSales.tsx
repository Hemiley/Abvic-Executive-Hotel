import { useEffect, useState, useRef } from "react";
import { api, type BarDrink, type BarWaiter, type BarSale, type BarSaleItem } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";

type CartItem = { drink: BarDrink; quantity: number };

function esc(v: string | number | null | undefined) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateReceiptHtml(sale: BarSale, items: BarSaleItem[], hotelName: string, logoUrl?: string | null) {
  const fmt = (n: string | number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const rows = items.map(i => `
    <tr>
      <td>${esc(i.drinkName)}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${fmt(i.unitPrice)}</td>
      <td style="text-align:right">${fmt(i.subtotal)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Receipt ${esc(sale.invoiceNumber)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:20px;max-width:380px;margin:0 auto;font-size:13px}
.header{text-align:center;margin-bottom:16px;border-bottom:2px dashed #ccc;padding-bottom:16px}
.hotel{font-size:18px;font-weight:700;color:#1a1a2e}
.title{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.meta{margin:12px 0;font-size:12px;color:#555}
.meta div{display:flex;justify-content:space-between;margin:3px 0}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
th{background:#1a1a2e;color:#fff;padding:6px 8px;text-align:left;font-weight:600;font-size:11px}
td{padding:5px 8px;border-bottom:1px solid #eee}
.total-row{font-weight:700;font-size:14px;border-top:2px solid #1a1a2e}
.footer{border-top:2px dashed #ccc;padding-top:12px;margin-top:12px;text-align:center;font-size:11px;color:#888}
.badge{display:inline-block;background:#1a1a2e;color:#fff;padding:2px 8px;border-radius:12px;font-size:10px}
@media print{body{padding:8px}@page{margin:0.5cm}}
</style></head><body>
<div class="header">
${logoUrl ? `<img src="${esc(logoUrl)}" style="height:48px;margin-bottom:8px" alt="logo"/>` : ""}
<div class="hotel">${esc(hotelName)}</div>
<div class="title">Bar Receipt &nbsp;<span class="badge">OFFICIAL</span></div>
</div>
<div class="meta">
  <div><span>Invoice #</span><strong>${esc(sale.invoiceNumber)}</strong></div>
  <div><span>Date</span><span>${new Date(sale.createdAt).toLocaleString("en-NG")}</span></div>
  <div><span>Waiter/Waitress</span><span>${esc(sale.waiterName || "—")}</span></div>
  <div><span>Bar Attendant</span><span>${esc(sale.barAttendantName)}</span></div>
  <div><span>Payment Method</span><span style="text-transform:capitalize">${esc(sale.paymentMethod.replace(/_/g, " "))}</span></div>
</div>
<table>
  <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total-row"><td colspan="3">GRAND TOTAL</td><td style="text-align:right">${fmt(sale.totalAmount)}</td></tr>
  </tbody>
</table>
<div class="footer">Thank you for your patronage!<br/>${esc(hotelName)} Bar Services</div>
</body></html>`;
}

export default function BarSales() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [drinks, setDrinks] = useState<BarDrink[]>([]);
  const [waiters, setWaiters] = useState<BarWaiter[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [selectedWaiter, setSelectedWaiter] = useState("");
  const [customWaiter, setCustomWaiter] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successSale, setSuccessSale] = useState<{ sale: BarSale; items: BarSaleItem[] } | null>(null);
  const [recentSales, setRecentSales] = useState<BarSale[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<{ sale: BarSale; items: BarSaleItem[] } | null>(null);
  const [hasShift, setHasShift] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  function load() {
    api.getBarDrinks().then(setDrinks).catch(() => {});
    api.getBarWaiters().then(setWaiters).catch(() => {});
    api.getCurrentBarShift().then(s => setHasShift(!!s)).catch(() => {});
    api.getBarSales().then(s => setRecentSales(s.slice(0, 20))).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const categories = ["All", ...Array.from(new Set(drinks.map(d => d.category)))];
  const filteredDrinks = drinks.filter(d =>
    d.status === "available" &&
    (filterCat === "All" || d.category === filterCat) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || (d.brand || "").toLowerCase().includes(search.toLowerCase()))
  );

  function addToCart(drink: BarDrink) {
    setCart(prev => {
      const existing = prev.find(c => c.drink.id === drink.id);
      if (existing) return prev.map(c => c.drink.id === drink.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { drink, quantity: 1 }];
    });
  }

  function updateQty(drinkId: string, qty: number) {
    if (qty <= 0) setCart(prev => prev.filter(c => c.drink.id !== drinkId));
    else setCart(prev => prev.map(c => c.drink.id === drinkId ? { ...c, quantity: qty } : c));
  }

  const cartTotal = cart.reduce((s, c) => s + Number(c.drink.sellingPrice) * c.quantity, 0);
  const waiterName = selectedWaiter === "__custom__" ? customWaiter : (waiters.find(w => w.id === selectedWaiter)?.name || "");

  async function handleSubmit() {
    if (cart.length === 0) { setError("Add at least one drink to the order."); return; }
    if (!hasShift) { setError("You must start a bar shift before recording sales."); return; }
    setError(""); setSubmitting(true);
    try {
      const result = await api.createBarSale({
        waiterName: waiterName || undefined,
        paymentMethod,
        items: cart.map(c => ({ drinkId: c.drink.id, quantity: c.quantity })),
      });
      setSuccessSale(result);
      setCart([]);
      setSelectedWaiter("");
      setCustomWaiter("");
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function printReceipt(data: { sale: BarSale; items: BarSaleItem[] }) {
    const html = generateReceiptHtml(data.sale, data.items, settings?.hotelName || "AEH", settings?.logoUrl);
    const win = window.open("", "_blank", "width=420,height=700,noopener,noreferrer");
    if (!win) return;
    win.opener = null;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  async function viewSale(sale: BarSale) {
    try {
      const data = await api.getBarSaleById(sale.id);
      setViewingReceipt(data);
    } catch {}
  }

  const fmt = (n: number | string) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="page-header">
        <div><h1>New Sale — POS</h1><p className="page-sub">Select drinks and complete a sale</p></div>
      </div>

      {!hasShift && (
        <div className="glass" style={{ padding: 16, borderRadius: 12, marginBottom: 20, borderLeft: "4px solid #f87171", color: "#f87171" }}>
          ⚠️ No active bar shift. Go to the Dashboard to start a shift before recording sales.
        </div>
      )}

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        {/* Drink Selector */}
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input className="search-input" placeholder="Search drinks..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {filteredDrinks.map(d => (
              <button key={d.id} onClick={() => addToCart(d)} style={{
                background: "var(--glass-bg, rgba(255,255,255,0.06))", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, padding: 14, cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                color: "inherit"
              }}
                onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
                onMouseOut={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              >
                <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>{d.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 6 }}>{d.category}{d.brand ? ` · ${d.brand}` : ""}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{fmt(d.sellingPrice)}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>{d.quantityAvailable} in stock</div>
              </button>
            ))}
            {filteredDrinks.length === 0 && <p style={{ color: "var(--muted)", gridColumn: "1/-1", padding: 20, textAlign: "center" }}>No drinks available</p>}
          </div>
        </div>

        {/* Cart */}
        <div className="glass" style={{ borderRadius: 14, padding: 16, position: "sticky", top: 16 }}>
          <h3 style={{ marginBottom: 12 }}>🧾 Order</h3>

          <div className="field">
            <label>Waiter / Waitress</label>
            <select value={selectedWaiter} onChange={e => setSelectedWaiter(e.target.value)}>
              <option value="">— Select or skip —</option>
              {waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              <option value="__custom__">+ Enter name manually</option>
            </select>
          </div>
          {selectedWaiter === "__custom__" && (
            <div className="field">
              <label>Waiter Name</label>
              <input value={customWaiter} onChange={e => setCustomWaiter(e.target.value)} placeholder="Enter name" />
            </div>
          )}

          <div className="field">
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>

          <div style={{ marginBottom: 12, maxHeight: 280, overflowY: "auto" }}>
            {cart.length === 0 && <p style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>Click drinks to add them</p>}
            {cart.map(c => (
              <div key={c.drink.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ flex: 1, fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 600 }}>{c.drink.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{fmt(c.drink.sellingPrice)} each</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => updateQty(c.drink.id, c.quantity - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", color: "inherit", fontSize: 16 }}>−</button>
                  <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{c.quantity}</span>
                  <button onClick={() => updateQty(c.drink.id, c.quantity + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer", color: "inherit", fontSize: 16 }}>+</button>
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, minWidth: 64, textAlign: "right" }}>{fmt(Number(c.drink.sellingPrice) * c.quantity)}</div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div style={{ padding: "10px 0", borderTop: "2px solid rgba(255,255,255,0.1)", marginBottom: 12, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.05rem" }}>
              <span>Grand Total</span><span>{fmt(cartTotal)}</span>
            </div>
          )}

          <button className="btn full" onClick={handleSubmit} disabled={submitting || cart.length === 0} style={{ marginBottom: 8 }}>
            {submitting ? "Processing..." : `💳 Complete Sale · ${fmt(cartTotal)}`}
          </button>
          {cart.length > 0 && <button className="btn secondary full" onClick={() => setCart([])}>Clear</button>}
        </div>
      </div>

      {/* Recent Transactions */}
      {recentSales.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ marginBottom: 12 }}>Recent Transactions</h2>
          <div className="glass" style={{ borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead><tr>{["Invoice", "Waiter", "Method", "Amount", "Time", ""].map(h => <th key={h} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", color: "var(--muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {recentSales.map(s => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "8px 14px", fontFamily: "monospace", fontSize: "0.8rem" }}>{s.invoiceNumber}</td>
                    <td style={{ padding: "8px 14px" }}>{s.waiterName || "—"}</td>
                    <td style={{ padding: "8px 14px", textTransform: "capitalize" }}>{s.paymentMethod.replace(/_/g, " ")}</td>
                    <td style={{ padding: "8px 14px", fontWeight: 600 }}>{fmt(s.totalAmount)}</td>
                    <td style={{ padding: "8px 14px", color: "var(--muted)" }}>{new Date(s.createdAt).toLocaleTimeString()}</td>
                    <td style={{ padding: "8px 14px" }}>
                      <button className="btn secondary" style={{ padding: "3px 10px", fontSize: "0.75rem" }} onClick={() => viewSale(s)}>Receipt</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successSale && (
        <div className="modal-overlay">
          <div className="modal glass" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
              <h2>Sale Complete!</h2>
              <p className="page-sub" style={{ marginTop: 4 }}>Invoice {successSale.sale.invoiceNumber}</p>
            </div>
            <div className="glass" style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16 }}>
              {successSale.items.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.9rem" }}>
                  <span>{i.drinkName} × {i.quantity}</span>
                  <strong>{fmt(i.subtotal)}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, fontWeight: 700, fontSize: "1.05rem" }}>
                <span>Total</span><span>{fmt(successSale.sale.totalAmount)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => printReceipt(successSale)}>🖨️ Print Receipt</button>
            </div>
            <button className="btn secondary full" onClick={() => setSuccessSale(null)}>New Order</button>
          </div>
        </div>
      )}

      {/* View/Reprint Receipt Modal */}
      {viewingReceipt && (
        <div className="modal-overlay" onClick={() => setViewingReceipt(null)}>
          <div className="modal glass" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4 }}>Receipt — {viewingReceipt.sale.invoiceNumber}</h2>
            <p className="page-sub" style={{ marginBottom: 16 }}>{new Date(viewingReceipt.sale.createdAt).toLocaleString()}</p>
            <div className="glass" style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontSize: "0.85rem" }}>
                <span style={{ color: "var(--muted)" }}>Waiter:</span> <strong>{viewingReceipt.sale.waiterName || "—"}</strong>
                &nbsp;&nbsp;<span style={{ color: "var(--muted)" }}>Method:</span> <strong style={{ textTransform: "capitalize" }}>{viewingReceipt.sale.paymentMethod}</strong>
              </div>
              {viewingReceipt.items.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.9rem" }}>
                  <span>{i.drinkName} × {i.quantity}</span>
                  <strong>{fmt(i.subtotal)}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, fontWeight: 700 }}>
                <span>Total</span><span>{fmt(viewingReceipt.sale.totalAmount)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => printReceipt(viewingReceipt)}>🖨️ Reprint</button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={() => setViewingReceipt(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <div ref={printRef} style={{ display: "none" }} />
    </div>
  );
}
