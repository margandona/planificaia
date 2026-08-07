# Resumen Ejecutivo — PlanificaIA

**Documento técnico-ejecutivo para revisión externa y planificación de mejoras.**
Generado el 2026-08-06 a partir del análisis completo del repositorio (código, docs, tests, scripts y CI/CD).

---

## 1. Ficha del proyecto

| Campo | Valor |
|---|---|
| **Nombre** | PlanificaIA |
| **Descripción** | Generador ético de planificaciones educativas asistido por IA, alineado al currículum oficial chileno (Mineduc) |
| **Estado** | MVP desplegado en producción, escalado S-0 → S-7 completado (v2.5→v3.0) |
| **URL producción** | https://planificacion-con-ia.web.app |
| **Proyecto Firebase** | `planificacion-con-ia` (región us-central1, plan Blaze) |
| **Stack** | Firebase Hosting + Cloud Functions (Node 22) + Firestore + Auth + Storage · Vue 3 + Tailwind v4 sin build step · pnpm 11.18 |
| **IA** | DeepSeek `deepseek-v4-flash` (primario) + Gemini `gemini-2.5-flash` (fallback) |
| **Principio rector** | *"La IA propone, el sistema verifica y el docente decide"* |
| **Cobertura curricular** | 2.783 docs: **1.796 OA + 327 habilidades + 598 actitudes + 62 OAT** en 19 asignaturas, Parvularia → 4° medio + EPJA |
| **Pruebas** | 106 tests unitarios Jest · 11 E2E Playwright · dataset IA 55 casos (global 4.91/5) · axe-core WCAG 2.2 AA (0 violaciones) |

---

## 2. Resumen ejecutivo (página única)

PlanificaIA es una SPA (Firebase + Vue 3, sin servidores propios) que convierte el currículum oficial chileno en **borradores de planificación listos para revisar**, bajo un marco estricto de agencia docente: la IA genera, un verificador pedagógico determinista (reglas V-001 a V-016) audita, una rúbrica pondera la calidad, y **nada se usa en aula sin aprobación explícita del docente** (o del UTP en contexto institucional).

El producto resuelve 14 problemas concretos (P01–P14): el tiempo excesivo en tareas administrativas, la falta de alineación curricular verificable, el uso desorganizado de IA genérica (ChatGPT), la dificultad de diferenciar (DUA) y la evaluación sin criterios (Decreto 67).

El MVP (fases 0–18) y el plan de escalado (S-0…S-7) están **completados e implementados en producción**: 6 tipos de planificación (clase, unidad, mensual, anual, evaluación, multigrado), colaboración institucional con roles y aprobación UTP, plan freemium (Free 10 gen/día / Pro 1.000), calidad de IA medida por rúbrica automática, presupuesto con kill-switch, cumplimiento legal (Ley 19.628 / adecuación Ley 21.719) y accesibilidad WCAG 2.2 AA.

**Pendientes estratégicos**: piloto docente con usuarios reales (infraestructura lista), cobro real (Stripe/Mercado Pago), validación jurídica H02 ya resuelta por decisión del propietario, y la corrección de una lista concreta de deuda técnica (sección 12) que incluye 2 bugs de seguridad, 1 contradicción del plan Pro y ~30 helpers duplicados en los tests.

---

## 3. Problema y oportunidad

**Problema** (14 documentados, P01–P14): los docentes chilenos dedican un tiempo excesivo a planificar, con poca estructura, currículum disperso, actividades sin alineación verificable, DUA y evaluación (Decreto 67) difíciles, y riesgo de copiar salidas de IA sin revisión. No existe historial/versionado ni reutilización.

**Oportunidad**:
- **250.000+ docentes** en Chile (Mineduc); currículum nacional público en línea.
- **DeepSeek extremadamente barato** (~$0.14/M input, ~$0.28/M output) + Gemini Flash con free tier generoso.
- **No hay plataforma especializada** en planificación curricular chilena con IA.
- Stack 100% Firebase: hosting gratuito, escalable, cero administración de servidores.

---

## 4. Propuesta de valor

