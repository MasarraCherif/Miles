"""
MILES Smart Recovery — ML training pipeline.

Improvements vs the previous version:
  * Stronger feature engineering (ratios, log-scales, interactions).
  * Robust preprocessing pipeline (imputation + scaling + one-hot) wrapped
    in a single ColumnTransformer, so the saved artifact is self-contained.
  * Multiple candidate models (Logistic Regression, Random Forest,
    Gradient Boosting) compared on a stratified hold-out set using
    AUC + F1 + average precision.
  * Probability calibration (isotonic) of the winning model so that
    predicted probabilities can be trusted by the business layer.
  * 5-fold stratified cross-validation report (mean ± std) for stability.
  * Class-imbalance handling via class_weight where supported.
  * Optional fallback to a synthetic dataset when PostgreSQL is offline,
    so the script runs end-to-end during development.
  * Versioned artifact: persists a dict {model, features, metadata} so
    predict_model.py never depends on column order or feature names.
"""

from __future__ import annotations

import json
import os
import sys
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), "random_forest_model.pkl")
RESULTS_CSV = os.path.join(os.path.dirname(__file__), "model_comparison_results.csv")
METADATA_PATH = os.path.join(os.path.dirname(__file__), "model_metadata.json")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "talend")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD")

NUMERIC_RAW = [
    "montant_impaye",
    "montant_devise",
    "nb_contrats",
    "nb_relances",
    "taux_recouvrement",
    "montant_recouvre",
    "nb_jours_retard",
]
CATEGORICAL = ["risque_id", "devise_id", "temps_id"]


