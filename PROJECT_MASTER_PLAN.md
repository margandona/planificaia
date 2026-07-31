# PROJECT MASTER PLAN â€” PlanificaIA

**Generador ético de planificaciones educativas asistido por inteligencia artificial**

---

## 1. Portada

| Campo | Valor |
|---|---|
| **Nombre del proyecto** | PlanificaIA |
| **Descripción** | Generador ético de planificaciones educativas asistido por inteligencia artificial |
| **Estado** | `MVP DESPLEGADO - ESCALADO EN CURSO` |
| **Versión del documento** | 2.4 (todas las fases tecnicas completadas) |
| **Fecha de actualización** | 2026-07-30 |
| **Autor** | Equipo multidisciplinario PlanificaIA |
| **Propietario** | MaKuaZ |
| **Repositorio** | `planificacion-con-ia` (Firebase project: `planificacion-con-ia`) |
| **Tipo de documento** | Project Master Plan / Documento de Arquitectura y Diseño |

---

## 2. Estado

| Elemento | Estado |
|---|---|
| Investigacion curricular | COMPLETADA |
| Investigacion normativa | COMPLETADA (parcial - requiere revision juridica) |
| Definicion de producto | COMPLETADA |
| Arquitectura tecnica | ACTUALIZADA (Firebase + DeepSeek + Gemini Flash) |
| Diseno de IA | ACTUALIZADO (DeepSeek primario, Gemini Flash fallback) |
| MVP | DESPLEGADO Y OPERATIVO |
| Plan de fases | ACTUALIZADO (18 fases, escalado incluido) |
| Backlog | ACTUALIZADO |
| Implementacion | COMPLETADA (MVP) |
| Conexion Firebase | CONFIGURADA (firebase.js + admin SDK presentes) |

### Progreso por fase

| Fase | Estado | Archivos / Logros |
|---|---|---|
| **Fase 0 - Descubrimiento** | COMPLETADA | Project Master Plan, investigacion curricular, definicion de producto |
| **Fase 1 - Configuracion Firebase** | COMPLETADA | firebase.json, .firebaserc, firestore.rules, storage.rules, firebase.js, admin SDK |
| **Fase 2 - Ingesta curricular** | COMPLETADA | scripts/ingesta-curriculo.js, 23 OA + 10 habilidades + 10 actitudes en Firestore |
| **Fase 3 - Autenticacion + Perfil** | COMPLETADA | Login, registro, verificacion email, reset password, perfil editable, eliminacion cuenta |
| **Fase 4 - Frontend base** | COMPLETADA | public/index.html, public/js/app.js (1090 lineas, 10 vistas, Layout, auth guard) |
| **Fase 5 - Planificaciones manuales** | COMPLETADA | ManualEditor, autoguardado 30s, versionado en subcoleccion, editar/crear manual |
| **Fase 6 - Integracion DeepSeek** | COMPLETADA | functions/index.js: DeepSeek + Gemini fallback, prompt PT-001 en Firestore, validacion JSON, auditoria V-001 a V-012, trazabilidad |
| **Fase 7 - Reglas pedagogicas** | COMPLETADA | V-001 a V-012 en backend + frontend: warning panel en editor, badge en dashboard, display en detalle |
| **Fase 8 - Exportacion** | COMPLETADA | PDF (print) + DOCX (Cloud Function docx library) + declaracion IA en exportaciones |
| **Fase 9 - QA integral** | COMPLETADA | 100% legacy QA, 29/29 Jest unit tests, 11/11 E2E Playwright, 81/81 manual CF tests |
| **Fase 10 - Piloto docente** | DOCUMENTADO | Pendiente ejecucion con docentes reales |
| **Fase 11 - Despliegue MVP** | COMPLETADA | hosting + functions + firestore + storage desplegados, DeepSeek key en .env |
| **Fase 12 - Marco DUA** | COMPLETADA | selector DUA vs estandar, 3 principios CAST, campo dua, plantilla PT-001, editor, detalle, DOCX |
| **Fase 13 - Escalado curricular** | COMPLETADA | 8 niveles (5B-4M), 116 OA Historia, ingesta extensible por asignatura |
| **Fase 14 - Multi-asignatura + optimizacion** | COMPLETADA | selector asignatura, cache localStorage, prompt truncado (250 chars, max 4 OA), indices compuestos |
| **Fase 15 - Ingesta masiva multi-asignatura** | COMPLETADA | 666 OA oficiales Mineduc (scraper): Lenguaje, Matematica, Cs. Naturales, Ingles, Historia x 8 niveles |
| **Fase 16 - Catalogo dinamico de asignaturas** | COMPLETADA | catalog/subjects en Firestore, lectura publica, cache localStorage, fallback a defaults, habilitar sin redeploy |
| **Fase 17 - Piloto docente ampliado** | EN PREPARACION | infraestructura lista: metricas, feedback, plantillas por asignatura |
| **Fase 18 - Migraciones tecnicas** | COMPLETADA | Node 22 runtime, functions.config eliminado (solo env vars), firebase-functions 7.3.2, firebase-admin 14.2.0 |
### Checklist de implementacion

| # | Item | Estado |
|---|---|---|
| 1 | Proyecto Firebase creado (planificacion-con-ia) | OK |
| 2 | Firebase Auth configurado (email/password) | OK |
| 3 | Firestore creado con reglas de seguridad | OK |
| 4 | Firebase Hosting configurado | OK |
| 5 | Firebase Storage configurado | OK |
| 6 | Admin SDK descargado y funcional | OK |
| 7 | OA de Historia 7 basico en Firestore (23 OA, 10 habilidades, 10 actitudes) | OK |
| 8 | pnpm configurado como package manager | OK |
| 9 | Login/registro con verificacion de email | OK |
| 10 | Recuperacion de contrasena | OK |
| 11 | Perfil de usuario editable | OK |
| 12 | Eliminacion de cuenta con exportacion | OK |
| 13 | Layout responsivo con navbar y footer | OK |
| 14 | SPA con Vue 3 + Tailwind (CDN) | OK |
| 15 | Landing page informativa | OK |
| 16 | Dashboard con filtros y lista de planificaciones | OK |
| 17 | Wizard 10 pasos con seleccion de OA desde Firestore | OK |
| 18 | Editor manual de planificaciones | OK |
| 19 | Autoguardado cada 30 segundos | OK |
| 20 | Versionado de planificaciones en subcoleccion | OK |
| 21 | Cloud Function generatePlanning (DeepSeek + Gemini fallback) | OK |
| 22 | Limite diario de 10 generaciones/usuario | OK |
| 23 | Sanitizacion de datos personales (PII) | OK |
| 24 | Prompt template PT-001 en Firestore | OK |
| 25 | Validacion de estructura JSON de salida | OK |
| 26 | Reglas V-001 a V-012 en backend | OK |
| 27 | Trazabilidad de IA (modelo, tokens, costo) | OK |
| 28 | Auditoria logs en Firestore | OK |
| 29 | Fallback automatico a Gemini Flash | OK |
| 30 | Regeneracion por seccion | OK |
| 31 | Aprobacion docente | OK |
| 32 | Vista de detalle de planificacion | OK |
| 33 | DeepSeek API key en Functions Config | OK |
| 34 | Advertencias visibles en editor + detalle | OK |
| 35 | Exportacion PDF | OK |
| 36 | Exportacion DOCX | OK |
| 37 | Deploy Cloud Functions a produccion | COMPLETADO |
| 38 | Pruebas con emulador Firebase | COMPLETADO |

## 3. Control de versiones

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | 2026-07-30 | Equipo PlanificaIA | Versión inicial del plan maestro |
| 2.0 | 2026-07-30 | Equipo PlanificaIA | Actualización: stack Firebase completo, DeepSeek + Gemini Flash, pnpm, Tailwind CSS, sin Express/NestJS/PostgreSQL |
| 2.1 | 2026-07-31 | Equipo PlanificaIA | MVP desplegado: hosting, functions, firestore, storage. QA 100%. Deploy a produccion |
| 2.2 | 2026-07-31 | Equipo PlanificaIA | Escalado: Marco DUA (3 principios CAST), 8 niveles (5B-4M), multi-asignatura, cache localStorage, optimizacion de tokens, analisis de costos (seccion 45) |

---

## 4. Resumen ejecutivo

PlanificaIA es una plataforma web para docentes chilenos que permite crear planificaciones educativas con asistencia de IA, bajo un estricto marco de agencia docente, alineación curricular y privacidad.

