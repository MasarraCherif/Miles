import { useEffect, useMemo, useState } from "react";

import { Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import PredictionML from "./pages/PredictionML.jsx";
import StorytellingHybrid from "./pages/StorytellingHybrid";
import { motion } from "framer-motion";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import "chart.js/auto";
import {
  LayoutDashboard,
  AlertTriangle,
  BellRing,
  Sparkles,
  MessageSquare,
  LogOut,
  Search,
  Bell,
  Settings,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Receipt,
  Activity,
  Lightbulb,
  ArrowRight,
  Plus,
  Calendar,
  ChevronDown,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowUpRight,
  Brain,
} from "lucide-react";

import Impayes from "./pages/Impayes.jsx";
import SmartCreditAssessmentChat from "./pages/SmartCreditAssessmentChat.jsx";
import Storytelling from "./pages/Storytelling.jsx";
import Notifications from "./pages/Notifications.jsx";
import Login from "./pages/Login.jsx";
import Clients from "./pages/Clients.jsx";
import UsersPage from "./pages/Users.jsx";
import Sparkline from "./components/Sparkline.jsx";
import CountUp from "./components/CountUp.jsx";
import { authStore, bootstrapSession, logout as authLogout } from "./services/auth.js";
import apiClient from "./services/api.js";
import { API_BASE } from "./config.js";
import "./App.css";

/* ----------------------------------------------------------
   Chart styling
---------------------------------------------------------- */
const baseChartOptions = {
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#475569",
        font: { family: "Inter, sans-serif", size: 12, weight: "500" },
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: "#1c1e23",
      padding: 12,
      titleFont: { family: "Inter, sans-serif", weight: "600" },
      bodyFont: { family: "Inter, sans-serif" },
      cornerRadius: 8,
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(15,23,42,0.05)", drawBorder: false },
      ticks: { color: "#64748b", font: { family: "Inter, sans-serif", size: 11 } },
    },
    y: {
      grid: { color: "rgba(15,23,42,0.05)", drawBorder: false },
      ticks: { color: "#64748b", font: { family: "Inter, sans-serif", size: 11 } },
    },
  },
};

const doughnutOptions = {
  maintainAspectRatio: false,
  cutout: "72%",
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#475569",
        font: { family: "Inter, sans-serif", size: 12 },
        usePointStyle: true,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: "#1c1e23",
      padding: 12,
      cornerRadius: 8,
    },
  },
};

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */
const fmtNumber = (v) => Number(v).toLocaleString("fr-FR");
const fmtCurrency = (v) =>
  Number(v).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};

