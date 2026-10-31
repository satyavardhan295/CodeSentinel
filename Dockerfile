# CodeSentinel: one container serving the React app and the FastAPI backend.
#
#   docker build -t codesentinel .
#   docker run -p 8000:8000 -e GEMINI_API_KEY=... -e ALLOW_SIGNUPS=true \
#     -v codesentinel-data:/data codesentinel

# ── 1. Build the frontend ─────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── 2. Backend runtime ───────────────────────────────────────────
FROM python:3.12-slim
# git is needed to clone GitHub repositories
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/secdebt-backend
COPY secdebt-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY secdebt-backend/ .
COPY --from=frontend /app/dist /app/dist

RUN useradd --create-home codesentinel \
 && mkdir -p /data /tmp/codesentinel \
 && chown -R codesentinel /data /tmp/codesentinel
USER codesentinel

ENV DATABASE_URL=sqlite+aiosqlite:////data/codesentinel.db \
    UPLOAD_DIR=/tmp/codesentinel/uploads \
    REPO_DIR=/tmp/codesentinel/repos \
    FRONTEND_DIST=/app/dist \
    PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:' + __import__('os').environ.get('PORT', '8000') + '/health')"

# Apply migrations, then serve. PORT is honoured for platforms that set it.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
