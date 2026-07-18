import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Sparkles,
  BarChart3,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Smartphone,
} from "lucide-react";
import { login, verifyMfa, resendMfaEmail } from "../services/auth.js";

const STAGE = { CREDENTIALS: "credentials", MFA: "mfa" };

function Login({ onLoginSuccess }) {
  const [stage, setStage] = useState(STAGE.CREDENTIALS);

  // credentials stage
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // mfa stage
  const [challengeId, setChallengeId] = useState(null);
  const [availableMethods, setAvailableMethods] = useState([]);
  const [activeMethod, setActiveMethod] = useState("email");
  const [code, setCode] = useState("");
  const [resentInfo, setResentInfo] = useState("");
  const codeInputRef = useRef(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stage === STAGE.MFA && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [stage]);

  const submitCredentials = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, motDePasse);
      if (res.mfaRequired) {
        setChallengeId(res.challengeId);
        setAvailableMethods(res.availableMethods || ["email"]);
        setActiveMethod(res.activeMethod || "email");
        setStage(STAGE.MFA);
      } else if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyMfa({ challengeId, type: activeMethod, code });
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.message || "Code invalide");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const switchMethod = (m) => {
    setActiveMethod(m);
    setError("");
    setCode("");
  };

  const handleResend = async () => {
    setError("");
    setResentInfo("");
    try {
      const res = await resendMfaEmail(challengeId);
      setChallengeId(res.challengeId || challengeId);
      setResentInfo("Un nouveau code a été envoyé.");
    } catch (err) {
      setError(err.message);
    }
  };

  const back = () => {
    setStage(STAGE.CREDENTIALS);
    setCode("");
    setChallengeId(null);
    setError("");
    setResentInfo("");
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <div className="login-brand-top">
          <div className="brand-logo">M</div>
          <div className="brand-name">
            <h2>MILES</h2>
            <span>Smart Recovery</span>
          </div>
        </div>

        <div className="login-brand-mid">
          <h1>Recouvrement intelligent, décisions éclairées.</h1>
          <p>
            Plateforme de gestion des impayés avec IA, scoring de risque et
            storytelling client en temps réel.
          </p>
          <ul className="feature-list">
            <li><ShieldCheck size={18} /> Authentification 2FA (TOTP + email)</li>
            <li><BarChart3 size={18} /> Tableaux de bord et indicateurs clés</li>
            <li><Sparkles size={18} /> Storytelling IA propulsé par Groq</li>
          </ul>
        </div>

        <div className="login-brand-bottom">
          © {new Date().getFullYear()} MILES Platform — Smart Recovery & Credit Analysis
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          {stage === STAGE.CREDENTIALS && (
            <>
              <h2>Bienvenue 👋</h2>
              <p className="subtitle">Connectez-vous pour accéder à votre espace.</p>

              <form className="login-form" onSubmit={submitCredentials}>
                <div className="field">
                  <label htmlFor="email">Adresse e-mail</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={iconLeft} />
                    <input
                      id="email"
                      type="email"
                      className="input"
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ paddingLeft: 40 }}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="password">Mot de passe</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={iconLeft} />
                    <input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      className="input"
                      placeholder="••••••••"
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      style={{ paddingLeft: 40, paddingRight: 40 }}
                      autoComplete="current-password"
                      required
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} style={iconBtn} aria-label="Afficher / masquer">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={rowSpace}>
                  <label style={inlineLabel}>
                    <input type="checkbox" /> Se souvenir de moi
                  </label>
                  <a href="#" style={{ color: "var(--brand-700)", fontWeight: 600 }} onClick={(e) => e.preventDefault()}>
                    Mot de passe oublié ?
                  </a>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: "12px 18px", fontSize: 14 }}>
                  {loading ? "Connexion…" : "Se connecter"}
                  {!loading && <ArrowRight size={14} />}
                </button>

                {error && <div className="alert error">{error}</div>}
              </form>

              <p style={hint}>Connexion sécurisée — chiffrement TLS, tokens JWT, MFA disponible.</p>
            </>
          )}

          {stage === STAGE.MFA && (
            <>
              <button onClick={back} style={backBtn}>
                <ArrowLeft size={14} /> Retour
              </button>

              <h2>Vérification en deux étapes</h2>
              <p className="subtitle">
                {activeMethod === "email"
                  ? "Un code à 6 chiffres a été envoyé à votre adresse e-mail."
                  : "Saisissez le code généré par votre application d'authentification."}
              </p>

              {availableMethods.length > 1 && (
                <div className="segmented" style={{ marginBottom: 14 }}>
                  {availableMethods.includes("email") && (
                    <button
                      type="button"
                      className={activeMethod === "email" ? "active" : ""}
                      onClick={() => switchMethod("email")}
                    >
                      <Mail size={12} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Email
                    </button>
                  )}
                  {availableMethods.includes("totp") && (
                    <button
                      type="button"
                      className={activeMethod === "totp" ? "active" : ""}
                      onClick={() => switchMethod("totp")}
                    >
                      <Smartphone size={12} style={{ marginRight: 6, verticalAlign: "-2px" }} /> App
                    </button>
                  )}
                </div>
              )}

              <form className="login-form" onSubmit={submitMfa}>
                <div className="field">
                  <label htmlFor="code">Code de vérification</label>
                  <div style={{ position: "relative" }}>
                    <KeyRound size={16} style={iconLeft} />
                    <input
                      id="code"
                      ref={codeInputRef}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input num"
                      placeholder="123 456"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
                      style={{
                        paddingLeft: 40,
                        letterSpacing: "0.4em",
                        fontSize: 18,
                        fontWeight: 600,
                        textAlign: "center",
                      }}
                      maxLength={8}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading || code.length < 4} style={{ padding: "12px 18px", fontSize: 14 }}>
                  {loading ? "Vérification…" : "Valider le code"}
                  {!loading && <ArrowRight size={14} />}
                </button>

                {error && <div className="alert error">{error}</div>}
                {resentInfo && <div className="alert success">{resentInfo}</div>}
              </form>

              {activeMethod === "email" && (
                <button onClick={handleResend} style={resendBtn}>
                  Vous n'avez rien reçu ? Renvoyer le code
                </button>
              )}

              <p style={hint}>
                Le code expire dans quelques minutes. En cas de doute, retournez à l'étape précédente.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const iconLeft = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--text-3)",
};

const iconBtn = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--text-3)",
  padding: 4,
  display: "grid",
  placeItems: "center",
};

const rowSpace = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  color: "var(--text-2)",
  margin: "2px 0 4px 0",
};

const inlineLabel = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
};

const hint = {
  marginTop: 24,
  fontSize: 12,
  color: "var(--text-3)",
  textAlign: "center",
};

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  color: "var(--text-2)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  padding: 0,
  marginBottom: 14,
};

const resendBtn = {
  marginTop: 14,
  background: "transparent",
  border: "none",
  color: "var(--brand-700)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

export default Login;