- Reduce el tiempo de planificación (estimado 40–60%).
- **OA desde currículum oficial** (scrapeado de curriculumnacional.cl), nunca desde la memoria del modelo.
- Editable, **regenerable por sección**, aprobación docente obligatoria.
- Exportación **DOCX** (Cloud Function) y **PDF** (print), con declaración de asistencia de IA.
- **Trazabilidad completa**: modelo, proveedor, fecha, tokens, costo, OA por generación.
- **Sin datos personales de estudiantes** (diseño PR004 + filtro PII en backend).
- Marco ético UNESCO 2021 / Guidance GenAI 2023 + mitigaciones OWASP LLM Top 10.

---

## 5. Producto: funcionalidad principal

### 5.1 Tipos de planificación (6)
| Tipo | Límite OA | Estructura |
|---|---|---|
| Clase | 1–4 | `activities[]` + `assessment` |
| Unidad didáctica | 1–8 | `unit.classes[]` (4–8 clases, ≥3 actividades c/u) + `unitAssessment` |
| Mensual | 1–10 | `unit.weeks[]` (3–5 semanas) + `unit.assessment` |
| Anual | 1–12 | `unit.months[]` (8–12 meses) |
| Evaluación | 1–4 | `evaluation` (tipo + instrumento, rúbrica ≥3 dimensiones, Decreto 67) |
| Multigrado | 1–6 | `activities[]` con `targetLevel` (combina 2 niveles) |

### 5.2 Flujo principal
Asistente de **10 pasos**: ① tipo → ② nivel/asignatura/OA (filtro por eje, búsqueda por código, caché localStorage) → ③ contexto pedagógico → ④ metodología (multi-select ≤4 en unit/mensual/anual) → ⑤ estructura (info) → ⑥ evaluación (UI decorativa, ver sección 12) → ⑦ inclusión/DUA (3 principios CAST, "DUA rápido" sugerido) → ⑧ generar → ⑨ revisar + aprobar → ⑩ lista.

### 5.3 Colaboración institucional (S-3)
Organizaciones (colegios), membresías (`owner`/`coordinator`/`teacher`), invitaciones por token con vencimiento 7 días y validación de email, **aprobación UTP** (`canApprovePlanning`), comentarios en subcolección, panel institucional (`#/institucional`) con **"Planes del equipo"** (asignación Free/Pro por docente) y biblioteca compartida del establecimiento.

### 5.4 Planes freemium (S-7)
`PLANS`: Free 10 generaciones/día, Pro 1.000/día (asignado por admin). `setUserPlan` (callable admin-only) escribe `users/{uid}.plan` y el mirror en `organizations/{orgId}/members/{uid}`. **El cobro real (Stripe/Mercado Pago) es trabajo futuro.**

---

## 6. Stack técnico y arquitectura

### 6.1 Capas
```
Docente → Firebase Hosting (Vue 3 + Tailwind CDN, sin build) → Cloud Functions v2
                                                              → Firestore (NoSQL)
                                                              → Auth (email/password)
                                                              → Storage (DOCX exportados)
                                                              → DeepSeek / Gemini
```

### 6.2 Backend — `functions/index.js` (~2.460 líneas, ESM, Node 22)
**13 funciones**: `generatePlanning`, `regenerateSection`, `approvePlanning`, `submitFeedback`, `exportPlanning`, `acceptTerms`, `setUserPlan`, `setUserRole`, `createOrganization`, `inviteMember`, `acceptInvite`, `removeMember`, `onNewAuditLog` (trigger) + helpers exportados para test (`retentionCutoffIso`, `validateTermsAcceptance`, `runRetentionSweep`).

