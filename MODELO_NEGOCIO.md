# Modelo de Negocio y Expansión — PlanificaIA

**Fase S-7 · Modelo de negocio y expansión**
**Fecha:** 2026-08-01
**Estado:** Implementación técnica de base freemium + onboarding + multi-país (base); cobro real y piloto institucional pendientes de gestión comercial.

---

## 1. Propuesta de valor

PlanificaIA convierte el currículum oficial chileno en planificaciones listas para revisar,
con supervisión docente obligatoria (IA propone → sistema verifica → docente decide). El
diferenciador frente a un LLM genérico es la **alineación curricular verificada**, el
**control docente** y la **privacidad por diseño** (sin datos de estudiantes).

## 2. Planes Freemium (implementado en S-7)

| Plan | Precio | Límite diario | Destino |
|---|---|---|---|
| **Gratis** | $0 | 10 generaciones/día | Docente individual |
| **Pro** | Piloto institucional | 1.000 generaciones/día | Equipos, colegios, ATE/OTEC |

- Implementación: `PLANS` en `functions/index.js` (espejo en `index.test.js`); el límite se
  aplica en `generatePlanning` leyendo `users/{uid}.plan`; `setUserPlan` (callable admin-only)
  asigna el plan y deja trazabilidad en `audit-logs`. UI: insignia + cambio de plan en "Mi Perfil".
- **Cobro real:** fuera del alcance técnico. El piloto institucional se gestiona de forma
  directa (contrato) y el plan Pro se asigna por admin. La integración de pagos (Stripe/
  Mercado Pago) es trabajo futuro, priorizado por la demanda del piloto.

## 3. Onboarding docente (implementado en S-7)

- Página **`#/ayuda`** (pública): primeros pasos, los 6 tipos de planificación, uso ético de la
  IA, colaboración institucional y preguntas frecuentes. Enlazada desde el footer.
- Banner **"Primeros pasos"** en el dashboard para cuentas sin planificaciones.
- Métrica de activación objetivo: ≥60% de los nuevos registros genera ≥1 planificación en su
  primera sesión (ver sección 5).

## 4. Multi-país (base, implementado en S-7)

- El catálogo es dinámico desde Firestore (`catalog/subjects`). En S-7 se añadió la dimensión
  **país** (`country: 'cl'`, `countryName: 'Chile'`), que el frontend carga y muestra
  ("Currículum oficial de Chile").
- **Extensión a otro país:** se crea su ingesta curricular (mismo esquema que `scripts/ingesta-curriculo.js`
  adaptado a su marco), su catálogo de asignaturas (`catalog/<pais>-subjects` o un doc por país)
  y se parametriza el selector de país. El modelo de datos (OA con código/nivel/eje/versión) ya
  es neutro de país.
- **Deuda anotada:** la ingesta multi-país completa (p. ej. Perú, Colombia) es trabajo futuro;
  hoy solo Chile tiene datos.

## 5. Métricas de conversión (criterio de salida S-7)

| Métrica | Definición | Objetivo |
|---|---|---|
| **Activación** | % de registros que generan ≥1 planificación en sesión inicial | ≥60% |
| **Uso semanal (WAU/registrados)** | Docentes activos en 7 días / total registrados | ≥25% |
| **Generaciones/activo/semana** | Total de generaciones / activos semanales | ≥3 |
| **Tasa de aprobación** | Planificaciones aprobadas / generadas | ≥70% |
| **Upgrade a Pro** | % de activos que migran a plan Pro | ≥5% (piloto) |
| **Costo por generación** | Costo IA promedio (rúbrica S-5, `ai-costs`) | <$0.0005 USD |

Fuente de datos: colecciones `ai-costs`/`audit-logs`/`plannings` (el kill-switch de presupuesto
S-5 y la trazabilidad S-6 cubren el costeo). Un dashboard de métricas de negocio es trabajo futuro.

## 6. Canal ATE/OTEC/universidades (white-label / licenciamiento)

- **Modelo:** licenciamiento por institución (plan Pro institucional) con condiciones propias;
  el white-label completo (marca, dominio, base curricular por institución) se entrega como
  servicio gestionado.
- **Requisitos que ya existen:** términos versionados y política de privacidad (S-6, Ley 21.719),
  roles institucionales y aprobación UTP (S-3), calidad medida y rúbrica (S-4), presupuesto y
  observabilidad (S-5).
- **Pendiente legal:** validación externa de la licencia de uso del contenido Mineduc (H02 en
  `REVISION_JURIDICA.md`) antes de un contrato de licenciamiento comercial.
- **Piloto institucional (criterio de salida):** 1 establecimiento (o ATE) piloto con plan Pro
  asignado por admin, seguimiento de la métrica de activación y upgrade, y sesión de feedback
  docente.

## 7. Riesgos de negocio

| Riesgo | Mitigación |
|---|---|
| Costos IA crecen con usuarios | Kill-switch de presupuesto (S-5), límites por plan |
| Canal institucional bloqueado por licencia Mineduc | Validación jurídica H02 antes de licenciar |
| Baja activación de nuevos registros | Onboarding (S-7), banners, seguimiento de métricas |
| Conversión freemium insuficiente | Ajustar límite gratuito y valor del plan Pro según datos del piloto |
