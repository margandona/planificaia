export { createApp } from 'vue';
export { ref } from 'vue';
export { reactive } from 'vue';
export { computed } from 'vue';
export { onMounted } from 'vue';
export { defineComponent } from 'vue';
export { h } from 'vue';
export { markRaw } from 'vue';
export { shallowRef } from 'vue';
export { createUserWithEmailAndPassword } from 'firebase/auth';
export { signInWithEmailAndPassword } from 'firebase/auth';
export { signOut } from 'firebase/auth';
export { sendPasswordResetEmail } from 'firebase/auth';
export { sendEmailVerification } from 'firebase/auth';
export { updateProfile } from 'firebase/auth';
export { onAuthStateChanged } from 'firebase/auth';
export { getIdTokenResult } from 'firebase/auth';
export { collection } from 'firebase/firestore';
export { query } from 'firebase/firestore';
export { where } from 'firebase/firestore';
export { orderBy } from 'firebase/firestore';
export { getDocs } from 'firebase/firestore';
export { doc } from 'firebase/firestore';
export { getDoc } from 'firebase/firestore';
export { setDoc } from 'firebase/firestore';
export { addDoc } from 'firebase/firestore';
export { updateDoc } from 'firebase/firestore';
export { deleteDoc } from 'firebase/firestore';
export { limit } from 'firebase/firestore';
export { serverTimestamp } from 'firebase/firestore';
import { createApp, ref, reactive, computed, watch, onMounted, defineComponent, h, markRaw, shallowRef } from 'vue';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { getPerformance, trace } from 'firebase/performance';
import { getIdTokenResult } from 'firebase/auth';

// ──────────── Firebase ────────────

const firebaseConfig = {
  apiKey: "AIzaSyADeo8Y7lVBeT4MJNXOqQSbirOa6sdX3EY",
  authDomain: "planificacion-con-ia.firebaseapp.com",
  projectId: "planificacion-con-ia",
  storageBucket: "planificacion-con-ia.firebasestorage.app",
  messagingSenderId: "317744047775",
  appId: "1:317744047775:web:c7779e496403a6e64ae4aa",
  measurementId: "G-TFHV3R6JT0"
};

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const fx = getFunctions(fb, 'us-central1');
getAnalytics(fb);
let perf = null;
try { perf = getPerformance(fb, { instrumentationEnabled: false }); } catch (e) { /* Performance no disponible en dev */ }

// ──────────── Observabilidad (S-5) ────────────

// Trace de Performance Monitoring web (sustituto pragmático de Crashlytics,
// que solo existe para iOS/Android). Crashlytics → Error Reporting web.
const perfTrace = (name) => { try { return perf ? trace(perf, name) : null; } catch (e) { return null; } };

// Handler global de errores → Cloud Logging (console.error) + colección error-logs.
async function reportError(action, context = {}, err = null) {
  const entry = {
    action,
    url: window.location.hash || '/',
    userId: store.user?.uid || null,
    message: err?.message || context.message || '',
    code: err?.code || context.code || null,
    stack: err?.stack?.slice(0, 2000) || null,
    createdAt: new Date().toISOString(),
  };
  try { console.error('[PlanificaIA]', action, context, err || ''); } catch (e) { /* ignore */ }
  try {
    await addDoc(collection(db, 'error-logs'), entry);
  } catch (e) { /* Firestore write fallible; ya se logueó en consola */ }
}

window.addEventListener('error', (ev) => {
  reportError('global_error', { message: ev.message, code: 'window_error' }, ev.error);
});
window.addEventListener('unhandledrejection', (ev) => {
  reportError('unhandled_rejection', { message: (ev.reason?.message || String(ev.reason)) }, ev.reason);
});

// ──────────── Estado global ────────────

