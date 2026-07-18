FROM node:20-slim

# The backend shells out to Python for ML/AI/OCR (predict_model.py,
# storytelling_hybrid_ai.py, predictive_ai.py, easyocr_script.py), so this
# image needs both runtimes. easyocr pulls in torch — the image is large.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# backend/uploads and the trained-model artifacts (*.pkl, *.traineddata,
# model_metadata.json) are gitignored — mount them as volumes or generate
# them (train_models.py) before running ML-dependent routes.
RUN mkdir -p uploads

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
