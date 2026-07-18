import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, RefreshCw, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const questions = [
  "Quel est le revenu mensuel du client ?",
  "Quel est le montant total des charges mensuelles du client ?",
  "Quel est le montant demandé par le client ?",
  "Sur combien d'années le client souhaite-t-il rembourser ?",
  "Le revenu du client est-il stable ? (faible / moyen / élevé)",
  "Comment évaluez-vous l'historique de paiement du client ? (mauvais / moyen / bon)",
  "Combien d'incidents de paiement le client a-t-il déjà eus ?",
  "Quel est le niveau d'endettement actuel du client ? (faible / moyen / élevé)",
  "Souhaitez-vous ajouter une note d'analyse sur ce dossier ?",
];

const fieldKeys = [
  "revenuMensuel",
  "chargesMensuelles",
  "montantDemande",
  "dureeAnnees",
  "stabiliteRevenu",
  "historiquePaiement",
  "incidentsPaiement",
  "niveauEndettement",
  "noteAnalyse",
];

const initialMessages = [
  {
    sender: "assistant",
    text: "Bonjour 👋, je suis l'assistant intelligent d'évaluation de solvabilité.",
  },
  { sender: "assistant", text: questions[0] },
];

function SmartCreditAssessmentChat() {
  const [messages, setMessages] = useState(initialMessages);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState(null); // { type: 'success'|'error', message: string }
  const [extractedData, setExtractedData] = useState(null);

  // OCR STATES
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("chat");

  const threadRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const reset = () => {
    setMessages(initialMessages);
    setCurrentStep(0);
    setAnswers({});
    setResult(null);
    setInputValue("");
    setFile(null);
    setMode("chat");
    setOcrStatus(null);
    setExtractedData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const updatedMessages = [
      ...messages,
      { sender: "user", text: inputValue },
    ];

    const updatedAnswers = {
      ...answers,
      [fieldKeys[currentStep]]: inputValue,
    };

    setMessages(updatedMessages);
    setAnswers(updatedAnswers);
    setInputValue("");

    if (currentStep < questions.length - 1) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { sender: "assistant", text: questions[currentStep + 1] },
        ]);
        setCurrentStep((prev) => prev + 1);
      }, 300);
    } else {
      try {
        setLoading(true);

        const response = await fetch(
          "http://localhost:5000/api/smart-credit-assessment",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedAnswers),
          }
        );

        const data = await response.json();
        setResult(data);

        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: "✨ Analyse terminée.",
          },
        ]);
      } catch (error) {
        console.error(error);
        setMessages((prev) => [
          ...prev,
          {
            sender: "assistant",
            text: "❌ Erreur lors de l'analyse. Veuillez réessayer.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOCRUpload = async () => {
    if (!file) {
      setOcrStatus({ type: "error", message: "Veuillez sélectionner un fichier" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setOcrStatus(null);

    try {
      const res = await fetch("http://localhost:5000/api/scan-credit-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la lecture du document");
      }

      if (!data.success) {
        setOcrStatus({
          type: "error",
          message: data.message || "Impossible de lire le document. Essayez avec une écriture plus lisible ou un texte imprimé."
        });
        setLoading(false);
        return;
      }

      // Succès - afficher les données extraites
      setExtractedData(data.extractedData);
      setOcrStatus({
        type: "success",
        message: `Document lu avec succès ! Données extraites : Revenu: ${data.extractedData.revenuMensuel} TND, Charges: ${data.extractedData.chargesMensuelles} TND, Montant: ${data.extractedData.montantDemande} TND, Durée: ${data.extractedData.dureeAnnees} ans`
      });

      // Afficher un message dans le chat
      setMessages(prev => [
        ...prev,
        {
          sender: "assistant",
          text: `📄 Document analysé avec succès !\n\nRevenu: ${data.extractedData.revenuMensuel} TND\nCharges: ${data.extractedData.chargesMensuelles} TND\nMontant demandé: ${data.extractedData.montantDemande} TND\nDurée: ${data.extractedData.dureeAnnees} ans\n\nVoici l'analyse complète :`
        }
      ]);

      setResult(data.analysis);
      
      // Nettoyer le fichier
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (error) {
      console.error("OCR Error:", error);
      setOcrStatus({
        type: "error",
        message: error.message || "Erreur de connexion au serveur. Vérifiez que le backend est démarré."
      });
    } finally {
      setLoading(false);
    }
  };

  const progressPct = Math.round(
    (Object.keys(answers).length / questions.length) * 100
  );

  const getRisqueColor = (risque) => {
    if (risque === "Faible") return "#10b981";
    if (risque === "Modéré") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="page-container" style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Assistant d'évaluation de solvabilité</h1>

        {result && (
          <button className="btn btn-secondary" onClick={reset} style={{ padding: "8px 16px", cursor: "pointer" }}>
            <RefreshCw size={14} /> Nouvelle analyse
          </button>
        )}
      </div>

      {/* MODE SWITCH */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => { setMode("chat"); setOcrStatus(null); }}
          style={{ 
            padding: "10px 20px", 
            cursor: "pointer", 
            backgroundColor: mode === "chat" ? "#3b82f6" : "#e5e7eb",
            color: mode === "chat" ? "white" : "#374151",
            border: "none",
            borderRadius: 8,
            fontWeight: 500
          }}
        >
          💬 Mode Chat
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => { setMode("upload"); setResult(null); setOcrStatus(null); }}
          style={{ 
            padding: "10px 20px", 
            cursor: "pointer", 
            backgroundColor: mode === "upload" ? "#3b82f6" : "#e5e7eb",
            color: mode === "upload" ? "white" : "#374151",
            border: "none",
            borderRadius: 8,
            fontWeight: 500
          }}
        >
          📄 Scan Document (OCR)
        </button>
      </div>

      <div className="chat-shell" style={{ 
        border: "1px solid #e5e7eb", 
        borderRadius: 12, 
        overflow: "hidden",
        backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div className="chat-header" style={{ 
          padding: "15px 20px", 
          backgroundColor: "#f9fafb", 
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12
        }}>
          <div className="bot-avatar" style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 18, 
            backgroundColor: "#3b82f6", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center" 
          }}>
            <Bot size={18} color="white" />
          </div>

          <div>
            <h4 style={{ margin: 0, fontSize: 16 }}>Smart Assistant</h4>
            <span style={{ fontSize: 12, color: "#6b7280" }}>En ligne</span>
          </div>
        </div>

        <div className="chat-thread" ref={threadRef} style={{ 
          height: 400, 
          overflowY: "auto", 
          padding: 20,
          backgroundColor: "#ffffff"
        }}>
          {messages.map((m, i) => (
            <motion.div 
              key={i} 
              className={`bubble ${m.sender}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ 
                marginBottom: 12,
                display: "flex",
                justifyContent: m.sender === "user" ? "flex-end" : "flex-start"
              }}
            >
              <div style={{ 
                maxWidth: "70%", 
                padding: "10px 15px", 
                borderRadius: 12,
                backgroundColor: m.sender === "user" ? "#3b82f6" : "#f3f4f6",
                color: m.sender === "user" ? "white" : "#1f2937",
                whiteSpace: "pre-line"
              }}>
                {m.text}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 10 }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}
        </div>

        {/* ================= OCR MODE ================= */}
        {mode === "upload" && !result && (
          <div style={{ padding: 20, borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                📸 Téléchargez la photo du document
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ display: "block", marginBottom: 10 }}
              />
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>
                ✍️ Pour de meilleurs résultats : écrivez en MAJUSCULES, bien espacé, sur fond blanc.
              </p>
            </div>

            {ocrStatus && (
              <div style={{ 
                padding: 12, 
                borderRadius: 8, 
                marginBottom: 15,
                backgroundColor: ocrStatus.type === "success" ? "#d1fae5" : "#fee2e2",
                color: ocrStatus.type === "success" ? "#065f46" : "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                {ocrStatus.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span style={{ fontSize: 14 }}>{ocrStatus.message}</span>
              </div>
            )}

            {extractedData && !result && (
              <div style={{ 
                padding: 12, 
                borderRadius: 8, 
                marginBottom: 15,
                backgroundColor: "#e0f2fe",
                border: "1px solid #bae6fd"
              }}>
                <p style={{ margin: 0, fontWeight: 500, marginBottom: 8 }}>📊 Données extraites :</p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Revenu mensuel : {extractedData.revenuMensuel} TND</li>
                  <li>Charges mensuelles : {extractedData.chargesMensuelles} TND</li>
                  <li>Montant demandé : {extractedData.montantDemande} TND</li>
                  <li>Durée : {extractedData.dureeAnnees} ans</li>
                </ul>
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={!file || loading}
              onClick={handleOCRUpload}
              style={{ 
                width: "100%", 
                padding: "12px", 
                backgroundColor: "#3b82f6", 
                color: "white", 
                border: "none", 
                borderRadius: 8,
                cursor: (!file || loading) ? "not-allowed" : "pointer",
                opacity: (!file || loading) ? 0.6 : 1,
                fontWeight: 500
              }}
            >
              {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }} /> : "🔍 "}
              Scanner le document
            </button>

            <button
              onClick={() => { setMode("chat"); setOcrStatus(null); setFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }}
              style={{ 
                marginTop: 10, 
                width: "100%", 
                padding: "8px", 
                backgroundColor: "#e5e7eb", 
                border: "none", 
                borderRadius: 8,
                cursor: "pointer",
                color: "#374151"
              }}
            >
              ⬅️ Retour au chat
            </button>
          </div>
        )}

        {/* ================= CHAT INPUT ================= */}
        {!result && mode === "chat" && (
          <div className="chat-input" style={{ 
            display: "flex", 
            padding: 15, 
            borderTop: "1px solid #e5e7eb", 
            gap: 10,
            backgroundColor: "white"
          }}>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Tapez votre réponse..."
              disabled={loading}
              style={{ 
                flex: 1, 
                padding: "10px 15px", 
                border: "1px solid #e5e7eb", 
                borderRadius: 8,
                outline: "none",
                fontSize: 14
              }}
            />

            <button 
              onClick={handleSend} 
              disabled={loading || !inputValue.trim()}
              style={{ 
                padding: "10px 20px", 
                backgroundColor: "#3b82f6", 
                color: "white", 
                border: "none", 
                borderRadius: 8,
                cursor: (loading || !inputValue.trim()) ? "not-allowed" : "pointer",
                opacity: (loading || !inputValue.trim()) ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <Send size={14} /> Envoyer
            </button>
          </div>
        )}
      </div>

      {/* ================= RESULT ================= */}
      {result && (
        <motion.div 
          className="section-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            marginTop: 24, 
            padding: 20, 
            backgroundColor: "#f9fafb", 
            borderRadius: 12,
            border: "1px solid #e5e7eb"
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} color="#f59e0b" />
            Résultat de l'analyse
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ padding: 12, backgroundColor: "white", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Mensualité</p>
              <p style={{ margin: "8px 0 0 0", fontSize: 20, fontWeight: 600 }}>{result.mensualiteEstimee}</p>
            </div>
            
            <div style={{ padding: 12, backgroundColor: "white", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Taux d'endettement</p>
              <p style={{ margin: "8px 0 0 0", fontSize: 20, fontWeight: 600 }}>{result.tauxEndettement}</p>
            </div>
            
            <div style={{ padding: 12, backgroundColor: "white", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Reste à vivre</p>
              <p style={{ margin: "8px 0 0 0", fontSize: 20, fontWeight: 600 }}>{result.resteAVivre}</p>
            </div>
            
            <div style={{ padding: 12, backgroundColor: "white", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Niveau de risque</p>
              <p style={{ 
                margin: "8px 0 0 0", 
                fontSize: 20, 
                fontWeight: 600, 
                color: getRisqueColor(result.niveauRisque)
              }}>
                {result.niveauRisque}
              </p>
            </div>
          </div>
          
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            backgroundColor: "#e0f2fe", 
            borderRadius: 8,
            border: "1px solid #bae6fd"
          }}>
            <p style={{ margin: 0, fontSize: 14 }}>💡 {result.recommandation}</p>
          </div>
        </motion.div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default SmartCreditAssessmentChat;