**Pipeline de generación** (`runGeneratePlanning`):
1. Auth → 2. `runRetentionSweep()` oportunista → 3. Límite diario por plan (count en `ai-costs`) → 4. Kill-switch de presupuesto (`budget-usage/{YYYY-MM}`, bloquea al 80%) → 5. Validación de entrada (sin PII, multigrado exige 2 niveles) → 6. OA desde Firestore → 7. Selección de plantilla en cascada `subject+type → type → subject → generic` → 8. `sanitizeContextFields` (PII) + `detectPromptInjection` (8 patrones) → 9. Prompt con prefijo estable (prefix-caching DeepSeek) → 10. `generateFromProvider` (DeepSeek → fallback Gemini) → 11. `extractJson` tolerante a truncamiento → 12. `normalizePlanningOutput` + `validateOutputStructure` por tipo → 13. `runPedagogicalAudit` (V-001…V-016) → 14. `evaluateQuality` (rúbrica 8 criterios → score 0–5 + veredicto) → 15. `runCoherenceReview` PT-007 (segundo LLM, no bloqueante) → 16. Persistencia + trazabilidad (`ai-costs`, `audit-logs`, `recordBudgetUsage` transaccional).

### 6.3 Frontend — módulos ES sin build step
- `public/js/core.js` (~336 líneas): firebase, store global `reactive`, helpers, UI, Layout (skip-link, landmarks), catálogo curricular con caché, `PLANS`, `TERMS_VERSION`/`PRIVACY_VERSION`, re-exports de Vue/Firebase.
- `public/js/app.js` (~556 líneas): páginas ligeras (Landing, Login, Registro, Dashboard, Perfil, Ayuda, Privacidad, Términos) + router manual con `import()` dinámico.
- `public/js/pages/`: `wizard.js` (10 pasos), `detail.js`, `editor.js` (editor manual + autosave 30 s + versionado), `institucional.js` (panel + unirse a org).

### 6.4 Seguridad (multicapa)
Hosting CDN/TLS → Auth → Firestore Security Rules (owner/admin/org-members, escritura solo desde Functions en `audit-logs`/`ai-costs`/`budget-usage`/`feedback`) → validación backend → keys solo en `functions/.env` (nunca frontend). Rate limiting nativo 10/día en `generatePlanning`.

---

## 7. Datos y cobertura curricular

- **2.783 docs** en Firestore `curriculum`: 1.796 OA, 327 habilidades, 598 actitudes, 62 OAT.
- **19 asignaturas** (catálogo dinámico `catalog/subjects`, lectura pública, base multi-país con `country: 'cl'`).
- Niveles: Parvularia (3 ámbitos × 3 niveles), 1°–8° básico, 7°–2° medio, 3°–4° medio (solo Formación General), **EPJA** (156 OA desde Anexo 2 Bases EPJA 2024).
- Fuentes: scraper `scrape-curriculum.mjs` (idempotente, IDs determinísticos) + seeds `seed-epja.mjs`, `seed-catalog.mjs`, `seed-prompt-templates.mjs`.
- Caché curricular client-side (localStorage TTL 7 días) → reduce lecturas Firestore ~90% (~$2/mes).

---

## 8. Calidad, pruebas y observabilidad

| Área | Estado |
|---|---|
| Unit tests | **106/106 Jest** (`functions/index.test.js`, 15 describe) — CI en cada push/PR |
| E2E | **11/11 Playwright** contra producción (`frontend.test.py`) — incluye axe-core WCAG 2.2 AA en 6 rutas públicas (0 violaciones) |
| Evaluación IA | Dataset **55 casos / 13 categorías** (`eval-dataset.mjs` + `eval-batch.mjs`): **global 4.91, 100% aprueba**, prompt-injection detectada 3/3, PII 2/2 |
| Auditoría dependencias | `pnpm audit --prod` → 0 vulnerabilidades |
| Calidad por generación | Rúbrica automática post-generación (8 criterios ponderados, umbral ≥3.0) + verificador de coherencia PT-007 |
| Presupuesto | Kill-switch al 80% (`budget-usage` transaccional) + alerta Cloud Billing (documentada en CONTROL_COSTOS.md) |
| Observabilidad | Performance Monitoring (traces), error-logs web, logger estructurado, audit-logs con `durationMs` |
| Costo/generación | ~$0.00032–0.00043 USD (target <$0.0005) |

---

## 9. Cumplimiento legal y accesibilidad (S-6)

