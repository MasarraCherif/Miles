import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { API_BASE } from "../config.js";

function Storytelling() {
  const [clientName, setClientName] = useState("");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("Français");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateStorytelling = async () => {
    if (!clientName.trim() || !question.trim()) {
      setError("Veuillez saisir le nom du client et la question.");
      setResult("");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    try {
      const response = await fetch(
        `${API_BASE}/ai/client-storytelling`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientName, question, language }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Erreur lors de la génération du storytelling.");
        setLoading(false);
        return;
      }

      setResult(data.result);
    } catch (err) {
      console.error(err);
      setError("Erreur serveur lors de l'appel IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Storytelling intelligent</h1>
          <p className="page-subtitle">
            Posez une question sur un client pour obtenir une analyse IA contextuelle,
            propulsée par PostgreSQL et Groq.
          </p>
        </div>
      </div>

      <div className="section-card">
        <h3>
          <Sparkles size={16} /> Nouvelle analyse
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label>Nom du client</label>
            <input
              className="input"
              type="text"
              placeholder="Ex. Société Atlas Trading"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Question</label>
            <textarea
              className="textarea"
              placeholder="Ex. Quel est le profil de risque actuel et les leviers de relance ?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div className="field">
              <label>Langue</label>
              <select
                className="select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>Français</option>
                <option>English</option>
                <option>Español</option>
                <option>العربية</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={generateStorytelling}
              disabled={loading}
              style={{ height: 42 }}
            >
              <Wand2 size={14} />
              {loading ? "Génération…" : "Générer l'analyse IA"}
            </button>
          </div>
        </div>

        {loading && (
          <div className="typing-dots" style={{ marginTop: 16 }}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}

        {error && (
          <div className="alert error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {result && <div className="story-result" style={{ marginTop: 20 }}>{result}</div>}
      </div>
    </div>
  );
}

export default Storytelling;
