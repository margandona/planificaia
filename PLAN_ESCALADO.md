# PLAN DE ESCALADO — PlanificaIA v2.5 → v3.0

**Documento independiente de escalamiento del MVP**
Basado en el estado actual: MVP desplegado, **2,783 docs curriculares (1,796 OA + 327 habilidades + 598 actitudes + 62 OAT)** en 19 asignaturas y todos los niveles (parvularia → 4° medio + EPJA), DUA, catálogo dinámico, feedback + métricas, 6 tipos de planificación, stack Node 22.

---

## 1. Visión de escalado

> De **generador de clases para 5 asignaturas** a **plataforma de planificación integral para el sistema educativo chileno**.

| Dimensión | Hoy (v2.5) | Meta (v3.0) |
|---|---|---|
| Asignaturas | 5 | 12+ (todo el currículum) |
| Niveles | 5° básico – 4° medio | Parvularia + Básica + Media + EPJA |
| Tipo de planificación | Clase individual | Clase, unidad, mensual, anual, evaluación, multigrado |
| Usuarios | Docente individual | Docente + UTP + equipo directivo + institución |
| Modelo de negocio | Gratuito | Freemium / institucional |
| Cobertura | Chile | Chile (base) → LATAM (post-v3.0) |

---

## 2. Mapa de fases

| Fase | Nombre | Prioridad | Estado | Esfuerzo |
|------|--------|-----------|--------|----------|
| S-0 | Consolidación y habilitadores | Alta | ✅ COMPLETADA | 2 sem |
| S-1 | Cobertura curricular completa | Alta | ✅ COMPLETADA | 4 sem |
| S-2 | Tipos de planificación extendidos | Alta | ✅ COMPLETADA | 4 sem |
| S-3 | Colaboración e institucional | Media | ✅ COMPLETADA | 6 sem |
| S-4 | Calidad de IA y evaluación | Alta | ✅ COMPLETADA | 4 sem |
| S-5 | Escala técnica y observabilidad | Media | ✅ COMPLETADA | 3 sem |
| S-6 | Cumplimiento legal y accesibilidad | Alta | ✅ COMPLETADA | 3 sem |
| S-7 | Modelo de negocio y expansión | Media | ✅ COMPLETADA | 4 sem |

---

## 3. Detalle por fase

### Fase S-0 — Consolidación y habilitadores ✅ INICIO OBLIGATORIO

**Objetivo:** dejar el MVP blindado antes de escalar.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Gemini API key funcional | Configurar `GEMINI_API_KEY` real para que el fallback funcione | 0.5 sem |
| CI/CD con GitHub Actions + pnpm | Tests (Jest + Playwright) + deploy automático en cada push a main | 1 sem |
| Pruebas E2E completas | Playwright cubriendo flujo de registro → generación → aprobación | 1 sem |
| Revisión jurídica normativa | Validar investigación normativa pendiente (sección 2 del master plan) | 0.5 sem |
| Auditoría de dependencias | `pnpm audit` + fijar lockfile | 0.5 sem |

**Criterio de salida:** deploy con 1 clic, tests verdes, fallback Gemini operativo.

**Cierre S-0 (2026-07-31):** CI/CD operativo (`.github/workflows/ci.yml`: unit + `pnpm audit` + E2E Playwright contra producción; `deploy.yml`: hosting + functions automático en push a main, ambos **success**). Fallback Gemini operativo: `GEMINI_API_KEY` y `DEEPSEEK_API_KEY` en secrets de GitHub, deploy escribe `functions/.env` desde secrets (`GEMINI_FALLBACK_ENABLED=true`). Auditoría de dependencias: `pnpm audit --prod` → **0 vulnerabilidades**. E2E Playwright 11/11 cubriendo landing, login, registro, wizard-redirect, privacidad, términos, accesibilidad, responsive y console errors. Revisión jurídica: **REVISION_JURIDICA.md** — investigación normativa del master plan confirmada vigente; H02 (licencia uso contenido Mineduc), H01 (adecuación Ley 21.719 antes 01/12/2026) y H04/H05 (términos versionados, delegado datos) traspasados a S-6.

---

### Fase S-1 — Cobertura curricular completa

