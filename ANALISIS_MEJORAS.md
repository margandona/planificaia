# Análisis técnico y plan de mejoras — PlanificaIA

**Fecha:** 2026-08-01
**Ámbito:** generación de planificaciones por IA (todos los tipos), warnings de calidad, DUA, planes freemium y manual de uso.
**Fuentes:** `functions/index.js`, `public/js/core.js`, `public/js/app.js`, `public/js/pages/{wizard,detail,editor,institucional}.js`, `MANUAL_USUARIO.md`.

---

## 1. Por qué la planificación mensual muestra 4 advertencias

Las 4 advertencias que ve el usuario al generar una planificación mensual son, en su mayoría, **falsos positivos por un desajuste estructural**: las reglas de calidad leen campos de nivel raíz, pero el tipo `monthly` guarda todo dentro de `p.unit`.

### 1.1 Flujo de generación

1. `runGeneratePlanning` (`functions/index.js:1274-1563`) recibe `{ context, oaIds, useFallback }`.
2. `normalizePlanningOutput(aiResult.content, type)` aplanó el JSON de la IA (`index.js:1463`).
3. `validateOutputStructure(normalizedContent, type)` valida la estructura mínima (`index.js:1464`); si falla → `VALIDACION_FALLIDA` (`index.js:1474`).
4. `buildPlanningRecord(...)` construye el objeto y ejecuta el audit pedagógico (`index.js:1249`): `planning.warnings = runPedagogicalAudit(planning)`.
5. `evaluateQuality(planning)` re-ejecuta el audit y calcula el score ponderado (`index.js:1486`).
6. El objeto con `warnings` se devuelve al cliente (`index.js:1559-1562`); el wizard los pinta en `public/js/pages/wizard.js:381-384`.

### 1.2 Las reglas y su causa raíz

Las reglas viven en `VALIDATION_RULES` (`index.js:111-182`) y se ejecutan en `runPedagogicalAudit` (`index.js:526-534`). Los textos se asignan en `getRuleDescription` (`index.js:536-549`).

| Warning mostrado | Regla / línea | Condición que evalúa | Causa raíz para `monthly` |
|---|---|---|---|
| `[critical]` No hay actividades definidas para los OA seleccionados | V-001 — `index.js:112` | `p.activities?.length > 0` | `buildPlanningRecord` no setea `planning.activities` para monthly (`index.js:1238-1239` guarda todo en `unit`). `p.activities` es `undefined` → **falla siempre**, aun con semanas completas. |
| `[critical]` La evaluación no tiene criterios definidos | V-004 — `index.js:113` | `p.assessment?.criteria?.length > 0` | `p.assessment` no existe para monthly; la evaluación vive en `unit.assessment`. → **falla siempre**. Además `validateOutputStructure` no exige criterios para monthly (`index.js:284` es solo `unit`). |
| `[warning]` No hay estrategia de retroalimentación | V-009 — `index.js:121` | `p.assessment?.feedbackStrategy?.length > 0` | Ídem V-004: lee `p.assessment` inexistente. → **falla siempre**. |
| `[warning]` La duración total de actividades no coincide con la duración planificada | V-006 — `index.js:122-140` | Para monthly compara semana a semana: `suma(activities[].duration) ∈ [0.6 × w.duration, 1.1 × w.duration]` (`index.js:129-136`) | Depende de la fidelidad de la IA. `normalizeActivities` (`index.js:377-391`) **filtra** actividades sin `moment` o sin `description` (`index.js:390`), y `normalizeDuration` (`index.js:370-375`) fija duraciones ausentes en **15 min**; con 3 actividades → 45 min vs semana de 180 → bajo el 60%. |

**Conclusión:** V-001, V-004 y V-009 son **bugs estructurales** que disparan warnings falsos en el 100% de las mensuales (y también afectan a `unit`, que comparte la estructura `unit.classes`). Esto además **sesga el score de calidad** (`evaluateQuality`, `index.js:595-669`): curricular baja por V-001, evaluación por V-004/V-009.

### 1.3 Estructura de salida por tipo (`buildTypeInstruction`, `index.js:974-1189`)

| Tipo | Líneas | Contenedor | Exige actividades |
|---|---|---|---|
| `class` | (sin branch, plantilla de `prompt-templates`) | `activities[]` + `assessment` | Sí |
| `unit` | 977-1028 | `unit.classes[]` (cada una con `activities[]` de 3+ y `assessment`) + `unit.unitAssessment` | Sí, mínimo explícito (1027) |
| `monthly` | 1030-1079 | `unit.weeks[]` (cada semana con `activities[]` y `assessment`) + `unit.assessment` | Sí, **sin mínimo explícito por semana** |
| `annual` | 1081-1115 | `unit.months[]` (sin actividades) | No |
| `evaluation` | 1117-1151 | `evaluation` (instrumento, indicadores, rúbrica, criterios) | N/A |
| `multigrade` | 1153-1186 | `activities[]` con `targetLevel` | Sí, mínimo 4 |

`PLANNING_TYPES` (`index.js:102-109`) solo define `label / minOA / maxOA`. `minOA` está definido pero **no se usa en ninguna parte**.

### 1.4 `normalizePlanningOutput` (branch monthly, `index.js:472-493`)

- Sin `weeks` → `weeks: []` → `validateOutputStructure` falla → generación falla (no da warnings).
- Semanas sin actividades válidas se **eliminan** (`index.js:482`).
- Semanas sin `assessment` se rellenan con `{criteria: [], feedbackStrategy: ''}` (`normalizeAssessment`, `index.js:393-402`) → pasan la validación estructural pero disparan V-004/V-009.

---

