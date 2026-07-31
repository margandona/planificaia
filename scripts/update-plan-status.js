import { readFileSync, writeFileSync } from 'fs';

const path = new URL('../PROJECT_MASTER_PLAN.md', import.meta.url);
let content = readFileSync(path, 'utf-8');

const newStatusSection = `## 2. Estado

| Elemento | Estado |
|---|---|
| Investigacion curricular | COMPLETADA |
| Investigacion normativa | COMPLETADA (parcial - requiere revision juridica) |
| Definicion de producto | COMPLETADA |
| Arquitectura tecnica | ACTUALIZADA (Firebase + DeepSeek + Gemini Flash) |
| Diseno de IA | ACTUALIZADO (DeepSeek primario, Gemini Flash fallback) |
| MVP | DEFINIDO |
| Plan de fases | ACTUALIZADO |
| Backlog | ACTUALIZADO |
| Implementacion | EN CURSO |
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
| **Fase 7 - Reglas pedagogicas** | EN CURSO | V-001 a V-012 en backend, falta integrar advertencias en frontend (editor + detalle) |
| **Fase 8 - Exportacion** | PENDIENTE | PDF + DOCX + declaracion IA |
| **Fase 9 - Gemini Flash fallback** | COMPLETADA | Integrado en generatePlanning y regenerateSection |
| **Fase 10 - QA integral** | PENDIENTE | Pruebas con emulador |
| **Fase 11 - Piloto docente** | PENDIENTE | Requiere deploy a produccion |
| **Fase 12 - Despliegue MVP** | PENDIENTE | Bloqueante: IAM permissions para Cloud Functions |

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
| 34 | Advertencias visibles en editor + detalle | EN CURSO |
| 35 | Exportacion PDF | PENDIENTE |
| 36 | Exportacion DOCX | PENDIENTE |
| 37 | Deploy Cloud Functions a produccion | PENDIENTE |
| 38 | Pruebas con emulador Firebase | PENDIENTE |`;

// Replace the old status section with the new one
const startMarker = '## 2. Estado';
const endMarker = '## 3.';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);

if (startIdx >= 0 && endIdx > startIdx) {
  content = content.substring(0, startIdx) + newStatusSection + '\n\n' + content.substring(endIdx);
  writeFileSync(path, content, 'utf-8');
  console.log('Seccion 2 actualizada correctamente.');
} else {
  console.error('No se encontraron los marcadores en el archivo.');
}