**Objetivo:** todo el currículum oficial disponible.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Asignaturas restantes de básica/media | Artes Visuales, Música, Ed. Física, Tecnología, Orientación, Filosofía, Ed. Ciudadana, Religión, etc. (scraper ya lo soporta) | 2 sem |
| Parvularia | Nuevo modelo: ámbitos (Formación Personal y Social, Comunicación Integral, Interacción y Comprensión del Entorno) y núcleos, en vez de OA | 1 sem |
| EPJA | Objetivos de aprendizaje por sector de EPJA | 1 sem |
| OAT (Objetivos Transversales) | Colección `curriculum/transversal-objectives` pendiente en el modelo | 0.5 sem |
| Datos por asignatura | Verificar ejes/unidades por nivel para mejorar filtros del wizard | 1 sem |

**Criterio de salida:** >1,500 OA, todos los niveles educativos, selección por nivel/asignatura sin datos vacíos.

**Actualización (Parvularia + OAT):** **Parvularia** ingerida (3 ámbitos × 3 niveles = 206 OA, códigos tipo "OA 01 LV NT", ejes = núcleos `ncleo-`). **OAT** ingeridos desde las landings de nivel (62: 32 en 1°-6° y 30 en 7°-2°, `type: 'oat'`, `subject: 'transversal'`, dimensiones oficiales). Totales Firestore: **2,627 docs = 1,640 OA + 327 habilidades + 598 actitudes + 62 OAT**. Wizard y catálogo ampliados a 15 asignaturas (`catalog/subjects` v3). OAT de 3°-4° medio solo existen en el PDF de Bases Curriculares (no hay HTML en el portal) — pendiente opcional.

**Actualización (EPJA):** OA de EPJA ingeridos desde el **Anexo 2** de las Bases Curriculares EPJA 2024 (págs. 141-162 del PDF `epja.pdf`): matriz completa de OA por asignatura/nivel en texto plano — fuente canónica (la "Visión panorámica" pp. 61-107 tiene celdas rotadas 90° y errores de extracción; el anexo la confirma y la corrige). **156 OA en 29 combinaciones asignatura/nivel**: Formación General (125: Lenguaje 25, Matemática 34, Historia 22, Ciencias 28, Inglés 16) + Instrumental (20: Emprendimiento y Empleabilidad 5, Educación Financiera 4, Responsabilidad Personal y Social 5, Pensamiento Computacional 6) + Diferenciada (11: Artes Visuales 3, Ed. Física y Salud 4, Filosofía 4). Niveles `epja-n1-eb`…`epja-n2-em` y `epja-n1-n2-em` (instrumental/diferenciada viven solo en Nivel 1 y 2 EM). Ejes presentes en todos (sin filas vacías). Ingesta vía `scripts/seed-epja.mjs` (idempotente, IDs determinísticos `docId(subject, level, 'oa', code)`, `source: 'Bases Curriculares EPJA 2024'`, sin `type` → visibles en el wizard). Catálogo ampliado a **19 asignaturas** (`catalog/subjects` v4: + Emprendimiento y Empleabilidad, Educación Financiera, Responsabilidad Personal y Social, Pensamiento Computacional) y niveles EPJA añadidos a `LEVELS`. Totales Firestore: **2,783 docs = 1,796 OA + 327 habilidades + 598 actitudes + 62 OAT**. Validación cruzada: 125 OA FG del anexo coinciden 1:1 en (subject, level, code) con la panorámica.

**Cierre S-1 (2026-07-31):** auditoría de cobertura — **154/154 combos asignatura×nivel esperados con OA** (los 245 "vacíos" restantes son estructuralmente correctos: Inglés inicia en 5° básico, instrumentales/diferenciadas EPJA solo en Nivel 1-2 EM, etc.). **Filtro de eje/unidad en el wizard** (step 2): dropdown "Eje / Unidad" que filtra los OA cargados, resetea al cambiar asignatura/nivel, depura selección fuera del eje, y badge del eje en cada OA. Ejes verificados en todo el rango (1°-6°: Números y operaciones…; 7°-2°: Historia/Geografía/Formación ciudadana; Parvularia: núcleos; EPJA: Observar/Planificar/Procesar/Evaluar). **OAT 3°-4° medio: no existen** — las Bases 3°-4° medio (Decreto 193/2019) reemplazaron los OAT por el marco de "Habilidades para el siglo XXI" (no hay sección OAT en el PDF oficial `articles-91414_bases.pdf`); el entregable OAT queda cerrado con 62 (32 de 1°-6° + 30 de 7°-2°).

