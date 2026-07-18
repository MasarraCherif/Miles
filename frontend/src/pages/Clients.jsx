import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Edit3, Trash2, X, Users as UsersIcon,
  RefreshCw, Download, Save, AlertTriangle, MapPin, Mail, Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import apiClient from "../services/api.js";
import { formatCurrency } from "../utils/formatters.js";

const EMPTY = {
  customer_id: "",
  nom_client: "",
  email: "",
  telephone: "",
  adresse: "",
  ville: "",
  pays: "TN",
  langue: "fr",
  segment: "Particulier",
};

const initials = (name = "") =>
  name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const riskBadgeClass = (level) => {
  const v = String(level || "").toUpperCase();
  if (v === "CRITIQUE" || v === "HIGH") return "danger";
  if (v === "ÉLEVÉ" || v === "ELEVE") return "warning";
  if (v === "MOYEN") return "info";
  if (v === "BAS" || v === "FAIBLE") return "success";
  return "neutral";
};

export default function Clients() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
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
      const res = await apiClient.listClients({ limit: 200, search });
      setRows(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e.message || "Impossible de charger les clients");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing("new");
    setForm(EMPTY);
  };

  const openEdit = (client) => {
    setEditing(client.customer_id);
    setForm({
      customer_id: client.customer_id || "",
      nom_client: client.nom_client || "",
      email: client.email || "",
      telephone: client.telephone || "",
      adresse: client.adresse || "",
      ville: client.ville || "",
      pays: client.pays || "TN",
      langue: client.langue || "fr",
      segment: client.segment || "Particulier",
    });
  };

  const closePanel = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const save = async () => {
    if (!form.nom_client.trim()) {
      setError("Le nom du client est obligatoire");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        await apiClient.createClient(form);
      } else {
        await apiClient.updateClient(editing, form);
      }
      await load();
      closePanel();
    } catch (e) {
      setError(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setSaving(true);
    setError("");
    try {
      await apiClient.deleteClient(id);
      setConfirmDel(null);
      await load();
    } catch (e) {
      setError(e.message || "Échec de la suppression");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = ["ID", "Nom", "Email", "Tél.", "Ville", "Pays", "Segment", "Total dû", "Nb impayés"];
    const lines = rows.map((c) => [
      c.customer_id, c.nom_client, c.email || "", c.telephone || "",
      c.ville || "", c.pays || "", c.segment || "", c.total_du || 0, c.nb_impayes || 0,
    ]);
    const csv = [headers, ...lines]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalDue = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.total_du || 0), 0),
    [rows]
  );

  if (loading && rows.length === 0)
    return <LoadingSpinner message="Chargement des clients…" />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <span className="page-eyebrow"><UsersIcon size={11} /> Référentiel</span>
          <h1 className="page-title-pro">Clients</h1>
          <p className="page-subtitle">
            <span className="num">{total}</span> client{total > 1 ? "s" : ""}
            <span className="dot-sep" />
            Encours total <b className="num">{formatCurrency(totalDue)}</b>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={14} /> Rafraîchir
          </button>
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Download size={14} /> Exporter
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Nouveau client
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="search" style={{ width: 360 }}>
            <Search size={14} color="var(--text-3)" />
            <input
              placeholder="Rechercher par nom, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Localisation</th>
                <th>Segment</th>
                <th>Encours</th>
                <th>Risque</th>
                <th style={{ width: 96 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state" style={{ border: "none", margin: 0, padding: "32px 16px" }}>
                      <UsersIcon size={28} />
                      <h4>Aucun client</h4>
                      <p>Essayez d'élargir la recherche ou ajoutez un nouveau client.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((c, i) => (
                  <tr key={c.customer_id}>
                    <td>
                      <div className="client-cell">
                        <div className={`client-avatar alt-${(i % 4) + 1}`}>
                          {initials(c.nom_client)}
                        </div>
                        <div>
                          <div className="cell-strong">{c.nom_client}</div>
                          <div className="cell-muted" style={{ fontSize: 12 }}>
                            #{c.customer_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-muted" style={{ display: "grid", gap: 2 }}>
                        {c.email && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Mail size={11} /> {c.email}
                          </span>
                        )}
                        {c.telephone && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Phone size={11} /> {c.telephone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="cell-muted">
                      {(c.ville || c.pays) && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <MapPin size={11} /> {[c.ville, c.pays].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </td>
                    <td><span className="badge neutral">{c.segment || "—"}</span></td>
                    <td className="cell-strong num">{formatCurrency(c.total_du)}</td>
                    <td>
                      <span className={`badge ${riskBadgeClass(c.dernier_risque)}`}>
                        {c.dernier_risque || "—"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button className="row-action" title="Modifier" onClick={() => openEdit(c)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="row-action danger" title="Supprimer" onClick={() => setConfirmDel(c)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIDE PANEL — create / edit */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.div
              className="drawer-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel}
            />
            <motion.aside
              className="drawer"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="drawer-head">
                <h3>{editing === "new" ? "Nouveau client" : "Modifier le client"}</h3>
                <button className="row-action" onClick={closePanel}><X size={16} /></button>
              </div>
              <div className="drawer-body">
                <div className="form-grid">
                  {editing === "new" && (
                    <label className="field">
                      <span>Identifiant</span>
                      <input
                        className="input"
                        placeholder="Auto-généré si vide"
                        value={form.customer_id}
                        onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                      />
                    </label>
                  )}
                  <label className="field span-2">
                    <span>Nom du client *</span>
                    <input
                      className="input"
                      value={form.nom_client}
                      onChange={(e) => setForm({ ...form, nom_client: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      className="input" type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Téléphone</span>
                    <input
                      className="input"
                      value={form.telephone}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    />
                  </label>
                  <label className="field span-2">
                    <span>Adresse</span>
                    <input
                      className="input"
                      value={form.adresse}
                      onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Ville</span>
                    <input
                      className="input"
                      value={form.ville}
                      onChange={(e) => setForm({ ...form, ville: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Pays</span>
                    <input
                      className="input"
                      value={form.pays}
                      onChange={(e) => setForm({ ...form, pays: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Langue</span>
                    <select
                      className="input"
                      value={form.langue}
                      onChange={(e) => setForm({ ...form, langue: e.target.value })}
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Segment</span>
                    <select
                      className="input"
                      value={form.segment}
                      onChange={(e) => setForm({ ...form, segment: e.target.value })}
                    >
                      <option>Particulier</option>
                      <option>PME</option>
                      <option>Grand Compte</option>
                      <option>Public</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="drawer-foot">
                <button className="btn btn-secondary" onClick={closePanel} disabled={saving}>Annuler</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                  <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Confirm delete */}
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
              <h3>Supprimer ce client ?</h3>
              <p>
                <b>{confirmDel.nom_client}</b> sera définitivement supprimé. Cette action est
                irréversible et impossible si le client a des impayés liés.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDel(null)} disabled={saving}>
                  Annuler
                </button>
                <button className="btn btn-danger" onClick={() => remove(confirmDel.customer_id)} disabled={saving}>
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