- **Ley 19.628** vigente + **adecuación a Ley 21.719** (vigencia 01/12/2026): política de privacidad publicada (`#/privacidad`) con base legal, derechos ARCO, retención, DPO y prohibición de menores de 16.
- **Términos versionados** (RF-013): `TERMS_VERSION = PRIVACY_VERSION = '2026-07-31'` en **3 lugares** (core.js, index.js, index.test.js) + re-consentimiento con modal bloqueante.
- **Retención de datos** (29.3): `runRetentionSweep` purga `ai-costs` >2 años, logs >1 año (barrido oportunista; Cloud Scheduler bloqueado por IAM).
- **H02 resuelto**: currículum Mineduc declarado contenido oficial de uso público educativo.
- **WCAG 2.2 AA**: 0 violaciones axe-core; skip-link, landmarks, focus-visible, `prefers-reduced-motion`, aria en modal/progressbar/estrellas.

---

## 10. Estado del roadmap

### Fases del MVP (0–18): COMPLETADAS
0 Descubrimiento · 1 Firebase · 2 Ingesta curricular · 3 Auth+Perfil · 4 Frontend base · 5 Manuales · 6 DeepSeek+Gemini · 7 Reglas V-001…V-012 · 8 Exportación · 9 QA (100%) · 10 Piloto (documentado) · 11 Deploy · 12 DUA · 13 Escalado 8 niveles · 14 Multi-asignatura · 15 Ingesta masiva (666 OA) · 16 Catálogo dinámico · 17 Piloto ampliado (en preparación) · 18 Migraciones (Node 22, env vars).

### Plan de escalado (S-0…S-7): COMPLETADAS
| Fase | Contenido |
|---|---|
| S-0 | CI/CD, Gemini fallback, E2E, auditoría deps, revisión jurídica |
| S-1 | Cobertura completa: Parvularia, OAT, EPJA, 2.783 docs, filtro eje/unidad |
| S-2 | 6 tipos de planificación (backend + templates + wizard + editor + detalle) |
| S-3 | Roles, organizaciones, invitaciones, aprobación UTP, comentarios, panel institucional |
| S-4 | Reglas V-013+ , rúbrica 8 criterios, PT-007, red teaming, dataset 55 casos |
| S-5 | Kill-switch presupuesto, observabilidad web, búsqueda OA, lazy-load SPA, auditoría reglas/índices |
| S-6 | Ley 21.719, términos versionados, retención, WCAG 2.2 AA (axe-core) |
| S-7 | Freemium, onboarding (`#/ayuda`), multi-país base, MODELO_NEGOCIO.md |

### Deuda de proceso
- **Piloto docente real: no ejecutado** (infraestructura lista: métricas, feedback, plantillas por asignatura).
- **Reglas e índices Firestore no se despliegan por CI**: la SA (`GCP_SA_KEY`) no tiene el rol `Firebase Rules Admin` ni `cloudscheduler.jobs.update` → se publican a mano (`npx firebase-tools deploy --only firestore`).

---

## 11. Modelo de negocio (S-7)

- Freemium: Free 10 gen/día / Pro 1.000 gen/día (asignado por admin para piloto institucional).
- Métricas de conversión definidas en MODELO_NEGOCIO.md: activación ≥60%, WAU ≥25%, gen/activo/semana ≥3, aprobación ≥70%, upgrade ≥5%, costo <$0.0005.
- Canal ATE/OTEC/universidades: white-label/licenciamiento (requisitos técnicos ya listos).
- **Pendiente de gestión**: cobro real (Stripe/Mercado Pago), negociación del piloto, dashboard de métricas de negocio.

---

## 12. Deuda técnica y hallazgos (priorizados)