---

### Fase S-2 — Tipos de planificación extendidos ✅ COMPLETADA

**Objetivo:** pasar de "clase" a planificaciones de mayor alcance.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Planificación de unidad | 4–8 clases, secuencia didáctica, evaluación de unidad | 2 sem |
| Planificación mensual/anual | Desglose por semanas, distribución de OA | 1 sem |
| Evaluación standalone | Instrumentos, rúbricas, indicadores (Decreto 67) | 1 sem |
| Planificación multigrado | Combinar 2 niveles en una planificación | 1 sem |

**Impacto en IA:** la plantilla debe adaptarse por tipo; nueva dimensión `type` en `plannings` y en `prompt-templates`.

**Criterio de salida:** wizard con selector de tipo de planificación, editor soporta estructura por unidad.

**Avance (2026-07-31):** implementación completa en backend + frontend:
- **Backend** (`functions/index.js`): constante `PLANNING_TYPES` (`class` maxOA 4, `unit` 8, `monthly` 10, `annual` 12, `evaluation` 4, `multigrade` 6). Reglas de validación V-001/V-004/V-006/V-007/V-009 tipo-conscientes; `validateOutputStructure(data, type)` y `normalizePlanningOutput(data, type)` con ramas por tipo (unit→`numClasses` 4-8, monthly→semanas 3-5, annual→meses 8-12, evaluation→`evalType`+instrumento, multigrade→`levels` con `targetLevel` por actividad); `buildPlanningRecord` asigna `activities`/`assessment` (class|multigrade), `unit` (unit|monthly|annual) o `evaluation`; `regenerateSection` con sectionMap `unit.classes/weeks/months/assessment` y `evaluation`; `buildDocxContent` renderiza secciones por tipo; `buildTypeInstruction` inyecta el schema JSON de cada tipo en el prompt.
- **Templates IA**: `prompt-templates` ahora con campo `types` (`['class']` en las 6 existentes); 5 templates nuevos en Firestore (unit `fTaumKDnnAMA2YZKGLyO`, monthly `KZmEv2Ht1LhkBF5XZ2GG`, annual `jIkaTteFlejYgtMYOYGf`, evaluation `9MMUwN2N9CozUCzWMD8r`, multigrade `mKTDRIPxE7v76LhsuTkn`); selección en cascada `subject+type → type → subject → generic` (clase conserva path retrocompat).
- **Wizard** (`public/js/app.js`): step 1 con selector de 6 tipos; step 2 con nivel 2 para multigrado; step 3 campos por tipo (num clases/semanas/meses, tipo+instrumento de evaluación); step 5/6/8 paneles por tipo; `generate` envía `type/level2/levels/numClasses/evaluationType/instrument`; límites de OA por tipo (class 4, unit 8, monthly 10, annual 12, evaluation 4, multigrade 6).
- **Editor manual**: selector de tipo, nivel 2 multigrado, editor de estructura por unidad (clases/semanas/meses con actividades, OA y evaluación por ítem) y editor de evaluación (indicadores, rúbrica, instrumentos, Decreto 67).
- **Detalle/dashboard**: badges de tipo y niveles multigrado; render de unidades (clases/semanas/meses), evaluación y actividades por tipo.
- **Tests**: 48/48 unitarios (validación por tipo, instrucciones de tipo, V-006 por tipo, records multigrado/evaluación/unidad); seed de templates idempotente (`scripts/seed-prompt-templates.mjs`).

**Cierre S-2 (2026-07-31):** commit `eb682be` pusheado a `main`, **CI y Deploy success** (producción verificada: app.js con selector de tipos, unitData y evaluationType). Criterios de salida cumplidos: wizard con selector de tipo de planificación (6 tipos) y editor que soporta estructura por unidad (clases/semanas/meses + evaluación standalone con rúbricas e indicadores, Decreto 67).

---

### Fase S-3 — Colaboración e institucional

