# Manual de Pruebas — PlanificaIA

**Versión:** 1.0 · **Fecha:** 2026-08-12
**URL:** https://planificacion-con-ia.web.app
**Ámbito:** pruebas manuales de aceptación (funcionalidades core + U17/U17b feature flags)

---

## 1. Cuentas de prueba (creadas 2026-08-12)

Todas las cuentas tienen contraseña **`PlanIFia-2026`** y correo ya verificado. Fueron creadas contra el proyecto de producción.

| Cuenta | Rol | Plan | UID | Para qué sirve |
|---|---|---|---|---|
| `admin.prueba@planificaia.test` | admin | Pro | `EcaPPWhrkLTn76BBIx6kbN435E03` | Panel de flags, ve todo siempre (bypass U17b) |
| `docente.prueba@planificaia.test` | teacher | Free | `1hXHLHty8HhVfUj3lxkymkZgxRO2` | Docente normal: con flags off **no** ve las funcionalidades nuevas |
| `piloto.prueba@planificaia.test` | teacher | Free | `BwqOfihh1heiY2E8Tj3Cd7hcPV62` | Piloto allowlist: ve Gamificación y Prompts externos (allowlist ya configurada) |

> **Estado de flags en producción (2026-08-12):** todas las flags globales apagadas (`false`). Allowlist activada para el **piloto** en `gamificationModuleEnabled` y `externalPromptGeneratorEnabled`.

---

## 2. Cómo crear más cuentas de prueba

Si se necesitan nuevos usuarios (p. ej. más docentes para rollout), reutilizar el script **idempotente**:

```powershell
$env:FIREBASE_SA_PATH = "C:\Users\marga\OneDrive\Desktop\PROYECTS\Generador-ético-de-planificaciones-con-IA\planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json"
node scripts/seed-test-users.mjs
```

Editar el arreglo `TEST_USERS` en `scripts/seed-test-users.mjs` para añadir cuentas. Para poner un usuario en la allowlist de un flag:

```powershell
node scripts/seed-feature-flags.mjs "--allow=gamificationModuleEnabled=<UID>" "--allow=externalPromptGeneratorEnabled=<UID>"
```

---

## 3. Pasos de prueba

### 3.1. Registro y términos (RF-013)

1. Abrir `https://planificacion-con-ia.web.app/#/registro`.
2. Crear una cuenta nueva con correo real y aceptar los términos.
3. **Esperado:** aparece aviso de correo de verificación; al reenviar el enlace y entrar, redirige al dashboard.
4. Cerrar sesión y volver a entrar con la misma cuenta.
5. **Esperado:** no vuelve a pedir aceptar términos (versiones `2026-07-31` ya aceptadas).

### 3.2. Login con cuentas de prueba

| Pasos | Resultado esperado |
|---|---|
| Login con `admin.prueba@planificaia.test` | Entra directo al dashboard (correo verificado), ve en el menú **Institucional**, **Gamificaciones** y **Prompts externos** |
| Login con `docente.prueba@planificaia.test` | Entra al dashboard, el menú **NO** muestra Gamificaciones ni Prompts externos |
| Login con `piloto.prueba@planificaia.test` | Entra al dashboard y el menú **SÍ** muestra Gamificaciones y Prompts externos (allowlist) |

### 3.3. Generación de planificaciones (core)

1. Con cualquier cuenta, ir al **Asistente** (`#/nueva`).
2. Completar los 10 pasos: nivel, asignatura, unidad, OA, metodologías, evaluación, DUA, duraciones, contexto, datos base.
3. Solicitar la generación.
4. **Esperado:** se muestra el borrador con declaración de IA; el botón de **Aprobar** habilita la vista final.
5. Aprobar y exportar a **DOCX** (Cloud Function) y **PDF** (impresión). Debe incluir la declaración de asistencia de IA.

### 3.4. Panel de feature flags (U17b, solo admin)

**Rol requerido:** admin (`admin.prueba@planificaia.test` o la cuenta del propietario).

1. Ir a `#/institucional` → card **Funcionalidades**.
2. **Esperado:** aparecen los 5 switchs (Recomendación metodológica, Gamificación, Generador de prompts externos, Contexto técnico-profesional, Contexto territorial) + slider "% de docentes" por flag.
3. Cambiar `externalPromptGeneratorEnabled` a ON con slider 100 % y pulsar **Guardar**.
4. **Esperado:** mensaje de éxito. (La caché es de 5 min en el frontend; para verlo al instante, recargar la página como otro usuario.)
5. Verificación cruzada:
   - **admin**: sigue viendo todo (bypass).
   - **docente**: tras recargar, ahora ve "Prompts externos" en el menú.
   - **piloto**: lo veía antes por allowlist y lo sigue viendo.
6. Apagar la flag de nuevo y pulsar **Guardar**.
   - **Esperado:** docente deja de ver "Prompts externos"; admin y piloto siguen viéndolo.

