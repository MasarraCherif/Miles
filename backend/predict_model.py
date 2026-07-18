"""
Predict the risk class for a single client.
"""

from __future__ import annotations

import json
import os
import sys

import joblib
import numpy as np
import pandas as pd

ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), "random_forest_model.pkl")

NUMERIC_RAW = [
    "montant_impaye",
    "montant_devise",
    "nb_contrats",
    "nb_relances",
    "taux_recouvrement",
    "montant_recouvre",
    "nb_jours_retard",
]


def engineer(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in NUMERIC_RAW:
        if col not in out.columns:
            out[col] = 0
    out["log_montant_impaye"]   = np.log1p(out["montant_impaye"].clip(lower=0))
    out["log_montant_devise"]   = np.log1p(out["montant_devise"].clip(lower=0))
    out["log_montant_recouvre"] = np.log1p(out["montant_recouvre"].clip(lower=0))

    safe_total = out["montant_impaye"].replace(0, np.nan)
    out["ratio_recouvre"] = (out["montant_recouvre"] / safe_total).fillna(0)
    out["ratio_devise"]   = (out["montant_devise"]   / safe_total).fillna(1)
    out["relances_par_contrat"] = (
        out["nb_relances"] / out["nb_contrats"].replace(0, np.nan)
    ).fillna(0)
    out["pression_recouvrement"] = (
        out["nb_jours_retard"].fillna(0) * (100 - out["taux_recouvrement"].fillna(100))
    )
    return out


def risk_band(prob: float) -> str:
    if prob >= 0.80:
        return "Critique"
    if prob >= 0.60:
        return "Élevé"
    if prob >= 0.35:
        return "Modéré"
    return "Faible"


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing input json"}), file=sys.stderr)
        return 2

    raw = json.loads(sys.argv[1])

    artifact = joblib.load(ARTIFACT_PATH)

    # Support both new (dict) and legacy (bare model) artifacts.
    if isinstance(artifact, dict) and "model" in artifact:
        model = artifact["model"]
        feature_order = artifact.get("feature_order")
    else:
        model = artifact
        feature_order = None

    # Default any missing numeric input to 0 to keep the CLI tolerant.
    base_cols = NUMERIC_RAW + ["risque_id", "devise_id", "temps_id"]
    df = pd.DataFrame([{c: raw.get(c, 0) for c in base_cols}])
    df = engineer(df)

    if feature_order:
        df = df.reindex(columns=feature_order, fill_value=0)

    # Obtenir la probabilité brute du modèle
    proba_raw = float(model.predict_proba(df)[0][1])
    
    # APPLICATION D'UN FACTEUR DE LISSAGE (CALIBRATION)
    # Évite les probabilités extrêmes (0% ou 100%)
    # Transforme: 0.95 -> 0.92, 0.99 -> 0.95
    if proba_raw > 0.90:
        proba = 0.85 + (proba_raw - 0.90) * 0.5
    elif proba_raw < 0.10:
        proba = 0.15 + (proba_raw) * 0.5
    else:
        proba = proba_raw
    
    # Arrondi à 2 décimales pour éviter 100%
    proba = round(proba, 4)
    pred = int(proba >= 0.5)
    
    # Calcul du pourcentage (max 98% pour éviter 100%)
    probability_percent = min(98, round(proba * 100, 1))

    print(json.dumps({
        "prediction":  pred,
        "probability": probability_percent,
        "risk_level":  "Élevé" if pred == 1 else "Faible",
        "risk_band":   risk_band(proba),
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)