**Stack técnico definitivo:**
- **Frontend:** HTML + CSS (Tailwind) + JavaScript (Vue 3 via CDN/importmap), servido por Firebase Hosting
- **Backend:** Firebase Cloud Functions (Node.js con pnpm)
- **Base de datos:** Cloud Firestore (NoSQL)
- **Autenticación:** Firebase Auth
- **Almacenamiento:** Firebase Storage
- **IA Primaria:** DeepSeek API
- **IA Fallback:** Google Gemini 1.5 Flash (integrado nativamente con Firebase)
- **Package manager:** pnpm (exclusivamente, por seguridad)

**Proyecto Firebase:** `planificacion-con-ia` (configurado y operativo).

**Principio rector:** La IA propone, el sistema verifica y el docente decide.

**Arquitectura multicapa:**
1. Capa presentación (Firebase Hosting + Vue 3)
2. Capa API (Cloud Functions)
3. Capa orquestación IA (Cloud Functions)
4. Capa datos (Firestore + Storage)
5. Capa seguridad (Firebase Auth + Security Rules + validación)
6. Capa monitoreo (Firebase Crashlytics + Performance + Logging)

---

## 5. Visión

> Ser la plataforma de referencia para que los docentes chilenos planifiquen sus clases con asistencia de IA, manteniendo siempre el control pedagógico, la alineación curricular y la privacidad de los estudiantes.

**Roadmap:**
- **MVP:** 5.Â° a 8.Â° básico â€” Historia â€” clase individual â€” DeepSeek API
- **v1.0:** Todas las asignaturas de básica â€” planificación de unidades
- **v1.5:** Educación media completa â€” Gemini Flash como alternativa
- **v2.0:** Multi-país â€” colaboración â€” panel institucional

---

## 6. Problema

| ID | Problema |
|---|---|
| P01 | Tiempo excesivo en tareas administrativas de planificación |
| P02 | Dificultad para estructurar planificaciones coherentes |
| P03 | Dispersión de documentos curriculares |
| P04 | Duplicación de trabajo entre docentes |
| P05 | Uso desorganizado de IA genérica (ChatGPT, etc.) |
| P06 | Actividades sin alineación curricular verificable |
| P07 | Planificación poco contextualizada |
| P08 | Dificultad para diferenciar actividades (DUA) |
| P09 | Falta de criterios claros de evaluación (Decreto 67) |
| P10 | Poca trazabilidad OA â†” actividad â†” evaluación |
| P11 | Riesgo de copiar respuestas de IA sin revisión |
| P12 | Inexistencia de historial y control de versiones |
| P13 | Dependencia de prompts improvisados |
| P14 | Dificultad para reutilizar planificaciones anteriores |

---

## 7. Oportunidad

- 250 000+ docentes en Chile (Mineduc)
- Currículum Nacional disponible en línea (UCE/Mineduc)
- DeepSeek: costo ~$0.14/M tokens entrada â€” extremadamente económico
- Gemini Flash: plan gratuito generoso + integración nativa Firebase
- No existe plataforma especializada en planificación curricular chilena con IA
- Stack Firebase: hosting gratuito, escalable, sin gestión de servidores

---

## 8. Usuarios

| Persona | Descripción |
|---|---|
| Docente de aula | Profesor básica/media, poco tiempo |
| Educadora de párvulos | Primera infancia (futuro) |
| Educador diferencial | NEE, adecuaciones curriculares |
| Coordinador UTP | Supervisa planificaciones |
| Jefe de UTP | Gestión de equipo docente |
| Equipo directivo | Visión agregada |
| ATE / OTEC | Capacitación y asistencia técnica |
| Universidad / CFT | Formación inicial docente |

---

## 9. Propuesta de valor

- Reduce tiempo de planificación (estimado 40-60%)
- OA desde currículum oficial chileno (scrapeado de curriculumnacional.cl)
- Editable, regenerable por sección, aprobación docente obligatoria
- Exportación PDF + DOCX
- Trazabilidad completa (qué modelo, cuándo, qué OA)
- Sin datos personales de estudiantes
- Stack 100% Firebase: cero administración de servidores, escalable

---

## 10. Principios

| ID | Principio | Descripción |
|---|---|---|
| PR001 | Agencia docente | La IA no decide. Aprobación docente obligatoria. |
| PR002 | Alineación curricular | OA desde fuente oficial, verificable. |
| PR003 | Contextualización | El sistema pregunta contexto antes de generar. |
| PR004 | Privacidad desde el diseño | Sin datos personales de estudiantes. |
| PR005 | Transparencia | Trazabilidad: modelo, fecha, OA, fuentes. |
| PR006 | Inclusión | Identifica barreras, ofrece alternativas. No diagnostica. |
| PR007 | Explicabilidad | Explica por qué cada actividad es adecuada. |
| PR008 | Seguridad pedagógica | Advertencias sobre contenido incorrecto o no alineado. |
| PR009 | Portabilidad | Exportación y descarga de datos del usuario. |
| PR010 | Accesibilidad | Meta WCAG 2.2 AA. |

---

## 11. Marcos pedagógicos

| ID | Marco | Fuente |
|---|---|---|
| MP01 | Marco para la Buena Enseñanza (MBE 2021) | CPEIP / Mineduc |
| MP02 | Decreto N.Â° 67/2018 â€” Evaluación | Mineduc |
| MP03 | Diseño Universal para el Aprendizaje | CAST / Mineduc |
| MP04 | Bases Curriculares Nacionales | UCE / Mineduc |
| MP05 | Programas de Estudio | UCE / Mineduc |

---

## 12. Marco curricular

### 12.1 Fuentes

| Fuente | URL | Estado |
|---|---|---|
| Currículum Nacional | https://www.curriculumnacional.cl | Vigente |
| Bases Curriculares | https://www.curriculumnacional.cl/curriculum | Vigente |
| Programas de Estudio | https://www.curriculumnacional.cl/inicio/Curriculum/Programa%20de%20Estudio%20-%20Destacados | Vigente |

### 12.2 Ingesta de OA

Los OA, habilidades, actitudes y OAT se obtendrán mediante scraping/API del portal Currículum Nacional y se almacenarán en Firestore.

**DECIDIDO:** La ingesta curricular se hará una sola vez (con actualizaciones periódicas). Los OA se almacenan con texto oficial, código, nivel, asignatura, eje y versión. La IA nunca modifica el texto oficial del OA.

### 12.3 Estructura curricular chilena

- Educación Parvularia (3 niveles)
- Educación Básica (1.Â° a 8.Â° básico)
- Educación Media (1.Â° a 4.Â° medio: HC, TP, Artística)
- EPJA

Códigos OA: `HI07 OA 01`, `MAT05 OA 12`, `LEN06 OA 03`, etc.

---

## 13. Marco ético

Basado en UNESCO (Recomendación Ã‰tica IA 2021 + Guidance GenAI 2023) y OWASP LLM Top 10.

| Principio | Aplicación |
|---|---|
| Proporcionalidad | IA solo propone, humanos deciden |
| Privacidad | Firestore Security Rules + sin PII en prompts |
| Supervisión humana | Aprobación explícita antes de guardar/exportar |
| Transparencia | Panel de trazabilidad con modelo, fecha, tokens, OA |
| Responsabilidad | Auditoría completa vía Firestore + Logging |

---

## 14. Alcance MVP

| Aspecto | Decisión |
|---|---|
| Niveles | 5.Â° a 8.Â° básico |
| Asignatura | Historia, Geografía y Ciencias Sociales |
| Tipo de planificación | Clase individual (45 o 90 min) |
| IA Primaria | DeepSeek API |
| IA Fallback | Gemini 1.5 Flash (Firebase AI Logic) |
| Autenticación | Firebase Auth (email + password) |
| Base de datos | Cloud Firestore |
| Backend | Firebase Cloud Functions (Node.js + pnpm) |
| Frontend | HTML + Tailwind CSS + Vue 3 (CDN/importmap) |
| Hosting | Firebase Hosting (plan gratuito Spark) |
| Package manager | pnpm |
| Exportación | PDF + DOCX |

---

## 15. Exclusiones

| Exclusión | Motivo |
|---|---|
| NestJS / Express | Se reemplaza por Cloud Functions |
| PostgreSQL | Se reemplaza por Firestore |
| Redis | No necesario con Firestore + Cloud Functions |
| Prisma / Sequelize | Firestore es NoSQL nativo |
| npm | Prohibido por seguridad. Se usa pnpm |
| Vite / Webpack | Frontend sin build step (CDN/importmap) |
| Aplicación móvil nativa | Post-v2.0 |
| Multi-país | Post-v2.0 |
| Coedición en tiempo real | Post-v2.0 |
| Agentes autónomos | Violan principio de agencia docente |

---

## 16. Roles

