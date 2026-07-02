import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { api } from "../lib/api";
import { fileToResizedDataUrl } from "../lib/image";

const BG_PRESETS = [
  { label: "Deep Navy", value: "radial-gradient(circle at 20% 20%, #1c2340 0%, #0b0e1a 55%)" },
  { label: "Midnight Purple", value: "radial-gradient(circle at 30% 20%, #1e0b3d 0%, #0a0614 60%)" },
  { label: "Ocean Blue", value: "radial-gradient(circle at 20% 30%, #0b2040 0%, #040c1a 60%)" },
  { label: "Emerald Forest", value: "radial-gradient(circle at 20% 20%, #0b2d1a 0%, #050f09 60%)" },
  { label: "Crimson Night", value: "radial-gradient(circle at 25% 20%, #3d0b0b 0%, #14040a 60%)" },
  { label: "Warm Bronze", value: "radial-gradient(circle at 20% 20%, #2d1a04 0%, #100b04 60%)" },
  { label: "Slate Gray", value: "radial-gradient(circle at 20% 20%, #1a1c24 0%, #0c0d12 60%)" },
  { label: "Cosmic Pink", value: "radial-gradient(circle at 30% 20%, #2d0b2a 0%, #0f050f 60%)" },
  { label: "Sunrise Gold", value: "radial-gradient(circle at 20% 20%, #2d1f04 0%, #0f0a03 60%)" },
  { label: "Arctic White", value: "radial-gradient(circle at 20% 10%, #ffffff 0%, #e3e8fb 60%)" },
];

type Section = "branding" | "background" | "rooms" | "staff";

