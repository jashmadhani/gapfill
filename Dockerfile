# One container: builds the React app, then serves it together with the FastAPI backend.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 FRONTEND_DIST=/app/frontend/dist
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist
WORKDIR /app/backend
# The demo database is seeded automatically on first start (SQLite, reset whenever the service restarts).
CMD ["sh", "-c", "uvicorn app.serve:app --host 0.0.0.0 --port ${PORT:-8000}"]