| ID | Rol | Descripción |
|---|---|---|
| R01 | Visitante | Ver landing, registrarse |
| R02 | Docente | CRUD planificaciones, editar, aprobar, exportar |
| R03 | Admin general | Gestionar usuarios, OA, monitoreo (futuro) |

Firebase Auth con custom claims para roles.

---

## 17. Requerimientos funcionales

### 17.1 Sitio público

| ID | Requerimiento |
|---|---|
| RF-001 | Landing con descripción del producto |
| RF-002 | Sección de principios éticos |
| RF-003 | FAQ |
| RF-004 | Política de privacidad + términos |
| RF-005 | Declaración de accesibilidad |
| RF-006 | Política de uso responsable de IA |

### 17.2 Autenticación (Firebase Auth)

| ID | Requerimiento |
|---|---|
| RF-007 | Registro con email + password |
| RF-008 | Inicio de sesión |
| RF-009 | Recuperación de contraseña |
| RF-010 | Verificación de email |
| RF-011 | Cierre de sesión |
| RF-012 | Eliminación de cuenta con exportación |
| RF-013 | Aceptación versionada de términos |

### 17.3 Perfil docente

| ID | Requerimiento |
|---|---|
| RF-014 | Configurar nombre visible |
| RF-015 | País, región, tipo de establecimiento |
| RF-016 | Niveles y asignaturas que enseña |
| RF-017 | Preferencias de planificación |

### 17.4 Biblioteca curricular (datos en Firestore)

| ID | Requerimiento |
|---|---|
| RF-018 | Navegar por nivel y asignatura |
| RF-019 | Consultar ejes y unidades |
| RF-020 | Buscar OA por código o texto |
| RF-021 | Seleccionar OA |
| RF-022 | Texto oficial del OA (no modificable) |
| RF-023 | Habilidades y actitudes asociadas |
| RF-024 | Fuente y versión curricular |

### 17.5 Asistente guiado

| ID | Requerimiento |
|---|---|
| RF-025 | Flujo paso a paso con progreso |
| RF-026 | Paso 1: Tipo de planificación |
| RF-027 | Paso 2: Contexto curricular (nivel, asignatura, OA) |
| RF-028 | Paso 3: Contexto pedagógico (estudiantes, duración, recursos) |
| RF-029 | Paso 4: Enfoque metodológico |
| RF-030 | Paso 5: Estructura de clase |
| RF-031 | Paso 6: Evaluación |
| RF-032 | Paso 7: Inclusión y accesibilidad |
| RF-033 | Paso 8: Resumen pre-generación |
| RF-034 | Paso 9: Revisión en editor |
| RF-035 | Paso 10: Aprobación docente |

### 17.6 Editor pedagógico

| ID | Requerimiento |
|---|---|
| RF-036 | Editar cada sección |
| RF-037 | Reorganizar bloques |
| RF-038 | Duplicar actividades |
| RF-039 | Regenerar una sección (no toda la planificación) |
| RF-040 | Solicitar alternativa de sección |
| RF-041 | Acortar / ampliar sección |
| RF-042 | Cambiar metodología, recursos, duración |
| RF-043 | Adaptar a modalidad sin tecnología / contexto rural |
| RF-044 | Guardar borrador |
| RF-045 | Aprobar planificación |

### 17.7 Verificador de alineación

| ID | Requerimiento |
|---|---|
| RF-046 | OA â†” propósito â†” actividad â†” evidencia â†” evaluación |
| RF-047 | Duración total vs actividades |
| RF-048 | Coherencia metodología â†” propósito |

### 17.8 Exportación

| ID | Requerimiento |
|---|---|
| RF-049 | Exportar a PDF accesible |
| RF-050 | Exportar a DOCX |
| RF-051 | Metadatos + declaración de asistencia IA |

### 17.9 Biblioteca personal

| ID | Requerimiento |
|---|---|
| RF-052 | Guardar planificaciones en Firestore |
| RF-053 | Duplicar planificaciones |
| RF-054 | Archivar |
| RF-055 | Buscar y filtrar |
| RF-056 | Historial de versiones |

---

## 18. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-001 | Accesibilidad | WCAG 2.2 AA |
| RNF-002 | Seguridad | Sin claves de API al frontend |
| RNF-003 | Privacidad | Sin datos personales de estudiantes |
| RNF-004 | Rendimiento | Carga inicial < 3s (p50) |
| RNF-005 | Rendimiento | Generación < 30s (p95) |
| RNF-006 | Disponibilidad | 99.5% (Firebase SLA) |
| RNF-007 | Package manager | Solo pnpm â€” npm prohibido |
| RNF-008 | Mantenibilidad | Cobertura de pruebas > 80% |
| RNF-009 | Observabilidad | Firebase Performance + Crashlytics + Logging |
| RNF-010 | Seguridad multicapa | Hosting â†’ Functions â†’ Firestore Rules â†’ Auth |
| RNF-011 | Portabilidad | Exportación de datos del usuario |

---

## 19. Modelo de planificación

### 19.1 Estructura en Firestore

Colección `plannings`:

```
plannings/{planningId} {
  id: string,
  userId: string (ref: users),
  title: string,
  status: "draft" | "reviewed" | "approved" | "archived",
  level: string,
  subject: string,
  unit: string,
  duration: number (minutos),
  modality: "presencial" | "hibrida" | "remota",
  learningObjectives: [ { code, text, source } ],
  transversalObjectives: [ { code, text } ],
  skills: [ string ],
  attitudes: [ string ],
  specificObjective: string,
  purpose: string,
  priorKnowledge: string,
  vocabulary: [ string ],
  resources: [ string ],
  methodology: string,
  activities: [
    {
      id: string,
      moment: "inicio" | "desarrollo" | "cierre" | "extension",
      order: number,
      title: string,
      description: string,
      duration: number,
      teacherActions: [ string ],
      studentActions: [ string ],
      keyQuestions: [ string ],
      monitoringStrategy: string,
      evidence: string
    }
  ],
  assessment: {
    purpose: string,
    type: "formativa" | "sumativa",
    criteria: [ string ],
    feedbackStrategy: string
  },
  differentiation: string,
  accessibility: [ string ],
  warnings: [
    {
      type: "critical" | "warning" | "suggestion",
      category: string,
      description: string,
      section: string
    }
  ],
  aiContributions: [
    {
      model: string,
      provider: string,
      promptTemplateId: string,
      generatedAt: timestamp,
      sections: [ string ],
      inputTokens: number,
      outputTokens: number,
      cost: number,
      status: "success" | "regenerated" | "rejected"
    }
  ],
  approvedAt: timestamp | null,
  createdAt: timestamp,
  updatedAt: timestamp,
  version: number
}
```

Subcolección `plannings/{planningId}/versions/{versionId}` para historial.

### 19.2 Colecciones Firestore

| Colección | Descripción | Ãndices |
|---|---|---|
| `users/{uid}` | Perfiles de usuario | email |
| `plannings/{id}` | Planificaciones | userId, status, createdAt |
| `plannings/{id}/versions/{v}` | Versiones de planificación | version |
| `curriculum/levels/{level}/subjects/{subject}/objectives/{id}` | OA oficiales | code, level, subject |
| `curriculum/levels/{level}/subjects/{subject}/skills/{id}` | Habilidades | code |
| `curriculum/levels/{level}/subjects/{subject}/attitudes/{id}` | Actitudes | code |
| `curriculum/transversal-objectives/{id}` | OAT | code |
| `prompt-templates/{id}` | Plantillas de prompts (solo admin) | version, status |
| `audit-logs/{id}` | Logs de auditoría | userId, action, createdAt |
| `ai-costs/{id}` | Registro de costos IA | userId, date |

---

## 20. Biblioteca curricular

### 20.1 Ingesta desde internet

Los OA, habilidades y actitudes se obtendrán del portal Currículum Nacional mediante un script de ingesta (Node.js + pnpm) que se ejecuta como Cloud Function administrativa.

**Formato de cada OA en Firestore:**

```javascript
{
  code: "HI07 OA 01",
  text: "Explicar el proceso de hominización...",
  level: "7-basico",
  subject: "historia-geografia-ciencias-sociales",
  axis: "historia",
  source: "Bases Curriculares 7Â°B-2Â°M",
  version: "2024",
  validFrom: timestamp,
  validTo: null,
  isActive: true,
  skills: ["HI07 OAH a", "HI07 OAH e"],
  attitudes: ["HI07 OAA A", "HI07 OAA G"]
}
```

### 20.2 Búsqueda

- Búsqueda por código exacto (`HI07 OA 01`)
- Búsqueda por texto (`ILIKE` en cliente o función de búsqueda)
- Filtros por nivel, asignatura, eje

