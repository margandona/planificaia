# AGENTS.md

PlanificaIA — ethical AI lesson-planning generator for the Chilean curriculum (Mineduc). Firebase backend + static Vue 3 SPA, no build step. pnpm 11.18.0, Node >= 22. All commits/docs/UI strings in Spanish (es-CL); code identifiers in English.

## Commands

- Install: `pnpm install` (workspace: root + `functions` + `scripts`)
- **Unit tests (what CI runs):** `pnpm --dir functions test:unit`
- Frontend E2E (against PRODUCTION, public pages only): `python public/js/frontend.test.py` (needs `pip install playwright` + `python -m playwright install chromium`)
- Dependency audit: `pnpm audit --prod --audit-level=high` (root and `functions/`)
- No linter, typecheck, or build step. Syntax-check edited JS with `node --check functions/index.js` / `node --check public/js/app.js`
- Emulators: `firebase emulators:start` (requires Java on PATH; `integration.test.js` auto-skips when the emulator is down)

## Critical gotchas

- **`functions/index.test.js` duplicates helper logic instead of importing it** — `index.js` calls `initializeApp()` at import, so tests paste copies of `VALIDATION_RULES`, `normalizePlanningOutput`, `buildPlanningRecord`, etc. When you change any of that logic in `index.js`, you MUST mirror it in `index.test.js` or tests silently go stale. CI runs ONLY `index.test.js` (the `index.test` pattern); `index.test.cjs` and `scripts/manual-tests.cjs` are stale duplicates — prefer editing `index.test.js`.
- **`TERMS_VERSION`/`PRIVACY_VERSION` live in THREE places (S-6/RF-013)** — `functions/index.js`, `functions/index.test.js` and `public/js/core.js` (re-exported to `app.js`). Bumping a version (a legal/policy change) must update all three; `acceptTerms` rejects stale versions server-side, and `hasAcceptedTerms()`/the consent modal enforce re-acceptance client-side. Frontend E2E (`frontend.test.py`) includes an axe-core WCAG 2.2 AA scan of the 5 public routes — keep them violation-free.
- **No `functions.config()`** — API keys come only from `process.env` via `functions/.env`, which the deploy workflow (`deploy.yml`) writes from GitHub secrets (`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GEMINI_FALLBACK_ENABLED`). Never commit `.env` files.
- **Deploy happens on push to `main`** via `.github/workflows/deploy.yml` (hosting + functions, `--only hosting,functions`). It only triggers on `functions/**`, `public/**`, firebase config, and rules files — **docs-only commits skip deploy**. Reglas/índices de Firestore **no se despliegan por CI**: la SA (`GCP_SA_KEY`) no tiene el rol `Firebase Rules Admin` (el test de compilación devuelve 403). Publicar reglas/índices a mano con `npx firebase-tools deploy --only firestore` (con credenciales con rol) o conceder el rol a la SA. CI (`ci.yml`: unit tests + audit + E2E) runs on every push/PR.
- **`gh` CLI is not authenticated.** To poll Actions via the GitHub API, recover the token with `"protocol=https`nhost=github.com`n`n" | git credential fill` (take the `password=` line) and use it as `Authorization: token <tok>` against `https://api.github.com/repos/margandona/planificaia/actions/runs`.
- **Seed/data scripts hit PRODUCTION Firestore directly** (no emulator). They need admin credentials: set `GOOGLE_APPLICATION_CREDENTIALS=<path>` (most scripts) or `FIREBASE_SA_PATH` (`seed-prompt-templates.mjs`). The gitignored SA file `planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json` exists in the repo root. Scripts with deterministic doc IDs are idempotent; dry-run flags exist on some (`seed-epja.mjs --dry-run`).
- **Admin access = custom claim `admin == true`** (`firestore.rules`). `prompt-templates`, `catalog`, `curriculum` writes and `audit-logs`/`ai-costs`/`feedback` reads are admin-only; `plannings` are owner-only. Client and admin SDKs both go to the same production project — no separate test env.

## Architecture

- **`functions/index.js` (~1600 lines)** — all Cloud Functions: `generatePlanning`, `regenerateSection`, `approvePlanning`, `submitFeedback`, `exportPlanning`, `acceptTerms` (S-6: aceptación versionada RF-013), `cleanupRetention` (S-6: purga diaria 03:00 Santiago según retención 29.3), `onNewAuditLog` (v2 onCall/onDocumentCreated). AI: DeepSeek primary, Gemini fallback (`gemini-1.5-flash`). Planning types: `class | unit | monthly | annual | evaluation | multigrade` — central `PLANNING_TYPES` const (per-type OA limits); type-aware `validateOutputStructure`, `normalizePlanningOutput`, `buildPlanningRecord`, `buildTypeInstruction` (per-type JSON schemas injected into prompts).
- `public/js/app.js` (~1800 lines) — single-file Vue 3 SPA (Vue via importmap, Tailwind v4 via CDN, hash routing: `#/dashboard`, `#/nueva`, `#/planificacion/:id`, `#/nueva-manual`, `#/editar/:id`). Pages: Landing, Login, Register, Dashboard, Profile, Wizard (10 steps), PlanningDetail, ManualEditor. Shared helpers (`Spinner`, `Alert`, `Card`, `Layout`) are defined inline — no module bundling.
- **Frontend S-5.4 (módulos ES, sin build step):** `public/js/core.js` exporta toda la infraestructura compartida (firebase, store, helpers, UI, Layout) + re-exports de `vue`/`firebase/*`; `public/js/app.js` es la entrada (páginas ligeras Landing/Login/Register/VerifyEmail/Dashboard/Profile + router con `import()` dinámico); las páginas pesadas viven en `public/js/pages/{wizard,detail,institucional,editor}.js` e importan de `../core.js`. Si añades un símbolo compartido, expórtalo desde `core.js` y recuerda que los módulos de páginas importan por nombre.
- `scripts/` — curriculum ingestion and seeding: `ingesta-curriculo.js`, `scrape-curriculum.mjs`, `seed-epja.mjs`, `seed-catalog.mjs`, `seed-templates.mjs`, `seed-prompt-templates.mjs`, plus `verify-*`/`debug-*` helpers. Curriculum lives in `curriculum/<subject>/<level>/...`; catalog in `catalog/subjects`; prompt templates in `prompt-templates` (each with `types` array + cascade selection subject+type → type → subject → generic).
- Firestore collections: `curriculum` (public read), `catalog` (public read), `prompt-templates` (admin), `plannings` + `plannings/{id}/versions` (owner), `users` (owner), `ai-costs`/`audit-logs`/`feedback` (function-write only).

## Conventions

- Commit messages: Spanish, phase-prefixed — `s2: ...`, `docs: ...`, `ci: ...`, `s1: ...` (see `git log`).
- `PLAN_ESCALADO.md` is the phase roadmap (S-0…S-7): when finishing a phase, update its status in the phase table AND append a "Cierre" note under the phase section. `PROJECT_MASTER_PLAN.md` holds requirements/specs.
- Do not commit or push unless explicitly asked.