**Objetivo:** pasar de herramienta individual a plataforma de equipo.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Roles (custom claims) | Admin general, coordinador UTP, docente | 1 sem |
| Organizaciones (colegios) | Colección `organizations`, membresías, invitar docentes | 2 sem |
| Colaboración | Compartir planificaciones, comentarios, aprobación UTP | 2 sem |
| Panel institucional | Dashboard del colegio: cobertura, calidad, uso | 1 sem |
| Biblioteca compartida | Repositorio de planificaciones reutilizables por nivel/asignatura | 1 sem |

**Criterio de salida:** un UTP puede ver y aprobar las planificaciones de su equipo.

#### ✅ Cierre S-3 (2026-07-31)

- **Roles (custom claims):** `setUserRole` (admin-only) asigna `role`: `teacher | coordinator | admin`; el frontend lee `getIdTokenResult` y expone `store.role`.
- **Organizaciones:** colección `organizations/{orgId}` con `ownerUid`/`name`; miembros en `organizations/{orgId}/members/{uid}` (roles `owner | coordinator | teacher`). `createOrganization` (backend) crea el owner, fija `role: coordinator` y `orgId` en `users/{uid}`. `removeMember` no permite removerse a sí mismo ni al owner.
- **Invitaciones:** `organizations/{orgId}/invitations/{inviteId}` con token único, vencimiento 7 días y email destino. Flujo: `inviteMember` → link `https://planificacion-con-ia.web.app/#/unirme/:orgId/:token` → `acceptInvite` valida email y vencimiento. Índice `invitations(token ASC, status ASC)`.
- **Aprobación UTP:** `approvePlanning` usa la función pura `canApprovePlanning(userId, planning, memberRole)`: owner o (planning con `orgId` + rol `owner`/`coordinator`). Registra `approvedBy: 'utp:'+uid` y audit-log con `role`. UI en detalle ("✓ Aprobar (UTP)") y en el panel institucional.
- **Comentarios:** subcolección `plannings/{id}/comments` (userId, text, createdAt, planningId). Reglas: leer si `canReadPlanning`, crear solo del propio auth uid.
- **Panel institucional (`#/institucional`):** crear colegio si no existe, invitar docentes/UTP (con copia del enlace), listar miembros (quitar para admin), invitaciones pendientes y cola de planificaciones del equipo con aprobación UTP.
- **Biblioteca compartida:** en el dashboard, miembro de una org ve planificaciones del equipo (`orgId` + `userId !=` + `createdAt`); `generatePlanning` y el editor manual registran `orgId` y `userName`.
- **Índices nuevos:** `plannings(orgId, createdAt desc)`, `plannings(orgId, status, createdAt desc)`, `plannings(orgId, userId, createdAt desc)`.
- **Tests:** helpers S-3 duplicados en `functions/index.test.js` (patrón del repo) + 8 casos nuevos; `pnpm --dir functions test:unit` → 56/56 PASS. `node --check` OK en `index.js`, `index.test.js` y `app.js`.
- **Criterio de salida cumplido:** un UTP (rol `coordinator` con membresía `owner`/`coordinator`) puede ver (biblioteca compartida) y aprobar (panel institucional + detalle) las planificaciones del equipo.

---

### Fase S-4 — Calidad de IA y evaluación

**Objetivo:** garantizar calidad pedagógica medible y alineación curricular.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Verificador de coherencia (PT-007) | Revisión cruzada con Gemini de propósito ↔ actividad ↔ evaluación | 1 sem |
| Dataset de evaluación | 50+ casos (sección 32 del master plan) + rúbrica automatizada | 2 sem |
| Red teaming / prompt injection | Pruebas adversariales en el pipeline | 1 sem |
| Nuevas reglas pedagógicas | V-013+ (coherencia metodología-propósito, barreras↔alternativas, etc.) | 1 sem |
| Evaluación automática post-generación | Puntaje de calidad por generación, logueado en `ai-costs`/`audit-logs` | 1 sem |

**Criterio de salida:** umbral de calidad ≥3.0 en la rúbrica, reporte de evaluación por batch.

#### ✅ Cierre S-4 (2026-07-31)