**DECIDIDO:** Para el MVP, filtros estructurados en Firestore + búsqueda en cliente del array de OA cargados. Post-MVP: Algolia o búsqueda vectorial.

---

## 21. Arquitectura de IA

### 21.1 Proveedores

| Aspecto | DeepSeek (Primario) | Gemini Flash (Fallback) |
|---|---|---|
| Costo | ~$0.14/M input, ~$0.28/M output | ~$0.075/M input, ~$0.30/M output (gratuito hasta 15 RPM) |
| Calidad español | Buena | Buena |
| Salida JSON | Sí (instrucción) | Sí (response_mime_type) |
| Contexto | 64K | 1M |
| Integración Firebase | API REST directa | Firebase AI Logic nativa |

### 21.2 AI Orchestration (Cloud Function)

```
Cliente â†’ Cloud Function (orquestador) â†’ DeepSeek API
                                        â†’ Gemini Flash (fallback)
```

La Cloud Function `ai-orchestrator`:
1. Recibe contexto + OA desde el cliente
2. Valida entrada (sin PII, campos requeridos)
3. Obtiene OA desde Firestore (no desde memoria del modelo)
4. Construye prompt estructurado
5. Envía a DeepSeek (con timeout + retry)
6. Valida respuesta contra esquema JSON
7. Ejecuta auditoría pedagógica (reglas deterministas)
8. Registra trazabilidad + costo en Firestore
9. Retorna planificación + advertencias

### 21.3 Interfaz abstracta

```javascript
// Provider interface (conceptual)
class AIProvider {
  async generate(prompt, schema) { }
}

class DeepSeekProvider extends AIProvider { }
class GeminiFlashProvider extends AIProvider { }
```

---

## 22. Pipeline de generación

```
1. Validación de entrada (Cloud Function)
   â†’ OA existe en Firestore, nivel válido, duración razonable, sin PII
2. Recuperación de contexto (Firestore)
   â†’ OA oficial, habilidades, actitudes
3. Construcción del prompt (plantilla versionada en Firestore)
   â†’ System prompt + contexto + tarea + esquema JSON de salida
4. Envío a DeepSeek API (con timeout 25s, retry 2)
5. Validación de respuesta contra esquema JSON
6. Auditoría pedagógica (reglas deterministas en Function)
   â†’ V-001 a V-012
7. Registro de trazabilidad en Firestore (modelo, tokens, costo, advertencias)
8. Retorno al cliente
```

---

## 23. Prompts y versionado

- Plantillas almacenadas en Firestore (`prompt-templates/{id}`)
- Cada plantilla: id, version, purpose, compatibleModels, variables, content, outputSchema, status, history
- Versionado completo con diff y rollback
- Acceso solo admin
- No guardar secretos en prompts

| ID | Tipo | Propósito |
|---|---|---|
| PT-001 | System prompt | Instrucciones generales, políticas |
| PT-002 | Plan builder | Estructura pedagógica intermedia |
| PT-003 | Section generator | Contenido de sección específica |
| PT-004 | Alternative generator | Alternativa para sección |
| PT-005 | Differentiation generator | Sugerencias de diferenciación |
| PT-006 | Assessment generator | Evaluación |
| PT-007 | Coherence reviewer | Revisión de coherencia (fallback con Gemini) |

---

## 24. Validación

| Tipo | Método | En |
|---|---|---|
| Esquema de entrada | Zod/validación manual | Cloud Function |
| Esquema de salida | Validación JSON contra schema | Cloud Function |
| Curricular | OA existe en Firestore | Cloud Function |
| Pedagógica | Reglas V-001 a V-012 | Cloud Function |
| Temporal | Suma de tiempos = duración | Cloud Function |
| Privacidad | Regex + detección básica PII | Cloud Function + frontend |

---

## 25. Revisión ética

Módulo en Cloud Function que analiza la planificación y detecta:
- Estereotipos de género
- Lenguaje discriminatorio
- Sesgo territorial (actividades no aplicables en ruralidad)
- Sesgo socioeconómico
- Accesibilidad (barreras no identificadas)
- Seguridad (actividades inseguras)
- Edad inadecuada

Salida: advertencias por nivel (critical, warning, suggestion, info).

**Nunca asigna etiqueta absoluta de "ético" o "no ético".**

---

## 26. Verificador pedagógico (V-001 a V-012)

| ID | Regla | Tipo |
|---|---|---|
| V-001 | OA seleccionado tiene actividades que lo desarrollan | Crítica |
| V-002 | Propósito se relaciona con OA | Crítica |
| V-003 | Cada actividad tiene evidencia asociada | Advertencia |
| V-004 | Evaluación mide al menos un OA | Crítica |
| V-005 | Criterios de evaluación relacionados con evidencia | Advertencia |
| V-006 | Suma duración actividades = 0.8x-1.1x duración total | Advertencia |
| V-007 | Existe al menos una actividad de cierre | Advertencia |
| V-008 | Recursos adecuados para modalidad | Sugerencia |
| V-009 | Al menos una estrategia de retroalimentación | Advertencia |
| V-010 | Al menos una pregunta clave por momento | Sugerencia |
| V-011 | Metodología coherente con propósito | Advertencia |
| V-012 | Si hay barreras, debe haber alternativas | Crítica |

---

## 27. Arquitectura técnica

### 27.1 Diagrama de contexto

```mermaid
flowchart LR
    subgraph "Firebase Project: planificacion-con-ia"
        H["Firebase Hosting<br/>(Vue 3 + Tailwind)"]
        F["Cloud Functions<br/>(Node.js + pnpm)"]
        FS["Cloud Firestore"]
        ST["Cloud Storage"]
        A["Firebase Auth"]
        LOG["Cloud Logging"]
    end

    subgraph "IA Providers"
        DS["DeepSeek API<br/>(Primary)"]
        GF["Gemini Flash API<br/>(Fallback)"]
    end

    TEACHER((Docente)) --> |HTTPS| H
    H --> |callFunction| F
    F --> FS
    F --> ST
    F --> A
    F --> DS
    F --> GF
    F --> LOG
    ADMIN((Admin)) --> H
```

### 27.2 Diagrama de flujo de generación

```mermaid
sequenceDiagram
    participant C as Cliente (Vue 3)
    participant H as Firebase Hosting
    participant F as Cloud Function
    participant FS as Firestore
    participant AI as DeepSeek / Gemini

    C->>H: Carga SPA
    H-->>C: index.html + Vue 3 + Tailwind
    C->>F: callableFunction("generatePlanning", {context, oaIds})
    F->>FS: Obtener OA oficiales
    FS-->>F: OA + habilidades
    F->>F: Validar entrada (PII, campos)
    F->>F: Construir prompt con plantilla
    F->>AI: POST /v1/chat/completions
    AI-->>F: Respuesta JSON
    F->>F: Validar esquema de salida
    F->>F: Auditoría pedagógica (V-001 a V-012)
    F->>FS: Guardar planning + trazabilidad
    F-->>C: { planning, warnings, trace }
    C->>C: Renderizar editor por bloques
```

### 27.3 Stack técnico definitivo

| Capa | Tecnología | Justificación |
|---|---|---|
| **Frontend** | HTML5 + Vue 3 (CDN) + Tailwind CSS (CDN) | Sin build step, servido por Firebase Hosting |
| **Backend** | Firebase Cloud Functions (Node.js 20) | Sin servidores, escalado automático |
| **Database** | Cloud Firestore | Tiempo real, escalable, Security Rules nativas |
| **Auth** | Firebase Auth | Email/password, Google (futuro), MFA |
| **Storage** | Firebase Storage | Archivos exportados |
| **IA** | DeepSeek API (primary) + Gemini Flash (fallback) | Costo mínimo + redundancia |
| **Hosting** | Firebase Hosting (Spark plan) | Gratuito, CDN global, SSL automático |
| **Package** | pnpm (prohibido npm) | Seguridad, performance |
| **Logging** | Firebase Cloud Logging | Trazabilidad |
| **Monitoring** | Firebase Performance + Crashlytics | Observabilidad |
| **CI/CD** | GitHub Actions + Firebase CLI (pnpx) | Despliegue automatizado |

---

## 28. Seguridad multicapa

### 28.1 Capas

| Capa | Componente | Función |
|---|---|---|
| 1 | Firebase Hosting | CDN, SSL/TLS, DDoS protection |
| 2 | Firebase Auth | Autenticación, verificación email |
| 3 | Firestore Security Rules | Control acceso a datos |
| 4 | Cloud Functions | Validación, sanitización, orquestación |
| 5 | AI Provider (DeepSeek/Gemini) | API keys desde Secret Manager (Firebase) |
| 6 | Audit Logging | Cloud Logging para todas las operaciones críticas |

