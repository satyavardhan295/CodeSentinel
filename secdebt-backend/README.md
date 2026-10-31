# CodeSentinel API

Backend for **CodeSentinel**, an AI-powered Security Debt Scorer. It takes an uploaded codebase or a GitHub repo and:

- **Code analysis.** Gemini reviews source files for vulnerabilities and returns a CWE/OWASP-tagged finding with a suggested fix for each one.
- **Secrets.** `detect-secrets` plus extra regexes find hardcoded credentials. Values are masked in results and **redacted before any code is sent to Gemini**.
- **Dependencies.** `package.json` and `requirements*.txt` versions are checked against the free [OSV](https://osv.dev) vulnerability database.
- **Configuration.** Rule-based checks flag things like disabled TLS verification, debug mode, wildcard CORS, insecure cookies, and public Terraform resources.
- **Scoring.** Code findings roll up into a 0–100 score, an A–F grade and a risk level. Each finding says how many points fixing it would win back.
- **Accounts.** Users sign up and sign in; each user only sees their own scans and GitHub connection.

Stack: FastAPI · SQLAlchemy (async) + SQLite · Alembic · Pydantic v2 · GitPython · google-generativeai.

---

## Prerequisites

- **Python 3.11+**
- **git** (only needed for GitHub scans; the server starts without it)
- A **Gemini API key** from https://aistudio.google.com/apikey

## Setup

```bash
git clone <this repo> && cd secdebt-backend
python -m venv .venv
# Windows:   .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
```

Then open `.env` and set `GEMINI_API_KEY`.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

This runs the API only. To also serve the web app on the same port, run `npm run build` in the project root first; see "Connecting the frontend" below.

The database (`codesentinel.db`) is created on first start. Interactive API docs are at http://localhost:8000/docs.

## API

All routes are under `/api`, and every response is JSON in camelCase.

Everything except `/health` and `/api/auth/{config,signup,login}` requires a signed-in session cookie (`cs_session`). Without one you get 401 `{ "detail": "Please sign in to continue." }`. Each user only sees their own scans, findings and GitHub connection; anyone else's look like 404.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | `{ name, email, password }`. Creates the account and signs in (201). 409 if the email is taken, 403 if sign-ups are closed |
| `POST` | `/api/auth/login` | `{ email, password }`. Signs in. 401 for a wrong email or password; 429 after 5 failures in 15 minutes |
| `POST` | `/api/auth/logout` | Signs out this browser (204) |
| `GET` | `/api/auth/me` | The signed-in user `{ id, name, email, createdAt }` |
| `POST` | `/api/auth/change-password` | `{ currentPassword, newPassword }`. Signs out every other browser (204) |
| `DELETE` | `/api/auth/account` | `{ password }`. Deletes the account, all its scans and its GitHub connection (204) |
| `GET` | `/api/auth/config` | `{ allowSignups }` |
| `POST` | `/api/scans` | Start a scan (multipart form). Returns `{ "scanId" }` |
| `GET` | `/api/scans` | List your scans, newest first |
| `GET` | `/api/scans/{id}/status` | Scan status and progress (`progressStep`, `progressPct`) |
| `DELETE` | `/api/scans/{id}` | Delete a finished or failed scan and all of its results (204; 409 while it is still running) |
| `GET` | `/api/scans/{id}/report` | Full report: `{ scan, findings, dependencies, secrets, configurations }` |
| `PATCH` | `/api/findings/{id}` | Update `status` and/or `notes` |
| `POST` | `/api/findings/{id}/chat` | Ask Gemini about a finding. Returns `{ "reply" }` |
| `GET` | `/api/github/connection` | Connected GitHub account (`connected`, `username`, `avatarUrl`, …). Never includes the token |
| `POST` | `/api/github/connection` | Connect with `{ "token": "<personal access token>" }`. The token is verified with GitHub first; a bad token returns 401 |
| `DELETE` | `/api/github/connection` | Disconnect and forget the token |
| `GET` | `/api/github/repos` | Repos the connected account can access, most recently updated first |
| `GET` | `/health` | Liveness check |

`POST /api/scans` form fields:

- `source`: `upload` or `github`
- `repo_url`: required for GitHub
- `branch`: default `main`. If you leave it as `main` and the repo's default branch is something else (e.g. `master`), the default branch is used.
- `token`: optional, for private repos. If it's left out, the token of the GitHub account connected in Settings is used. The token stays in the local database (`codesentinel.db`) and is never returned by the API, so keep that file private like `.env`.
- `scan_types`: a JSON array drawn from `code`, `secrets`, `dependencies`, `config`, `ai-code`. Defaults to all except `ai-code`.
- `files`: one or more files or `.zip` archives, for uploads

Repos are cloned (and uploads extracted) inside the request itself, so problems come back straight away as clear errors: 400 for a bad URL or no code files, 401 for a bad token, 404 for a missing repo or branch, 413 when it's too large. The analysis then runs as a background task, and the frontend polls `/status` while it does.

Errors always have the shape `{ "detail": "<message you can show the user>" }`. Unhandled errors return 500 with `{ "detail": "Internal server error", "type": "<ExceptionType>" }`.

## Verify with curl

> On Windows PowerShell 5.1, use `curl.exe` and pass JSON bodies from a file (`--data-binary "@body.json"`). PowerShell strips the inner quotes from inline JSON.

1. Health check

   ```bash
   curl http://localhost:8000/health
   ```

   Expected: `{"status":"ok"}`

   **Sign in first.** Every request below needs the session cookie. Create an account once and save the cookie to a file (or use `/api/auth/login` with the same body minus `name`):

   ```bash
   curl -c cookies.txt -X POST http://localhost:8000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Your Name","email":"you@example.com","password":"choose-a-pass-123"}'
   ```

   Then add `-b cookies.txt` to each command below.

2. Start a scan with a public GitHub repo

   ```bash
   curl -X POST http://localhost:8000/api/scans \
     -F "source=github" \
     -F "repo_url=https://github.com/OWASP/NodeGoat" \
     -F "branch=master" \
     -F 'scan_types=["code","secrets","dependencies"]'
   ```

   Expected: `{"scanId":"<uuid>"}`

3. Poll status, using the scanId from step 2

   ```bash
   curl http://localhost:8000/api/scans/<scanId>/status
   ```

   Expected: a scan object whose `status` and `progressPct` update as the scan runs

4. Fetch the report once `status` is `complete`

   ```bash
   curl http://localhost:8000/api/scans/<scanId>/report
   ```

   Expected: `{scan, findings[], dependencies[], secrets[], configurations[]}`

5. Update a finding's status, using a findingId from step 4

   ```bash
   curl -X PATCH http://localhost:8000/api/findings/<findingId> \
     -H "Content-Type: application/json" \
     -d '{"status":"Fixed","notes":"Switched to parameterized queries"}'
   ```

   Expected: the updated Finding object

6. Ask about a finding

   ```bash
   curl -X POST http://localhost:8000/api/findings/<findingId>/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"How would an attacker exploit this?"}'
   ```

   Expected: `{"reply":"..."}`

7. List all scans

   ```bash
   curl http://localhost:8000/api/scans
   ```

   Expected: an array of scan objects, newest first

Upload variant of step 2:

```bash
curl -X POST http://localhost:8000/api/scans -F "source=upload" -F "files=@my-project.zip"
```

## Connecting the frontend

The frontend calls the API on its own origin (`/api/...`), so there are two ways to run it.

**One URL (production-style).** Build the frontend, and this server will serve it:

```bash
# in the project root
npm run build
# then here
uvicorn app.main:app --port 8000      # open http://localhost:8000
```

**Two servers (frontend development with hot reload):**

```bash
# Terminal 1 (backend)
uvicorn app.main:app --reload --port 8000

# Terminal 2 (frontend, project root): proxies /api to port 8000
npm run dev        # http://localhost:5173
```

`FRONTEND_ORIGIN` (CORS) only matters when the frontend is served from a *different* origin than the API.

For deployment (Docker, `ALLOW_SIGNUPS`, the data volume), see the project root README.

## Database migrations

On startup the app creates any missing tables. To change the schema, edit the models in `app/models/`, then:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

A database created by the app's own startup (rather than by Alembic) has no migration history yet. Mark it as current once with `alembic stamp head` before running your first upgrade.

## Gemini notes

- **Model.** The default `GEMINI_MODEL` is `gemini-3.5-flash-lite`. When this was built (Oct 2026), `gemini-2.0-flash` and `gemini-2.5-flash` had been retired. The full `gemini-3.5-flash` refused to review some intentionally vulnerable code, and newer flash models were often overloaded. The lite model was fast, reliable, and didn't refuse. Any model from `genai.list_models()` works.
- **Free-tier limits.** Free-tier keys allow only a few requests per minute and a small daily budget per model. Code is sent in batches of up to 5 files or about 15k tokens, with 2 batches in parallel. Per-minute 429s are retried after the delay Gemini asks for. If the daily quota runs out, the scan fails with a clear message. For large repos, enable billing or scan a subset.
- **Deprecated SDK.** `google-generativeai` no longer receives updates (Google recommends `google-genai`). All Gemini calls live in `app/services/gemini.py`, so switching SDKs only touches that file.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | (none, required) | Gemini API key |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model used for analysis and chat |
| `DATABASE_URL` | `sqlite+aiosqlite:///./codesentinel.db` | SQLAlchemy async database URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Origins allowed by CORS (comma-separated). Only needed when the frontend is served from another origin |
| `ALLOW_SIGNUPS` | `true` | Whether new accounts can be created. **Set to `false` on a public server once your team has signed up** |
| `SESSION_DAYS` | `30` | How long a sign-in lasts |
| `FRONTEND_DIST` | `../dist` | Built frontend that the server serves at `/` |
| `UPLOAD_DIR` | `uploads` | Temporary storage for uploads, deleted after each scan |
| `REPO_DIR` | `repos` | Temporary storage for clones, deleted after each scan |
| `MAX_FILE_SIZE_MB` | `50` | Upload limit, including the unzipped size of archives |
| `MAX_REPO_SIZE_MB` | `200` | GitHub repo size limit |
| `CODE_EXTENSIONS` | `.js,.ts,…,.tf` | File extensions to analyse |

## Project layout

```
app/
  main.py            FastAPI app, CORS, global error handler
  config.py          Settings from .env
  database.py        Async engine/session, Base, create_all_tables
  models/            ORM models (Scan, Finding, DependencyIssue, SecretFinding, ConfigurationIssue)
  schemas/           Pydantic response/request models (camelCase aliases)
  api/routes/        scans.py, findings.py
  services/
    file_handler.py  Upload/ZIP extraction, code-file filtering
    github.py        Clone public/private repos, with friendly errors
    secret_scanner.py detect-secrets + regexes, masking, redaction
    dep_scanner.py   package.json / requirements.txt → OSV CVEs
    config_scanner.py Rule-based misconfiguration checks
    gemini.py        Chunking, analysis prompt, JSON parsing, chat
    scanner.py       Background pipeline orchestration
    scorer.py        Score, grade, risk level
    security.py      Password hashing (scrypt) and session tokens
    rate_limit.py    Locks sign-in for 15 min after 5 failed attempts
alembic/             Migrations
```
