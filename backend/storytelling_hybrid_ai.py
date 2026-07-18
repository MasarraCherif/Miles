import json
import sys
import os
import pandas as pd
import psycopg2
import numpy as np
from groq import Groq
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Forcer UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

class AdvancedAIAnalysis:
    def __init__(self):
        self.conn = psycopg2.connect(
            host="localhost",
            database="talend",
            user="postgres",
            password="lala",
            port="5432"
        )
        self.client = Groq(api_key=GROQ_API_KEY)

    def get_stats(self):
        """Recupere les stats de base - CORRIGE"""
        query = """
        SELECT 
            COUNT(*) as total_impayes,
            COALESCE(SUM(montant_impaye), 0) as montant_total,
            COUNT(DISTINCT client_id) as nb_clients,
            COALESCE(AVG(nb_jours_retard), 0) as retard_moyen,
            COALESCE(AVG(taux_recouvrement), 0) as recouvrement_moyen
        FROM fact_impayes
        """
        try:
            df = pd.read_sql(query, self.conn)
            print(f"Stats OK: {df.iloc[0].to_dict()}", file=sys.stderr)
            return df.iloc[0].to_dict()
        except Exception as e:
            print(f"Erreur get_stats: {e}", file=sys.stderr)
            return {"total_impayes": 0, "montant_total": 0, "nb_clients": 0, "retard_moyen": 0, "recouvrement_moyen": 0}

    def get_top_clients(self):
        """Recupere le top 10 des clients a risque - CORRIGE"""
        query = """
        SELECT 
            COALESCE(c.nom_client, 'Client Inconnu') as nom_client,
            COUNT(*) as nb_impayes,
            ROUND(COALESCE(AVG(f.nb_jours_retard), 0)::numeric, 1) as retard_moyen,
            ROUND(COALESCE(SUM(f.montant_impaye), 0)::numeric, 2) as montant_total
        FROM fact_impayes f
        LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
        GROUP BY c.nom_client
        ORDER BY AVG(f.nb_jours_retard) DESC NULLS LAST
        LIMIT 10
        """
        try:
            df = pd.read_sql(query, self.conn)
            print(f"Top clients OK: {len(df)} clients", file=sys.stderr)
            return df.to_dict('records')
        except Exception as e:
            print(f"Erreur get_top_clients: {e}", file=sys.stderr)
            return []

    def get_risk_distribution(self):
        """Recupere la distribution des risques - CORRIGE"""
        query = """
        SELECT 
            CASE 
                WHEN nb_jours_retard > 90 THEN 'CRITIQUE (>90j)'
                WHEN nb_jours_retard > 60 THEN 'ELEVE (>60j)'
                WHEN nb_jours_retard > 30 THEN 'MODERE (>30j)'
                ELSE 'FAIBLE (<30j)'
            END as niveau,
            COUNT(*) as nb
        FROM fact_impayes
        GROUP BY 
            CASE 
                WHEN nb_jours_retard > 90 THEN 'CRITIQUE (>90j)'
                WHEN nb_jours_retard > 60 THEN 'ELEVE (>60j)'
                WHEN nb_jours_retard > 30 THEN 'MODERE (>30j)'
                ELSE 'FAIBLE (<30j)'
            END
        """
        try:
            df = pd.read_sql(query, self.conn)
            return df.to_dict('records')
        except Exception as e:
            print(f"Erreur get_risk_distribution: {e}", file=sys.stderr)
            return []

    def get_segments(self):
        """Analyse par segment - NOUVEAU"""
        query = """
        SELECT 
            COALESCE(c.segment, 'Autre') as segment,
            COUNT(*) as nb_impayes,
            ROUND(COALESCE(AVG(f.nb_jours_retard), 0)::numeric, 1) as retard_moyen,
            ROUND(COALESCE(AVG(f.taux_recouvrement), 0)::numeric, 1) as recouvrement_moyen
        FROM fact_impayes f
        LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
        GROUP BY c.segment
        ORDER BY AVG(f.nb_jours_retard) DESC NULLS LAST
        """
        try:
            df = pd.read_sql(query, self.conn)
            return df.to_dict('records')
        except Exception as e:
            print(f"Erreur get_segments: {e}", file=sys.stderr)
            return []

    def get_correlations(self):
        """Calcule des correlations"""
        query = """
        SELECT 
            nb_jours_retard,
            montant_impaye,
            taux_recouvrement,
            nb_relances
        FROM fact_impayes
        """
        df = pd.read_sql(query, self.conn)
        
        correlations = {}
        if len(df) > 1:
            correlations['retard_vs_recouvrement'] = round(df['nb_jours_retard'].corr(df['taux_recouvrement']), 3)
            correlations['retard_vs_montant'] = round(df['nb_jours_retard'].corr(df['montant_impaye']), 3)
            correlations['relances_vs_retard'] = round(df['nb_relances'].corr(df['nb_jours_retard']), 3)
        
        return correlations

    def get_probabilites(self):
        """Calcule les probabilites conditionnelles"""
        query = """
        SELECT 
            nb_jours_retard,
            taux_recouvrement
        FROM fact_impayes
        """
        df = pd.read_sql(query, self.conn)
        
        proba = {}
        total = len(df)
        
        if total > 0:
            df_critique = df[df['nb_jours_retard'] > 90]
            if len(df_critique) > 0:
                proba['non_recouvrement_si_retard_90'] = round(
                    len(df_critique[df_critique['taux_recouvrement'] < 30]) / len(df_critique) * 100, 1
                )
            
            df_eleve = df[df['nb_jours_retard'] > 60]
            if len(df_eleve) > 0:
                proba['non_recouvrement_si_retard_60'] = round(
                    len(df_eleve[df_eleve['taux_recouvrement'] < 40]) / len(df_eleve) * 100, 1
                )
            
            df_faible = df[df['nb_jours_retard'] <= 30]
            if len(df_faible) > 0:
                proba['bon_recouvrement_si_retard_faible'] = round(
                    len(df_faible[df_faible['taux_recouvrement'] > 70]) / len(df_faible) * 100, 1
                )
        
        return proba

    def detect_hidden_patterns(self):
        """Detection de patterns invisibles"""
        query = """
        SELECT nb_jours_retard, taux_recouvrement
        FROM fact_impayes
        WHERE nb_jours_retard > 0
        """
        df = pd.read_sql(query, self.conn)
        
        # Seuil optimal
        seuils = range(10, 100, 5)
        chutes = []
        for seuil in seuils:
            avant = df[df['nb_jours_retard'] <= seuil]['taux_recouvrement'].mean()
            apres = df[df['nb_jours_retard'] > seuil]['taux_recouvrement'].mean()
            if avant > 0 and not pd.isna(avant) and not pd.isna(apres):
                chute = (avant - apres) / avant * 100
                chutes.append((seuil, chute))
        
        seuil_optimal = max(chutes, key=lambda x: x[1])[0] if chutes else 47
        
        return {"seuil_optimal": seuil_optimal}

    def analyze(self):
        """Analyse principale"""
        
        stats = self.get_stats()
        top_clients = self.get_top_clients()
        risk_dist = self.get_risk_distribution()
        segments = self.get_segments()
        correlations = self.get_correlations()
        probabilites = self.get_probabilites()
        hidden = self.detect_hidden_patterns()
        
        # Calculer les chiffres pour l'affichage
        total_impayes = stats.get('total_impayes', 0)
        montant_total = stats.get('montant_total', 0)
        nb_clients = stats.get('nb_clients', 0)
        retard_moyen = stats.get('retard_moyen', 0)
        recouvrement_moyen = stats.get('recouvrement_moyen', 0)
        
        # Trouver le secteur le plus risque
        secteur_risque = segments[0]['segment'] if segments else "Inconnu"
        
        return {
            "stats": {
                "total_impayes": int(total_impayes),
                "montant_total": round(float(montant_total), 2),
                "nombre_clients": int(nb_clients),
                "retard_moyen_global": round(float(retard_moyen), 1),
                "taux_recouvrement_moyen": round(float(recouvrement_moyen), 1)
            },
            "insights": {
                "top_clients": top_clients,
                "distribution_risque": risk_dist,
                "segments": segments,
                "correlations": correlations,
                "probabilites": probabilites,
                "secteur_plus_risque": secteur_risque,
                "seuil_optimal": hidden.get('seuil_optimal', 30),
                "synthese_globale": f"Portefeuille de {total_impayes} impayes pour {montant_total:,.0f} TND",
                "recommandations": [
                    f"Contacter en priorite les clients avec retard > {hidden.get('seuil_optimal', 30)} jours",
                    "Mettre en place une alerte preventive",
                    "Renforcer le suivi des clients critiques"
                ]
            }
        }


if __name__ == "__main__":
    try:
        ai = AdvancedAIAnalysis()
        result = ai.analyze()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "stats": {"total_impayes": 0, "montant_total": 0, "nombre_clients": 0, "retard_moyen_global": 0}}), ensure_ascii=False)