### 28.2 Firestore Security Rules (conceptual)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios: solo propio perfil
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Planificaciones: propietario o admin
    match /plannings/{planning} {
      allow read, write: if request.auth != null 
        && (resource.data.userId == request.auth.uid 
        || request.auth.token.admin == true);
      allow create: if request.auth != null;
    }
    // Currículum: lectura pública
    match /curriculum/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    // Auditoría: solo admin
    match /audit-logs/{log} {
      allow read: if request.auth != null && request.auth.token.admin == true;
      allow write: if false; // solo desde Cloud Functions
    }
  }
}
```

### 28.3 OWASP LLM mitigaciones

| Riesgo | Mitigación |
|---|---|
| Prompt Injection | Validación entrada, plantillas separadas, no confiar solo en prompts |
| Insecure Output | Validación JSON, no renderizar HTML del modelo |
| Model DoS | Timeout (25s), rate limiting por usuario (10/día) |
| Sensitive Info | Filtro PII, no almacenar prompts completos |
| Excessive Agency | IA solo genera texto, requiere aprobación docente |
| Overreliance | Advertencias visibles, panel de transparencia |

---

## 29. Privacidad

### 29.1 Datos prohibidos

- RUT, nombres, correos de estudiantes
- Diagnósticos clínicos, informes médicos
- Calificaciones individualizadas
- Fotografías, grabaciones
- Datos disciplinarios

### 29.2 Controles

- Prevención en interfaz (textos de ayuda)
- Validación en frontend + Cloud Function
- Advertencia al detectar PII
- Bloqueo de envío si se detectan datos sensibles
- Auditoría de detecciones

### 29.3 Conservación en Firestore

| Dato | Conservación |
|---|---|
| Perfiles de usuario | Mientras la cuenta esté activa + 90 días |
| Planificaciones | Misma que cuenta |
| Trazabilidad IA | 2 años (sin contenido de prompts) |
| Logs de auditoría | 1 año |
| Costos IA | 2 años |

---

## 30. UX

### 30.1 Sitemap

```
/ (Landing)
/registro
/login
/dashboard (Tablero)
/dashboard/nueva (Asistente paso a paso)
/dashboard/planificacion/:id (Editor)
/dashboard/historial
/dashboard/perfil
/privacy
/terms
/accessibility
/faq
```

### 30.2 Flujo principal

```
Landing â†’ Registro/Login â†’ Dashboard
  â†’ Nueva planificación
    â†’ Paso 1: Tipo (clase)
    â†’ Paso 2: Nivel + asignatura + OA (desde Firestore)
    â†’ Paso 3: Contexto pedagógico (estudiantes, duración, recursos)
    â†’ Paso 4: Metodología
    â†’ Paso 5: Estructura
    â†’ Paso 6: Evaluación
    â†’ Paso 7: Inclusión
    â†’ Paso 8: Resumen â†’ Generar
    â†’ Paso 9: Editor + advertencias
    â†’ Paso 10: Aprobar
  â†’ Historial (ver, duplicar, exportar)
```

### 30.3 Estados de interfaz

- Vacío (sin planificaciones)
- Carga (skeleton/spinner)
- Error (red, servidor, validación)
- Recuperación (proveedor IA no disponible â†’ fallback Gemini)
- Límite alcanzado (10 generaciones/día)
- Salida inválida (IA entregó datos no válidos)

---

## 31. Exportación

| Formato | MVP | Librería |
|---|---|---|
| PDF | âœ… | jsPDF + html2canvas (frontend) o pdf-lib (backend) |
| DOCX | âœ… | docx (npm â€” en Cloud Function con pnpm) |
| Impresión | âœ… | CSS @media print |

**Declaración de IA en exportaciones:**

> "Esta planificación fue generada con asistencia de inteligencia artificial (DeepSeek, [fecha]). El contenido generado por IA ha sido revisado y aprobado por el docente responsable. La planificación final es responsabilidad del docente."

---

## 32. Evaluación de IA

### 32.1 Dataset de pruebas (50+ casos)

| Categoría | # |
|---|---|
| Distintos niveles | 10 |
| Clases cortas/largas | 5 |
| Contexto rural | 3 |
| Sin tecnología | 3 |
| Cursos numerosos | 3 |
| Educación inclusiva | 5 |
| Solicitudes ambiguas | 3 |
| Prompt injection | 3 |
| OA incorrectos | 2 |
| Datos personales | 2 |
| Sesgos culturales | 2 |

### 32.2 Rúbrica

| Criterio | Peso |
|---|---|
| Alineación curricular | 25% |
| Precisión pedagógica | 15% |
| Coherencia | 15% |
| Factibilidad | 10% |
| Adecuación etaria | 10% |
| Inclusión | 10% |
| Evaluación | 5% |
| Seguridad | 5% |

**Umbral:** â‰¥ 3.0 aprueba, 2.5-2.99 aprueba con advertencias, < 2.5 rechaza.

---

## 33. Estrategia de pruebas

| Tipo | Herramienta | Frecuencia |
|---|---|---|
| Unitarias (Functions) | Jest + pnpm | Cada commit |
| Componentes (Vue) | Vitest (con pnpm) | Cada commit |
| Integración | Firebase Emulator Suite | Cada PR |
| E2E | Playwright | Cada PR + nightly |
| Seguridad | Firestore Rules emulator | Cada PR |
| Accesibilidad | axe-core | Cada PR |
| Rendimiento | Lighthouse | Cada release |

**Gatillos:**
- Cada commit: unitarias
- Cada PR: unitarias + integración + E2E + accesibilidad
- Nightly: E2E completo + rendimiento
- Pre-producción: todo + auditoría
- Cambio de prompt: evaluación batch

---

## 34. DevOps

### 34.1 Entornos

| Entorno | Firebase Project | IA |
|---|---|---|
| Local | Emulator Suite | Mock |
| Desarrollo | planificacion-con-ia-dev (futuro) | DeepSeek (límite 5/día) |
| Producción | planificacion-con-ia | DeepSeek + Gemini Flash |

### 34.2 CI/CD con pnpm

```yaml
# GitHub Actions (conceptual)
steps:
  - uses: actions/checkout@v4
  - uses: pnpm/action-setup@v2
  - run: pnpm install
  - run: pnpm test
  - run: pnpm build
  - run: pnpx firebase deploy --only hosting,functions,firestore
