import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { api } from "../lib/api";
import { fileToResizedDataUrl } from "../lib/image";

export default function HotelSettings() {
  const { settings, refresh } = useSettings();
  const [hotelName, setHotelName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setHotelName(settings.hotelName);
      setLogoUrl(settings.logoUrl || "");
    }
  }, [settings]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 320, 0.9);
      setLogoUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || "Could not process image");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.updateSettings({ hotelName, logoUrl });
      await refresh();
      setSuccess("Hotel settings updated.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Hotel Settings</h1>
          <p className="page-sub">Update your hotel's name and logo shown across the console</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <form className="card glass settings-form" onSubmit={handleSave}>
        <div className="avatar-upload-row">
          {logoUrl ? (
            <img src={logoUrl} alt="Hotel logo preview" className="logo-preview" />
          ) : (
            <div className="logo-preview logo-preview-empty">✨</div>
          )}
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

        <div className="field">
          <label>Hotel Name</label>
          <input value={hotelName} onChange={(e) => setHotelName(e.target.value)} required />
        </div>

        <div className="modal-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