// Asignaturas por defecto (fallback si el catálogo remoto no está disponible)
const DEFAULT_SUBJECTS = [
  { key: 'desarrollo-personal-social', name: 'Desarrollo Personal y Social', icon: '🧒', active: true },
  { key: 'comunicacion-integral', name: 'Comunicación Integral', icon: '🗣️', active: true },
  { key: 'interaccion-comprension-entorno', name: 'Interacción y Comprensión del Entorno', icon: '🌱', active: true },
  { key: 'historia-geografia-ciencias-sociales', name: 'Historia, Geografía y Cs. Sociales', icon: '🏛️', active: true },
  { key: 'lenguaje-y-comunicacion', name: 'Lenguaje y Comunicación', icon: '📖', active: true },
  { key: 'matematica', name: 'Matemática', icon: '🔢', active: true },
  { key: 'ciencias-naturales', name: 'Ciencias Naturales', icon: '🔬', active: true },
  { key: 'ingles', name: 'Inglés', icon: '🌎', active: true },
  { key: 'artes-visuales', name: 'Artes Visuales', icon: '🎨', active: true },
  { key: 'musica', name: 'Música', icon: '🎵', active: true },
  { key: 'educacion-fisica-salud', name: 'Educación Física y Salud', icon: '⚽', active: true },
  { key: 'tecnologia', name: 'Tecnología', icon: '💻', active: true },
  { key: 'orientacion', name: 'Orientación', icon: '🧭', active: true },
  { key: 'filosofia', name: 'Filosofía', icon: '🧠', active: true },
  { key: 'educacion-ciudadana', name: 'Educación Ciudadana', icon: '🗳️', active: true },
  { key: 'emprendimiento-y-empleabilidad', name: 'Emprendimiento y Empleabilidad', icon: '💡', active: true },
  { key: 'educacion-financiera', name: 'Educación Financiera', icon: '💰', active: true },
  { key: 'responsabilidad-personal-social', name: 'Responsabilidad Personal y Social', icon: '🤝', active: true },
  { key: 'pensamiento-computacional', name: 'Pensamiento Computacional', icon: '🤖', active: true },
];

const store = reactive({
  user: null,
  profile: null,
  claims: null,
  org: null,
  orgRole: null,
  ready: false,
  plannings: [],
  loading: false,
  error: null,
  subjects: DEFAULT_SUBJECTS, // catálogo dinámico desde Firestore (fallback a defaults)
  country: 'cl',
  countryName: 'Chile',
});

const PLANS = {
  free: { label: 'Gratis', dailyGenerations: 10 },
  pro: { label: 'Pro', dailyGenerations: 1000 },
};

const planLabel = () => (store.profile?.plan === 'pro' ? 'Pro' : 'Gratis');

const generatePlanningFn = httpsCallable(fx, 'generatePlanning');
const recommendMethodologiesFn = httpsCallable(fx, 'recommendMethodologies');
const generateActivityVariantsFn = httpsCallable(fx, 'generateActivityVariants');
const regenerateSectionFn = httpsCallable(fx, 'regenerateSection');
const approvePlanningFn = httpsCallable(fx, 'approvePlanning');
const exportPlanningFn = httpsCallable(fx, 'exportPlanning');
const submitFeedbackFn = httpsCallable(fx, 'submitFeedback');
const setUserRoleFn = httpsCallable(fx, 'setUserRole');
const createOrganizationFn = httpsCallable(fx, 'createOrganization');
const inviteMemberFn = httpsCallable(fx, 'inviteMember');
const acceptInviteFn = httpsCallable(fx, 'acceptInvite');
const removeMemberFn = httpsCallable(fx, 'removeMember');
const acceptTermsFn = httpsCallable(fx, 'acceptTerms');
const setUserPlanFn = httpsCallable(fx, 'setUserPlan');
const setFeatureFlagsFn = httpsCallable(fx, 'updateFeatureFlags');
const createGamifiedExperienceFn = httpsCallable(fx, 'createGamifiedExperience');
const generateGamificationDraftFn = httpsCallable(fx, 'generateGamificationDraft');
const regenerateGamificationSectionFn = httpsCallable(fx, 'regenerateGamificationSection');
const joinGamifiedExperienceFn = httpsCallable(fx, 'joinGamifiedExperience');
const submitMissionEvidenceFn = httpsCallable(fx, 'submitMissionEvidence');
const reviewMissionEvidenceFn = httpsCallable(fx, 'reviewMissionEvidence');
const publishGamifiedExperienceFn = httpsCallable(fx, 'publishGamifiedExperience');
const unpublishGamifiedExperienceFn = httpsCallable(fx, 'unpublishGamifiedExperience');
const archiveGamifiedExperienceFn = httpsCallable(fx, 'archiveGamifiedExperience');
const computeExperienceProgressFn = httpsCallable(fx, 'computeExperienceProgress');
const generateExternalToolPromptFn = httpsCallable(fx, 'generateExternalToolPrompt');
const exportExternalPromptFn = httpsCallable(fx, 'exportExternalPrompt');
const syncPlanningContextFn = httpsCallable(fx, 'syncPlanningContext');

const isAdmin = () => store.claims?.admin === true || store.claims?.role === 'admin';
const isOrgAdmin = () => ['owner', 'coordinator'].includes(store.orgRole);