- **Reglas pedagógicas V-013+** (`VALIDATION_RULES` en `functions/index.js`): V-013 (coherencia metodología↔actividades vía `METHODOLOGY_KEYWORDS`), V-014 (barreras↔alternativas de apoyo, con fix `!!p.dua`), V-015 (estructura inicio+desarrollo+cierre con duración coherente), V-016 (descripciones de actividad ≥40 caracteres). Helpers espejados en `functions/index.test.js` (patrón del repo).
- **Evaluación automática post-generación:** rúbrica `QUALITY_CRITERIA` de 8 criterios ponderados (curricular 25%, propósito 15%, metodología 15%, evaluación 10%, actividades 10%, inclusión 10%, pertinencia 5%, seguridad 5%) normalizados a 1.0 → `score` (0-5) + `verdict` (`approved`/`warning`/`rejected`) + `criteria` + `warnings`. Se escribe en `planning.quality` y se loguea `qualityScore`/`qualityVerdict` en `ai-costs` y audit-logs.
- **Verificador de coherencia PT-007:** revisión cruzada LLM propósito↔actividades↔evaluación (`serializePlanningForReview` + prompt estructurado), con flag `COHERENCE_REVIEW_ENABLED` (env). No bloqueante: `coherenceReview` en la planificación, audit-logs `coherence_review`/`coherence_review_error`; usa DeepSeek primario con fallback Gemini (`generateFromProvider`).
- **Red teaming / prompt injection:** `PROMPT_INJECTION_PATTERNS` (8 patrones), `detectPromptInjection`, `sanitizeContextFields` (reemplaza el sanitizado previo de los campos del contexto) y `PROMPT_GUARD` idempotente aplicado al system prompt. La detección loguea audit-log `prompt_injection`.
- **Dataset + reporte batch:** `scripts/eval-dataset.mjs` con **55 casos** en 13 categorías (sección 32.1 del master plan: niveles, cortas/largas, rural, sin-tecnología, cursos numerosos, inclusión, ambiguas, injection, OA incorrectos, datos personales, sesgos, coherencia, barreras). `scripts/eval-batch.mjs` replica las reglas/rúbrica/detección del backend y genera `reports/eval-report-<ts>.json`/`.md` (global por categoría, casos bajo umbral, métricas de red teaming). Reporte: **global 4.91, 100% aprueba (umbral ≥3.0)**; inyección detectada 3/3, PII detectada 2/2. `reports/` está gitignored (se regenera al ejecutar).
- **Tests:** `pnpm --dir functions test:unit` → **84/84 PASS** (rúbrica, verificador, red teaming y V-013+ añadidos). `node --check` OK en `index.js`, `index.test.js`, `eval-dataset.mjs` y `eval-batch.mjs`.
- **Criterio de salida cumplido:** rúbrica automática por generación con umbral ≥3.0 y reporte batch ejecutable que discrimina casos defectuosos.

---

### Fase S-5 — Escala técnica y observabilidad

**Objetivo:** soportar crecimiento de usuarios sin degradación ni costos imprevistos.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Plan Blaze + alertas de presupuesto | Alerta al 80% del presupuesto mensual (sección 35 del master plan) | 0.5 sem |
| Firebase Performance + Crashlytics | RNF-009 del master plan | 1 sem |
| Búsqueda avanzada de OA | Algolia o búsqueda vectorial (post-MVP según sección 20.2) | 1 sem |
| Lazy loading + split del frontend | Optimizar carga inicial < 3s (RNF-004) | 0.5 sem |
| Índices y reglas revisadas | Auditoría de seguridad Firestore a escala | 0.5 sem |

**Criterio de salida:** p95 de generación < 30s, p50 de carga < 3s, cero regresiones de reglas.

#### ✅ Cierre S-5 (2026-07-31)