### 🔴 Críticos / seguridad (corregir primero)
1. **`regenerateSection` permite sobrescritura arbitraria de campos** (`functions/index.js:1727-1734`): `section` no se valida contra una lista cerrada; un usuario puede sobrescribir `status`/`approvedAt` de su propia planificación y saltarse el flujo de aprobación UTP.
2. **Clave Gemini fallback = código muerto** (`functions/index.js:17,24`): `FIREBASE_API_KEY` (key web de Firebase) se usa como fallback de `getGeminiKey`; no es una clave Gemini válida. Limpiar y cargar la real.
3. **`rateLimiting: {maxCalls: 10, periodSeconds: 86400}`** en `generatePlanning` (`index.js:1342`) contradice `PLANS.pro` (1.000/día): **el plan Pro es inalcanzable**. O bien subir el límite nativo, o quitar el rate limit y confiar en el count por plan.
4. **Carrera en el límite diario** (`index.js:1374-1383`): count + comparación no atómica (peticiones concurrentes pueden exceder el límite).
5. **`regenerateSection` sin control de coste ni presupuesto** (sin límite, sin registro en `ai-costs`/`budget-usage`): rompe la contabilidad del kill-switch.
6. **`runCoherenceReview` subcontabiliza coste**: el segundo LLM no se registra en `ai-costs`/`budget-usage`.
7. **SA admin en el root** (`planificacion-con-ia-firebase-adminsdk-*.json`, gitignored): riesgo de exposición con `git add -f`. Considerar rotarla y moverla fuera del repo.

### 🟠 Bugs funcionales / UX
8. **Paso 6 del wizard es decorativo** (`wizard.js:310-315`): el `<select>` de evaluación no tiene binding; la selección se descarta.
9. **`snap.exists` usado como propiedad en vez de método** en `detail.js:21` y `editor.js:83`: el mensaje "no encontrada" nunca se dispara.
10. **`regenerateSectionFn` importado en todo el frontend pero nunca invocado**: no hay UI de "regenerar sección" pese a que Landing/Ayuda lo prometen. Es la mejora de mayor valor pedagógico declarada.
11. **`quality`/`coherenceReview` calculados y persistidos pero nunca renderizados** en wizard/detalle.
12. **Bug de interpolación** en el resumen del wizard (`wizard.js:407`): el texto DUA se renderiza literalmente.
13. **Autosave crea docs sin acción explícita** en `/nueva-manual` y cleanup del intervalo hecho en `render()` (editor.js:491-493), no en lifecycle real.
14. **Rama PDF de `exportPlanning` no genera audit-log** (inconsistente con DOCX).
15. **`MINOA` definido pero sin uso** en `PLANNING_TYPES`; huecos en numeración V-002/V-003/V-005/V-008/V-010/V-011/V-012 (test sigue diciendo "V-001 a V-012").

### 🟡 Mantenibilidad
16. **~30 helpers duplicados en `functions/index.test.js`** (raíz: `initializeApp()` al importar impide importar `index.js`) + `index.test.cjs` y `scripts/manual-tests.cjs` stale. Refactor candidato: extraer lógica pura a un módulo (p. ej. `functions/logic.js`) que no inicialice app, e importarlo desde index y tests.
17. **`eval-batch.mjs`, `verify-normalize.mjs`, `manual-tests.cjs` re-duplican** reglas/rúbrica/detección.
18. **`ingesta-curriculo.js` no idempotente** (usa `add()` con IDs auto) y con referencias de habilidades sin prefijo vs. códigos prefijados (inconsistencia en 5°B/6°B/8°B/1°M–4°M).
19. **7 scripts `debug-*.mjs` y utilidades ad-hoc** sin limpiar; `deploy.ps1` documenta `functions:config:set` (contradice la política "No functions.config()").
20. **Índice inviable declarado**: `prompt-templates(status+subjects+types)` con doble `array-contains` (Firestore no lo permite; el código filtra en memoria).
21. **`.env.example` no documenta `MONTHLY_BUDGET_USD`**; `firebase.js` del root es legacy sin uso.
22. **`store.plannings` e imports muertos** en todos los módulos de páginas (importan bloques enteros de core.js); `origBeforeUnmount = null` placeholder.
23. **`exports/` en Storage acumula DOCX sin limpieza** (URLs firmadas 7 días).
24. **3 copias de `TERMS_VERSION`/`PRIVACY_VERSION`** (riesgo de drift documentado).
25. **CDN sin SRI** (unpkg, jsdelivr, gstatic); `reports/` gitignored (resultados de evaluación no versionados).
26. **`reportError` escribe stacks completos a `error-logs`** (posible data sensible).
27. **`getPerformance` con `instrumentationEnabled:false`** + traces manuales (razonable pero verificar).