// ──────────── Feature flags (U3) + despliegue gradual (U17) ────────────
// Espejo en cliente de functions/logic.js (FEATURE_FLAGS/resolveUserFeatureFlags):
// el wizard y el Layout resuelven las flags efectivas por usuario leyendo el doc
// público config/feature-flags. Rollout: bucket determinista por uid (0-99).
const CLIENT_FEATURE_FLAGS = {
  methodologyRecommendationsEnabled: false,
  gamificationModuleEnabled: false,
  externalPromptGeneratorEnabled: false,
  tpContextEnabled: false,
  localContextEnabled: false,
};

const userFlagBucket = (uid = '') => {
  let h = 0;
  const s = String(uid || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
};

const resolveUserFeatureFlags = (source = {}, uid = '', isAdmin = false) => {
  const out = {};
  for (const key of Object.keys(CLIENT_FEATURE_FLAGS)) {
    if (isAdmin) { out[key] = true; continue; }
    if (source[key] !== true) { out[key] = false; continue; }
    const allowed = Array.isArray(source.allowlist?.[key]) ? source.allowlist[key].map(String) : [];
    if (uid && allowed.includes(String(uid))) { out[key] = true; continue; }
    const pct = source.rollout?.[key];
    if (typeof pct === 'number' && pct >= 0 && pct <= 100) {
      out[key] = pct >= 100 || userFlagBucket(uid) < pct;
    } else {
      out[key] = true;
    }
  }
  return out;
};

// Lee config/feature-flags (doc único público) con caché de 5 minutos.
let featureFlagsDoc = null;
let featureFlagsDocAt = 0;
const FEATURE_FLAGS_DOC_CACHE_MS = 5 * 60 * 1000;

async function loadFeatureFlags() {
  const now = Date.now();
  if (featureFlagsDoc && now - featureFlagsDocAt < FEATURE_FLAGS_DOC_CACHE_MS) return featureFlagsDoc;
  try {
    const snap = await getDoc(doc(db, 'config', 'feature-flags'));
    featureFlagsDoc = snap.exists() ? (snap.data() || {}) : {};
  } catch (e) {
    featureFlagsDoc = {};
  }
  featureFlagsDocAt = now;
  return featureFlagsDoc;
}

// U17b: invalida la caché local de flags después de guardar desde el panel admin.
const clearFeatureFlagsCache = () => { featureFlagsDoc = null; featureFlagsDocAt = 0; };

// ──────────── Términos y privacidad versionados (S-6 / RF-013) ────────────

// Versión vigente. Al publicar una versión nueva se fuerza re-aceptación en el
// frontend (modal) y `acceptTerms` valida la versión en el backend.
const TERMS_VERSION = '2026-07-31';
const PRIVACY_VERSION = '2026-07-31';

const hasAcceptedTerms = () => {
  if (!store.user || !store.user.emailVerified) return true;
  return !!store.profile
    && store.profile.termsVersion === TERMS_VERSION
    && store.profile.privacyVersion === PRIVACY_VERSION;
};

// ──────────── Catálogo curricular (Parvularia → 4° medio) ────────────

const LEVELS = [
  ['sc-sala-cuna', 'Sala Cuna'],
  ['nm-nivel-medio', 'Nivel Medio'],
  ['nt-nivel-transicion', 'Nivel Transición'],
  ['1-basico', '1° básico'],
  ['2-basico', '2° básico'],
  ['3-basico', '3° básico'],
  ['4-basico', '4° básico'],
  ['5-basico', '5° básico'],
  ['6-basico', '6° básico'],
  ['7-basico', '7° básico'],
  ['8-basico', '8° básico'],
  ['1-medio', '1° medio'],
  ['2-medio', '2° medio'],
  ['3-medio', '3° medio'],
  ['4-medio', '4° medio'],
  ['epja-n1-eb', 'EPJA Nivel 1 Básica'],
  ['epja-n2-eb', 'EPJA Nivel 2 Básica'],
  ['epja-n3-eb', 'EPJA Nivel 3 Básica'],
  ['epja-n1-em', 'EPJA Nivel 1 Media'],
  ['epja-n2-em', 'EPJA Nivel 2 Media'],
  ['epja-n1-n2-em', 'EPJA Nivel 1 y 2 Media'],
];

const LEVELS_BASICA = LEVELS.filter(([v]) => v.includes('basico'));
const LEVELS_MEDIA = LEVELS.filter(([v]) => v.includes('medio'));

const levelLabel = (v) => (LEVELS.find(([lv]) => lv === v) || [v, v])[1];
const subjectLabel = (v) => (store.subjects.find((s) => s.key === v)?.name || v);
const activeSubjects = () => store.subjects.filter(s => s.active !== false);

// Carga el catálogo de asignaturas desde Firestore (con caché y fallback)
async function loadSubjectCatalog() {
  const cacheKey = 'catalog_subjects_v1';
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.expires > Date.now() && parsed.subjects?.length) {
        store.subjects = parsed.subjects;
        store.country = parsed.country || 'cl';
        store.countryName = parsed.countryName || 'Chile';
        return;
      }
    }
    const snap = await getDoc(doc(db, 'catalog', 'subjects'));
    if (snap.exists()) {
      const data = snap.data();
      store.country = data.country || 'cl';
      store.countryName = data.countryName || 'Chile';
      if (Array.isArray(data.subjects) && data.subjects.length) {
        store.subjects = data.subjects;
        try { localStorage.setItem(cacheKey, JSON.stringify({ subjects: data.subjects, country: data.country, countryName: data.countryName, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 })); } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Catálogo remoto no disponible, usando defaults:', e);
  }
}