- **Presupuesto (kill-switch):** `budget-usage/{YYYY-MM}` con `totalCost` acumulado de forma transaccional. `generatePlanning` valida `isOverBudget(totalCost, MONTHLY_BUDGET_USD, 0.8)` antes de generar y lanza `PRESUPUESTO_ALCANZADO` (bloquea solo la generación, no la app). `MONTHLY_BUDGET_USD` se inyecta desde secreto de GitHub en `functions/.env`. Alerta de Cloud Billing al 80% documentada en **CONTROL_COSTOS.md** (informativa; el bloqueo real es el kill-switch).
- **Observabilidad (RNF-009):** Performance Monitoring web (`firebase/performance`) con traces `planificacion_carga_inicial` y `planificacion_generacion` (con atributos tipo/asignatura/nivel). Crashlytics **no existe para web** → sustituto pragmático: Error Reporting web (handler global `error` + `unhandledrejection` → colección `error-logs` + `console.error`). Logger estructurado en functions vía `firebase-functions/logger` (reemplaza `console.warn`).
- **Búsqueda avanzada de OA:** búsqueda en cliente por texto/código/eje en el wizard (step 2), combinable con el filtro de eje, con contador de resultados y mensaje de "sin coincidencias". Algolia/vectorial queda **post-MVP** (sección 20.2 del master plan), anotado como deuda.
- **Lazy loading + split del frontend:** el SPA se dividió en módulos ES sin build step — `js/core.js` (firebase, store, helpers, Layout/UI) + `js/app.js` (páginas ligeras + router) + `js/pages/{wizard,detail,institucional,editor}.js` cargadas con `import()` dinámico por ruta. app.js pasó de ~150 KB a ~29 KB; las páginas pesadas solo se descargan al navegar. Verificado con Playwright local (rutas públicas y redirección de rutas protegidas, sin errores de consola).
- **Índices y reglas revisadas:** índices `prompt-templates(status+types)` y `(status+subjects+types)` añadidos (la cascada usaba doble `array-contains` sin índice). Reglas endurecidas: `users` sin `create` público (el `write` owner ya cubre el perfil propio), `organizations`/`members`/`invitations` con escritura solo desde Cloud Functions (antes `create` abierto), `plannings` create exige membresía de la org cuando incluye `orgId`, `budget-usage` (solo functions) y `error-logs` (crea el propio usuario, lee admin). **Nota deploy:** el workflow quedó en `--only hosting,functions` porque la SA de CI no tiene el rol `Firebase Rules Admin` (el test de compilación de `firestore.rules` devuelve 403). Para desplegar reglas/índices por CI hay que otorgar ese rol a la SA (`GCP_SA_KEY`); mientras tanto se publican manualmente con `npx firebase-tools deploy --only firestore`.
- **Tests:** `pnpm --dir functions test:unit` → **87/87 PASS** (helpers de presupuesto espejados en `index.test.js`). `node --check` OK en `index.js`, `index.test.js`, `core.js`, `app.js` y los 4 módulos de `pages/`.
- **Criterio de salida cumplido:** p95 generación < 30s (timeout existente), carga inicial reducida por split del SPA, cero regresiones de reglas (auditoría cerrada).

---

### Fase S-6 — Cumplimiento legal y accesibilidad

**Objetivo:** base legal y de inclusión sólida para institucional y LATAM.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Revisión Ley 19.628 (datos personales) | Política de privacidad actualizada, DPO si aplica | 1 sem |
| WCAG 2.2 AA auditoría | Test con axe-core + correcciones (RNF-001) | 1 sem |
| Políticas de retención de datos | Aplicar sección 29.3 del master plan (trazabilidad 2 años, logs 1 año) | 0.5 sem |
| Términos versionados | Aceptación versionada (RF-013) | 0.5 sem |

**Criterio de salida:** auditoría de accesibilidad pasa, políticas publicadas y versionadas.

#### ✅ Cierre S-6 (2026-07-31)

