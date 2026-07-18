# easyocr_script.py
import sys
import json
import re
import os

# Forcer l'encodage UTF-8 pour éviter les erreurs Unicode sous Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    import easyocr
except ImportError:
    print(json.dumps({"error": "EasyOCR not installed. Run: pip install easyocr"}))
    sys.exit(1)

def extract_information(text):
    """Extrait les données du texte OCR"""
    data = {
        "revenuMensuel": 0,
        "chargesMensuelles": 0,
        "montantDemande": 0,
        "dureeAnnees": 1,
        "stabiliteRevenu": "moyen",
        "historiquePaiement": "moyen",
        "incidentsPaiement": 0,
        "niveauEndettement": "moyen",
        "noteAnalyse": ""
    }
    
    # Patterns pour trouver les nombres (avec fautes possibles)
    patterns = {
        "revenuMensuel": [
            r'(?:revenu|renvu|revernu|revenue)\s*(?:mensuel|mensuelle|ms)?\s*:?\s*(\d+)',
            r'revenu\s*(\d+)',
            r'salaire\s*:?\s*(\d+)'
        ],
        "chargesMensuelles": [
            r'(?:charges|charge)\s*(?:mensuelles|mensuel)?\s*:?\s*(\d+)',
            r'charges\s*(\d+)',
            r'dépenses\s*:?\s*(\d+)'
        ],
        "montantDemande": [
            r'(?:montant|demande|montan)\s*(?:demand[ée]|emprunt|crédit)?\s*:?\s*(\d+)',
            r'montant\s*(\d+)',
            r'emprunt\s*:?\s*(\d+)'
        ],
        "dureeAnnees": [
            r'(?:durée|duree|annee|ans|renbourse|remboursement)\s*:?\s*(\d+)',
            r'durée\s*(\d+)',
            r'(\d+)\s*(?:ans|années|an)'
        ],
        "incidentsPaiement": [
            r'(?:incidents|impayés|retards|stérique des mises)\s*:?\s*(\d+)',
            r'incidents?\s*(\d+)'
        ],
        "niveauEndettement": [
            r'niveau\s*d\'endettement\s*:?\s*(\w+)',
            r'endettement\s*:?\s*(\w+)'
        ]
    }
    
    text_lower = text.lower()
    
    for key, pattern_list in patterns.items():
        for pattern in pattern_list:
            match = re.search(pattern, text_lower)
            if match:
                value = match.group(1)
                if value.isdigit():
                    data[key] = int(value)
                elif key == "niveauEndettement":
                    if value in ["faible", "moyen", "élevé", "eleve"]:
                        data[key] = value
                break
    
    return data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        return
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"Image not found: {image_path}"}))
        return
    
    try:
        # Désactiver les messages de progression pour éviter les erreurs Unicode
        import warnings
        warnings.filterwarnings("ignore")
        
        # Rediriger stderr pour éviter les messages de téléchargement
        import contextlib
        
        with contextlib.redirect_stderr(None):
            # Initialiser EasyOCR avec moins de verbosité
            reader = easyocr.Reader(['fr', 'en'], gpu=False, verbose=False)
        
        # Lire l'image
        results = reader.readtext(image_path, detail=0, paragraph=True)
        
        full_text = ' '.join(results)
        
        # Extraire les informations
        extracted_data = extract_information(full_text)
        extracted_data["full_text"] = full_text
        
        # Afficher uniquement le résultat JSON
        print(json.dumps(extracted_data))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()