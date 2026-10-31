# CodeSentinel — Codebase Security Debt Scorer

CodeSentinel measures, tracks and helps you pay down security debt across codebases. Think of it as a **credit report for software repositories**: it turns findings into a single 0–100 score and lists first the fixes that win back the most points.

Each person signs in with their own account and sees only their own scans and GitHub connection.

This folder is the React frontend. The API lives in [`secdebt-backend/`](secdebt-backend/README.md).

---

## Run it (one URL)

Prerequisites: Node.js 18+, Python 3.11+, git, and a Gemini API key. Set up the backend once first (see [`secdebt-backend/README.md`](secdebt-backend/README.md)).

```bash
npm install
npm run build                      # writes dist/
cd secdebt-backend
uvicorn app.main:app --port 8000   # serves the app AND the API
```

Open **http://localhost:8000**. The backend serves the built app from `dist/`.

### Developing the frontend (hot reload)

Keep the backend running on port 8000, then:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` to `http://localhost:8000`; to use another address, set `API_TARGET`.

---

## Deploying

The [`Dockerfile`](Dockerfile) at the project root builds the frontend and runs both halves in one container:

```bash
docker build -t codesentinel .
docker run -p 8000:8000 \
  -e GEMINI_API_KEY=your-key \
  -e ALLOW_SIGNUPS=true \
  -v codesentinel-data:/data \
  codesentinel
```

- **Accounts.** Everyone signs up at `/signup` and signs in at `/login`. Sessions use an `HttpOnly`, `SameSite=Lax` cookie (marked `Secure` over HTTPS) and last 30 days (`SESSION_DAYS`). Passwords are hashed with scrypt.
- **Close sign-ups on public servers.** Once your team has accounts, set `ALLOW_SIGNUPS=false`; otherwise strangers could create accounts and use your Gemini quota. Existing users can still sign in.
- **First account.** Scans created before accounts existed go to the first account that signs up.
- **Keep the `/data` volume.** It holds the database (scans and the GitHub connection) and is migrated automatically on start.
- **Platform `PORT` variables are honoured,** for hosts such as Render, Railway or Fly.io. `GET /health` is an unauthenticated health check.
- **API on a different domain:** set `VITE_API_URL` when building the frontend, and add the frontend's origin to `FRONTEND_ORIGIN` on the backend (comma-separated).

---

## How the frontend talks to the API

All HTTP calls go through [`src/api/client.ts`](src/api/client.ts). By default they go to the same origin the page was served from:

| Function | Endpoint |
|---|---|
| `startScan(payload)` | `POST /api/scans` (multipart; `scan_types` is a JSON array of `code`, `secrets`, `dependencies`, `config`, `ai-code`) |
| `getScanStatus(scanId)` | `GET /api/scans/:scanId/status` |
| `getScanReport(scanId)` | `GET /api/scans/:scanId/report` |
| `listScans()` | `GET /api/scans` |
| `updateFinding(findingId, patch)` | `PATCH /api/findings/:findingId` |
| `chatAboutFinding(findingId, message)` | `POST /api/findings/:findingId/chat` |
| `deleteScan(scanId)` | `DELETE /api/scans/:scanId` |
| `getGitHubConnection()` / `connectGitHub(token)` / `disconnectGitHub()` | `GET` / `POST` / `DELETE /api/github/connection` |
| `signUp` / `logIn` / `logOut` / `getCurrentUser` | `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| `changePassword` / `deleteAccount` | `POST /api/auth/change-password`, `DELETE /api/auth/account` |
| `listGitHubRepos()` | `GET /api/github/repos` |

When a request fails, the error's message is the API's `detail` string, so it can be shown to the user as-is.

Pages choose which scan to show from the `?scan=<id>` query parameter. Without it, they show the most recent completed scan. The full response shapes are documented in the backend README.

---

## Switching the color palette

All design tokens are CSS custom properties in [`src/styles/tokens.css`](src/styles/tokens.css), mapped to Tailwind in [`tailwind.config.js`](tailwind.config.js). To change the theme in light and dark mode, adjust the root variables:

```css
:root {
  /* Light Theme */
  --bg: #EDF0F3;          /* Page background */
  --surface: #FFFFFF;     /* Panels, tables, modals */
  --ink: #1B2430;         /* Primary text */
  --muted: #5B6676;       /* Secondary text */
  --line: #D5DAE1;        /* 1px structural borders */
  --brand: #145374;       /* Interactive links and primary buttons */
  --brand-hover: #0E3F58;

  /* Severity Tokens (Badges & icons only) */
  --sev-critical: #C42B3A;
  --sev-high: #D9702B;
  --sev-medium: #B8901A;
  --sev-low: #3B7EA1;
  --sev-fixed: #2F855A;
}

.dark {
  /* Dark Theme */
  --bg: #10161D;
  --surface: #17202A;
  --ink: #E6EBF0;
  --muted: #9AA6B5;
  --line: #263241;
  --brand: #5FB3D4;
  --brand-hover: #3E9DBF;

  /* Lighter tints in dark mode for 4.5:1 contrast */
  --sev-critical: #E05260;
  --sev-high: #E88B4E;
  --sev-medium: #D4AA33;
  --sev-low: #579BBE;
  --sev-fixed: #48A375;
}
```

---

## Design system

- **Credit report paradigm.** Debt is shown as a financial-statement ledger of score points lost per severity. No glowing neon or gamified hacker dashboards.
- **Visual restraint.** No card soup; grouping comes from whitespace and 1px dividers.
- **Typography:**
  - `Bricolage Grotesque` (600) is reserved for the score number and page headers.
  - `Public Sans` (400, 500, 600) is used for all UI copy, labels and tables.
  - `JetBrains Mono` is used for code snippets, diffs, CWE IDs and file paths.
  - `font-variant-numeric: tabular-nums` is applied to all numbers, metrics and tables.
- **One orchestrated motion.** A 900ms ease-out count-up and marker slide play on dashboard load, and `prefers-reduced-motion` is respected.
- **Accessible and responsive.** 2px `--brand` keyboard focus rings, 4.5:1 minimum contrast, and a mobile navigation drawer down to 375px.