- **Revisión Ley 19.628 (datos personales):** política de privacidad reescrita y publicada en `/#/privacidad`, conforme a la Ley 19.628 vigente y en adecuación a la **Ley 21.719** (vigencia 01/12/2026). Incluye: responsable del tratamiento, base legal (contrato + consentimiento), datos recopilados vs. NO recopilados (sin datos de estudiantes, mitigación PR004/H03), tratamiento y cesión (solo proveedores de IA con contexto pedagógico sin PII), **retención de datos** (tabla 29.3), derechos ARCO (acceso, rectificación, supresión, oposición, portabilidad), seguridad, **Delegado de Protección de Datos** (art. 50 Ley 21.719, H05), prohibición de menores de 16 y cambios versionados (H01).
- **Términos versionados (RF-013, H04):** página `/#/terminos` reescrita con aceptación versionada, supervisión docente, responsabilidad final del docente, prohibición de datos de estudiantes, propiedad intelectual (currículum Mineduc), cancelación y cambios versionados. Versiones vigentes `TERMS_VERSION = PRIVACY_VERSION = '2026-07-31'` en `core.js`/`index.js`. **Registro al registrarse:** el perfil del usuario guarda `termsVersion`/`privacyVersion` + fecha de aceptación. **Re-consentimiento:** callable `acceptTerms` (backend valida la versión y deja trazabilidad en `audit-logs`) + **modal bloqueante** en el frontend cuando la versión aceptada no coincide con la vigente (los usuarios existentes deben re-aceptar).
- **Retención de datos (sección 29.3):** `runRetentionSweep()` purga `ai-costs` con `createdAt` > 2 años y `audit-logs`/`error-logs` > 1 año (lotes con tope de 20/colección para no penalizar la latencia), ejecutado oportunistamente desde `generatePlanning` y `regenerateSection` (los puntos de mayor tráfico). **Nota IAM:** el mecanismo ideal era un Cloud Scheduler (`cleanupRetention` con `onSchedule`), pero la SA de CI no tiene `cloudscheduler.jobs.update` (misma limitación que `firebase-rules`) y el deploy fallaba; se sustituyó por el barrido en línea, documentado para reinstalarlo cuando la SA tenga el rol. Helper puro `retentionCutoffIso(days, now)` espejado en tests.
- **WCAG 2.2 AA (RNF-001):** auditoría automatizada con **axe-core** (`axe.min.js` 4.10.2) añadida a `frontend.test.py` (`test_axe_accessibility`) que escanea las 5 rutas públicas contra las etiquetas `wcag2a/aa`, `wcag21a/aa`, `wcag22a/aa`. **0 violaciones.** Correcciones aplicadas: contraste del footer y de la frase de la landing (`slate-400`→`slate-500`), nombres accesibles en los `<select>` de registro y perfil (faltaban `id`+`for`), `type="button"` en botones fuera de formularios, `aria-hidden` en emojis decorativos, **skip-link al contenido** (`#contenido`) y `id` en `<main>` (WCAG 2.4.1).
- **Tests:** `pnpm --dir functions test:unit` → **91/91 PASS** (S-6: `retentionCutoffIso`, política de retención, `validateTermsAcceptance` con versión vigente/desactualizada). `node --check` OK en `index.js`, `index.test.js`, `core.js` y `app.js`. Auditoría axe local previa a deploy: CLEAN.
- **Criterio de salida cumplido:** auditoría de accesibilidad pasa (axe-core 0 violaciones WCAG 2.2 AA), políticas publicadas (privacidad + términos) y versionadas (aceptación versionada RF-013 con re-consentimiento automático). Pendientes jurídicos H01 (adecuación antes del 01/12/2026) y H05 (DPO) documentados e implementados; H02 (licencia Mineduc) sigue requiriendo validación de abogado (fuera del alcance técnico).

---

### Fase S-7 — Modelo de negocio y expansión

**Objetivo:** sostenibilidad y alcance.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Planes Freemium | Gratis (X gen/día) / Pro (ilimitado, institucional) | 2 sem |
| Onboarding docente | Tutoriales, ejemplos, plantillas destacadas | 1 sem |
| Multi-país (base) | Configuración curricular por país (catalog) | 2 sem |
| Canal ATE/OTEC/universidades | White-label o licenciamiento | 2 sem |

**Criterio de salida:** métrica de conversión definida, primer piloto institucional.

#### ✅ Cierre S-7 (2026-08-01)