export default function HotelSettings() {
  const { settings, refresh } = useSettings();
  const [activeSection, setActiveSection] = useState<Section>("branding");

  // Branding state
  const [hotelName, setHotelName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandError, setBrandError] = useState("");
  const [brandSuccess, setBrandSuccess] = useState("");

  // Background state
  const [selectedBg, setSelectedBg] = useState<string>("");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [bgSaving, setBgSaving] = useState(false);
  const [bgError, setBgError] = useState("");
  const [bgSuccess, setBgSuccess] = useState("");

  useEffect(() => {
    if (settings) {
      setHotelName(settings.hotelName);
      setLogoUrl(settings.logoUrl || "");
      setSelectedBg(settings.backgroundStyle || "");
    }
  }, [settings]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 320, 0.9);
      setLogoUrl(dataUrl);
    } catch (err: any) {
      setBrandError(err.message || "Could not process image");
    }
  }

  async function handleBrandSave(e: React.FormEvent) {
    e.preventDefault();
    setBrandError("");
    setBrandSuccess("");
    setBrandSaving(true);
    try {
      await api.updateSettings({ hotelName, logoUrl });
      await refresh();
      setBrandSuccess("Hotel branding saved.");
    } catch (err: any) {
      setBrandError(err.message);
    } finally {
      setBrandSaving(false);
    }
  }

  async function handleCustomBgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1920, 0.85);
      setCustomBgUrl(dataUrl);
      setSelectedBg(`url("${dataUrl}") center/cover no-repeat`);
    } catch (err: any) {
      setBgError(err.message || "Could not process image");
    }
  }

  async function handleBgSave() {
    setBgError("");
    setBgSuccess("");
    setBgSaving(true);
    try {
      await api.updateSettings({ backgroundStyle: selectedBg || undefined });
      await refresh();
      setBgSuccess("Background saved and applied.");
    } catch (err: any) {
      setBgError(err.message);
    } finally {
      setBgSaving(false);
    }
  }

  function clearBackground() {
    setSelectedBg("");
    setCustomBgUrl("");
  }

  const TABS: { key: Section; label: string; icon: string }[] = [
    { key: "branding", label: "Hotel Branding", icon: "🏨" },
    { key: "background", label: "Dashboard Background", icon: "🎨" },
    { key: "rooms", label: "Room Management", icon: "🚪" },
    { key: "staff", label: "Staff Accounts", icon: "🧑‍💼" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Admin Settings</h1>
          <p className="page-sub">Manage hotel branding, appearance, rooms, and staff</p>
        </div>
      </div>

      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`settings-tab ${activeSection === tab.key ? "active" : ""}`}
            onClick={() => setActiveSection(tab.key)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Branding ────────────────────────────────────────── */}
      {activeSection === "branding" && (
        <form className="card glass settings-card" onSubmit={handleBrandSave}>
          <h2 className="settings-section-title">Hotel Branding</h2>
          <p className="page-sub" style={{ marginBottom: 24 }}>
            The hotel name and logo appear in the sidebar and on the login screen.
          </p>

          {brandError && <p className="error-text">{brandError}</p>}
          {brandSuccess && <p className="success-text">{brandSuccess}</p>}

          <div className="avatar-upload-row">
            {logoUrl ? (
              <img src={logoUrl} alt="Hotel logo preview" className="logo-preview" />
            ) : (
              <div className="logo-preview logo-preview-empty">✨</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="btn secondary file-btn">
                Upload Logo
                <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
              </label>
              {logoUrl && (
                <button type="button" className="btn secondary" onClick={() => setLogoUrl("")}>
                  Remove Logo
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <label>Hotel Name</label>
            <input value={hotelName} onChange={(e) => setHotelName(e.target.value)} required />
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn" disabled={brandSaving}>
              {brandSaving ? "Saving…" : "Save Branding"}
            </button>
          </div>
        </form>
      )}

      {/* ── Background ──────────────────────────────────────── */}
      {activeSection === "background" && (
        <div className="card glass settings-card">
          <h2 className="settings-section-title">Dashboard Background</h2>
          <p className="page-sub" style={{ marginBottom: 24 }}>
            Choose a preset gradient or upload a custom background image. Changes apply immediately across the console.
          </p>

          {bgError && <p className="error-text">{bgError}</p>}
          {bgSuccess && <p className="success-text">{bgSuccess}</p>}

          <p className="field-label-sm">Preset Gradients</p>
          <div className="bg-preset-grid">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`bg-preset-swatch ${selectedBg === preset.value ? "selected" : ""}`}
                style={{ background: preset.value }}
                onClick={() => { setSelectedBg(preset.value); setCustomBgUrl(""); }}
                title={preset.label}
              >
                {selectedBg === preset.value && <span className="bg-preset-check">✓</span>}
                <span className="bg-preset-label">{preset.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-divider">
            <span>or</span>
          </div>

          <p className="field-label-sm">Custom Background Image</p>
          <div className="custom-bg-row">
            {customBgUrl && (
              <div
                className="custom-bg-preview"
                style={{ backgroundImage: `url(${customBgUrl})` }}
              />
            )}
            <label className="btn secondary file-btn">
              Upload Image
              <input type="file" accept="image/*" onChange={handleCustomBgChange} hidden />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {selectedBg && (
              <button type="button" className="btn secondary" onClick={clearBackground}>
                Reset to Default
              </button>
            )}
            <button type="button" className="btn" onClick={handleBgSave} disabled={bgSaving}>
              {bgSaving ? "Saving…" : "Apply Background"}
            </button>
          </div>

          {selectedBg && (
            <div className="bg-live-preview" style={{ background: selectedBg }}>
              <span className="bg-live-label">Live preview</span>
            </div>
          )}
        </div>
      )}

      {/* ── Rooms shortcut ──────────────────────────────────── */}
      {activeSection === "rooms" && (
        <div className="card glass settings-card">
          <h2 className="settings-section-title">Room Management</h2>
          <p className="page-sub" style={{ marginBottom: 24 }}>
            Edit room names, prices, photos, amenities, and availability directly from the Rooms page.
          </p>
          <div className="shortcut-grid">
            <div className="shortcut-card glass">
              <div className="shortcut-icon">🛏️</div>
              <div>
                <strong>Edit Existing Rooms</strong>
                <p>Update room name, price per night, photo, capacity, and amenities.</p>
              </div>
              <Link to="/rooms" className="btn">Go to Rooms →</Link>
            </div>
            <div className="shortcut-card glass">
              <div className="shortcut-icon">➕</div>
              <div>
                <strong>Add a New Room</strong>
                <p>Create a new room listing with full details and a cover photo.</p>
              </div>
              <Link to="/rooms" className="btn secondary">Go to Rooms →</Link>
            </div>
          </div>
          <div className="shortcut-tip">
            💡 On the Rooms page, click <strong>Edit Room</strong> on any card to update its details, or click <strong>+ Add Room</strong> to create a new one.
          </div>
        </div>
      )}

      {/* ── Staff shortcut ──────────────────────────────────── */}
      {activeSection === "staff" && (
        <div className="card glass settings-card">
          <h2 className="settings-section-title">Staff Account Management</h2>
          <p className="page-sub" style={{ marginBottom: 24 }}>
            Create receptionist accounts, update names and profile photos, change roles, and deactivate accounts.
          </p>
          <div className="shortcut-grid">
            <div className="shortcut-card glass">
              <div className="shortcut-icon">👤</div>
              <div>
                <strong>Create a New Account</strong>
                <p>Add a receptionist, supervisor, or admin with a username and password.</p>
              </div>
              <Link to="/staff" className="btn">Go to Staff →</Link>
            </div>
            <div className="shortcut-card glass">
              <div className="shortcut-icon">✏️</div>
              <div>
                <strong>Edit Staff Profiles</strong>
                <p>Update names, profile photos, roles, and account status.</p>
              </div>
              <Link to="/staff" className="btn secondary">Go to Staff →</Link>
            </div>
          </div>
          <div className="shortcut-tip">
            💡 On the Staff page, click <strong>+ Add Staff</strong> to create an account, or click <strong>Edit</strong> next to any staff member to update their profile photo, name, or role.
          </div>
        </div>
      )}
    </div>
  );
}