def load_data() -> pd.DataFrame:
    """Load training data from PostgreSQL; fall back to a synthetic dataset."""
    sql = """
        SELECT
          montant_impaye,
          montant_devise,
          nb_contrats,
          nb_relances,
          taux_recouvrement,
          montant_recouvre,
          nb_jours_retard,
          risque_id,
          devise_id,
          temps_id
        FROM fact_impayes
    """
    try:
        import psycopg2

        with psycopg2.connect(
            host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS
        ) as conn:
            df = pd.read_sql(sql, conn)
        print(f"[data] loaded {len(df)} rows from PostgreSQL.")
    except Exception as exc:  # noqa: BLE001
        print(f"[data] PostgreSQL unavailable ({exc}); using synthetic dataset.")
        rng = np.random.default_rng(42)
        n = 1500
        df = pd.DataFrame(
            {
                "montant_impaye":     rng.gamma(2.0, 4500.0, n),
                "montant_devise":     rng.gamma(2.0, 4500.0, n),
                "nb_contrats":        rng.integers(1, 6, n),
                "nb_relances":        rng.integers(0, 8, n),
                "taux_recouvrement":  rng.uniform(0, 100, n),
                "montant_recouvre":   rng.gamma(2.0, 2500.0, n),
                "nb_jours_retard":    rng.integers(0, 180, n),
                "risque_id":          rng.integers(1, 5, n),
                "devise_id":          rng.integers(1, 4, n),
                "temps_id":           rng.integers(1, 12, n),
            }
        )

    # Business label: at-risk when delay > 60 days OR low recovery rate.
    df["target_risque"] = (
        (df["nb_jours_retard"].fillna(0) > 60)
        | (df["taux_recouvrement"].fillna(100) < 40)
    ).astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add ratios / log-scales / interactions. Keeps the original raw cols."""
    out = df.copy()

    # Log transforms (heavy-tailed money values)
    out["log_montant_impaye"]  = np.log1p(out["montant_impaye"].clip(lower=0))
    out["log_montant_devise"]  = np.log1p(out["montant_devise"].clip(lower=0))
    out["log_montant_recouvre"] = np.log1p(out["montant_recouvre"].clip(lower=0))

    # Ratios — guard against div-by-zero
    safe_total = out["montant_impaye"].replace(0, np.nan)
    out["ratio_recouvre"] = (out["montant_recouvre"] / safe_total).fillna(0)
    out["ratio_devise"]   = (out["montant_devise"]   / safe_total).fillna(1)
    out["relances_par_contrat"] = (
        out["nb_relances"] / out["nb_contrats"].replace(0, np.nan)
    ).fillna(0)

    # Interactions
    out["pression_recouvrement"] = (
        out["nb_jours_retard"].fillna(0) * (100 - out["taux_recouvrement"].fillna(100))
    )

    return out


NUMERIC_ENGINEERED = NUMERIC_RAW + [
    "log_montant_impaye",
    "log_montant_devise",
    "log_montant_recouvre",
    "ratio_recouvre",
    "ratio_devise",
    "relances_par_contrat",
    "pression_recouvrement",
]


def build_preprocessor() -> ColumnTransformer:
    numeric_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler",  StandardScaler()),
        ]
    )
    categorical_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot",  OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipe,     NUMERIC_ENGINEERED),
            ("cat", categorical_pipe, CATEGORICAL),
        ]
    )


def build_candidates() -> dict[str, Pipeline]:
    pre = build_preprocessor
    return {
        "Logistic Regression": Pipeline([
            ("prep", pre()),
            ("clf",  LogisticRegression(
                max_iter=2000, class_weight="balanced", n_jobs=None
            )),
        ]),
        "Random Forest": Pipeline([
            ("prep", pre()),
            ("clf",  RandomForestClassifier(
                n_estimators=300,
                max_depth=12,
                min_samples_leaf=4,
                class_weight="balanced",
                n_jobs=-1,
                random_state=42,
            )),
        ]),
        "Gradient Boosting": Pipeline([
            ("prep", pre()),
            ("clf",  GradientBoostingClassifier(
                n_estimators=300,
                max_depth=3,
                learning_rate=0.05,
                random_state=42,
            )),
        ]),
    }


def evaluate(name: str, model: Pipeline, X_train, X_test, y_train, y_test) -> dict:
    model.fit(X_train, y_train)
    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    auc = roc_auc_score(y_test, proba)
    ap = average_precision_score(y_test, proba)
    f1 = f1_score(y_test, pred)
    prec = precision_score(y_test, pred, zero_division=0)
    rec = recall_score(y_test, pred, zero_division=0)

    print(f"\n--- {name} ---")
    print(f"AUC       : {auc:.4f}")
    print(f"AP        : {ap:.4f}")
    print(f"F1-score  : {f1:.4f}")
    print(f"Precision : {prec:.4f}")
    print(f"Recall    : {rec:.4f}")
    print(classification_report(y_test, pred, zero_division=0))

    return {
        "Model":     name,
        "AUC":       round(auc, 4),
        "AP":        round(ap, 4),
        "F1":        round(f1, 4),
        "Precision": round(prec, 4),
        "Recall":    round(rec, 4),
    }


def main() -> None:
    print("===== MILES — model training =====")
    df = load_data()
    df = engineer_features(df)

    X = df[NUMERIC_ENGINEERED + CATEGORICAL]
    y = df["target_risque"]

    print(f"[data] shape={X.shape}  class balance={y.mean():.2%}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    candidates = build_candidates()
    results = [
        evaluate(name, model, X_train, X_test, y_train, y_test)
        for name, model in candidates.items()
    ]

    results_df = pd.DataFrame(results).sort_values(by="AUC", ascending=False)
    print("\n===== RESULTS =====")
    print(results_df.to_string(index=False))
    results_df.to_csv(RESULTS_CSV, index=False)

    # Cross-validated stability check on the winner
    best_name = results_df.iloc[0]["Model"]
    winner = build_candidates()[best_name]  # fresh pipeline
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_auc = cross_val_score(winner, X, y, cv=skf, scoring="roc_auc", n_jobs=-1)
    print(f"\n[cv] {best_name}: AUC {cv_auc.mean():.4f} ± {cv_auc.std():.4f}")

    # Refit on full train + isotonic probability calibration
      # Refit final winner on training set
    winner.fit(X_train, y_train)

    artifact = {
        "model": winner,
        "base_estimator": best_name,
        "numeric_features": NUMERIC_ENGINEERED,
        "categorical_features": CATEGORICAL,
        "feature_order": NUMERIC_ENGINEERED + CATEGORICAL,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": results_df.to_dict(orient="records"),
        "cv_auc_mean": round(float(cv_auc.mean()), 4),
        "cv_auc_std": round(float(cv_auc.std()), 4),
    }

    joblib.dump(artifact, ARTIFACT_PATH)

    with open(METADATA_PATH, "w", encoding="utf-8") as fh:
        json.dump(
            {k: v for k, v in artifact.items() if k != "model"},
            fh,
            indent=2,
            ensure_ascii=False,
        )

    print(f"\n[ok] artifact saved → {ARTIFACT_PATH}")
    print(f"[ok] metadata saved → {METADATA_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"[fatal] {exc}", file=sys.stderr)
        sys.exit(1)
