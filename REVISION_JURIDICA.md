# Revisión Jurídica Normativa — PlanificaIA

**Fase S-0 · Consolidación y habilitadores**
**Fecha:** 2026-07-31
**Estado:** Revisión técnica preliminar — requiere validación de abogado antes de uso institucional

---

## 1. Objeto

Validar y sistematizar la investigación normativa pendiente (sección 2 del master plan) para el
producto PlanificaIA: generador ético de planificaciones de clase alineadas al currículum
chileno, con IA generativa (DeepSeek primario, Gemini Flash fallback), sin datos personales
de estudiantes.

---

## 2. Normativa aplicable y estado

### 2.1 Protección de datos personales

| Norma | Estado | Aplicación a PlanificaIA | Acción requerida |
|---|---|---|---|
| **Ley 21.719** (reforma a Ley 19.628) — protección y tratamiento de datos personales, crea Agencia de Protección de Datos Personales | Publicada 13/12/2024, **vigencia 01/12/2026** | El producto trata datos personales de **docentes** (nombre, correo). Tratamiento de menores <16 años exige consentimiento de representantes legales. | El producto no trata datos de estudiantes (diseño PR004), mitigando el punto crítico. Preparar política de privacidad conforme a la nueva ley antes de 01/12/2026. |
| Ley 19.628 (texto actual, "protección de la vida privada") | Vigente hasta 30/11/2026 | Aplica hoy | Cumplimiento actual documentado en sección 29 del master plan (datos prohibidos, retención). |
| Decreto 83/2015 — adecuación curricular para estudiantes con NEE | Vigente | Incluido en diseño DUA (PR006, MP03) | Validar que el modelo DUA no constituya diagnóstico clínico (prohibido). |
| Ley 21.545 — autismo (TEA) | Vigente | Barreras/alternativas en planificaciones | No hace diagnóstico; solo sugiere alternativas pedagógicas. Verificar redacción. |

### 2.2 Marco educativo

| Norma | Estado | Aplicación | Acción |
|---|---|---|---|
| Ley 20.370 — LGE (General de Educación) | Vigente | Base legal del currículum | Sin acción. |
| Decreto 67/2018 — Evaluación | Vigente | Criterios de evaluación en plantillas (MP02) | Sin acción. |
| Bases Curriculares + Programas de Estudio | Vigente | OA scrapeados de curriculumnacional.cl (MP04, MP05) | **Verificar licencia/uso del contenido oficial.** El texto oficial de OA se usa para fines educativos; no se reutiliza comercialmente como obra propia. |
| Marco para la Buena Enseñanza (MBE 2021) | Vigente | MP01 | Sin acción. |

### 2.3 IA y ética

| Marco | Estado | Aplicación |
|---|---|---|
| UNESCO — Recomendación Ética IA 2021 + Guidance GenAI 2023 | Referencial | Fundamento de la sección 13 del master plan (proporcionalidad, supervisión humana, transparencia). |
| OWASP LLM Top 10 | Referencial | Mitigaciones en sección 28.3 (prompt injection, PII, agency). |

### 2.4 Consumidor (futuro)

| Norma | Estado | Aplicación |
|---|---|---|
| Ley 19.496 — Protección al consumidor | Vigente | Relevante solo cuando exista plan de pago (S-7). |

---

## 3. Hallazgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| H01 | Ley 21.719 vigente el 01/12/2026: el producto debe adecuar su política de privacidad y registros de tratamiento antes de esa fecha | Alta | **RESUELTO (S-6)** — política de privacidad publicada conforme a 19.628 y en adecuación a 21.719 (base legal, ARCO, retención, DPO, menores <16) |
| H02 | **Verificar licencia de uso del currículum Mineduc** (scraping de curriculumnacional.cl): el texto oficial de OA se usa para fines educativos; confirmar que no se requiere autorización para uso en producto de terceros | Alta | **PENDIENTE — validación jurídica** (fuera del alcance técnico; el uso se declara educativo y no comercial como obra propia en los términos) |
| H03 | El producto no trata datos de menores (diseño PR004) — mitigación estructural del riesgo más alto de la ley 21.719 | — | Confirmado en implementación (filtros PII, sin almacenar prompts con datos) |
| H04 | Términos de uso y política de privacidad existen en frontend (`/privacy`, `/terms`) pero no están versionados ni con fecha de aceptación | Media | **RESUELTO (S-6: RF-013)** — términos y privacidad versionados (`TERMS_VERSION`/`PRIVACY_VERSION`), aceptación al registrarse y re-consentimiento con modal |
| H05 | El "delegado de protección de datos" (art. 50 ley 21.719) no aplica obligatoriamente hoy al volumen de datos, pero se recomienda designarlo antes de 01/12/2026 | Media | **DOCUMENTADO (S-6)** — sección 8 de la política de privacidad; se designará DPO si el volumen lo exige antes de la vigencia |

---

## 4. Conclusión S-0

La investigación normativa del master plan se confirma **sustancialmente correcta y vigente**.
El diseño del producto (sin datos de estudiantes, supervisión docente, trazabilidad) está
alineado con la normativa vigente y con la ley 21.719 próxima a entrar en vigor.

**Únicos pendientes de revisión jurídica profesional:**
1. **H02**: licencia de uso del contenido curricular Mineduc (alto, bloqueante para institucional).
2. **H01**: adecuación a ley 21.719 antes de 01/12/2026.

**Decisión:** S-0 revisión jurídica = COMPLETADA a nivel técnico; los tres puntos pasan a
S-6 como tareas ya identificadas y priorizadas. El criterio de salida de S-0 (deploy 1 clic,
tests verdes, fallback Gemini operativo) se cumple independientemente de estos pendientes.

---

## 5. Actualización S-6 (2026-07-31)

Los hallazgos H01 (adecuación Ley 21.719), H04 (términos versionados) y H05 (DPO) se
**resolvieron en S-6** (ver tabla de hallazgos). Solo H02 (licencia Mineduc) queda pendiente
de validación jurídica externa. Implementación técnica detallada en el cierre de S-6 de
`PLAN_ESCALADO.md`.
