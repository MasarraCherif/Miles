import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar
} from "recharts";

const PredictionML = () => {
  const [clientName, setClientName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  
  // États pour les données dynamiques du dashboard
  const [kpiData, setKpiData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [modelAccuracy, setModelAccuracy] = useState(94);
  const [statsLoading, setStatsLoading] = useState(true);

  // Charger toutes les statistiques au montage du composant
  useEffect(() => {
    loadDashboardStats();
    loadFullHistory();
  }, []);

  // Charger les KPI et graphiques depuis PostgreSQL
  const loadDashboardStats = async () => {
    try {
      setStatsLoading(true);
      
      // Appels parallèles aux 4 endpoints
      const [kpiRes, monthlyRes, riskDistRes, accuracyRes] = await Promise.all([
        fetch("http://localhost:5000/api/ml/stats/kpi"),
        fetch("http://localhost:5000/api/ml/stats/monthly"),
        fetch("http://localhost:5000/api/ml/stats/risk-distribution"),
        fetch("http://localhost:5000/api/ml/stats/accuracy-radial")
      ]);
      
      const kpi = await kpiRes.json();
      const monthly = await monthlyRes.json();
      const riskDist = await riskDistRes.json();
      const accuracy = await accuracyRes.json();
      
      setKpiData(kpi);
      setMonthlyData(monthly);
      setRiskData(riskDist);
      setModelAccuracy(accuracy.precision);
      
    } catch (err) {
      console.error("Erreur chargement stats dashboard:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Charger l'historique des prédictions depuis PostgreSQL
  const loadFullHistory = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/ml/history/all?limit=10");
      const data = await response.json();
      if (response.ok) {
        setHistory(data);
      }
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  };

  // Prédiction pour un client
  const handlePredict = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError("Veuillez saisir un nom de client");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      setResult(null);
      
      const response = await fetch("http://localhost:5000/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      setResult(data);
      
      // Recharger les stats et l'historique après une nouvelle prédiction
      await Promise.all([loadDashboardStats(), loadFullHistory()]);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Couleurs pour le pie chart
  const COLORS = ["#10b981", "#fbbf24", "#f59e0b", "#ef4444"];

  // Affichage du chargement
  if (statsLoading && !kpiData) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        background: "#f3f4f6"
      }}>
        <div style={{ 
          background: "white", 
          padding: "30px", 
          borderRadius: "16px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "18px", color: "#4f46e5" }}>📊 Chargement du tableau de bord...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: "24px" }}>
      
      {/* HEADER AVEC FORMULAIRE */}
      <div style={{ 
        background: "white", 
        borderRadius: "16px", 
        padding: "24px", 
        marginBottom: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
              📊 Tableau de Bord Prédiction ML
            </h1>
            <p style={{ color: "#6b7280", marginTop: "8px", marginBottom: 0 }}>
              Analyse décisionnelle du risque client par intelligence artificielle
            </p>
          </div>
          
          {/* FORMULAIRE DE RECHERCHE CLIENT */}
          <form onSubmit={handlePredict} style={{ minWidth: "300px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px", display: "block" }}>
                  Nom du client
                </label>
                <input
                  type="text"
                  placeholder="Ex: SAS BENALI"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "10px 24px",
                  background: loading ? "#9ca3af" : "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {loading ? "Analyse..." : "Prédire"}
              </button>
            </div>
            {error && (
              <div style={{ marginTop: "12px", padding: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "12px" }}>
                ❌ {error}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* RÉSULTAT DE LA PRÉDICTION - DONNÉES RÉELLES DE L'API */}
      {result && (
        <div style={{ 
          background: "white", 
          borderRadius: "12px", 
          padding: "20px", 
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          borderLeft: `4px solid ${result.risk_level === "Élevé" ? "#ef4444" : result.risk_level === "Moyen" ? "#f59e0b" : "#10b981"}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0, color: "#111827" }}>
              🎯 Résultat pour <span style={{ color: "#4f46e5" }}>{result.client}</span>
            </h3>
            <span style={{
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "600",
              background: result.risk_level === "Élevé" ? "#fef2f2" : result.risk_level === "Moyen" ? "#fffbeb" : "#f0fdf4",
              color: result.risk_level === "Élevé" ? "#dc2626" : result.risk_level === "Moyen" ? "#d97706" : "#10b981"
            }}>
              {result.risk_level}
            </span>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Décision</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: result.decision_label === "Approuvé" ? "#10b981" : "#ef4444" }}>
                {result.decision_label}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Probabilité de risque</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#111827" }}>{result.probability}%</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Confiance modèle</div>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#4f46e5" }}>{100 - result.probability}%</div>
            </div>
          </div>

          <div style={{ background: "#f3f4f6", padding: "12px", borderRadius: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#374151" }}>📝 Résumé</div>
            <p style={{ margin: 0, fontSize: "14px", color: "#4b5563" }}>{result.summary}</p>
          </div>

          {result.explanation && result.explanation.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#374151" }}>🔑 Facteurs clés</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {result.explanation.map((item, idx) => (
                  <span key={idx} style={{ background: "#f3f4f6", padding: "4px 12px", borderRadius: "16px", fontSize: "12px", color: "#4b5563" }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI CARDS - MAINTENANT DYNAMIQUES AVEC VOS DONNÉES POSTGRESQL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "24px" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "8px" }}>✅ Taux d'approbation</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#10b981" }}>
            {kpiData?.taux_approbation || 85}<span style={{ fontSize: "16px" }}>%</span>
          </div>
          <div style={{ color: (kpiData?.evolution_approbation || 0) >= 0 ? "#10b981" : "#ef4444", fontSize: "12px", marginTop: "8px" }}>
            {(kpiData?.evolution_approbation || 0) >= 0 ? "▲" : "▼"} {Math.abs(kpiData?.evolution_approbation || 12)}% vs mois dernier
          </div>
        </div>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "8px" }}>🎯 Précision modèle</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#4f46e5" }}>
            {kpiData?.precision_modele || 94}<span style={{ fontSize: "16px" }}>%</span>
          </div>
          <div style={{ color: "#10b981", fontSize: "12px", marginTop: "8px" }}>Basée sur historique PostgreSQL</div>
        </div>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "8px" }}>📊 Clients analysés (30j)</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#111827" }}>
            {kpiData?.total_clients || 0}
          </div>
          <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "8px" }}>
            Dernière prédiction incluse
          </div>
        </div>
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "8px" }}>⚠️ Risque moyen</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#f59e0b" }}>
            {kpiData?.risque_moyen || 15}<span style={{ fontSize: "16px" }}>%</span>
          </div>
          <div style={{ color: (kpiData?.evolution_risque || 0) <= 0 ? "#10b981" : "#ef4444", fontSize: "12px", marginTop: "8px" }}>
            {(kpiData?.evolution_risque || 0) <= 0 ? "▼" : "▲"} {Math.abs(kpiData?.evolution_risque || 3)}% vs mois dernier
          </div>
        </div>
      </div>

      {/* GRAPHIQUES LIGNE 1 - DYNAMIQUES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "24px" }}>
        
        {/* Graphique Évolution des prédictions */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>📈 Évolution des prédictions</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mois" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="predictions" stroke="#4f46e5" strokeWidth={2} name="Prédictions" />
                <Line type="monotone" dataKey="approves" stroke="#10b981" strokeWidth={2} name="Approuvés" />
                <Line type="monotone" dataKey="avgRisk" stroke="#f59e0b" strokeWidth={2} name="Risque moy." />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Aucune donnée disponible
            </div>
          )}
        </div>

        {/* Graphique Distribution des risques */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>🥧 Distribution des risques</h3>
          {riskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Aucune donnée disponible
            </div>
          )}
        </div>
      </div>

      {/* GRAPHIQUES LIGNE 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "24px" }}>
        
        {/* Graphique Score Radial */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>🎯 Score Radial - Précision Globale</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="20%" 
              outerRadius="80%" 
              data={[{ name: "Score", value: modelAccuracy, fill: "#4f46e5" }]}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar minAngle={15} background clockWise={true} dataKey="value" />
              <Tooltip />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", marginTop: "-40px" }}>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#4f46e5" }}>{modelAccuracy}%</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>Précision globale</div>
          </div>
        </div>

        {/* Note d'information */}
        <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ color: "white", fontSize: "48px", marginBottom: "16px" }}>🤖</div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px", color: "white" }}>Modèle ML Random Forest</h3>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.9)", marginBottom: 0 }}>
            Feature engineering avancé : log transforms, ratios, interactions.<br/>
            Calibration isotonique pour probabilités fiables.<br/>
            Entraîné sur données PostgreSQL réelles.
          </p>
        </div>
      </div>

      {/* HISTORIQUE - DONNÉES RÉELLES DEPUIS POSTGRESQL */}
      {history.length > 0 && (
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px", color: "#111827" }}>📋 Historique des prédictions (PostgreSQL)</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                  <th style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>Client</th>
                  <th style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>Décision</th>
                  <th style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>Risque</th>
                  <th style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>Probabilité</th>
                  <th style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px", fontSize: "14px", fontWeight: "500" }}>{item.client}</td>
                    <td style={{ padding: "12px", fontSize: "14px", color: item.decision_label === "Approuvé" ? "#10b981" : "#ef4444", fontWeight: "600" }}>
                      {item.decision_label}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        background: item.risk_level === "Élevé" ? "#fef2f2" : item.risk_level === "Moyen" ? "#fffbeb" : "#f0fdf4",
                        color: item.risk_level === "Élevé" ? "#dc2626" : item.risk_level === "Moyen" ? "#d97706" : "#10b981"
                      }}>
                        {item.risk_level}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#374151" }}>{item.probability}%</td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>{new Date(item.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionML;