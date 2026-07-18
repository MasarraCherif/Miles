import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Edit3, Trash2, X, Shield, ShieldCheck, Save,
  AlertTriangle, RefreshCw, KeyRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import apiClient from "../services/api.js";
import { authStore } from "../services/auth.js";

const EMPTY = {
  nom: "",
  prenom: "",
  email: "",
  mot_de_passe: "",
  role: "agent",
  statut: "actif",
};

const ROLE_LABEL = {
  admin:   { cls: "danger",  label: "Admin",   Icon: ShieldCheck },
  manager: { cls: "warning", label: "Manager", Icon: Shield },
  agent:   { cls: "info",    label: "Agent",   Icon: Shield },
  viewer:  { cls: "neutral", label: "Viewer",  Icon: Shield },
};

const initials = (u) => {
  const s = `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email || "?";
  return s.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
};

export default function Users() {
  const me = authStore.getUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiClient.listUsers();
      setUsers(res.data || []);
    } catch (e) {
      setError(e.message || "Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.nom, u.prenom, u.email, u.role].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [users, search]);

  const openCreate = () => { setEditing("new"); setForm(EMPTY); };
  const openEdit = (u) => {
    setEditing(u.id);
    setForm({
      nom: u.nom || "",
      prenom: u.prenom || "",
      email: u.email || "",
      mot_de_passe: "",
      role: u.role || "agent",
      statut: u.statut || "actif",
    });
  };
  const close = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        if (!form.mot_de_passe || form.mot_de_passe.length < 8)
          throw new Error("Mot de passe ≥ 8 caractères requis");
        await apiClient.createUser(form);
      } else {
        const patch = { ...form };
        if (!patch.mot_de_passe) delete patch.mot_de_passe;
        await apiClient.updateUser(editing, patch);
      }
      await load();
      close();
    } catch (e) {
      setError(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setSaving(true);
    try {
      await apiClient.deleteUser(id);
      setConfirmDel(null);
      await load();
    } catch (e) {
      setError(e.message || "Échec de la suppression");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Chargement des utilisateurs…" />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <span className="page-eyebrow"><ShieldCheck size={11} /> Administration</span>
          <h1 className="page-title-pro">Utilisateurs</h1>
          <p className="page-subtitle">
            <span className="num">{users.length}</span> utilisateur{users.length > 1 ? "s" : ""}
            <span className="dot-sep" />
            {users.filter((u) => u.statut === "actif").length} actif{users.filter((u) => u.statut === "actif").length > 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} /> Rafraîchir
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Nouvel utilisateur
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="search" style={{ width: 360 }}>
            <Search size={14} color="var(--text-3)" />
            <input
              placeholder="Rechercher un utilisateur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>MFA</th>
                <th>Créé le</th>
                <th style={{ width: 96 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const role = ROLE_LABEL[u.role] || ROLE_LABEL.agent;
                const RoleIcon = role.Icon;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="client-cell">
                        <div className={`client-avatar alt-${(i % 4) + 1}`}>{initials(u)}</div>
                        <div>
                          <div className="cell-strong">
                            {[u.prenom, u.nom].filter(Boolean).join(" ") || "—"}
                            {me?.id === u.id && (
                              <span className="badge info" style={{ marginLeft: 8 }}>Moi</span>
                            )}
                          </div>
                          <div className="cell-muted" style={{ fontSize: 12 }}>ID #{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="cell-muted">{u.email}</td>
                    <td>
                      <span className={`badge ${role.cls}`}>
                        <RoleIcon size={10} /> {role.label}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.statut === "actif" ? "success" : "neutral"}`}>
                        {u.statut}
                      </span>
                    </td>
                    <td className="cell-muted">
                      {u.mfa_totp_enabled ? "TOTP" : u.mfa_email_enabled ? "Email" : "—"}
                    </td>
                    <td className="cell-muted num">
                      {u.date_creation ? new Date(u.date_creation).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button className="row-action" title="Modifier" onClick={() => openEdit(u)}>
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="row-action danger"
                          title="Désactiver"
                          onClick={() => setConfirmDel(u)}
                          disabled={me?.id === u.id}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <>
            <motion.div
              className="drawer-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.aside
              className="drawer"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="drawer-head">
                <h3>{editing === "new" ? "Nouvel utilisateur" : "Modifier l'utilisateur"}</h3>
                <button className="row-action" onClick={close}><X size={16} /></button>
              </div>
              <div className="drawer-body">
                <div className="form-grid">
                  <label className="field">
                    <span>Prénom *</span>
                    <input
                      className="input"
                      value={form.prenom}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Nom *</span>
                    <input
                      className="input"
                      value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    />
                  </label>
                  <label className="field span-2">
                    <span>Email *</span>
                    <input
                      className="input" type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                  <label className="field span-2">
                    <span>
                      <KeyRound size={11} /> {editing === "new" ? "Mot de passe *" : "Nouveau mot de passe (optionnel)"}
                    </span>
                    <input
                      className="input" type="password"
                      placeholder={editing === "new" ? "Min. 8 caractères" : "Laisser vide pour ne pas changer"}
                      value={form.mot_de_passe}
                      onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Rôle</span>
                    <select
                      className="input"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Statut</span>
                    <select
                      className="input"
                      value={form.statut}
                      onChange={(e) => setForm({ ...form, statut: e.target.value })}
                    >
                      <option value="actif">Actif</option>
                      <option value="inactif">Inactif</option>
                      <option value="suspendu">Suspendu</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="drawer-foot">
                <button className="btn btn-secondary" onClick={close} disabled={saving}>Annuler</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDel && (
          <>
            <motion.div
              className="drawer-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmDel(null)}
            />
            <motion.div
              className="modal-card"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            >
              <div className="modal-icon danger"><AlertTriangle size={20} /></div>
              <h3>Désactiver cet utilisateur ?</h3>
              <p>
                <b>{[confirmDel.prenom, confirmDel.nom].filter(Boolean).join(" ") || confirmDel.email}</b>{" "}
                ne pourra plus se connecter. L'historique est conservé.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDel(null)} disabled={saving}>
                  Annuler
                </button>
                <button className="btn btn-danger" onClick={() => remove(confirmDel.id)} disabled={saving}>
                  <Trash2 size={14} /> Désactiver
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
