// Creación de cuentas de prueba en producción (Firebase Auth + users/{uid}).
// Idempotente por email: si la cuenta ya existe, actualiza claims/rol/plan y
// reescribe el doc de perfil con las versiones de términos vigentes.
// Uso:
//   $env:FIREBASE_SA_PATH = "<ruta-sa>"; node scripts/seed-test-users.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS_VERSION, PRIVACY_VERSION } from '../functions/logic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.FIREBASE_SA_PATH || join(__dirname, '..', 'planificacion-con-ia-firebase-adminsdk-fbsvc-77c69d86f8.json');
const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa) });

const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'PlanIFia-2026';
const TEST_USERS = [
  { email: 'admin.prueba@planificaia.test', displayName: 'Admin Prueba', plan: 'pro', claim: { role: 'admin', admin: true }, notes: 'Panel de flags, ve todo siempre' },
  { email: 'docente.prueba@planificaia.test', displayName: 'Docente Prueba', plan: 'free', claim: { role: 'teacher' }, notes: 'Docente normal sin flags (default off)' },
  { email: 'piloto.prueba@planificaia.test', displayName: 'Piloto Prueba', plan: 'free', claim: { role: 'teacher' }, notes: 'Candidato a allowlist de pilotos' },
];

const now = new Date().toISOString();
const results = [];

for (const u of TEST_USERS) {
  let uid;
  try {
    const existing = await auth.getUserByEmail(u.email);
    uid = existing.uid;
    await auth.updateUser(uid, { emailVerified: true, displayName: u.displayName });
    await auth.setCustomUserClaims(uid, u.claim);
    results.push({ email: u.email, uid, action: 'updated' });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const created = await auth.createUser({
      email: u.email, password: PASSWORD, displayName: u.displayName, emailVerified: true,
    });
    uid = created.uid;
    await auth.setCustomUserClaims(uid, u.claim);
    results.push({ email: u.email, uid, action: 'created' });
  }
  await db.collection('users').doc(uid).set({
    uid, email: u.email, displayName: u.displayName, level: '1', institutionType: 'colegio',
    termsVersion: TERMS_VERSION, termsAcceptedAt: now,
    privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: now,
    plan: u.plan, role: u.claim.role, updatedAt: now, createdAt: now,
  }, { merge: true });
}

console.log('\nCuentas de prueba (contraseña: ' + PASSWORD + ')');
console.log('====================================================');
for (const r of results) {
  const u = TEST_USERS.find(x => x.email === r.email);
  console.log(`[${r.action}] ${u.email}  uid=${r.uid}  (${u.notes})`);
}