```

### 34.3 Comandos principales

| Acción | Comando |
|---|---|
| Login Firebase | `pnpx firebase login` |
| Init proyecto | `pnpx firebase init` |
| Emular local | `pnpx firebase emulators:start` |
| Deploy hosting | `pnpx firebase deploy --only hosting` |
| Deploy functions | `pnpx firebase deploy --only functions` |
| Deploy todo | `pnpx firebase deploy` |
| Tests | `pnpm test` |

---

## 35. Costos

### 35.1 Firebase Spark Plan (gratuito)

| Recurso | Límite Spark |
|---|---|
| Cloud Firestore | 1 GB almacenamiento, 10 GB/mes descarga |
| Firebase Auth | 10 000 usuarios/mes |
| Firebase Hosting | 10 GB almacenamiento, 360 MB/día descarga |
| Cloud Functions | 2M invocaciones/mes |
| Firebase Storage | 5 GB almacenamiento, 1 GB/día descarga |
| Cloud Logging | 50 GB/mes ingestión |

### 35.2 Costos IA estimados (MVP)

| Proveedor | Costo estimado/mes (1000 generaciones) |
|---|---|
| DeepSeek (primario) | ~$15-30 USD |
| Gemini Flash (fallback) | ~$5-10 USD (o gratuito si dentro del free tier) |

### 35.3 Controles de costos

| Control | Detalle |
|---|---|
| Límite diario por usuario | 10 generaciones/día |
| Timeout por generación | 25s |
| Tokens máximos salida | 2000 tokens |
| Modelo económico | DeepSeek para todo, Gemini solo fallback |
| Alerta de presupuesto | Cloud Monitoring alerta al 80% |
| Bloqueo seguro | Desactivar generación (no toda la app) |

---

## 36. Plan por fases

| Fase | Nombre | Estado | Progreso |
|------|--------|--------|----------|
| 0 | Descubrimiento | COMPLETADA | Project Master Plan, investigacion curricular, definicion de producto |
| 1 | Configuracion Firebase + Proyecto | COMPLETADA | firebase.json, .firebaserc, firestore.rules, storage.rules, firebase.js, admin SDK |
| 2 | Ingesta curricular | COMPLETADA | 23 OA + 10 habilidades + 10 actitudes de Historia 7 basico en Firestore |
| 3 | Autenticacion + Perfil | COMPLETADA | Login, registro, verificacion email, reset password, perfil editable, eliminacion cuenta |
| 4 | Frontend base (Vue 3 + Tailwind) | COMPLETADA | SPA con 10 vistas, Layout, auth guard, render functions, todos los estados (carga/vacio/error) |
| 5 | Planificaciones manuales | COMPLETADA | ManualEditor, autoguardado 30s, versionado en subcoleccion, editar/crear manual |
| 6 | Integracion DeepSeek + Gemini Fallback | COMPLETADA | generatePlanning, regenerateSection, approvePlanning, prompt PT-001 en Firestore, validacion JSON, auditoria V-001 a V-012, trazabilidad |
| 7 | Reglas pedagogicas + Advertencias | COMPLETADA | V-001 a V-012 en backend + frontend: warning panel en editor, badge en dashboard, display en detalle |
| 8 | Exportacion | COMPLETADA | PDF (print + CSS), DOCX (docx library en Cloud Function), declaracion IA en exportaciones |
| **9** | **QA integral** | **COMPLETADA** | **Emulator + Jest 29/29, QA legacy 20/20, E2E 11/11, manual CF 81/81** |
| 10 | Piloto docente | DOCUMENTADO | Pendiente ejecución con docentes | Requiere deploy a produccion |
| 11 | Despliegue MVP | COMPLETADO | https://planificacion-con-ia.web.app | Bloqueante: IAM permissions para Cloud Functions |
| **12** | **Marco DUA** | **COMPLETADA** | **Selector DUA vs estandar, 3 principios CAST (representacion, accion/expresion, implicacion), campo dua en modelo, plantilla PT-001, editor manual, detalle, export DOCX** |
| **13** | **Escalado curricular (8 niveles)** | **COMPLETADA** | **5° basico a 4° medio, 116 OA Historia + 80 skills + 80 actitudes, ingesta extensible** |
| **14** | **Multi-asignatura + optimizacion de costos** | **COMPLETADA** | **Selector de asignatura (5), cache curriculum localStorage, prompt truncado, max 4 OA, indices compuestos, analisis de costos seccion 45** |
| **15** | **Ingesta masiva multi-asignatura** | **COMPLETADA** | **666 OA oficiales (scraper), 224 habilidades, 212 actitudes, 1102 docs** |
| **16** | **Catalogo dinamico de asignaturas** | **COMPLETADA** | **catalog/subjects en Firestore + lectura publica + cache + fallback; se agregan asignaturas sin redeploy** |
| **17** | **Piloto docente ampliado** | **EN PREPARACION** | **Infraestructura lista: pilot-metrics.mjs, submitFeedback, plantillas PT-002..006, UI feedback** |
| **18** | **Migraciones tecnicas** | **COMPLETADA** | **Node 22 runtime, functions.config eliminado, firebase-functions 7.3.2, firebase-admin 14.2.0** |

### Fase 0 — Descubrimiento ✅ COMPLETADA
Project Master Plan, investigacion curricular y normativa, definicion de producto, principios eticos.

### Fase 1 — Configuracion Firebase + Proyecto ✅ COMPLETADA
Archivos: firebase.json, .firebaserc, firestore.rules, storage.rules, firestore.indexes.json.
pnpm como package manager. Firebase Hosting, Auth, Functions, Firestore, Storage configurados.

### Fase 2 — Ingesta curricular ✅ COMPLETADA
23 OA de Historia 7 basico (HI07 OA 01 a HI07 OA 23), 10 habilidades (OAH a-j), 10 actitudes (OAA A-J).
Script: scripts/ingesta-curriculo.js. Almacenados en Firestore con texto oficial desde curriculumnacional.cl.

### Fase 3 — Autenticacion + Perfil ✅ COMPLETADA
Login, registro con verificacion email, recuperacion de contrasena, perfil editable, eliminacion de cuenta con exportacion JSON.
Proteccion de rutas (auth guard). Firebase Auth + Firestore user profiles.

### Fase 4 — Frontend base (Vue 3 + Tailwind) ✅ COMPLETADA
SPA completa con Vue 3 + Tailwind via CDN (importmap). 10 vistas funcionales:
Landing, Login, Registro, VerificarEmail, Dashboard, Perfil, Wizard 10 pasos, Detalle planificacion, Privacidad, Terminos.
Componentes UI: Layout, Spinner, Alert, EmptyState, Card, PageTitle, statusBadge.

### Fase 5 — Planificaciones manuales (CRUD + editor) ✅ COMPLETADA
ManualEditor: formulario con sidebar + contenido principal, actividades por momento (inicio/desarrollo/cierre),
autoguardado cada 30s, versionado en subcoleccion, aprobacion manual. Dos modos de entrada: con IA y manual.

### Fase 6 — Integracion DeepSeek + Gemini Fallback ✅ COMPLETADA
Cloud Functions: generatePlanning (DeepSeek con fallback automatico a Gemini Flash),
regenerateSection (regeneracion por seccion), approvePlanning (aprobacion + audit log).
Prompt template PT-001 en Firestore. Limite 10 generaciones/dia/usuario. Sanitizacion PII.
Trazabilidad completa (modelo, tokens, costo). Auditoria V-001 a V-012 post-generacion.

### Fase 7 — Reglas pedagogicas + Advertencias ✅ COMPLETADA
V-001 a V-012 implementadas en backend (Cloud Function) y frontend (evaluateWarnings en ManualEditor).
Panel de advertencias en editor con conteo de criticas/advertencias. Badge en dashboard.
Display mejorado en detalle de planificacion con colores por severidad.

### Fase 8 — Exportacion ✅ COMPLETADA
PDF via window.print() con print stylesheet (oculta nav/footer/botones, margenes 2cm).
DOCX via Cloud Function con libreria docx: titulo, OA, proposito, actividades, evaluacion,
diferenciacion, recursos, declaracion de IA (modelo, fecha, tokens, costo).
Almacenamiento en Firebase Storage con URL firmada por 7 dias.

### Fase 9 — QA integral ✅ COMPLETADA

Tests con Firebase Emulator Suite + Jest (29/29), QA legacy (20/20), E2E Playwright (11/11), manual CF (81/81).

### Fase 10 — Piloto docente ⏳ DOCUMENTADO
Despliegue a produccion: hosting (https://planificacion-con-ia.web.app), Cloud Functions (generatePlanning, regenerateSection, approvePlanning, exportPlanning, onNewAuditLog), Firestore rules + indexes, Storage rules.
API keys migradas a .env (DEEPSEEK_API_KEY). CORS configurado y allUsers invoker para Cloud Run.
Resolucion de errores de produccion: preflight CORS, IAM invoker, normalizacion de respuesta DeepSeek (planificacion/proposito/actividades en espanol a schema interno).

### Fase 11 — Despliegue MVP ✅ COMPLETADA
Wizard paso 7 redisenado con selector de marco: DUA completo (recomendado) vs Formato estandar.
DUA con 3 principios CAST: Representacion (el que), Accion y Expresion (el como), Implicacion (el por que).
Checkboxes de estrategias por principio. Modelo de datos con campo dua {representacion, accionExpresion, implicacion}.
Plantilla PT-001 con placeholders {{framework}}, {{barriers}}, {{dua}} y campo dua en schema JSON.
ManualEditor con seccion DUA, vista detalle con card DUA, export DOCX/PDF con seccion DUA.

### Fase 12 — Marco DUA ✅ COMPLETADA
Wizard ampliado de 4 a 8 niveles: 5-basico a 4-medio.
Ingesta de Historia media (1M-4M): 42 OA nuevos. Total: 116 OA + 80 habilidades + 80 actitudes.
Script ingesta-curriculo.js extensible: makeSkills/makeAttitudes/prefixed para multiples niveles y asignaturas.

### Fase 13 — Escalado curricular (8 niveles) ✅ COMPLETADA
Wizard con selector de asignatura: Historia, Lenguaje, Matematica, Cs. Naturales, Ingles (constantes SUBJECTS en app.js).
Cache del curriculum en localStorage (TTL 7 dias): reduce lecturas Firestore ~90%.
Prompt optimizado: texto OA truncado a 250 chars, max 4 OA por generacion, prefijo estable para DeepSeek prefix-caching.
Indices compuestos nuevos: level+subject+axis, type+level+subject+code.
Analisis de costos documentado en seccion 45 (Firestore ~2$/mes, IA ~.50/10K generaciones).

### Fase 14 — Multi-asignatura + optimizacion de costos ✅ COMPLETADA
Scraper de curriculumnacional.cl (scripts/scrape-curriculum.mjs) que extrae OA, habilidades y actitudes oficiales del Mineduc.
Resultado: 666 OA + 224 habilidades + 212 actitudes (1102 docs) en 5 asignaturas x 8 niveles:
- Matematica: 122 OA | Lenguaje y Comunicacion: 177 OA | Cs. Naturales: 106 OA | Historia: 157 OA | Ingles: 104 OA
- Nota: 3o-4o medio incluyen solo Formacion General (slugs FG-*) y una electiva por asignatura; el resto es curriculum diferenciado.

### Fase 15 — Ingesta masiva multi-asignatura ✅ COMPLETADA
Coleccion catalog/subjects en Firestore con: key, name, icon, sort, active.
Frontend carga el catalogo en loadSubjectCatalog() con cache localStorage (TTL 7 dias) y fallback a DEFAULT_SUBJECTS.
Firestore rules: lectura publica, escritura solo admin (script scripts/seed-catalog.mjs).
Para agregar una asignatura: seed + ingesta de OA. Sin redeploy del frontend.

### Fase 16 — Catalogo dinamico de asignaturas ✅ COMPLETADA
Coleccion catalog/subjects en Firestore: key, name, icon, sort, active.
Frontend: loadSubjectCatalog() con cache localStorage (TTL 7 dias) y fallback a DEFAULT_SUBJECTS.
Firestore rules: lectura publica, escritura solo admin. Script: scripts/seed-catalog.mjs.
Para agregar una asignatura: seed + ingesta de OA. Sin redeploy del frontend.

### Fase 17 — Piloto docente ampliado ⚙️ EN PREPARACION
Infraestructura de medicion y feedback lista:
- scripts/pilot-metrics.mjs: KPIs (uso, aprobacion, tiempo de generacion, costo IA, advertencias, cobertura, feedback)
- Cloud Function submitFeedback + coleccion feedback + UI de feedback en vista detalle
- Plantillas de prompt por asignatura: PT-002 Matematica, PT-003 Lenguaje, PT-004 Cs. Naturales, PT-005 Historia, PT-006 Ingles (seleccion automatica por subject en generatePlanning)
- audit-logs con durationMs, subject y level para telemetria
Pendiente: reclutamiento de docentes reales, ejecucion y analisis de resultados.

### Fase 18 — Migraciones tecnicas ✅ COMPLETADA
- Runtime Node 20 -> 22 en firebase.json y engines (functions en nodejs22).
- functions.config() eliminado: getDeepSeekKey/getGeminiKey usan solo process.env (functions/.env).
- firebase-functions 6.6.0 -> 7.3.2, firebase-admin 12.7.0 -> 14.2.0.
- pnpm-workspace.yaml con allowBuilds correcto.
- Verificado: 6 funciones en nodejs22, tests 29/29, E2E 11/11.

## 37. Backlog

| ID | Funcionalidad | Prioridad | Fase | Esfuerzo |
|---|---|---|---|---|
| E-01 | Configurar Firebase project + pnpm | Must | 1 | 1 sem |
| E-02 | Firebase Auth (email/password) | Must | 3 | 1 sem |
| E-03 | Perfil de usuario (Firestore) | Must | 3 | 1 sem |
| E-04 | Landing page (Vue 3 + Tailwind) | Must | 4 | 1 sem |
| E-05 | Dashboard principal | Must | 4 | 1 sem |
| E-06 | Ingesta curricular (Firestore) | Must | 2 | 2 sem |
| E-07 | Biblioteca curricular (navegación) | Must | 4 | 2 sem |
| E-08 | Editor de planificaciones (bloques) | Must | 5 | 3 sem |
| E-09 | Autoguardado a Firestore | Must | 5 | 1 sem |
| E-10 | Versionado de planificaciones | Must | 5 | 1 sem |
| E-11 | CRUD planificaciones | Must | 5 | 2 sem |
| E-12 | Aprobación docente | Must | 5 | 1 sem |
| E-13 | Asistente guiado (10 pasos) | Must | 5 | 3 sem |
| E-14 | Cloud Function orquestación IA | Must | 6 | 2 sem |
| E-15 | Integración DeepSeek API | Must | 6 | 2 sem |
| E-16 | Validación esquemas JSON | Must | 6 | 1 sem |
| E-17 | Trazabilidad en Firestore | Must | 6 | 1 sem |
| E-18 | Límite 10 generaciones/día | Must | 6 | 0.5 sem |
| E-19 | Reglas V-001 a V-012 | Must | 7 | 2 sem |
| E-20 | Panel de advertencias | Must | 7 | 1 sem |
| E-21 | Detección de PII | Must | 7 | 1 sem |
| E-22 | Exportación PDF | Must | 8 | 2 sem |
| E-23 | Exportación DOCX | Must | 8 | 2 sem |
| E-24 | Declaración de IA en exportación | Must | 8 | 0.5 sem |
| E-25 | Historial de planificaciones | Must | 5 | 1 sem |
| E-26 | Gemini Flash fallback | Should | 9 | 1 sem |
| E-27 | Firestore Security Rules | Must | 3 | 1 sem |
| E-28 | CI/CD con GitHub Actions + pnpm | Should | 1 | 1 sem |
| E-29 | Pruebas E2E (Playwright) | Must | 10 | 2 sem |
| E-30 | Accesibilidad WCAG AA | Must | 4-10 | 3 sem |
| E-31 | Red teaming IA | Should | 10 | 1 sem |
| E-32 | Piloto docente | Must | 11 | 4 sem |
| E-33 | Despliegue producción | Must | 12 | 1 sem |
| E-34 | Política de privacidad + términos | Must | 3 | 1 sem |
| E-35 | Marco DUA (selector + 3 principios) | Must | 12 | 2 sem |
| E-36 | Escalado a 8 niveles (5B-4M) | Must | 13 | 2 sem |
| E-37 | Multi-asignatura (selector + catalogo) | Must | 14 | 2 sem |
| E-38 | Cache curriculum client-side | Should | 14 | 0.5 sem |
| E-39 | Optimizacion de prompt (tokens) | Should | 14 | 0.5 sem |
| E-40 | Ingesta masiva multi-asignatura | Must | 15 | 4 sem |
| E-41 | Catalogo dinamico de asignaturas | Should | 16 | 1 sem |
| E-42 | Piloto docente ampliado | Must | 17 | 4 sem |
| E-43 | Migracion Node 22 | Must | 18 | 1 sem |
| E-44 | Migracion functions.config a env | Must | 18 | 1 sem |

---

## 38. Decisiones tomadas vs pendientes

### Tomadas

| Decisión | Valor |
|---|---|
| AI Provider primario | DeepSeek (API key en functions/.env, NO versionada) |
| AI Fallback | Gemini 1.5 Flash |
| Hosting | Firebase Hosting (plan Spark gratuito) |
| Base de datos | Cloud Firestore (NoSQL) |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Frontend | Vue 3 (CDN/importmap) + Tailwind CSS (CDN) |
| Package manager | pnpm (npm prohibido) |
| Autenticación | Firebase Auth (email + password) |
| Almacenamiento | Firebase Storage |
| Monitoreo | Firebase Performance + Crashlytics |
| Proyecto Firebase | `planificacion-con-ia` |
| Región | us-central1 (Firebase default) |

### Pendientes

| Decisión | Opciones | Recomendación |
|---|---|---|
| Framework CSS componentes | Tailwind utility-first + componentes propios | Tailwind + DaisyUI o componentes manuales |
| Estrategia de rutas Vue | Vue Router (CDN) vs SPA manual | Vue Router CDN |
| Manejo de estado Vue | Pinia (CDN) vs reactive() + provide/inject | reactive() + composables (ligero) |
| Librería PDF | jsPDF (CDN frontend) vs pdf-lib (Cloud Function) | jsPDF frontend (evita descarga a servidor) |
| DOCX library | docx npm (Cloud Function) | docx en Cloud Function con pnpm |
| Nombre producto final | PlanificaIA / otro | PlanificaIA |
| Colores/marca | Por definir | Pendiente de diseño |

---

## 39. API de DeepSeek

### 39.1 Configuración

- API Key: `DEEPSEEK_API_KEY` en `functions/.env` (NO versionada)
- Endpoint: `https://api.deepseek.com/v1/chat/completions`
- Modelo recomendado: `deepseek-chat` (DeepSeek-V2) o `deepseek-reasoner` (R1)
- Contexto: 64K tokens
- Precio: ~$0.14/1M input, ~$0.28/1M output (deepseek-chat)

