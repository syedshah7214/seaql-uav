# SEAQL model server + full dashboard, for a Hugging Face Docker Space (or any Docker host).
FROM python:3.12-slim

# LightGBM / XGBoost need the OpenMP runtime
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run containers as user 1000
RUN useradd -m -u 1000 user
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY --chown=user . /app
USER user

ENV HOST=0.0.0.0 \
    PORT=7860 \
    PYTHONUNBUFFERED=1
EXPOSE 7860
CMD ["python", "backend/server.py", "--no-browser"]