// ──────────── Helpers ────────────

function go(route) { window.location.hash = '#' + route; }

function guard() {
  if (!store.user) { go('/login'); return false; }
  if (!store.user.emailVerified) { go('/verificar-email'); return false; }
  return true;
}

function redirectAuth() {
  if (store.user && store.user.emailVerified) { go('/dashboard'); return true; }
  return false;
}

function mapError(code) {
  const map = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos',
    'auth/invalid-email': 'Correo inválido',
    'auth/user-disabled': 'Cuenta deshabilitada',
    'auth/user-not-found': 'No existe cuenta con este correo',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/email-already-in-use': 'Este correo ya está registrado',
    'auth/weak-password': 'Contraseña demasiado débil',
  };
  return map[code] || 'Error inesperado. Intenta de nuevo.';
}

// ──────────── Componentes UI reutilizables ────────────

const Spinner = (size = 5) => h('svg', {
  class: `animate-spin h-${size} w-${size} text-blue-600`,
  viewBox: '0 0 24 24', 'aria-hidden': 'true',
}, [
  h('circle', { class: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', 'stroke-width': '4', fill: 'none' }),
  h('path', { class: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' }),
]);

const Alert = (type, msg) => {
  if (!msg) return null;
  const colors = { error: 'bg-red-50 border-red-200 text-red-700', success: 'bg-green-50 border-green-200 text-green-700', warning: 'bg-amber-50 border-amber-200 text-amber-700', info: 'bg-blue-50 border-blue-200 text-blue-700' };
  return h('div', { class: `${colors[type] || colors.info} border p-3 rounded-lg mb-4 text-sm flex items-center gap-2`, role: 'alert' }, [h('span', type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ'), msg]);
};

const EmptyState = (icon, title, desc, action) => h('div', { class: 'text-center py-16' }, [
  h('div', { class: 'text-5xl mb-4' }, icon),
  h('h3', { class: 'text-lg font-semibold text-slate-700 mb-1' }, title),
  h('p', { class: 'text-sm text-slate-400 mb-4' }, desc),
  action || null,
]);

const PageTitle = (title, subtitle) => h('div', { class: 'mb-6' }, [
  h('h1', { class: 'text-2xl font-bold text-slate-900' }, title),
  subtitle ? h('p', { class: 'text-sm text-slate-500 mt-1' }, subtitle) : null,
]);

const Card = (children, extra = '') => h('div', { class: `bg-white rounded-xl shadow-sm border border-slate-200 ${extra}` }, children);

// ──────────── Layout ────────────

const Layout = defineComponent({
  props: ['title', 'subtitle', 'noWrapper'],
  setup(props, { slots }) {
    const logout = async () => { await signOut(auth); store.user = null; store.profile = null; store.org = null; store.orgRole = null; store.claims = null; go('/'); };
    // U17 (DEPL-01): flags efectivas por usuario para el menú (rollout/allowlist).
    // Solo se leen cuando hay sesión iniciada (las rutas públicas no abren Firestore).
    const userFlags = ref({ ...CLIENT_FEATURE_FLAGS });
    const applyFlags = async (uid) => {
      try {
        const doc = await loadFeatureFlags();
        userFlags.value = resolveUserFeatureFlags(doc, uid, isAdmin());
      } catch (e) { userFlags.value = { ...CLIENT_FEATURE_FLAGS }; }
    };
    watch(() => store.user?.uid, async (uid) => {
      if (uid) await applyFlags(uid); else userFlags.value = { ...CLIENT_FEATURE_FLAGS };
    });
    onMounted(async () => { if (store.user?.uid) await applyFlags(store.user.uid); });

    return () => h('div', { class: 'min-h-screen flex flex-col' }, [
      // Enlace de salto al contenido (WCAG 2.4.1 Bypass Blocks)
      h('a', { href: '#contenido', class: 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-blue-600 focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:text-sm', 'aria-label': 'Saltar al contenido principal' }, 'Saltar al contenido'),
      // Navbar
      h('nav', { class: 'bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50', role: 'navigation', 'aria-label': 'Navegación principal' }, [
        h('div', { class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14' }, [
          h('a', { href: '#/', class: 'flex items-center gap-2 font-bold text-lg text-blue-600 no-underline hover:text-blue-700', 'aria-label': 'PlanificaIA - Inicio' }, [
            h('span', { 'aria-hidden': 'true', class: 'text-xl' }, '📋'),
            'PlanificaIA',
          ]),
          h('div', { class: 'flex items-center gap-3' }, !store.user ? [
            h('a', { href: '#/login', class: 'text-sm text-slate-600 hover:text-slate-900' }, 'Iniciar sesión'),
            h('a', { href: '#/registro', class: 'bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition' }, 'Registrarse'),
          ] : [
            !store.user.emailVerified ? h('span', { class: 'inline-block w-2 h-2 bg-amber-400 rounded-full', title: 'Correo no verificado' }) : null,
            h('a', { href: '#/dashboard', class: 'text-sm text-slate-600 hover:text-slate-900' }, 'Dashboard'),
            userFlags.value.gamificationModuleEnabled ? h('a', { href: '#/gamificaciones', class: 'text-sm text-slate-600 hover:text-slate-900' }, 'Gamificaciones') : null,
            userFlags.value.externalPromptGeneratorEnabled ? h('a', { href: '#/prompts-externos', class: 'text-sm text-slate-600 hover:text-slate-900' }, 'Prompts externos') : null,
            (store.org || isAdmin()) ? h('a', { href: '#/institucional', class: 'text-sm text-slate-600 hover:text-slate-900' }, 'Institucional') : null,
            h('a', { href: '#/perfil', class: 'text-sm text-slate-600 hover:text-slate-900' }, store.user.displayName || store.user.email),
            h('button', { type: 'button', onClick: logout, class: 'text-sm text-red-600 hover:text-red-700' }, 'Salir'),
          ]),
        ]),
      ]),
      // Main content
      h('main', { id: 'contenido', class: 'flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full', role: 'main' }, [
        props.title ? PageTitle(props.title, props.subtitle) : null,
        slots.default ? slots.default() : null,
      ]),
      // Footer
      h('footer', { class: 'bg-white border-t border-slate-200 mt-auto py-6', role: 'contentinfo' }, [
        h('div', { class: 'max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 space-x-4' }, [
          h('span', `© 2026 PlanificaIA — MaKuaZ · Currículum oficial de ${store.countryName}`),
          h('a', { href: '#/ayuda', class: 'hover:text-slate-700 underline' }, 'Ayuda'),
          h('a', { href: '#/privacidad', class: 'hover:text-slate-700 underline' }, 'Privacidad'),
          h('a', { href: '#/terminos', class: 'hover:text-slate-700 underline' }, 'Términos'),
        ]),
      ]),
    ]);
  }
});

// Re-export de símbolos compartidos para los módulos de páginas (S-5.4).
export { DEFAULT_SUBJECTS, PLANS, planLabel, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, recommendMethodologiesFn, generateActivityVariantsFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, acceptTermsFn, setUserPlanFn, TERMS_VERSION, PRIVACY_VERSION, hasAcceptedTerms, isAdmin, isOrgAdmin, setFeatureFlagsFn, createGamifiedExperienceFn, generateGamificationDraftFn, regenerateGamificationSectionFn, joinGamifiedExperienceFn, submitMissionEvidenceFn, reviewMissionEvidenceFn, publishGamifiedExperienceFn, unpublishGamifiedExperienceFn, archiveGamifiedExperienceFn, computeExperienceProgressFn, generateExternalToolPromptFn, exportExternalPromptFn, syncPlanningContextFn, loadFeatureFlags, resolveUserFeatureFlags, clearFeatureFlagsCache };