## 2. Hallazgos adicionales relevantes para escalar

### 2.1 Método único para toda la planificación

- `data.methodology` es **un solo valor** en el wizard (`wizard.js:8`, paso 4 en `wizard.js:214-220`) y se inyecta en todo el prompt.
- Para unit/mensual (varias clases o semanas) la IA aplica *un* método a todas. No hay variación por clase/semana.
- Regla V-013 (`index.js:142-154`) verifica coherencia metodología ↔ actividades con `METHODOLOGY_KEYWORDS`; solo admite una familia.

### 2.2 DUA

- Ya existen **12 opciones predefinidas** (4 por principio) en `wizard.js:291-310` (checkboxes).
- Si el usuario no marca nada en un grupo, el backend **usa todas las claves por defecto** (`buildDuaPrompt`, `index.js:946-971`, línea 967).
- `framework: 'dua' | 'estandar'`; con `estandar` se envía `dua: null` (`wizard.js:108`).
- No existe un botón de "selección sugerida" ni "marcar todas".

### 2.3 Planes freemium (S-7)

- Límite diario lo aplica el backend (`index.js:1288-1300`): `free` 10/día, `pro` 1000/día (`PLANS`, `index.js:56-59`).
- **El admin solo puede cambiarse su propio plan** en Mi Perfil (`app.js:279` usa `targetUid: store.user.uid`).
- **No existe UI para asignar plan pro a otros usuarios** ni desde la página institucional, aunque `MANUAL_USUARIO.md:125` lo afirma.
- La callable `setUserPlan` es admin-only (`index.js:1795-1809`); solo falta la UI.

### 2.4 UI sin usar / datos ocultos

- `regenerateSection` está importado en todo el frontend pero **nunca se llama** — no hay botón "Regenerar sección" pese a que la ayuda (`app.js:329`) y el manual lo prometen.
- `quality` / `coherenceReview` se calculan y persisten (`index.js:1486-1495`) pero **ninguna página los renderiza**.
- El paso 6 del wizard (evaluación formativa/sumativa, `wizard.js:287`) es **decorativo**: no está enlazado a `data`.
- `title` del wizard es siempre `''` — el backend lo rellena con un default.
- No hay flujo de **rechazo** en la UI.

### 2.5 Manual de usuario

- `MANUAL_USUARIO.md` existe pero tiene **errores de codificación** (`é` → `�?`), **URL desactualizada** (`planificaia.web.app` en vez de `planificacion-con-ia.web.app`) y **no está enlazado desde la app**.

---

## 3. Opciones de mejora (por prioridad)

### A. Corregir warnings falsos en monthly/unit — bug, arreglo corto
Hacer que V-001, V-004 y V-009 lean la estructura correcta según tipo:
- V-001: `unit` → `unit.classes[].activities`, `monthly` → `unit.weeks[].activities`.
- V-004: `unit`/`monthly` → `unit.unitAssessment?.criteria` / `unit.assessment?.criteria` (y anidado por clase/semana).
- V-009: ídem para `feedbackStrategy`.
Impacto: elimina los 2 criticals falsos y el sesgo en el score de calidad.

### B. Métodos variados por clase/semana
- Multiselección de métodos en el wizard (paso 4) para `unit`/`monthly`.
- El prompt pide distribuir/variar los métodos entre clases o semanas.
- Ajustar V-013 para aceptar varias familias.

### C. Instrucciones por tipo más estrictas
- Exigir mínimo de actividades por semana en `monthly` (igual que `unit` pide 3+ por clase).
- Exigir `assessment.criteria` y `feedbackStrategy` por semana/clase en el prompt.
- Reduce warnings reales al mejorar la calidad del JSON generado.

### D. DUA rápido con opciones pre-marcadas
- Botón "marcar selección sugerida" que pre-chequee una base (p. ej. percepción, conocimientos, formatos, respuestas, organizadores, metas, interés, colaboración, autorregulación).
- Opción "DUA total" (marcar las 12).

### E. Asignación de planes a otros usuarios
- Panel (página institucional o perfil) para que el admin busque por correo/uid y asigne `free`/`pro`.

### F. Manual de usuario
- Corregir encoding + URL, enlazarlo desde `#/ayuda`, y ampliarlo con planes y tipos.

---

## 4. Referencias clave (archivo:línea)

| Tema | Ubicación |
|---|---|
| Reglas de calidad | `functions/index.js:111-182` |
| Audit pedagógico | `functions/index.js:526-534` |
| Descripciones de reglas | `functions/index.js:536-549` |
| Score de calidad | `functions/index.js:595-669` |
| Normalización de salida | `functions/index.js:351-524` |
| Normalización monthly | `functions/index.js:472-493` |
| Validación de estructura | `functions/index.js:262-302` |
| Instrucción por tipo | `functions/index.js:974-1189` |
| Instrucción monthly | `functions/index.js:1030-1079` |
| Build del registro | `functions/index.js:1191-1251` |
| `PLANNING_TYPES` | `functions/index.js:102-109` |
| `PLANS` freemium | `functions/index.js:56-59` |
| Límite diario | `functions/index.js:1288-1300` |
| `setUserPlan` (admin) | `functions/index.js:1795-1809` |
| Opciones DUA del wizard | `public/js/pages/wizard.js:291-310` |
| Payload a `generatePlanning` | `public/js/pages/wizard.js:89-111` |
| Panel de warnings (wizard) | `public/js/pages/wizard.js:381-384` |
| Panel de warnings (detalle) | `public/js/pages/detail.js:194-205` |
| Warnings client-side (editor) | `public/js/pages/editor.js:54-73` |
| "Mi Plan" en perfil | `public/js/app.js:298-309` |