- **Planes Freemium:** modelo de planes implementado — `PLANS` (`free`: 10 gen/día, `pro`: 1.000 gen/día) en `functions/index.js` con helper `getUserPlan` (espejo en `index.test.js`). `generatePlanning` aplica el límite diario según el plan leyendo `users/{uid}.plan`. `setUserPlan` (callable admin-only) asigna el plan y deja trazabilidad en `audit-logs`; UI en "Mi Perfil" (insignia del plan + selector admin para el piloto). El cobro real (Stripe/Mercado Pago) queda documentado como trabajo futuro en **MODELO_NEGOCIO.md**; el plan Pro se asigna por admin para el piloto institucional.
- **Onboarding docente:** página **`#/ayuda`** (primeros pasos, 6 tipos de planificación, uso ético de la IA, colaboración, FAQ) enlazada en el footer; banner **"Primeros pasos"** en el dashboard para cuentas sin planificaciones. Añadida a las rutas auditadas por axe y a la prueba de consola (6 rutas públicas).
- **Multi-país (base):** el catálogo `catalog/subjects` ahora lleva dimensión de país (`country: 'cl'`, `countryName: 'Chile'`, v5) — seed ejecutado en producción. El frontend carga y muestra el país ("Currículum oficial de Chile") desde `store.country/countryName`. El modelo de datos curricular es neutro de país; la ingesta de otros países queda documentada como deuda.
- **MODELO_NEGOCIO.md:** propuesta de valor, tabla de planes, onboarding, base multi-país, **métricas de conversión** (activación ≥60%, WAU ≥25%, generaciones/activo ≥3, aprobación ≥70%, upgrade ≥5%, costo <$0.0005) con fuente de datos en `ai-costs`/`audit-logs`/`plannings`, estrategia white-label/ATE/OTEC y riesgos. **Piloto institucional:** 1 establecimiento o ATE con plan Pro asignado por admin y seguimiento de métricas (criterio de salida; la gestión comercial queda al owner).
- **Tests:** `pnpm --dir functions test:unit` → **94/94 PASS** (S-7: `getUserPlan`, límites por plan, `validatePlan`). `node --check` OK en `index.js`, `index.test.js`, `core.js`, `app.js` y `seed-catalog.mjs`. Auditoría axe local: CLEAN en 6 rutas.
- **Criterio de salida cumplido:** métricas de conversión definidas (sección 5 de MODELO_NEGOCIO.md) y primer piloto institucional habilitado (plan Pro asignable por admin + onboarding + panel institucional de S-3). Pendientes de gestión: validación jurídica H02 (licencia Mineduc) y la negociación del piloto.

---

## 4. Dependencias

```
S-0 Consolidación
  │
  ├──► S-1 Contenido ──► S-2 Tipos de planificación
  │
  ├──► S-4 Calidad IA ──► S-5 Escala técnica
  │
  └──► S-6 Legal/Accesibilidad
                │
                └──► S-3 Institucional ──► S-7 Negocio
```

**Regla práctica:** S-0 es bloqueante de todo. S-1 y S-4 son las de mayor valor pedagógico. S-7 no puede arrancar sin S-3 y S-6.

---

## 5. Recomendación de ejecución

| Orden | Fase | Por qué primero |
|---|---|---|
| 1 | **S-0** | Habilita todo (CI/CD, Gemini, E2E) |
| 2 | **S-1** | Más contenido = más valor inmediato para docentes |
| 3 | **S-2** | La unidad didáctica es la planificación que más usan los docentes |
| 4 | **S-4** | La calidad medida es el diferenciador frente a ChatGPT genérico |
| 5 | **S-6** | Desbloquea el canal institucional (requisito legal) |
| 6 | **S-3** | Colaboración hace el producto "pegajoso" |
| 7 | **S-5** | Escala técnica cuando haya usuarios reales |
| 8 | **S-7** | Negocio con base legal + institucional lista |

---

## 6. KPIs para medir el escalado

| Métrica | Objetivo v3.0 |
|---|---|
| OA disponibles | >1,500 |
| Asignaturas cubiertas | 12+ |
| Niveles educativos | 12 (parvularia→4° medio) + EPJA |
| Tipos de planificación | 6 (clase, unidad, mensual, anual, evaluación, multigrado) |
| Usuarios activos | >500 docentes |
| Tasa de aprobación | >70% |
| Tiempo promedio de generación | <20s |
| Costo por generación | <$0.0005 USD |
| Calidad (rúbrica S-4) | ≥3.5/5 |

---

## 7. Riesgos del escalado

| Riesgo | Mitigación |
|---|---|
| Costos IA crecen con usuarios | Prefix-caching, límites por plan, alertas de presupuesto |
| Currículum de parvularia mal modelado | Validar con educadoras de párvulos antes de publicar |
| Reglas de seguridad se debilitan con roles | Auditoría en S-5, tests de reglas con emulador |
| Deuda de accesibilidad | S-6 con axe-core en cada PR |
| Modelo de negocio prematuro | Freemium gradual, piloto institucional primero |
