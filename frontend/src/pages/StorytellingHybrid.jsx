import { useEffect, useState } from "react";
import { 
  Brain, 
  AlertTriangle, 
  Activity, 
  Users, 
  Wallet, 
  Clock3, 
  ShieldAlert,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { API_ORIGIN } from "../config.js";

const API_BASE = API_ORIGIN;

const StorytellingHybrid = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/ai/hybrid-storytelling/global`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 30, textAlign: "center" }}>🧠 Chargement de l'analyse IA...</div>;
  if (error) return <div style={{ padding: 30, color: "red", textAlign: "center" }}>❌ Erreur: {error}</div>;
  if (!data) return null;

  const stats = data.stats || {};
  const insights = data.insights || {};
  const topClients = insights.top_clients || [];
  const riskDist = insights.distribution_risque || [];
  const correlations = insights.correlations || {};
  const probabilites = insights.probabilites || {};
  const segments = insights.segments || [];
  const correlationsIntelligentes = insights.correlations_intelligentes || [];
  const insightsInvisibles = insights.insights_invisibles || [];
  const predictionIa = insights.prediction_ia || "";
  const seuilOptimal = insights.seuil_optimal || null;
  const var90Jours = insights.var_90_jours || null;

  // Calculer le pourcentage de risque critique
  const totalRisk = riskDist.reduce((sum, r) => sum + r.nb, 0);
  const critiqueCount = riskDist.find(r => r.niveau === "CRITIQUE" || r.niveau === "CRITIQUE (>90j)")?.nb || 0;
  const critiquePercent = totalRisk > 0 ? Math.round((critiqueCount / totalRisk) * 100) : 0;

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: 24 }}>
      
      {/* Header */}
      <div style={{ 
        background: "linear-gradient(135deg, #667eea, #764ba2)", 
        borderRadius: 16, 
        padding: 32, 
        marginBottom: 24, 
        color: "white" 
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>🧠 IA Storytelling Intelligence</h1>
        <p>Analyse avancée de vos impayés par Groq LLM - Découverte de corrélations invisibles à l'œil humain</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <Activity size={24} color="#3b82f6" />
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total_impayes || 0}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total impayés</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <Wallet size={24} color="#10b981" />
          <div style={{ fontSize: 28, fontWeight: 700 }}>{(stats.montant_total || 0).toLocaleString()} TND</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Montant total</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <Users size={24} color="#f59e0b" />
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.nombre_clients || 0}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Clients</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <Clock3 size={24} color="#ef4444" />
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.retard_moyen_global || 0} j</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Retard moyen</div>
        </div>
      </div>

      {/* INSIGHTS INVISIBLES DÉCOUVERTS PAR L'IA - Carte spéciale */}
      {insightsInvisibles.length > 0 && (
        <div style={{ 
          background: "linear-gradient(135deg, #1e1b4b, #312e81)", 
          borderRadius: 16, 
          padding: 24, 
          marginBottom: 24, 
          color: "white" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Brain size={28} />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🔮 INSIGHTS INVISIBLES DÉCOUVERTS PAR L'IA</h3>
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
            Ces patterns sont impossibles à détecter avec une analyse humaine traditionnelle
          </div>
          {insightsInvisibles.map((insight, idx) => (
            <div key={idx} style={{ 
              background: "rgba(255,255,255,0.1)", 
              padding: 14, 
              borderRadius: 10, 
              marginBottom: 12,
              borderLeft: "3px solid #a855f7"
            }}>
              💡 {insight}
            </div>
          ))}
        </div>
      )}

      {/* SEUIL OPTIMAL DÉCOUVERT PAR L'IA */}
      {seuilOptimal && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#8b5cf6" }}>
            🎯 SEUIL CRITIQUE OPTIMAL DÉCOUVERT PAR L'IA
          </h3>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#8b5cf6" }}>
            {seuilOptimal} jours
          </div>
          <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8 }}>
            (contre 30/60/90 jours traditionnels - ce seuil est plus précis car calculé sur vos données réelles)
          </div>
          <div style={{ marginTop: 12, padding: 10, background: "#f3e8ff", borderRadius: 8, fontSize: 13 }}>
            ⚡ Agir avant {seuilOptimal} jours maximise les chances de recouvrement
          </div>
        </div>
      )}

      {/* PRÉDICTION IA - Valeur à risque (VaR) */}
      {var90Jours && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#dc2626" }}>
            📉 PRÉDICTION IA - Valeur à risque (VaR 90 jours)
          </h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#dc2626" }}>
            {var90Jours.toLocaleString()} TND
          </div>
          <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8 }}>
            Perte potentielle estimée dans les 90 prochains jours (seuil de confiance 95%)
          </div>
          {predictionIa && (
            <div style={{ marginTop: 12, padding: 10, background: "#fef2f2", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              🎯 {predictionIa}
            </div>
          )}
        </div>
      )}

      {/* Alert Cards - Taux de recouvrement et Risque critique */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#6b7280" }}>Taux de recouvrement</h3>
          <div style={{ fontSize: 32, fontWeight: 700, color: (stats.taux_recouvrement_moyen || 0) > 50 ? "#10b981" : "#ef4444" }}>
            {stats.taux_recouvrement_moyen || 0}%
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            {(stats.taux_recouvrement_moyen || 0) > 50 ? "✅ Bon" : "⚠️ Préoccupant"}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#6b7280" }}>Clients à risque critique</h3>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#dc2626" }}>
            {critiqueCount} <span style={{ fontSize: 16 }}>({critiquePercent}%)</span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>avec retard {">"} 90 jours</div>
        </div>
      </div>

      {/* Probabilité de non-paiement (Carte spéciale IA) */}
      {insights.probabilite_non_paiement && (
        <div style={{ 
          background: "linear-gradient(135deg, #991b1b, #7f1d1d)", 
          borderRadius: 12, 
          padding: 24, 
          marginBottom: 24, 
          color: "white" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <TrendingDown size={24} />
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>📊 PRÉDICTION IA - Risque de non-paiement</h3>
          </div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>
            {insights.probabilite_non_paiement}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>
            pour les clients avec retard critique ({">"}90 jours)
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 12 }}>
            🎯 L'IA estime que ces clients ont une très forte probabilité de ne jamais payer
          </div>
        </div>
      )}

      {/* CORRÉLATIONS INTELLIGENTES DÉCOUVERTES PAR L'IA */}
      {correlationsIntelligentes.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Brain size={20} color="#8b5cf6" />
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#8b5cf6" }}>
              🧠 CORRÉLATIONS INTELLIGENTES DÉCOUVERTES PAR L'IA
            </h3>
          </div>
          {correlationsIntelligentes.map((corr, idx) => (
            <div key={idx} style={{ 
              background: "#f3e8ff", 
              padding: 14, 
              borderRadius: 10, 
              marginBottom: 10,
              borderLeft: "3px solid #8b5cf6"
            }}>
              {corr}
            </div>
          ))}
        </div>
      )}

      {/* Corrélations statistiques calculées */}
      {(correlations.retard_vs_recouvrement || correlations.retard_vs_montant) && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>📈 CORRÉLATIONS STATISTIQUES</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Retard / Recouvrement</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: correlations.retard_vs_recouvrement < 0 ? "#ef4444" : "#10b981" }}>
                {correlations.retard_vs_recouvrement || 0}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {correlations.retard_vs_recouvrement < -0.5 ? "Corrélation forte négative" : "Corrélation modérée"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Retard / Montant</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>
                {correlations.retard_vs_montant || 0}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {Math.abs(correlations.retard_vs_montant || 0) > 0.3 ? "Corrélation positive" : "Faible corrélation"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Relances / Retard</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6" }}>
                {correlations.relances_vs_retard || 0}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Plus de relances = plus de retard</div>
            </div>
          </div>
        </div>
      )}

      {/* Probabilités conditionnelles */}
      {Object.keys(probabilites).length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#dc2626" }}>
            🎯 PROBABILITÉS CONDITIONNELLES
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {probabilites.non_recouvrement_si_retard_90 && (
              <div style={{ background: "#fef2f2", padding: 12, borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>
                  {probabilites.non_recouvrement_si_retard_90}%
                </div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>de non-recouvrement si retard {">"} 90j</div>
              </div>
            )}
            {probabilites.non_recouvrement_si_retard_60 && (
              <div style={{ background: "#fffbeb", padding: 12, borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
                  {probabilites.non_recouvrement_si_retard_60}%
                </div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>de non-recouvrement si retard {">"} 60j</div>
              </div>
            )}
            {probabilites.bon_recouvrement_si_retard_faible && (
              <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>
                  {probabilites.bon_recouvrement_si_retard_faible}%
                </div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>de bon recouvrement si retard &lt; 30j</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analyse par secteur */}
      {segments.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#f59e0b" }}>
            🏭 ANALYSE PAR SECTEUR D'ACTIVITÉ
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {segments.map((seg, idx) => (
              <div key={idx} style={{ 
                background: seg.retard_moyen > 60 ? "#fef2f2" : "#f3f4f6", 
                padding: 12, 
                borderRadius: 10 
              }}>
                <div style={{ fontWeight: 700 }}>{seg.segment}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: seg.retard_moyen > 60 ? "#dc2626" : "#4f46e5" }}>
                  {seg.nb_impayes} impayés
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Retard: {seg.retard_moyen} j</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Recouvrement: {seg.recouvrement_moyen}%</div>
              </div>
            ))}
          </div>
          {insights.secteur_plus_risque && (
            <div style={{ marginTop: 12, padding: 10, background: "#fef2f2", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              ⚠️ Secteur le plus à risque identifié par l'IA: <strong>{insights.secteur_plus_risque}</strong>
            </div>
          )}
        </div>
      )}

      {/* Synthèse IA */}
      <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Brain size={20} color="#2563eb" />
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>📖 Synthèse IA</h3>
        </div>
        <p style={{ color: "#4b5563", lineHeight: 1.6 }}>{insights.synthese_globale || "Analyse en cours..."}</p>
        {insights.alerte_immediate && (
          <div style={{ marginTop: 12, padding: 12, background: "#fef2f2", borderRadius: 8, color: "#dc2626", fontSize: 14 }}>
            ⚠️ {insights.alerte_immediate}
          </div>
        )}
      </div>

      {/* Distribution des risques */}
      {riskDist.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>📊 Distribution des risques</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {riskDist.map((item, idx) => {
              let bgColor = "#f3f4f6";
              let textColor = "#4b5563";
              if (item.niveau.includes("CRITIQUE")) {
                bgColor = "#fef2f2";
                textColor = "#dc2626";
              } else if (item.niveau.includes("ELEVE")) {
                bgColor = "#fffbeb";
                textColor = "#f59e0b";
              } else if (item.niveau.includes("MODERE")) {
                bgColor = "#f0fdf4";
                textColor = "#10b981";
              }
              return (
                <div key={idx} style={{ background: bgColor, padding: 16, borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: textColor }}>{item.nb}</div>
                  <div style={{ fontSize: 12, color: textColor }}>{item.niveau}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top clients à risque */}
      {topClients.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <ShieldAlert size={20} color="#dc2626" />
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>🎯 Top clients à risque</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>Client</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Impayés</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Retard moyen</th>
                  <th style={{ padding: 10, textAlign: "right" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((client, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10 }}>{client.nom_client}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{client.nb_impayes}</td>
                    <td style={{ padding: 10, textAlign: "right", color: client.retard_moyen > 60 ? "#dc2626" : "#4b5563" }}>
                      {client.retard_moyen} j
                    </td>
                    <td style={{ padding: 10, textAlign: "right" }}>{client.montant_total?.toLocaleString()} TND</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommandations IA */}
      {insights.recommandations?.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <TrendingUp size={20} color="#10b981" />
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>💡 Recommandations IA</h3>
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {insights.recommandations.map((rec, idx) => (
              <li key={idx} style={{ marginBottom: 8, color: "#4b5563" }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 24, padding: 16 }}>
        🤖 Analyse générée par Groq LLM (Llama 3.1) - Intelligence Artificielle
      </div>
    </div>
  );
};

export default StorytellingHybrid;