# PLAN DE ESCALADO — PlanificaIA v2.5 → v3.0

**Documento independiente de escalamiento del MVP**
Basado en el estado actual: MVP desplegado, 666 OA oficiales (5 asignaturas × 8 niveles), DUA, catálogo dinámico, feedback + métricas, stack Node 22.

---

## 1. Visión de escalado

> De **generador de clases para 5 asignaturas** a **plataforma de planificación integral para el sistema educativo chileno**.

| Dimensión | Hoy (v2.5) | Meta (v3.0) |
|---|---|---|
| Asignaturas | 5 | 12+ (todo el currículum) |
| Niveles | 5° básico – 4° medio | Parvularia + Básica + Media + EPJA |
| Tipo de planificación | Clase individual | Clase, unidad, mensual, anual, evaluación |
| Usuarios | Docente individual | Docente + UTP + equipo directivo + institución |
| Modelo de negocio | Gratuito | Freemium / institucional |
| Cobertura | Chile | Chile (base) → LATAM (post-v3.0) |

---

## 2. Mapa de fases

| Fase | Nombre | Prioridad | Estado | Esfuerzo |
|------|--------|-----------|--------|----------|
| S-0 | Consolidación y habilitadores | Alta | ⏳ PENDIENTE | 2 sem |
| S-1 | Cobertura curricular completa | Alta | ⏳ PENDIENTE | 4 sem |
| S-2 | Tipos de planificación extendidos | Alta | ⏳ PENDIENTE | 4 sem |
| S-3 | Colaboración e institucional | Media | ⏳ PENDIENTE | 6 sem |
| S-4 | Calidad de IA y evaluación | Alta | ⏳ PENDIENTE | 4 sem |
| S-5 | Escala técnica y observabilidad | Media | ⏳ PENDIENTE | 3 sem |
| S-6 | Cumplimiento legal y accesibilidad | Alta | ⏳ PENDIENTE | 3 sem |
| S-7 | Modelo de negocio y expansión | Media | ⏳ PENDIENTE | 4 sem |

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

---

### Fase S-1 — Cobertura curricular completa

**Objetivo:** todo el currículum oficial disponible.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Asignaturas restantes de básica/media | Artes Visuales, Música, Ed. Física, Tecnología, Filosofía, Ed. Ciudadana, Religión, etc. (scraper ya lo soporta) | 2 sem |
| Parvularia | Nuevo modelo: ámbitos (Formación Personal y Social, Comunicación Integral, Interacción y Comprensión del Entorno) y núcleos, en vez de OA | 1 sem |
| EPJA | Objetivos de aprendizaje por sector de EPJA | 1 sem |
| OAT (Objetivos Transversales) | Colección `curriculum/transversal-objectives` pendiente en el modelo | 0.5 sem |
| Datos por asignatura | Verificar ejes/unidades por nivel para mejorar filtros del wizard | 1 sem |

**Criterio de salida:** >1,500 OA, todos los niveles educativos, selección por nivel/asignatura sin datos vacíos.

---

### Fase S-2 — Tipos de planificación extendidos

**Objetivo:** pasar de "clase" a planificaciones de mayor alcance.

| Entregable | Detalle | Esfuerzo |
|---|---|---|
| Planificación de unidad | 4–8 clases, secuencia didáctica, evaluación de unidad | 2 sem |
| Planificación mensual/anual | Desglose por semanas, distribución de OA | 1 sem |
| Evaluación standalone | Instrumentos, rúbricas, indicadores (Decreto 67) | 1 sem |
| Planificación multigrado | Combinar 2 niveles en una planificación | 1 sem |

**Impacto en IA:** la plantilla debe adaptarse por tipo; nueva dimensión `type` en `plannings` y en `prompt-templates`.

**Criterio de salida:** wizard con selector de tipo de planificación, editor soporta estructura por unidad.

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
| Tipos de planificación | 5 (clase, unidad, mensual, anual, evaluación) |
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