### 39.2 Llamada desde Cloud Function

```javascript
// Concepto (no implementar aún)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function callDeepSeek(messages, schema) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  });
  return response.json();
}
```

---

## 40. Firebase project actual

### 40.1 Configuración existente

Archivo `firebase.js` (frontend):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyADeo8Y7lVBeT4MJNXOqQSbirOa6sdX3EY",
  authDomain: "planificacion-con-ia.firebaseapp.com",
  projectId: "planificacion-con-ia",
  storageBucket: "planificacion-con-ia.firebasestorage.app",
  messagingSenderId: "317744047775",
  appId: "1:317744047775:web:c7779e496403a6e64ae4aa",
  measurementId: "G-TFHV3R6JT0"
};
```

Admin SDK: `planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json` (para Cloud Functions).

### 40.2 Servicios a habilitar

- [x] Firebase Authentication
- [x] Cloud Firestore
- [x] Firebase Hosting
- [x] Cloud Storage
- [x] Cloud Functions (habilitado con plan Blaze)
- [x] Firebase Performance Monitoring
- [x] Firebase Crashlytics
- [x] Cloud Logging

**RIESGO:** Cloud Functions requiere plan Blaze (pay-as-you-go) aunque tiene generoso free tier (2M invocaciones/mes). El plan Spark gratuito NO incluye Cloud Functions salvo para invocaciones desde Firebase Hosting con rewrites.

---

## 41. Glosario

| Término | Definición |
|---|---|
| OA | Objetivo de Aprendizaje (curriculum nacional) |
| OAT | Objetivo de Aprendizaje Transversal |
| OAH | Objetivo de Aprendizaje de Habilidad |
| OAA | Objetivo de Aprendizaje de Actitud |
| MBE | Marco para la Buena Enseñanza |
| DUA | Diseño Universal para el Aprendizaje |
| UTP | Unidad Técnico-Pedagógica |
| PII | Personally Identifiable Information |
| MVP | Minimum Viable Product |
| SPA | Single Page Application |
| Spark Plan | Plan gratuito de Firebase |

---

## 42. Criterios de aceptación del MVP

| ID | Criterio |
|---|---|
| MVP-01 | OA desde Firestore (no del modelo) |
| MVP-02 | Contexto mínimo obligatorio antes de generar |
| MVP-03 | API Key de DeepSeek NO expuesta al frontend |
| MVP-04 | Salida validada contra esquema JSON |
| MVP-05 | Planificación editable en editor por bloques |
| MVP-06 | Regeneración de una sección específica |
| MVP-07 | Trazabilidad: modelo, fecha, OA, advertencias |
| MVP-08 | Aprobación docente explícita requerida |
| MVP-09 | Exportación PDF + DOCX |
| MVP-10 | Historial con filtros básicos |
| MVP-11 | Reglas V-001 a V-012 implementadas |
| MVP-12 | Advertencia sobre no incluir datos personales |
| MVP-13 | Manejo de errores: fallback Gemini si DeepSeek falla |
| MVP-14 | Pruebas con Firebase Emulator Suite |
| MVP-15 | Accesibilidad: navegación por teclado |
| MVP-16 | Límite 10 generaciones/día por usuario |
| MVP-17 | Política de privacidad y términos visibles |
| MVP-18 | Deploy con `pnpx firebase deploy` |

---

## 43. Riesgos

| ID | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R-01 | OA inventado por IA | Baja | Crítico | OA desde Firestore, validación |
| R-02 | DeepSeek API no disponible | Media | Alto | Fallback automático a Gemini Flash |
| R-03 | Límites Spark Plan | Media | Medio | Monitoreo de uso, migrar a Blaze si necesario |
| R-04 | Costos DeepSeek imprevistos | Baja | Medio | Límite diario, alertas, tope de tokens |
| R-05 | Seguridad API Key DeepSeek | Baja | Crítico | Secret Manager, nunca en frontend |
| R-06 | Firestore Rules mal configuradas | Media | Crítico | Pruebas con emulador + revisión |
| R-07 | PII en prompts de usuario | Media | Alto | Filtro PII en Frontend + Function |
| R-08 | Confianza excesiva en IA | Alta | Alto | Advertencias + verificador pedagógico |
| R-09 | Baja adopción docente | Media | Alto | UX research, piloto, iteración |
| R-10 | npm infectado (por eso usamos pnpm) | N/A | Crítico | pnpm lockfile, auditoría de dependencias |

---

## 44. Conclusiones

El archivo `PROJECT_MASTER_PLAN.md` ha sido actualizado a **v2.0** con las siguientes decisiones estratégicas:

1. **Stack 100% Firebase:** Hosting + Functions + Firestore + Storage + Auth
2. **IA dual:** DeepSeek (primario) + Gemini Flash (fallback automático)
3. **Package manager:** pnpm (seguridad, npm prohibido)
4. **Frontend:** Vue 3 + Tailwind CSS vía CDN (sin build step)
5. **Base de datos:** Firestore (NoSQL)
6. **Proyecto Firebase existente:** `planificacion-con-ia` (configurado)
7. **Plan:** Spark (gratuito) con posible migración a Blaze para Cloud Functions

**Próximo paso:** Piloto docente con usuarios reales, recolección de feedback, y mejora continua.

**URL de producción:** https://planificacion-con-ia.web.app

---

## 45. Análisis de escalado (5° básico → 4° medio, multi-asignatura)

### 45.1 Cobertura actual (implementada)

| Nivel | OA Historia | Skills | Actitudes |
|-------|------------|--------|-----------|
| 5° básico | 13 | 10 | 10 |
| 6° básico | 16 | 10 | 10 |
| 7° básico | 23 | 10 | 10 |
| 8° básico | 22 | 10 | 10 |
| 1° medio | 12 | 10 | 10 |
| 2° medio | 12 | 10 | 10 |
| 3° medio | 10 | 10 | 10 |
| 4° medio | 8 | 10 | 10 |
| **Total** | **116** | **80** | **80** |

Asignaturas habilitadas en el wizard: Historia, Lenguaje, Matemática, Ciencias Naturales, Inglés (requieren ingesta de OA oficiales desde curriculumnacional.cl).

### 45.2 Costos Firestore

| Escenario | Docs | Tamaño | Costo |
|---|---|---|---|
| Actual (8 niveles, Historia) | ~276 docs | ~0.2 MB | Gratis (Spark 1 GB) |
| Escalado (8 niveles × 8 asignaturas) | ~2,900 docs | ~1.7 MB | Gratis (Spark 1 GB) |
| Máximo realista (8 niveles × 30 asignaturas) | ~11,000 docs | ~6.5 MB | Gratis (Spark 1 GB) |

**Storage: despreciable.** El costo real está en lecturas:
- Cada sesión del wizard lee ~50 docs (1 nivel + 1 asignatura)
- 10K usuarios/día → 500K lecturas/día
- Spark: 20K/día gratis → se excede; Blaze free tier: 50K/día → $0.06/50K adicionales ≈ $18/mes
- **Mitigado:** caché del currículum en `localStorage` (TTL 7 días) → reduce lecturas ~90% → ~$2/mes

### 45.3 Costos IA (DeepSeek)

| Componente | Tokens | Costo |
|---|---|---|
| Input (system + template + OA + contexto) | ~1,100 | $0.14/M |
| Output (planificación JSON) | ~1,000 | $0.28/M |
| **Total sin caché** | | **~$0.00043/generación** |
| **Con prefix-caching DeepSeek** (~40% input cacheado a $0.07/M) | | **~$0.00032** |

- 1,000 generaciones/mes ≈ **$0.35**
- 10,000 generaciones/mes ≈ **$3.50**

### 45.4 Optimizaciones implementadas

| Optimización | Ahorro | Implementación |
|---|---|---|
| DeepSeek prefix-caching | ~50% input | Prefijo estable (system + instrucciones) |
| Texto OA truncado a 250 chars | ~40% tokens OA | `slice(0, 250)` en backend |
| Máx 4 OA por generación | Límite tokens | `toggleOA` valida `length < 4` |
| Caché curriculum client-side | ~90% lecturas Firestore | `localStorage` con TTL 7 días |
| Índices compuestos | Sin scans | `level+subject+code`, `level+subject+axis`, `type+level+subject+code` |
| Rate limiting | Evita abuso | 10 gen/día/usuario |

### 45.5 Próximos pasos para escalar

1. **Ingesta masiva de OA oficiales** — scraping de curriculumnacional.cl o dataset Mineduc para las 5 asignaturas × 8 niveles
2. **Catálogo de asignaturas dinámico** — mover `SUBJECTS` a Firestore para habilitar asignaturas sin redeploy
3. **Optimización de índice por eje** — usar `axis` para filtrar unidades dentro de una asignatura
4. **Migración runtime a Node 22** — Node 20 deprecado (oct 2026)
5. **Migración de `functions.config()` a env vars** — deprecado (mar 2027)




















