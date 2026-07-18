// ocr-handwritten.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function recognizeHandwriting(imagePath) {
  return new Promise((resolve, reject) => {
    // Vérifier que le fichier existe
    if (!fs.existsSync(imagePath)) {
      reject(new Error(`Le fichier ${imagePath} n'existe pas`));
      return;
    }

    const pythonScript = path.join(__dirname, 'easyocr_script.py');
    
    // Vérifier que le script Python existe
    if (!fs.existsSync(pythonScript)) {
      reject(new Error(`Le script Python ${pythonScript} n'existe pas. Veuillez créer easyocr_script.py`));
      return;
    }

    console.log("🐍 Exécution du script Python...");
    
    // Configuration pour Windows - utiliser 'python' ou 'python3' selon l'OS
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const pythonProcess = spawn(pythonCmd, [pythonScript, imagePath], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });
    
    let result = '';
    let error = '';
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error("❌ Erreur Python:", error);
        reject(new Error(`Erreur Python: ${error}`));
      } else {
        try {
          // Nettoyer la sortie (supprimer les warnings éventuels)
          const cleanResult = result.trim();
          const parsed = JSON.parse(cleanResult);
          console.log("✅ Résultat OCR reçu");
          
          if (parsed.error) {
            reject(new Error(parsed.error));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          console.error("❌ Erreur parsing JSON:", result);
          reject(new Error(`Erreur de parsing: ${e.message}\nRésultat: ${result}`));
        }
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error("❌ Erreur processus Python:", err);
      reject(new Error(`Impossible de lancer Python: ${err.message}. Vérifiez que Python est installé.`));
    });
    
    // Timeout de 60 secondes pour l'OCR (premier téléchargement des modèles peut être long)
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error("Timeout: L'OCR a pris trop de temps (plus de 60 secondes)"));
    }, 120000);
  });
}

module.exports = { recognizeHandwriting };