---

## 13. Recomendaciones de mejora (plan priorizado)

### Ola 1 — Seguridad y negocio (inmediata)
1. **Arreglar `regenerateSection`**: whitelist de secciones (`purpose`, `activities`, `assessment`, `differentiation`, `resources`, `unit.classes`, `unit.weeks`, `unit.months`, `unit.assessment`, `evaluation`) + validar contenido contra schema por tipo.
2. **Reconciliar límites**: subir/quitar `rateLimiting` nativo o ajustarlo a `PLANS.pro`; hacer el límite diario atómico (transacción o contador en doc diario).
3. **Control de costes en regeneración y coherencia review**: registrar tokens/costos en `ai-costs` + `budget-usage`.
4. **Limpiar el fallback Gemini muerto** y documentar la clave real.

### Ola 2 — Producto (valor pedagógico)
5. **UI de regeneración por sección** (usar el backend ya listo; es la promesa principal del producto).
6. **Renderizar `quality` y `coherenceReview`** en detalle (transparencia prometida).
7. **Arreglar el paso 6 del wizard** (capturar evaluación formativa/sumativa) y el bug de interpolación DUA.
8. **Corregir `snap.exists`** (método) en detail y editor.

### Ola 3 — Arquitectura y mantenibilidad
9. **Extraer la lógica pura** a un módulo importable (elimina la duplicación de tests y scripts), con `initializeApp()` aislado.
10. **Eliminar tests/scripts stale** (`index.test.cjs`, `manual-tests.cjs`) y debug-* de un solo uso.
11. **Hacer idempotente `ingesta-curriculo.js`** (IDs determinísticos como el scraper) y corregir referencias de habilidades.
12. **Limpiar imports muertos** del frontend; mover cleanup de autosave a `onUnmounted`.
13. **Limpieza de `exports/`** (borrar DOCX >7 días vía función programada) y rotación de la SA.
14. **CI: otorgar roles a la SA** (`Firebase Rules Admin`, `cloudscheduler.jobs.update`) para desplegar reglas/índices y reinstalar el `onSchedule` de retención.

---

## 14. Referencias clave (archivo:línea)

| Tema | Ubicación |
|---|---|
| Pipeline de generación | `functions/index.js:1357-1646` |
| Reglas V-001…V-016 | `functions/index.js:154-232` |
| Rúbrica de calidad | `functions/index.js:608-722` |
| Instrucciones por tipo | `functions/index.js:1040-1269` |
| `regenerateSection` (riesgo sección libre) | `functions/index.js:1648-1741` |
| `generatePlanning` (rate limit vs Pro) | `functions/index.js:1338-1345` |
| Kill-switch presupuesto | `functions/index.js:65-100` |
| Fallback Gemini (clave muerta) | `functions/index.js:17-24, 918-995` |
| `PLANS`/`getUserPlan`/`setUserPlan` | `functions/index.js:56-61, 1878` |
| `acceptTerms` / retención | `functions/index.js:2391-2455` |
| Wizard (paso 6 decorativo, DUA) | `public/js/pages/wizard.js:310-315, 317-391` |
| `snap.exists` bug | `public/js/pages/detail.js:21`, `editor.js:83` |
| Test axe-core | `public/js/frontend.test.py:210-246` |
| Diágnostico y plan de mejoras | `ANALISIS_MEJORAS.md` |
| Roadmap y cierres de fase | `PLAN_ESCALADO.md` |
| Requisitos/specs | `PROJECT_MASTER_PLAN.md` |
| Negocio | `MODELO_NEGOCIO.md` |
| Legal | `REVISION_JURIDICA.md` |
| Costos | `CONTROL_COSTOS.md` |
| Reglas Firestore | `firestore.rules` |
| CI/CD | `.github/workflows/ci.yml`, `deploy.yml` |

---

*Documento generado para revisión externa. Todos los datos provienen del código y documentación del repositorio; las líneas referenciadas son las del estado actual (commit `585a4ee`).*
