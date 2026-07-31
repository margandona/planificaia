# ───────────────────────────────────────────────
# PlanificaIA — Script de despliegue a produccion
# ───────────────────────────────────────────────
# Requisitos: Node.js, pnpm, cuenta propietaria de Firebase
#
# Paso 0: Habilitar APIs necesarias (solo la primera vez)
#   Ve a: https://console.cloud.google.com/apis/library?project=planificacion-con-ia
#   Habilita:
#     - Cloud Functions API
#     - Cloud Build API
#     - Artifact Registry API
#     - Cloud Run API
#     - Eventarc API
#     - Secret Manager API
#
#   O ejecuta (si tienes permisos de propietario):
#   gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com secretmanager.googleapis.com --project=planificacion-con-ia
#
# Paso 1: Autenticarse con cuenta de propietario
#   npx firebase-tools login
#
# Paso 2: Configurar API Key de DeepSeek (desde functions/.env o variable de entorno)
#   $env:DEEPSEEK_API_KEY="<tu-key>"; npx firebase-tools functions:config:set ai.deepseek_key=$env:DEEPSEEK_API_KEY
#
# Paso 3: Desplegar todo
#   npx firebase-tools deploy
#
# Opcional: Desplegar solo servicios especificos
#   npx firebase-tools deploy --only hosting
#   npx firebase-tools deploy --only firestore
#   npx firebase-tools deploy --only functions
#   npx firebase-tools deploy --only storage

Write-Host "=== PlanificaIA - Deploy a produccion ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "El despliegue requiere permisos de propietario del proyecto Firebase." -ForegroundColor Yellow
Write-Host "La cuenta de servicio actual NO tiene permisos para habilitar APIs." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pasos manuales necesarios:" -ForegroundColor White
Write-Host " 1. Ir a https://console.cloud.google.com/apis/library?project=planificacion-con-ia" -ForegroundColor White
Write-Host " 2. HABILITAR: Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc, Secret Manager" -ForegroundColor White
Write-Host " 3. npx firebase-tools login" -ForegroundColor White
Write-Host " 4. npx firebase-tools functions:config:set ai.deepseek_key=""<tu-key>""" -ForegroundColor White
Write-Host " 5. npx firebase-tools deploy" -ForegroundColor Green
Write-Host ""
Write-Host "Una vez desplegado, la URL sera:" -ForegroundColor Cyan
Write-Host " https://planificacion-con-ia.web.app" -ForegroundColor Cyan

# Check current auth status
$authStatus = & { npx firebase-tools projects:list --json 2>&1 }
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nAutenticacion actual: OK" -ForegroundColor Green
} else {
    Write-Host "`nAutenticacion actual: requiere login manual" -ForegroundColor Red
}