const todayLabel = () =>
  new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/* ----------------------------------------------------------
   Dashboard skeleton
---------------------------------------------------------- */
function DashboardSkeleton() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div className="skeleton skel-line" style={{ width: 140, marginBottom: 14 }} />
          <div className="skeleton skel-line" style={{ width: 320, height: 20, marginBottom: 10 }} />
          <div className="skeleton skel-line" style={{ width: 240, height: 14 }} />
        </div>
      </div>
      <div className="bento">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="col-3">
            <div className="kpi-pro">
              <div className="head">
                <div className="skeleton skel-line" style={{ width: 120 }} />
                <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 10 }} />
              </div>
              <div className="skeleton skel-line" style={{ width: 140, height: 24, marginTop: 8 }} />
              <div className="skeleton skel-block" style={{ marginTop: 12, height: 44 }} />
            </div>
          </div>
        ))}
        <div className="col-8">
          <div className="card">
            <div className="card-head">
              <div className="skeleton skel-line" style={{ width: 180 }} />
            </div>
            <div className="card-body">
              <div className="skeleton" style={{ height: 280, borderRadius: 10 }} />
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="card-head">
              <div className="skeleton skel-line" style={{ width: 160 }} />
            </div>
            <div className="card-body">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0" }}
                >
                  <div
                    className="skeleton"
                    style={{ width: 38, height: 38, borderRadius: "50%" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skel-line" style={{ width: "70%" }} />
                    <div
                      className="skeleton skel-line"
                      style={{ width: "40%", marginTop: 6, height: 10 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const riskBadge = (lvl) => {
  const v = String(lvl || "").toUpperCase();
  if (v === "CRITIQUE" || v === "HIGH") return "danger";
  if (v === "ÉLEVÉ" || v === "ELEVE")    return "warning";
  if (v === "MOYEN")                     return "info";
  if (v === "BAS" || v === "FAIBLE")     return "success";
  return "neutral";
};

const initialsOf = (s = "") =>
  s.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

const altFor = (i) => ((i % 4) + 1);

const relativeTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR");
};

const formatPct = (v) =>
  `${v >= 0 ? "+" : ""}${Number(v).toFixed(1).replace(".", ",")} %`;

/* ----------------------------------------------------------
   Dashboard
---------------------------------------------------------- */
function DashboardPage({ selectedMonth }) {

  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [topRisk, setTopRisk] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState("6M");
  const [clientName, setClientName] = useState("");
  const [story, setStory] = useState("");
  const [loadingStory, setLoadingStory] = useState(false);
  const [riskClientsByMonth, setRiskClientsByMonth] = useState([]);
const [loadingRiskClients, setLoadingRiskClients] = useState(false);


  const loadAll = async (range = chartRange) => {
    try {
      const [ov, tr, dist, top, act] = await Promise.all([
        apiClient.getOverview().catch(() => null),
        apiClient.getTrend(range).catch(() => null),
        apiClient.getDistribution().catch(() => null),
        apiClient.getTopRisk(5).catch(() => ({ data: [] })),
        apiClient.getActivity(6).catch(() => ({ data: [] })),
      ]);
      setOverview(ov || { total_impayes: 0, nombre_impayes: 0, nombre_clients: 0, montant_moyen: 0, deltas: { montant: 0, nombre: 0 } });
      setTrend(tr);
      setDistribution(dist);
      setTopRisk(top?.data || []);
      setActivity(act?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (!loading) apiClient.getTrend(chartRange).then(setTrend).catch(() => {});
  }, [chartRange, loading]);
  const loadRiskClientsByMonth = async (month) => {
  try {
    setLoadingRiskClients(true);
    const res = await apiClient.getRiskClientsByMonth(month);
    setRiskClientsByMonth(res.data || []);
  } catch (error) {
    console.error("Erreur chargement clients à risque par mois:", error);
    setRiskClientsByMonth([]);
  } finally {
    setLoadingRiskClients(false);
  }
};
useEffect(() => {
  if (selectedMonth) {
    loadRiskClientsByMonth(selectedMonth);
  }
}, [selectedMonth]);


  const generateStory = async () => {
    if (!clientName.trim()) return;
    setLoadingStory(true);
    setStory("");
    try {
      const res = await fetch(
        `${API_BASE}/storytelling/${encodeURIComponent(clientName)}`
      );
      const data = await res.json();
      setStory(data.storytelling || "Aucun storytelling trouvé.");
    } catch {
      setStory(
        "Backend indisponible — exemple : Le client Atlas Trading présente un risque CRITIQUE avec 3 échéances impayées sur 6 mois. Stratégie de relance graduelle recommandée."
      );
    } finally {
      setLoadingStory(false);
    }
  };

  if (loading || !overview) return <DashboardSkeleton />;

  const totals = trend?.totals || [];
  const counts = trend?.counts || [];

  // Build sparkline arrays from real series (last N points)
  const tail = (arr, n) => (arr && arr.length ? arr.slice(-n) : []);
  const sparkTotal   = tail(totals, 8);
  const sparkCount   = tail(counts, 8);

  const deltaMontant = overview.deltas?.montant ?? 0;
  const deltaNombre  = overview.deltas?.nombre ?? 0;

  const kpis = [
    {
      title: "Total impayés",
      raw: overview.total_impayes,
      format: fmtCurrency,
      icon: <Wallet size={15} />,
      iconClass: "danger",
      delta: formatPct(deltaMontant),
      deltaDir: deltaMontant === 0 ? "flat" : deltaMontant > 0 ? "up" : "down",
      deltaIsPositive: deltaMontant <= 0,
      sparkData: sparkTotal.length ? sparkTotal : [1, 1, 1],
      sparkColor: "#ef4444",
      foot: "vs mois dernier",
    },
    {
      title: "Nombre d'impayés",
      raw: overview.nombre_impayes,
      format: (v) => fmtNumber(Math.round(v)),
      icon: <Receipt size={15} />,
      iconClass: "warn",
      delta: formatPct(deltaNombre),
      deltaDir: deltaNombre === 0 ? "flat" : deltaNombre > 0 ? "up" : "down",
      deltaIsPositive: deltaNombre <= 0,
      sparkData: sparkCount.length ? sparkCount : [1, 1, 1],
      sparkColor: "#c9a233",
      foot: "ce mois",
    },
    {
      title: "Clients concernés",
      raw: overview.nombre_clients,
      format: (v) => fmtNumber(Math.round(v)),
      icon: <Users size={15} />,
      iconClass: "info",
      delta: "—",
      deltaDir: "flat",
      deltaIsPositive: true,
      sparkData: sparkCount.length ? sparkCount : [1, 1, 1],
      sparkColor: "#3b82f6",
      foot: "encours actifs",
    },
    {
      title: "Taux recouvrement",
      raw: overview.taux_recouvrement ?? 0,
      format: (v) => `${Number(v).toFixed(1).replace(".", ",")} %`,
      icon: <Activity size={15} />,
      iconClass: "ok",
      delta: "Cumul",
      deltaDir: "flat",
      deltaIsPositive: true,
      sparkData: sparkTotal.length ? sparkTotal : [1, 1, 1],
      sparkColor: "#8fb339",
      foot: "depuis l'origine",
    },
  ];

  const MONTH_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const labels = (trend?.labels || []).map((mk) => {
    const [, m] = mk.split("-");
    return MONTH_FR[Number(m) - 1] || mk;
  });

  const lineData = {
    labels: labels.length ? labels : ["—"],
    datasets: [
      {
        label: "Évolution des impayés",
        data: totals.length ? totals : [0],
        borderColor: "#8fb339",
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(143,179,57,0.15)";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(143,179,57,0.32)");
          g.addColorStop(1, "rgba(143,179,57,0)");
          return g;
        },
        tension: 0.4,
        fill: true,
        borderWidth: 2.5,
        pointBackgroundColor: "#8fb339",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const distRisk = distribution?.risk || [];
  const distStatus = distribution?.status || [];
  const riskColors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#94a3b8"];

  const barData = {
    labels: distRisk.length ? distRisk.map((r) => r.niveau) : ["—"],
    datasets: [
      {
        label: "Encours par niveau de risque",
        data: distRisk.length ? distRisk.map((r) => r.total) : [0],
        backgroundColor: distRisk.length
          ? distRisk.map((_, i) => riskColors[i % riskColors.length])
          : ["#cbd5e1"],
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 50,
      },
    ],
  };

  const doughnutData = {
    labels: distStatus.length ? distStatus.map((s) => s.statut) : ["—"],
    datasets: [
      {
        data: distStatus.length ? distStatus.map((s) => Number(s.total)) : [1],
        backgroundColor: distStatus.length
          ? distStatus.map((s, i) =>
              s.statut === "PAYÉ" ? "#8fb339"
              : s.statut === "PARTIELLEMENT_PAYÉ" ? "#f59e0b"
              : "#ef4444"
            )
          : ["#cbd5e1"],
        borderColor: "#ffffff",
        borderWidth: 3,
      },
    ],
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">
            <Sparkles size={11} /> Vue d'ensemble
          </span>
          <h1 className="page-title-pro">
            {greeting()}, bienvenue.
          </h1>
          <p className="page-subtitle">
            <span style={{ textTransform: "capitalize" }}>{todayLabel()}</span>
            <span className="dot-sep" />
            Indicateurs clés mis à jour il y a 2 minutes.
          </p>
        </div>
      </div>

      {/* ROW 1 — KPIs */}
      <div className="bento">
        {kpis.map((k, i) => {
          const TrendIcon = k.deltaDir === "up" ? TrendingUp : k.deltaDir === "down" ? TrendingDown : Activity;
          const deltaClass =
            k.deltaDir === "flat"
              ? "flat"
              : k.deltaIsPositive
              ? "up"
              : "down";
          return (
            <motion.div
              key={i}
              className="col-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
            >
              <div className="kpi-pro">
                <div className="head">
                  <p className="label">{k.title}</p>
                  <div className={`pill-icon ${k.iconClass}`}>{k.icon}</div>
                </div>
                <div className="value-row">
                  <span className="value num">
                    <CountUp value={k.raw} format={k.format} />
                  </span>
                  <span className={`delta ${deltaClass}`}>
                    <TrendIcon size={11} />
                    {k.delta}
                  </span>
                </div>
                <div className="footnote">{k.foot}</div>
                <div className="spark">
                  <Sparkline data={k.sparkData} color={k.sparkColor} height={44} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ROW 2 — main chart + top-risk */}
      <div className="bento">
        <motion.div
          className="col-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="card">
            <div className="card-head">
              <h3>
                <TrendingUp size={15} /> Évolution des impayés
              </h3>
              <div className="segmented">
                {["3M", "6M", "12M"].map((r) => (
                  <button
                    key={r}
                    className={chartRange === r ? "active" : ""}
                    onClick={() => setChartRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              <div style={{ height: 280 }}>
                <Line data={lineData} options={baseChartOptions} />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="col-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <div className="card">
            <div className="card-head">
              <h3>
                <AlertTriangle size={15} /> Top clients à risque
              </h3>
              <Link
                to="/impayes"
                className="meta"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--brand-700)" }}
              >
                Voir tout <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="card-body" style={{ paddingTop: 6, paddingBottom: 10 }}>
              {topRisk.length === 0 ? (
                <div style={{ padding: "24px 4px", color: "var(--text-3)", fontSize: 13 }}>
                  Aucun client à risque pour le moment.
                </div>
              ) : (
                <div className="risk-list">
                  {topRisk.map((c, i) => (
                    <div className="risk-row" key={c.customer_id || i}>
                      <div className={`client-avatar lg alt-${altFor(i)}`}>{initialsOf(c.nom_client)}</div>
                      <div style={{ minWidth: 0 }}>
                        <p className="name">{c.nom_client || "—"}</p>
                        <p className="sub">
                          {c.dernier_contrat ? `CTR-${c.dernier_contrat}` : `#${c.customer_id || "—"}`}
                          <span className="dot-sep" />
                          <span className={`badge ${riskBadge(c.niveau_risque)}`} style={{ padding: "1px 8px", fontSize: 10.5 }}>
                            {c.niveau_risque || "—"}
                          </span>
                        </p>
                      </div>
                      <div>
                        <div className="amount num">{fmtCurrency(c.total_du)}</div>
                        <div className="amount-sub">{c.nb_impayes} impayé{c.nb_impayes > 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ROW 3 — insight banner */}
      <motion.div
        className="insight-box"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
      >
        <div className="insight-icon">
          <Lightbulb size={20} />
        </div>
        <div className="insight-body">
          <strong>Insight IA</strong>
          <p>
            {deltaMontant > 0 ? (
              <>
                Le portefeuille présente une pression <b>croissante</b> ({formatPct(deltaMontant)} MoM).{" "}
                Une relance ciblée des dossiers <b>CRITIQUES</b> permettrait de récupérer
                jusqu'à <b>{fmtCurrency((overview.total_impayes || 0) * 0.03)}</b> sur les 30 prochains jours.
              </>
            ) : (
              <>
                Bon momentum : encours en <b>baisse</b> ({formatPct(deltaMontant)} MoM).{" "}
                Maintenez la cadence de relance sur les segments <b>ÉLEVÉ</b> pour consolider la tendance.
              </>
            )}
          </p>
        </div>
        <Link
          to="/impayes"
          className="btn"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          Voir les dossiers <ArrowRight size={13} />
        </Link>
      </motion.div>
<motion.div
  className="card"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.28 }}
  style={{ marginTop: 20 }}
>
  <div className="card-head">
    <h3>Clients à risque du mois sélectionné</h3>
    <span className="meta">{selectedMonth}</span>
  </div>

  <div className="card-body">
    {loadingRiskClients ? (
      <p>Chargement des clients à risque...</p>
    ) : riskClientsByMonth.length === 0 ? (
      <p>Aucun client à risque pour cette période.</p>
    ) : (
      <div className="risk-list">
        {riskClientsByMonth.map((client, i) => (
          <div className="risk-row" key={client.customer_id || i}>
            <div className={`client-avatar lg alt-${altFor(i)}`}>
              {initialsOf(client.nom_client)}
            </div>

            <div style={{ minWidth: 0 }}>
              <p className="name">{client.nom_client || "—"}</p>
              <p className="sub">
                {client.email || "Email non renseigné"}
                <span className="dot-sep" />
                <span className={`badge ${riskBadge(client.niveau_risque)}`}>
                  {client.niveau_risque || "—"}
                </span>
              </p>
            </div>

            <div>
              <div className="amount num">{fmtCurrency(client.montant_impaye)}</div>
              <div className="amount-sub">
                {client.nb_jours_retard} jours de retard · {client.nb_dossiers} dossier(s)
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</motion.div>

      {/* ROW 4 — bar + activity */}
      <div className="bento">
        <motion.div
          className="col-7"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="card">
            <div className="card-head">
              <h3>Répartition générale</h3>
              <span className="meta">Période en cours</span>
            </div>
            <div className="card-body">
              <div style={{ height: 250 }}>
                <Bar data={barData} options={baseChartOptions} />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="col-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
        >
          <div className="card">
            <div className="card-head">
              <h3>
                <Activity size={15} /> Activité récente
              </h3>
              <span className="meta">5 derniers événements</span>
            </div>
            <div className="card-body" style={{ paddingTop: 4, paddingBottom: 10 }}>
              {activity.length === 0 ? (
                <div style={{ padding: "24px 4px", color: "var(--text-3)", fontSize: 13 }}>
                  Aucune activité récente.
                </div>
              ) : (
                <div className="timeline">
                  {activity.map((a) => {
                    const type =
                      a.statut_paiement === "PAYÉ" ? "success"
                      : a.statut_paiement === "PARTIELLEMENT_PAYÉ" ? "warn"
                      : "danger";
                    const Icon =
                      type === "success" ? CheckCircle2
                      : type === "warn" ? AlertCircle
                      : XCircle;
                    return (
                      <div className="timeline-item" key={a.impaye_id}>
                        <div className={`timeline-icon ${type}`}>
                          <Icon size={16} />
                        </div>
                        <div className="timeline-content">
                          <p className="timeline-title">
                            {a.statut_paiement === "PAYÉ" ? "Paiement reçu"
                              : a.statut_paiement === "PARTIELLEMENT_PAYÉ" ? "Paiement partiel"
                              : "Impayé enregistré"}
                          </p>
                          <p className="timeline-desc">
                            {a.nom_client || "—"} — {fmtCurrency(a.montant_impaye)}
                            {a.niveau_risque && ` · ${a.niveau_risque}`}
                          </p>
                          <p className="timeline-meta">{relativeTime(a.date_constat)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ROW 5 — doughnut + storytelling form */}
      <div className="bento">
        <motion.div
          className="col-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
        >
          <div className="card">
            <div className="card-head">
              <h3>Part impayé / payé</h3>
            </div>
            <div className="card-body">
              <div style={{ height: 250 }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="col-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="card">
            <div className="card-head">
              <h3>
                <Sparkles size={15} /> Storytelling client
              </h3>
              <span className="meta">Propulsé par Groq AI</span>
            </div>
            <div className="card-body">
              <div className="story-form">
                <input
                  placeholder="Saisir le nom du client…"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generateStory()}
                />
                <button
                  className="btn btn-primary"
                  onClick={generateStory}
                  disabled={loadingStory || !clientName.trim()}
                >
                  {loadingStory ? "Génération…" : "Générer"}
                  {!loadingStory && <ArrowRight size={14} />}
                </button>
              </div>
              {loadingStory && (
                <div className="typing-dots" style={{ marginTop: 12 }}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              {story && <div className="story-result">{story}</div>}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   Sidebar nav config (grouped)
---------------------------------------------------------- */
const NAV_GROUPS = [
  {
    title: "Aperçu",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Opérations",
    items: [
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/impayes", label: "Impayés", icon: AlertTriangle },
      { to: "/notifications", label: "Notifications", icon: BellRing },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: "/storytelling", label: "Storytelling", icon: Sparkles },
      { to: "/smart-credit-assessment", label: "Assistant crédit", icon: MessageSquare },
      { to: "/prediction-ml", label: "Prédiction ML", icon: Brain },
      { to: "/storytelling-hybrid", label: "Storytelling IA Hybride", icon: Sparkles },
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    items: [{ to: "/users", label: "Utilisateurs", icon: Settings }],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

function getPageTitle(pathname) {
  const item = ALL_NAV.find((n) => n.to === pathname);
  return item ? item.label : "Dashboard";
}

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  const refresh = async () => {
    try {
      const res = await apiClient.listNotifications({ limit: 8 });
      setItems(res.data || []);
      setUnread(res.unread || 0);
    } catch (_) {}
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, []);

  // Live updates via SSE
  useEffect(() => {
    const token = authStore.getAccessToken();
    if (!token) return;
    let es;
    try {
      es = new EventSource(
        `${API_BASE}/notifications/stream?_t=${encodeURIComponent(token)}`
      );
    } catch (_) { return; }
    const onAny = () => refresh();
    es.addEventListener("created", onAny);
    es.addEventListener("read", onAny);
    es.addEventListener("read_all", onAny);
    es.addEventListener("deleted", onAny);
    es.onerror = () => es && es.close();
    return () => es && es.close();
  }, []);

  const markOne = async (id) => {
    try { await apiClient.markRead(id); refresh(); } catch (_) {}
  };

  return (
    <div className="notif-bell-wrap">
      <button
        className="icon-btn"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {unread > 0 && <span className="badge-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <>
          <div className="notif-pop-back" onClick={() => setOpen(false)} />
          <div className="notif-pop">
            <div className="notif-pop-head">
              <strong>Notifications</strong>
              <span className="meta">{unread} non lue{unread > 1 ? "s" : ""}</span>
            </div>
            <div className="notif-pop-body">
              {items.length === 0 ? (
                <div style={{ padding: 24, color: "var(--text-3)", textAlign: "center" }}>
                  Aucune notification
                </div>
              ) : (
                items.map((n) => (
                  <div                    key={n.id}
                    className={`notif-pop-item ${!n.read_at ? "is-unread" : ""}`}
                    onClick={() => markOne(n.id)}
                  >
                    <div className={`notif-pop-dot ${n.severity || "info"}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-pop-title">{n.title}</div>
                      {n.message && <div className="notif-pop-msg">{n.message}</div>}
                      <div className="notif-pop-time">{relativeTime(n.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="notif-pop-foot">
              <button
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => { setOpen(false); navigate("/notifications"); }}
              >
                Voir toutes les notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getUserDisplay(u) {
  if (!u) return { name: "Utilisateur", email: "", initials: "U" };
  const name = [u.prenom, u.nom].filter(Boolean).join(" ") || u.email || "Utilisateur";
  const email = u.email || "";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { name, email, initials };
}

function AppLayout({ onLogout, sessionUser }) {
  const [globalSearch, setGlobalSearch] = useState("");

 const [selectedMonth, setSelectedMonth] = useState("2026-04");


  const location = useLocation();
  const navigate = useNavigate();


  const user = getUserDisplay(sessionUser);
  const isAdmin = sessionUser?.role === "admin";
  const navGroups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">M</div>
          <div className="brand-name">
            <h2>MILES</h2>
            <span>Smart Recovery</span>
          </div>
        </div>

        <button className="cmdk-hint" type="button">
          <Search size={13} />
          <span>Rechercher…</span>
          <span className="kbd">⌘K</span>
        </button>

        {navGroups.map((group) => (
          <div className="nav-section" key={group.title}>
            <p className="nav-section-title">{group.title}</p>
            <nav className="sidebar-nav">
              {group.items.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link key={to} to={to} className={`nav-link ${active ? "active" : ""}`}>
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{user.initials}</div>
            <div className="user-meta">
              <strong>{user.name}</strong>
              <span>{user.email || "Connecté"}</span>
            </div>
          </div>
          <button onClick={onLogout} className="logout-btn">
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumbs">
            <span>MILES</span>
            <span className="sep">/</span>
            <strong>{getPageTitle(location.pathname)}</strong>
          </div>
          <div className="topbar-right">
           <select
  className="period-chip"
  value={selectedMonth}
  onChange={(e) => setSelectedMonth(e.target.value)}
>
  <option value="2026-01">Jan 2026</option>
  <option value="2026-02">Fév 2026</option>
  <option value="2026-03">Mar 2026</option>
  <option value="2026-04">Avr 2026</option>
  <option value="2026-05">Mai 2026</option>
  <option value="2026-06">Juin 2026</option>
</select>

          <div className="search">
  <Search size={14} color="var(--text-3)" />
  <input
    placeholder="Rechercher client, contrat…"
    value={globalSearch}
    onChange={(e) => setGlobalSearch(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        navigate("/impayes");
      }
    }}
  />
  <span className="kbd">⌘K</span>
</div>

            <NotificationBell />
            {isAdmin && (
              <button className="icon-btn" title="Administration" onClick={() => navigate("/users")}>
                <Settings size={16} />
              </button>
            )}
           <button
  className="btn btn-primary"
  style={{ height: 36 }}
  onClick={() => navigate("/impayes")}
>
  <Plus size={14} /> Nouveau dossier
</button>
          </div>
        </header>

        <Routes>
          {/* Redirection directe vers StorytellingHybrid */}
          <Route path="/" element={<Navigate to="/storytelling-hybrid" replace />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/impayes" element={<Impayes />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/storytelling" element={<Storytelling />} />
          <Route path="/smart-credit-assessment" element={<SmartCreditAssessmentChat />} />
          <Route path="/prediction-ml" element={<PredictionML />} />
          <Route path="/storytelling-hybrid" element={<StorytellingHybrid />} />
          {isAdmin && <Route path="/users" element={<UsersPage />} />}
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(authStore.getUser());
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const unsub = authStore.subscribe(({ user }) => setUser(user));
    bootstrapSession().finally(() => setBooted(true));
    return unsub;
  }, []);

  const handleLoginSuccess = () => setUser(authStore.getUser());
  const handleLogout = async () => {
    await authLogout();
    setUser(null);
  };

  if (!booted) return <div className="loading-screen">Initialisation…</div>;

  if (!user) return <Login onLoginSuccess={handleLoginSuccess} />;

  return <AppLayout onLogout={handleLogout} sessionUser={user} />;
}

export default App;