### 3.5. Rollout por porcentaje (U17)

1. Como admin, en **Funcionalidades** poner `gamificationModuleEnabled` con slider a un **% bajo** (p. ej. 20 %) y **Guardar**.
2. Entrar con varias cuentas de prueba distintas: solo el ~20 % (según bucket determinista del UID) debe ver "Gamificaciones".
3. Para un usuario concreto, añadirlo a la allowlist (ver punto 2) para forzar que lo vea siempre.
4. **Esperado:** un mismo usuario tiene un bucket estable (no "parpadea" on/off entre recargas).

### 3.6. Módulo de gamificación (piloto allowlist)

**Usar:** `piloto.prueba@planificaia.test` (ve la ruta por allowlist).

1. Entrar a `#/gamificaciones` → crear experiencia (convertir de planificación o desde cero).
2. Generar borrador IA, validar (sin errores críticos), publicar.
3. **Esperado:** al publicar se generan `code`/`shortCode`/`url`/`qrUrl` y estado pasa a `VALIDACION_PENDIENTE` o `published`.
4. Abrir `#/participar/<CODIGO>` en una ventana de incógnito, ingresar un seudónimo.
5. Entregar evidencia de una misión; como docente, revisarla en `#/gamificaciones` (aprobación → retroalimentación).
6. Probar progreso del grupo y despublicar/archivar.

### 3.7. Generador de prompts externos (piloto allowlist)

1. Con `piloto.prueba@planificaia.test`, ir a `#/prompts-externos`.
2. Seleccionar herramienta (Genially/Canva/Prezi/generic), tipo de recurso y generar.
3. **Esperado:** prompt estructurado por herramienta, con checklist y aviso de borrador; exportable a texto/Markdown/JSON.
4. `exportExternalPrompt` valida el formato; errores como `FORMATO_INVALIDO` se muestran sin romper la página.

### 3.8. Colaboración institucional

1. Con admin: `#/institucional` → crear organización, invitar por correo (`coordinator` o `teacher`), copiar enlace.
2. Aceptar el enlace con la cuenta invitada.
3. **Esperado:** el miembro aparece con su rol; la cuenta del owner ve "Planes del equipo" y puede asignar Free/Pro por miembro.
4. Probar quitar un miembro (no aplicable al owner).

### 3.9. Regresión de páginas públicas y accesibilidad

1. Verificar que Landing, Login, Registro, Privacidad, Términos y Participante cargan y navegan bien (los tests E2E cubren esto; en local ejecutar `python public/js/frontend.test.py` contra producción → esperado 13/13).
2. En `/participar/PRUEBA01`: con `Tab` desde `#codigo` debe enfocarse `#seudonimo` (navegación por teclado).
3. Auditoría axe WCAG 2.2 AA en las rutas públicas: **0 violaciones**.

---

## 4. Criterios de aceptación / ok

| # | Criterio | Resultado |
|---|---|---|
| 1 | Cuentas de prueba creadas y funcionales | ☐ |
| 2 | Admin ve todo; docente no ve flags off; piloto ve por allowlist | ☐ |
| 3 | Generación + aprobación + exportación DOCX/PDF con declaración IA | ☐ |
| 4 | Panel de flags (institucional) guarda y aplica cambios | ☐ |
| 5 | Rollout % funciona con buckets estables | ☐ |
| 6 | Gamificación completa (crear→publicar→participar→evidencia→revisar) | ☐ |
| 7 | Prompts externos generan y exportan | ☐ |
| 8 | Colaboración institucional e invitaciones | ☐ |
| 9 | E2E local 13/13 y axe 0 violaciones | ☐ |

---

## 5. Comandos útiles del equipo QA

```powershell
# Unit tests
pnpm --dir functions test:unit

# E2E contra producción (públicas)
python public/js/frontend.test.py

# Sembrar/actualizar flags (idempotente)
$env:FIREBASE_SA_PATH = "<ruta-sa>"
node scripts/seed-feature-flags.mjs
node scripts/seed-feature-flags.mjs "--rollout=gamificationModuleEnabled=20"
node scripts/seed-feature-flags.mjs "--allow=gamificationModuleEnabled=<UID>"

# Métricas del piloto
node scripts/pilot-metrics.mjs

# Auditoría de dependencias
pnpm audit --prod --audit-level=high
```

---

## 6. Notas y rollback

- **Caché:** las flags se cachean 5 min en backend y frontend; tras cambiar flags, esperar o cerrar/reabrir sesión para verlo en otras cuentas.
- **Rollback:** apagar el flag global (`false`) revierte el módulo al instante para todos (incluso allowlist); las colecciones quedan inertes.
- **Doc de producción (2026-08-12):** `config/feature-flags` = flags `false` + allowlist de piloto. No cambiar directamente en Firebase Console sin usar el panel o el seed.