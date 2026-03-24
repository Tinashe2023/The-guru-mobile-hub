import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { userAPI, webauthnAPI, documentAPI } from "../services/api";
import { startRegistration } from "@simplewebauthn/browser";
import { safeHref, safeImageSrc } from "../utils/safeUrl";

const ProfilePage = () => {
  const { t } = useTranslation();
  const { user, logout, updateUser, isAdmin } = useAuth();
  const { currentLanguage, languages, changeLanguage } = useLanguage();
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const result = await userAPI.uploadAvatar(formData);
      updateUser({ avatar_url: result.avatar_url });
    } catch (err) {
      console.error("Avatar upload error:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await userAPI.updateProfile(form);
      updateUser(updated);
      setEditing(false);
    } catch (err) {
      console.error("Profile save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (code) => {
    changeLanguage(code);
    try {
      await userAPI.updateProfile({ language_pref: code });
    } catch (err) {
      console.error(err);
    }
  };

  const loadDocs = async () => {
    setLoadingDocs(true);
    try {
      const data = await documentAPI.getAll();
      setDocs(data);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleShowDocuments = () => {
    setShowDocuments(true);
    loadDocs();
  };

  const handleAddPasskey = async () => {
    try {
      const options = await webauthnAPI.getRegisterOptions();
      const attResp = await startRegistration(options);
      const verificationObj = await webauthnAPI.verifyRegister(attResp);
      if (verificationObj.verified) {
        alert("Passkey (Biometric) registered successfully!");
      } else {
        alert("Failed to register passkey. Try again.");
      }
    } catch (err) {
      console.error("Passkey registration error:", err);
      alert("Passkey registration failed or was cancelled.");
    }
  };

  return (
    <div className="page">
      {/* Profile Header */}
      <div className="profile-header animate-fade-in">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {user?.avatar_url ? (
              <img src={safeImageSrc(user.avatar_url)} alt={user.name} />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                }}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <button
            className="profile-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="material-symbols-outlined">photo_camera</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarUpload}
          />
        </div>
        <div>
          <h1 className="profile-name">{user?.name}</h1>
          <p className="profile-id">{user?.email}</p>
          {user?.phone && (
            <p className="profile-id" style={{ marginTop: "0.25rem" }}>
              {user.phone}
            </p>
          )}
          <div style={{ marginTop: "0.5rem" }}>
            <span
              className={`badge ${isAdmin ? "badge-error" : "badge-primary"}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "14px" }}
              >
                {isAdmin ? "shield" : "verified_user"}
              </span>
              {isAdmin ? "Admin" : "Verified User"}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      {editing && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>
            {t("profile.editProfile")}
          </h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div className="input-group">
              <label className="input-label">{t("auth.name")}</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t("auth.phone")}</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t("common.loading") : t("common.save")}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setEditing(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Menu */}
      <div className="profile-menu" style={{ marginBottom: "1.5rem" }}>
        <button
          className="profile-menu-item"
          onClick={() => {
            setForm({ name: user?.name || "", phone: user?.phone || "" });
            setEditing(true);
          }}
        >
          <div className="profile-menu-left">
            <div className="profile-menu-icon">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="profile-menu-label">{t("profile.personalInfo")}</p>
              <p className="profile-menu-desc">Update name & phone</p>
            </div>
          </div>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--outline-variant)" }}
          >
            chevron_right
          </span>
        </button>

        <button className="profile-menu-item" onClick={handleShowDocuments}>
          <div className="profile-menu-left">
            <div
              className="profile-menu-icon"
              style={{
                background: "var(--secondary-container)",
                color: "var(--on-secondary-container)",
              }}
            >
              <span className="material-symbols-outlined">folder_shared</span>
            </div>
            <div>
              <p className="profile-menu-label">
                {t("profile.savedDocuments")}
              </p>
              <p className="profile-menu-desc">VISA, EFRRO, print files</p>
            </div>
          </div>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--outline-variant)" }}
          >
            chevron_right
          </span>
        </button>

        <button className="profile-menu-item" onClick={handleAddPasskey}>
          <div className="profile-menu-left">
            <div
              className="profile-menu-icon"
              style={{
                background: "var(--primary-container)",
                color: "var(--on-primary-container)",
              }}
            >
              <span className="material-symbols-outlined">fingerprint</span>
            </div>
            <div>
              <p className="profile-menu-label">Add Passkey / Biometrics</p>
              <p className="profile-menu-desc">
                Sign in with Face ID or Touch ID
              </p>
            </div>
          </div>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--outline-variant)" }}
          >
            add
          </span>
        </button>

        <button
          className="profile-menu-item"
          onClick={() => alert("Privacy controls coming soon!")}
        >
          <div className="profile-menu-left">
            <div
              className="profile-menu-icon"
              style={{
                background: "var(--surface-container-high)",
                color: "var(--on-surface)",
              }}
            >
              <span className="material-symbols-outlined">privacy_tip</span>
            </div>
            <div>
              <p className="profile-menu-label">{t("profile.privacyData")}</p>
              <p className="profile-menu-desc">Auto-delete, data retention</p>
            </div>
          </div>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--outline-variant)" }}
          >
            chevron_right
          </span>
        </button>
      </div>

      {/* Documents Modal/Preview */}
      {showDocuments && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              width: "100%",
              maxHeight: "80vh",
              borderRadius: "16px 16px 0 0",
              padding: "1.5rem",
              maxWidth: "600px",
              margin: "0 auto",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2 style={{ margin: 0 }}>{t("profile.savedDocuments")}</h2>
              <button
                onClick={() => setShowDocuments(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--on-surface)",
                }}
              >
                ✕
              </button>
            </div>

            {loadingDocs ? (
              <p style={{ textAlign: "center", color: "var(--outline)" }}>
                Loading documents...
              </p>
            ) : docs.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--outline)" }}>
                No documents yet. Upload your first document!
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {docs.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "1rem",
                      background: "var(--surface-container)",
                      borderRadius: "8px",
                      gap: "1rem",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "var(--primary)" }}
                    >
                      description
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: "0 0 0.25rem 0",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.original_name}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.875rem",
                          color: "var(--outline)",
                        }}
                      >
                        {doc.doc_type} •{" "}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={safeHref(doc.download_url)}
                      download
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        cursor: "pointer",
                        fontSize: "1.25rem",
                      }}
                    >
                      <span className="material-symbols-outlined">
                        download
                      </span>
                    </a>
                  </div>
                ))}
              </div>
            )}

            {docs.length > 5 && (
              <p
                style={{
                  textAlign: "center",
                  marginTop: "1rem",
                  color: "var(--outline)",
                  fontSize: "0.875rem",
                }}
              >
                +{docs.length - 5} more documents
              </p>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1.5rem" }}
              onClick={() => {
                setShowDocuments(false);
                // Navigate to documents page would go here
                window.location.href = "/documents";
              }}
            >
              View All Documents
            </button>
          </div>
        </div>
      )}

      {/* Language Section */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>
          {t("profile.language")}
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`chip ${lang.code === currentLanguage.code ? "chip-active" : ""}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              {lang.flag} {lang.native}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div style={{ textAlign: "center", paddingBottom: "2rem" }}>
        <button
          style={{
            color: "var(--error)",
            fontWeight: 700,
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
          onClick={logout}
        >
          <span className="material-symbols-outlined">logout</span>
          {t("auth.logout")}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
