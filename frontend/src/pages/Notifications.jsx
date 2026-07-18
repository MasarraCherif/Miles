import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  BellOff,
  CheckCheck,
  Trash2,
  Filter,
  RefreshCw,
} from "lucide-react";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import apiClient from "../services/api.js";
import { authStore } from "../services/auth.js";

const severityMap = {
  critical: { cls: "danger", Icon: AlertTriangle, label: "Critique" },
  danger: { cls: "danger", Icon: AlertTriangle, label: "Critique" },
  warning: { cls: "warning", Icon: AlertCircle, label: "Élevé" },
  success: { cls: "success", Icon: Info, label: "Succès" },
  info: { cls: "info", Icon: Info, label: "Info" },
};

const relativeTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;

  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `Il y a ${Math.floor(diff / 86400)} j`;

  return d.toLocaleDateString("fr-FR");
};

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "danger", label: "Critiques" },
];

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async () => {
    try {
      setError("");
      const res = await apiClient.listNotifications({ limit: 100 });
      setItems(res.data || []);
    } catch (e) {
      setError(e.message || "Impossible de charger les notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const token = authStore.getAccessToken();
    if (!token) return;

    let es;

    try {
      es = new EventSource(
        `http://localhost:5000/api/notifications/stream?_t=${encodeURIComponent(token)}`
      );
    } catch (_) {
      return;
    }

    const onCreated = (e) => {
      try {
        const { notification } = JSON.parse(e.data);
        setItems((prev) => [notification, ...prev]);
      } catch (_) {}
    };

    const onRead = () => refresh();

    es.addEventListener("created", onCreated);
    es.addEventListener("read", onRead);
    es.addEventListener("read_all", onRead);
    es.addEventListener("deleted", onRead);

    es.onerror = () => es && es.close();

    return () => es && es.close();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((n) => !n.read_at);
    if (filter === "danger") {
      return items.filter((n) =>
        ["danger", "critical"].includes((n.severity || "").toLowerCase())
      );
    }
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read_at).length,
    [items]
  );

  const markOne = async (id) => {
    try {
      await apiClient.markRead(id);
            setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n
        )
      );
    } catch (e) {
      setError(e.message || "Impossible de marquer comme lue");
    }
  };

  const markAll = async () => {
    try {await apiClient.markAllRead();
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (e) {
      setError(e.message || "Impossible de tout marquer comme lu");
    }
  };

  const remove = async (id) => {
    try {
      await apiClient.deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e.message || "Impossible de supprimer la notification");
    }
  };

  const handleSendEmail = async (notification) => {
    try {
      const clientEmail = notification.meta?.clientEmail;
      const clientName = notification.meta?.clientName || "Client";
      const amount = notification.amount ?? 0;
      const riskLevel = notification.meta?.riskLevel || "Élevé";

      if (!clientEmail) {
        setError("Aucun email client disponible pour cette notification");
        return;
      }

      await apiClient.sendClientReminder({
        to: clientEmail,
        subject: `Relance dossier client - ${clientName}`,
        clientName,
        amount,
        riskLevel,
        notificationId: notification.id,
      });
    } catch (e) {
      setError(e.message || "Impossible d'envoyer l'email");
    }
  };

  if (loading) {
    return (
      <LoadingSpinner
        title="Chargement des notifications"
        subtitle="Récupération des alertes et événements..."
      />
    );
  }
  return(
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title-pro">Notifications</h1>
          <p className="page-subtitle">
            Suivi des alertes, événements et activités importantes.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={refresh}>
            <RefreshCw size={16} />
            Actualiser
          </button>

          <button className="btn btn-primary" onClick={markAll}>
            <CheckCheck size={16} />
            Tout marquer comme lu
          </button>
        </div>
      </div>

      {error && <ErrorBanner title="Erreur" message={error} />}

      <div className="table-wrap" style={{ padding: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {filtered.length} notification(s) — {unreadCount} non lue(s)
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`btn ${filter === f.key ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFilter(f.key)}
              >
                <Filter size={14} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="table-wrap" style={{ padding: 40, textAlign: "center" }}>
          <BellOff size={42} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h3>Aucune notification</h3>
          <p style={{ color: "#64748b" }}>
            Il n’y a actuellement aucune notification à afficher.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filtered.map((n, index) => {
            const sev = severityMap[(n.severity || "info").toLowerCase()] || severityMap.info;
            const Icon = sev.Icon;

            const clientName = n.meta?.clientName || "Client non renseigné";
            const clientEmail = n.meta?.clientEmail || "";
            const riskLevel = n.meta?.riskLevel || "";
            const daysLate = n.meta?.daysLate ?? null;

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="table-wrap"
                style={{
                  padding: 18,
                  borderLeft: `5px solid ${
                    sev.cls === "danger"
                      ? "#dc2626"
                      : sev.cls === "warning"
                      ? "#f59e0b"
                      : sev.cls === "success"
                      ? "#16a34a"
                      : "#2563eb"
                  }`,
                  opacity: n.read_at ? 0.8 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, flex: 1 }}>
                    <div style={{ marginTop: 4 }}>
                      <Icon size={20} />
                    </div>
                                        <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                          marginBottom: 6
                          ,
                        }}
                      >
                        <strong>{n.title}</strong>
                        <span className={`risk-badge ${sev.cls}`}>{sev.label}</span>
                        {!n.read_at && <span className="risk-badge info">Nouveau</span>}
                      </div>

                      {n.message && (
                        <p style={{ margin: "6px 0", color: "#475569" }}>{n.message}</p>
                      )}

                      <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: 14 }}>
                        <div><strong>Client :</strong> {clientName}</div>
                        {clientEmail && <div><strong>Email :</strong> {clientEmail}</div>}
                        {riskLevel && <div><strong>Niveau de risque :</strong> {riskLevel}</div>}
                        {daysLate !== null && <div><strong>Retard :</strong> {daysLate} jours</div>}
                        {n.amount != null && (
                          <div>
                            <strong>Montant impayé :</strong>{" "}
                            {Number(n.amount).toLocaleString("fr-FR")} TND
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          flexWrap: "wrap",
                          marginTop: 12,
                          fontSize: 13,
                          color: "#64748b",
                        }}
                      >
                        <span>{relativeTime(n.created_at)}</span>
                        {n.type && <span>Type: {n.type}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {clientEmail && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSendEmail(n)}
                      >
                        Envoyer email
                      </button>
                    )}

                    {!n.read_at && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => markOne(n.id)}
                      >
                        <CheckCheck size={16} />
                      </button>
                    )}

                    <button
                      className="btn btn-secondary"
                      onClick={() => remove(n.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
