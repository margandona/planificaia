import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef } from 'vue';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

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
];

const store = reactive({
  user: null,
  profile: null,
  ready: false,
  plannings: [],
  loading: false,
  error: null,
  subjects: DEFAULT_SUBJECTS, // catálogo dinámico desde Firestore (fallback a defaults)
});

const generatePlanningFn = httpsCallable(fx, 'generatePlanning');
const regenerateSectionFn = httpsCallable(fx, 'regenerateSection');
const approvePlanningFn = httpsCallable(fx, 'approvePlanning');
const exportPlanningFn = httpsCallable(fx, 'exportPlanning');
const submitFeedbackFn = httpsCallable(fx, 'submitFeedback');

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
        return;
      }
    }
    const snap = await getDoc(doc(db, 'catalog', 'subjects'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.subjects) && data.subjects.length) {
        store.subjects = data.subjects;
        try { localStorage.setItem(cacheKey, JSON.stringify({ subjects: data.subjects, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 })); } catch (e) {}
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
    const logout = async () => { await signOut(auth); store.user = null; store.profile = null; go('/'); };

    return () => h('div', { class: 'min-h-screen flex flex-col' }, [
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
            h('a', { href: '#/perfil', class: 'text-sm text-slate-600 hover:text-slate-900' }, store.user.displayName || store.user.email),
            h('button', { onClick: logout, class: 'text-sm text-red-600 hover:text-red-700' }, 'Salir'),
          ]),
        ]),
      ]),
      // Main content
      h('main', { class: 'flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full', role: 'main' }, [
        props.title ? PageTitle(props.title, props.subtitle) : null,
        slots.default ? slots.default() : null,
      ]),
      // Footer
      h('footer', { class: 'bg-white border-t border-slate-200 mt-auto py-6', role: 'contentinfo' }, [
        h('div', { class: 'max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 space-x-4' }, [
          h('span', '© 2026 PlanificaIA — MaKuaZ'),
          h('a', { href: '#/privacidad', class: 'hover:text-slate-600 underline' }, 'Privacidad'),
          h('a', { href: '#/terminos', class: 'hover:text-slate-600 underline' }, 'Términos'),
        ]),
      ]),
    ]);
  }
});

// ──────────── Páginas ────────────

const LandingPage = defineComponent({
  setup() {
    if (redirectAuth()) return () => null;
    return () => h(Layout, () => [
      h('div', { class: 'text-center py-16' }, [
        h('h1', { class: 'text-5xl font-bold text-slate-900 mb-3' }, 'PlanificaIA'),
        h('p', { class: 'text-xl text-slate-500 max-w-xl mx-auto mb-6' }, 'Generador ético de planificaciones educativas asistido por inteligencia artificial'),
        h('p', { class: 'text-base text-slate-400 italic mb-8' }, 'La IA propone, el sistema verifica y el docente decide.'),
        h('div', { class: 'flex justify-center gap-3' }, [
          store.user
            ? h('a', { href: '#/dashboard', class: 'bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition' }, 'Ir al Dashboard')
            : h('a', { href: '#/registro', class: 'bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition' }, 'Comenzar gratis'),
          h('a', { href: '#/login', class: 'bg-white text-slate-700 px-6 py-2.5 rounded-lg font-medium border border-slate-300 hover:bg-slate-50 transition' }, 'Iniciar sesión'),
        ]),
      ]),
      h('div', { class: 'grid md:grid-cols-3 gap-6 max-w-4xl mx-auto pb-16' }, [
        Card([h('div', { class: 'p-6' }, [
          h('div', { class: 'text-3xl mb-3' }, '🎯'),
          h('h3', { class: 'font-semibold mb-1' }, 'Alineación Curricular'),
          h('p', { class: 'text-sm text-slate-500' }, 'OA desde el currículum oficial chileno. La IA nunca modifica el texto oficial.'),
        ])]),
        Card([h('div', { class: 'p-6' }, [
          h('div', { class: 'text-3xl mb-3' }, '👩‍🏫'),
          h('h3', { class: 'font-semibold mb-1' }, 'Control Docente'),
          h('p', { class: 'text-sm text-slate-500' }, 'Tú decides. Edita, regenera por secciones y aprueba antes de exportar.'),
        ])]),
        Card([h('div', { class: 'p-6' }, [
          h('div', { class: 'text-3xl mb-3' }, '🔒'),
          h('h3', { class: 'font-semibold mb-1' }, 'Privacidad Primero'),
          h('p', { class: 'text-sm text-slate-500' }, 'Sin datos personales de estudiantes. Información agregada solamente.'),
        ])]),
      ]),
    ]);
  }
});

const LoginPage = defineComponent({
  setup() {
    if (redirectAuth()) return () => null;
    const email = ref(''); const password = ref(''); const error = ref(''); const message = ref(''); const loading = ref(false);
    const login = async () => { loading.value = true; error.value = ''; message.value = '';
      try {
        const cred = await signInWithEmailAndPassword(auth, email.value, password.value);
        store.user = cred.user;
        go(cred.user.emailVerified ? '/dashboard' : '/verificar-email');
      } catch (e) { error.value = mapError(e.code); } finally { loading.value = false; }
    };
    const resetPw = async () => { if (!email.value) { error.value = 'Ingresa tu correo primero'; return; } loading.value = true; error.value = ''; message.value = '';
      try { await sendPasswordResetEmail(auth, email.value); message.value = 'Correo de recuperación enviado.'; } catch (e) { error.value = 'Error al enviar correo'; } finally { loading.value = false; }
    };

    return () => h(Layout, () => h('div', { class: 'min-h-[60vh] flex items-center justify-center' }, [
      h('div', { class: 'w-full max-w-sm' }, [
        h('div', { class: 'text-center mb-6' }, [h('h1', { class: 'text-2xl font-bold' }, 'Iniciar sesión'), h('p', { class: 'text-sm text-slate-500 mt-1' }, 'Accede a tu cuenta de PlanificaIA')]),
        Alert('error', error.value), Alert('success', message.value),
        h('form', { onSubmit: (e) => { e.preventDefault(); login(); }, class: 'space-y-3' }, [
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1', for: 'email' }, 'Correo'), h('input', { id: 'email', type: 'email', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition', placeholder: 'docente@ejemplo.cl', onInput: (e) => email.value = e.target.value, autocomplete: 'email' })]),
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1', for: 'pass' }, 'Contraseña'), h('input', { id: 'pass', type: 'password', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition', placeholder: '••••••••', onInput: (e) => password.value = e.target.value, autocomplete: 'current-password' })]),
          h('div', { class: 'text-right' }, [h('button', { type: 'button', class: 'text-sm text-blue-600 hover:underline', onClick: resetPw }, '¿Olvidaste tu contraseña?')]),
          h('button', { type: 'submit', disabled: loading.value, class: 'w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2' }, loading.value ? [Spinner(4), 'Ingresando...'] : 'Iniciar sesión'),
        ]),
        h('p', { class: 'text-sm text-center text-slate-500 mt-4' }, ['¿No tienes cuenta? ', h('a', { href: '#/registro', class: 'text-blue-600 font-medium hover:underline' }, 'Regístrate')]),
      ]),
    ]));
  }
});

const RegisterPage = defineComponent({
  setup() {
    if (redirectAuth()) return () => null;
    const f = reactive({ displayName: '', email: '', password: '', confirm: '', level: '', institutionType: '', acceptTerms: false });
    const error = ref(''); const loading = ref(false);
    const register = async () => {
      error.value = '';
      if (!f.displayName) { error.value = 'Ingresa tu nombre'; return; }
      if (f.password.length < 6) { error.value = 'La contraseña debe tener al menos 6 caracteres'; return; }
      if (f.password !== f.confirm) { error.value = 'Las contraseñas no coinciden'; return; }
      if (!f.acceptTerms) { error.value = 'Debes aceptar los términos'; return; }
      loading.value = true;
      try {
        const cred = await createUserWithEmailAndPassword(auth, f.email, f.password);
        await updateProfile(cred.user, { displayName: f.displayName });
        await sendEmailVerification(cred.user);
        await setDoc(doc(db, 'users', cred.user.uid), { uid: cred.user.uid, email: f.email, displayName: f.displayName, level: f.level, institutionType: f.institutionType, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        store.user = cred.user;
        go('/verificar-email');
      } catch (e) { error.value = mapError(e.code); } finally { loading.value = false; }
    };
    const levels = LEVELS;
    const institutions = [['', 'Selecciona...'], ['municipal', 'Municipal'], ['subvencionado', 'Particular Subvencionado'], ['particular', 'Particular Pagado'], ['otro', 'Otro']];

    return () => h(Layout, () => h('div', { class: 'min-h-[60vh] flex items-center justify-center' }, [
      h('div', { class: 'w-full max-w-md' }, [
        h('div', { class: 'text-center mb-6' }, [h('h1', { class: 'text-2xl font-bold' }, 'Crear cuenta'), h('p', { class: 'text-sm text-slate-500 mt-1' }, 'Comienza a planificar con IA')]),
        Alert('error', error.value),
        h('form', { onSubmit: (e) => { e.preventDefault(); register(); }, class: 'space-y-3' }, [
          h('div', { class: 'grid grid-cols-2 gap-3' }, [
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nombre'), h('input', { type: 'text', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'Tu nombre', onInput: (e) => f.displayName = e.target.value })]),
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nivel'), h('select', { required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', onInput: (e) => f.level = e.target.value }, [h('option', { value: '', disabled: true }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))])]),
          ]),
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Correo'), h('input', { type: 'email', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'docente@ejemplo.cl', onInput: (e) => f.email = e.target.value })]),
          h('div', { class: 'grid grid-cols-2 gap-3' }, [
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Contraseña'), h('input', { type: 'password', required: true, minLength: 6, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'Mín. 6 caracteres', onInput: (e) => f.password = e.target.value })]),
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Confirmar'), h('input', { type: 'password', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'Repite', onInput: (e) => f.confirm = e.target.value })]),
          ]),
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Establecimiento (opcional)'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onInput: (e) => f.institutionType = e.target.value }, ...institutions.map(([v, l]) => h('option', { value: v }, l)))]),
          h('label', { class: 'flex items-start gap-2 text-xs text-slate-500 cursor-pointer' }, [
            h('input', { type: 'checkbox', class: 'mt-0.5', onChange: (e) => f.acceptTerms = e.target.checked }),
            h('span', ['Acepto la ', h('a', { href: '#/terminos', class: 'text-blue-600 hover:underline' }, 'política de privacidad'), ' y ', h('a', { href: '#/terminos', class: 'text-blue-600 hover:underline' }, 'términos')]),
          ]),
          h('button', { type: 'submit', disabled: loading.value, class: 'w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2' }, loading.value ? [Spinner(4), 'Creando cuenta...'] : 'Crear cuenta'),
        ]),
        h('p', { class: 'text-sm text-center text-slate-500 mt-4' }, ['¿Ya tienes cuenta? ', h('a', { href: '#/login', class: 'text-blue-600 font-medium hover:underline' }, 'Inicia sesión')]),
      ]),
    ]));
  }
});

const VerifyEmailPage = defineComponent({
  setup() {
    if (!store.user) { go('/login'); return () => null; }
    if (store.user.emailVerified) { go('/dashboard'); return () => null; }
    const resent = ref(false); const loading = ref(false);
    const send = async () => { loading.value = true; try { if (auth.currentUser) await sendEmailVerification(auth.currentUser); resent.value = true; } catch (e) {} finally { loading.value = false; } };
    const check = async () => { if (auth.currentUser) { await auth.currentUser.reload(); if (auth.currentUser.emailVerified) { store.user = auth.currentUser; go('/dashboard'); } } };

    return () => h(Layout, () => h('div', { class: 'text-center max-w-sm mx-auto py-16' }, [
      h('div', { class: 'text-5xl mb-4' }, '📧'),
      h('h2', { class: 'text-xl font-bold mb-2' }, 'Verifica tu correo'),
      h('p', { class: 'text-sm text-slate-500 mb-1' }, 'Enviamos un enlace a:'),
      h('p', { class: 'font-medium text-slate-800 mb-6' }, store.user.email),
      h('p', { class: 'text-xs text-slate-400 mb-6' }, 'Revisa tu bandeja de entrada y spam. Luego haz clic en "Ya verifiqué".'),
      h('div', { class: 'space-y-2' }, [
        h('button', { onClick: send, disabled: loading.value, class: 'w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, loading.value ? 'Enviando...' : 'Reenviar verificación'),
        h('button', { onClick: check, class: 'w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition' }, 'Ya verifiqué mi correo'),
        resent.value ? h('p', { class: 'text-xs text-green-600 mt-2' }, '✓ Correo reenviado') : null,
      ]),
      h('button', { onClick: () => { signOut(auth); go('/login'); }, class: 'mt-6 text-xs text-slate-400 hover:text-slate-600 underline' }, 'Volver al inicio de sesión'),
    ]));
  }
});

const DashboardPage = defineComponent({
  setup() {
    if (!guard()) return () => null;
    const plans = ref([]); const loading = ref(true); const filter = ref('all');

    const load = async () => {
      loading.value = true;
      try {
        const q = query(collection(db, 'plannings'), where('userId', '==', store.user.uid), orderBy('createdAt', 'desc'), limit(20));
        plans.value = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        store.plannings = plans.value;
      } catch (e) { console.error(e); } finally { loading.value = false; }
    };
    onMounted(load);

    const filtered = computed(() => filter.value === 'all' ? plans.value : plans.value.filter(p => p.status === filter.value));
    const statusBadge = (s) => {
      const map = { draft: ['bg-yellow-100 text-yellow-700', 'Borrador'], approved: ['bg-green-100 text-green-700', 'Aprobada'], archived: ['bg-slate-100 text-slate-500', 'Archivada'] };
      const [c, t] = map[s] || ['bg-slate-100 text-slate-500', s];
      return h('span', { class: `text-xs px-2 py-0.5 rounded-full ${c}` }, t);
    };
    const filters = [['all', 'Todas'], ['draft', 'Borradores'], ['approved', 'Aprobadas']];

    return () => h(Layout, { title: 'Mis Planificaciones' }, () => [
      h('div', { class: 'flex items-center justify-between mb-4' }, [
        h('div', { class: 'flex gap-2' }, filters.map(([v, l]) =>
          h('button', { class: `px-3 py-1 rounded-full text-sm ${filter.value === v ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`, onClick: () => filter.value = v }, l)
        )),
        h('div', { class: 'flex gap-2' }, [
          h('a', { href: '#/nueva', class: 'bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition' }, '+ Con IA'),
          h('a', { href: '#/nueva-manual', class: 'bg-white text-blue-600 border border-blue-300 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition' }, '+ Manual'),
        ]),
      ]),
      loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) :
        filtered.value.length === 0 ? EmptyState('📋', filter.value === 'all' ? 'No tienes planificaciones' : 'No hay planificaciones en este estado', filter.value === 'all' ? 'Crea tu primera planificación con IA' : 'Cambia el filtro o crea una nueva', filter.value === 'all' ? h('a', { href: '#/nueva', class: 'mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700' }, 'Crear primera planificación') : null) :
          h('div', { class: 'grid gap-3' }, filtered.value.map(p =>
            h('a', { href: `#/planificacion/${p.id}`, class: 'block bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition shadow-sm' }, [
              h('div', { class: 'flex items-center justify-between' }, [
                h('div', [
                  h('div', { class: 'flex items-center gap-2' }, [
                    h('h3', { class: 'font-medium text-slate-900' }, p.title || 'Sin título'),
                    p.warnings?.length > 0 ? h('span', { class: `text-xs px-1.5 py-0.5 rounded-full ${p.warnings.some(w => w.type === 'critical') ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}` }, `${p.warnings.length} adv`) : null,
                  ]),
                  h('p', { class: 'text-xs text-slate-400' }, `${p.level || ''} · ${p.duration || ''} min · ${new Date(p.createdAt).toLocaleDateString('es-CL')}`),
                ]),
                statusBadge(p.status),
              ]),
            ])
          )),
    ]);
  }
});

const ProfilePage = defineComponent({
  setup() {
    if (!guard()) return () => null;
    const form = reactive({ displayName: store.user?.displayName || '', level: '', institutionType: '' });
    const loading = ref(true); const saving = ref(false); const error = ref(''); const success = ref('');

    onMounted(async () => {
      try {
        const snap = await getDoc(doc(db, 'users', store.user.uid));
        if (snap.exists()) { const d = snap.data(); form.displayName = d.displayName || ''; form.level = d.level || ''; form.institutionType = d.institutionType || ''; }
      } catch (e) {} finally { loading.value = false; }
    });

    const save = async () => {
      saving.value = true; error.value = ''; success.value = '';
      try {
        await updateDoc(doc(db, 'users', store.user.uid), { displayName: form.displayName, level: form.level, institutionType: form.institutionType, updatedAt: serverTimestamp() });
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: form.displayName });
        success.value = 'Perfil actualizado';
      } catch (e) { error.value = 'Error al guardar'; } finally { saving.value = false; }
    };

    const deleteAccount = async () => {
      if (!confirm('¿Eliminar tu cuenta? Recibirás una copia de tus planificaciones.')) return;
      saving.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'plannings'), where('userId', '==', store.user.uid)));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `planificaia-export-${store.user.uid}.json`; a.click(); URL.revokeObjectURL(url);
        for (const d of snap.docs) await deleteDoc(doc(db, 'plannings', d.id));
        await deleteDoc(doc(db, 'users', store.user.uid));
        if (auth.currentUser) await auth.currentUser.delete();
        store.user = null; go('/');
      } catch (e) { error.value = 'Error al eliminar cuenta'; } finally { saving.value = false; }
    };
    const levels = LEVELS;

    return () => h(Layout, { title: 'Mi Perfil' }, () => [
      Alert('error', error.value), Alert('success', success.value),
      loading.value ? h('div', { class: 'flex justify-center py-8' }, Spinner(6)) :
        Card([h('form', { onSubmit: (e) => { e.preventDefault(); save(); }, class: 'p-6 space-y-4' }, [
          h('div', { class: 'grid md:grid-cols-2 gap-4' }, [
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nombre'), h('input', { type: 'text', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', value: form.displayName, onInput: (e) => form.displayName = e.target.value })]),
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Correo'), h('input', { type: 'email', disabled: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-500', value: store.user?.email })])]),
          h('div', { class: 'grid md:grid-cols-2 gap-4' }, [
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nivel'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', value: form.level, onInput: (e) => form.level = e.target.value }, [h('option', { value: '' }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))])]),
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Establecimiento'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', value: form.institutionType, onInput: (e) => form.institutionType = e.target.value }, [['', 'Selecciona...'], ['municipal', 'Municipal'], ['subvencionado', 'Subvencionado'], ['particular', 'Particular'], ['otro', 'Otro']].map(([v, l]) => h('option', { value: v }, l)))])]),
          h('button', { type: 'submit', disabled: saving.value, class: 'bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, saving.value ? 'Guardando...' : 'Guardar cambios'),
        ])]),
      h('div', { class: 'mt-6' }, Card([h('div', { class: 'p-6' }, [
        h('h3', { class: 'text-base font-semibold text-red-600 mb-1' }, 'Eliminar cuenta'),
        h('p', { class: 'text-sm text-slate-500 mb-3' }, 'Exportaremos tus planificaciones antes de eliminar. Esta acción no se puede deshacer.'),
        h('button', { onClick: deleteAccount, disabled: saving.value, class: 'bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition' }, 'Eliminar mi cuenta'),
      ])])),
    ]);
  }
});

// ──────────── Wizard (Nueva Planificación) ────────────

const WizardPage = defineComponent({
  setup() {
    if (!guard()) return () => null;
    const step = ref(1);
    const data = reactive({ title: '', level: '', subject: '', oaIds: [], duration: 45, modality: 'presencial', studentCount: '', priorKnowledge: '', resources: '', methodology: '', barriers: '', framework: 'dua', dua: { representacion: [], accionExpresion: [], implicacion: [] } });
    const oas = ref([]); const oasLoading = ref(false); const oasLoaded = ref(false); const planning = ref(null); const generating = ref(false); const error = ref('');
    onMounted(() => { loadSubjectCatalog(); });

    const loadOAs = async () => {
      if (!data.level) return;
      error.value = '';
      oasLoading.value = true;
      oasLoaded.value = false;
      const cacheKey = `curriculum_v2_${data.level}_${data.subject}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.expires > Date.now()) {
            oas.value = parsed.docs;
            oasLoading.value = false;
            oasLoaded.value = true;
            return;
          }
        } catch (e) { /* cache corrupto, recargar */ }
      }
      try {
        const q = query(collection(db, 'curriculum'), where('level', '==', data.level), where('subject', '==', data.subject), orderBy('code'));
        const docs = (await getDocs(q)).docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.isActive !== false && d.type === undefined);
        oas.value = docs;
        oasLoaded.value = true;
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ docs, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
        } catch (e) { /* localStorage lleno/privado */ }
      } catch (e) {
        console.error(e);
        error.value = 'Error al cargar OA. Verifica la conexión.';
      } finally {
        oasLoading.value = false;
      }
    };
    const toggleOA = (id) => { const i = data.oaIds.indexOf(id); if (i >= 0) data.oaIds.splice(i, 1); else if (data.oaIds.length < 4) data.oaIds.push(id); };

    const generate = async () => {
      generating.value = true; error.value = '';
      try {
        const res = await generatePlanningFn({
          context: { title: data.title, level: data.level, subject: data.subject, duration: parseInt(data.duration), modality: data.modality, studentCount: data.studentCount, priorKnowledge: data.priorKnowledge, resources: data.resources ? data.resources.split(',').map(r => r.trim()) : [], methodology: data.methodology, barriers: data.barriers, framework: data.framework, dua: data.framework === 'dua' ? data.dua : null },
          oaIds: data.oaIds,
        });
        planning.value = res.data;
        step.value = 9;
      } catch (e) { error.value = e.message || 'Error al generar'; } finally { generating.value = false; }
    };

    const approve = async () => {
      if (!planning.value) return;
      generating.value = true;
      try { await approvePlanningFn({ planningId: planning.value.id }); planning.value.status = 'approved'; step.value = 10; } catch (e) { error.value = e.message; } finally { generating.value = false; }
    };

    const stepIndicator = () => {
      const steps = ['Tipo', 'Currículum', 'Contexto', 'Método', 'Estructura', 'Evaluación', 'Inclusión', 'Generar', 'Editar', 'Aprobar'];
      return h('div', { class: 'flex gap-1 mb-6 overflow-x-auto', role: 'progressbar', 'aria-valuenow': step.value, 'aria-valuemin': 1, 'aria-valuemax': 10 }, steps.map((l, i) => {
        const n = i + 1;
        return h('div', { class: `flex-1 text-center text-xs py-1.5 rounded ${n === step.value ? 'bg-blue-600 text-white font-medium' : n < step.value ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}` }, `${n}. ${l}`);
      }));
    };

    // Steps
    const step1 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Tipo de planificación'),
      h('p', { class: 'text-sm text-slate-500' }, '¿Cómo deseas crear tu planificación?'),
      h('div', { class: 'grid grid-cols-2 gap-3 max-w-lg' },
        [
          ['Clase con IA', 'clase-ia', 'Genera una planificación asistida por inteligencia artificial basada en OA y contexto', '🤖'],
          ['Clase manual', 'clase-manual', 'Crea una planificación desde cero con el editor estructurado', '✏️'],
        ].map(([tit, val, desc, icon]) =>
          h('button', {
            class: `p-4 rounded-xl border-2 text-left transition ${data.title === val ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`,
            onClick: () => {
              data.title = val;
              if (val === 'clase-manual') { go('/nueva-manual'); }
              else step.value = 2;
            }
          }, [
            h('span', { class: 'text-2xl' }, icon),
            h('p', { class: 'font-medium mt-1' }, tit),
            h('p', { class: 'text-xs text-slate-400 mt-0.5' }, desc),
          ])
        )),
    ]);

    const step2 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Contexto Curricular'),
      h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl' }, [
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Asignatura'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => { data.subject = e.target.value; data.oaIds = []; oas.value = []; if (data.level) loadOAs(); } }, [h('option', { value: '' }, 'Selecciona...'), ...activeSubjects().map(s => h('option', { value: s.key }, `${s.icon || ''} ${s.name}`))])]),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Nivel'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => { data.level = e.target.value; data.oaIds = []; oas.value = []; loadOAs(); } }, [h('option', { value: '' }, 'Selecciona...'), ...LEVELS.map(([v, l]) => h('option', { value: v }, l))])]),
      ]),
      error.value ? h('div', { class: 'text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded' }, error.value) : null,
      data.oaIds.length > 0 ? h('p', { class: 'text-xs text-green-600' }, `✓ ${data.oaIds.length} OA seleccionado(s)`) : null,
      oasLoading.value ? h('p', { class: 'text-xs text-amber-600' }, 'Cargando OA...') : null,
      oasLoaded.value && oas.value.length === 0 ? h('p', { class: 'text-xs text-amber-600' }, 'No hay OA para esta asignatura y nivel. Intenta otra combinación.') : null,
      h('div', { class: 'max-h-60 overflow-y-auto space-y-1 border rounded-lg p-2' }, oas.value.map(oa =>
        h('label', { class: 'flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer text-sm' }, [
          h('input', { type: 'checkbox', checked: data.oaIds.includes(oa.id), onChange: () => toggleOA(oa.id), class: 'mt-0.5' }),
          h('div', [h('span', { class: 'font-mono text-xs text-blue-600' }, oa.code), h('p', { class: 'text-xs text-slate-600' }, oa.text.slice(0, 120) + '...')]),
        ])
      )),
      h('button', { onClick: () => step.value = 3, disabled: !data.level || data.oaIds.length === 0, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step3 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Contexto Pedagógico'),
      h('div', { class: 'grid grid-cols-2 gap-3' }, [
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Duración'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.duration = parseInt(e.target.value) }, [h('option', { value: 45 }, '45 min'), h('option', { value: 90 }, '90 min')])]),
        h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Modalidad'), h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onChange: (e) => data.modality = e.target.value }, [['presencial', 'Presencial'], ['hibrida', 'Híbrida'], ['remota', 'Remota']].map(([v, l]) => h('option', { value: v }, l)))])]),
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Estudiantes (aprox.)'), h('input', { type: 'number', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', placeholder: '30', onInput: (e) => data.studentCount = e.target.value })]),
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Conocimientos previos'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', rows: 2, placeholder: 'Lo que los estudiantes ya saben...', onInput: (e) => data.priorKnowledge = e.target.value }), h('p', { class: 'text-xs text-amber-600 mt-1' }, 'No uses nombres ni RUT de estudiantes.')]),
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Recursos (separados por coma)'), h('input', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', placeholder: 'proyector, cuadernos, mapas', onInput: (e) => data.resources = e.target.value })]),
      h('button', { onClick: () => step.value = 4, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step4 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Enfoque Metodológico'),
      h('div', { class: 'grid grid-cols-2 gap-2 max-w-lg' },
        [['Clase dialogada', 'dialogada'], ['Aprendizaje Basado en Problemas', 'abp'], ['Aprendizaje Cooperativo', 'cooperativo'], ['Indagación', 'indagacion'], ['Gamificación', 'gamificacion'], ['Pensamiento Visible', 'pensamiento-visible']].map(([l, v]) =>
          h('button', { class: `p-3 rounded-lg border text-left text-sm transition ${data.methodology === v ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`, onClick: () => { data.methodology = v; step.value = 5; } }, l)
        )),
    ]);

    const step5 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Estructura de la Clase'),
      h('p', { class: 'text-sm text-slate-500' }, 'La estructura sugerida es: Inicio (10-15%) → Desarrollo (60-70%) → Cierre (10-15%). Puedes personalizarla después en el editor.'),
      h('div', { class: 'bg-blue-50 p-4 rounded-lg text-sm space-y-1' }, [
        h('p', { class: 'font-medium' }, 'Estructura estándar:'), h('ul', { class: 'list-disc pl-4 text-slate-600 space-y-0.5' }, [h('li', 'Inicio: Activación, propósito'), h('li', 'Desarrollo: Modelamiento, práctica, monitoreo'), h('li', 'Cierre: Síntesis, evaluación, retroalimentación')]),
      ]),
      h('button', { onClick: () => step.value = 6, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step6 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Evaluación'),
      h('p', { class: 'text-sm text-slate-500' }, 'Define el enfoque de evaluación (Decreto N.° 67)'),
      h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2' }, [h('option', { value: 'formativa' }, 'Evaluación Formativa'), h('option', { value: 'sumativa' }, 'Evaluación Sumativa')]),
      h('button', { onClick: () => step.value = 7, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const duaGroups = [
      { key: 'representacion', icon: '👁️', title: 'Representación', desc: 'El "qué" del aprendizaje — múltiples formas de presentar la información', options: [
        ['percepcion', 'Opciones de percepción (auditivo, visual, kinestésico)'],
        ['lenguaje', 'Lenguaje claro, vocabulario y símbolos explícitos'],
        ['conocimientos', 'Activación de conocimientos previos'],
        ['formatos', 'Materiales en múltiples formatos (texto, audio, imagen)'],
      ]},
      { key: 'accionExpresion', icon: '✍️', title: 'Acción y Expresión', desc: 'El "cómo" del aprendizaje — múltiples formas de demostrar lo aprendido', options: [
        ['respuestas', 'Variedad de formas de responder (oral, escrita, visual)'],
        ['organizadores', 'Organizadores gráficos y herramientas de apoyo'],
        ['metas', 'Metas y objetivos de aprendizaje claros'],
        ['monitoreo', 'Monitoreo y seguimiento del progreso'],
      ]},
      { key: 'implicacion', icon: '❤️', title: 'Implicación', desc: 'El "porqué" del aprendizaje — múltiples formas de motivar y comprometer', options: [
        ['interes', 'Opciones de interés y motivación'],
        ['relevancia', 'Tareas relevantes y auténticas'],
        ['colaboracion', 'Colaboración y comunidad'],
        ['autorregulacion', 'Autorregulación y retroalimentación'],
      ]},
    ];

    const toggleDua = (groupKey, optKey) => {
      const arr = data.dua[groupKey];
      const i = arr.indexOf(optKey);
      if (i >= 0) arr.splice(i, 1); else arr.push(optKey);
    };

    const step7 = () => h('div', { class: 'space-y-4' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Inclusión y Accesibilidad'),
      h('p', { class: 'text-sm text-slate-500' }, 'Elige el marco pedagógico de inclusión y describe barreras (información agregada, sin diagnósticos individuales).'),
      h('div', { class: 'grid grid-cols-1 gap-2 max-w-lg' }, [
        ['dua', '📐', 'DUA completo (recomendado)', 'Diseño Universal para el Aprendizaje — representación, acción/expresión e implicación'],
        ['estandar', '🧩', 'Formato estándar', 'Diferenciación básica sin estructura DUA explícita'],
      ].map(([val, icon, tit, desc]) =>
        h('button', { class: `p-3 rounded-xl border-2 text-left transition ${data.framework === val ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`, onClick: () => data.framework = val }, [
          h('p', { class: 'font-medium text-sm' }, `${icon} ${tit}`),
          h('p', { class: 'text-xs text-slate-500 mt-0.5' }, desc),
        ])
      )),
      data.framework === 'dua' ? h('div', { class: 'space-y-3' }, duaGroups.map(g =>
        Card([h('div', { class: 'p-4' }, [
          h('h3', { class: 'font-medium text-sm text-slate-800 flex items-center gap-2' }, [h('span', g.icon), g.title]),
          h('p', { class: 'text-xs text-slate-500 mb-2' }, g.desc),
          h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-1' }, g.options.map(([k, label]) =>
            h('label', { class: 'flex items-start gap-2 text-xs p-1.5 rounded hover:bg-slate-50 cursor-pointer' }, [
              h('input', { type: 'checkbox', checked: data.dua[g.key].includes(k), onChange: () => toggleDua(g.key, k), class: 'mt-0.5' }),
              h('span', { class: 'text-slate-600' }, label),
            ])
          )),
        ])])
      )) : null,
      h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Barreras observadas (opcional)'), h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2', rows: 3, placeholder: 'Ej: estudiantes que requieren apoyo en lectura...', onInput: (e) => data.barriers = e.target.value })]),
      h('p', { class: 'text-xs text-amber-600' }, 'No incluyas diagnósticos clínicos ni nombres de estudiantes.'),
      h('button', { onClick: () => step.value = 8, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, 'Siguiente →'),
    ]);

    const step8 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('h2', { class: 'text-lg font-semibold' }, 'Generar Planificación'),
      Card([h('div', { class: 'p-4 space-y-2 text-sm' }, [
        h('p', { class: 'font-medium' }, 'Resumen de lo que se enviará a DeepSeek:'),
        h('ul', { class: 'text-slate-600 space-y-1 text-xs' }, [
          h('li', `Nivel: ${levelLabel(data.level) || '-'}`),
          h('li', `Asignatura: ${subjectLabel(data.subject)}`),
          h('li', `OA seleccionados: ${data.oaIds.length}`),
          h('li', `Duración: ${data.duration} min · Modalidad: ${data.modality}`),
          h('li', `Marco de inclusión: ${data.framework === 'dua' ? 'DUA (${data.dua.representacion.length + data.dua.accionExpresion.length + data.dua.implicacion.length} estrategias)' : 'Estándar'}`),
        ]),
        h('div', { class: 'bg-amber-50 border border-amber-200 p-3 rounded-lg mt-3 text-xs text-amber-800 space-y-1' }, [
          h('p', { class: 'font-medium' }, '⚠ Importante:'),
          h('ul', { class: 'list-disc pl-3 space-y-0.5' }, [
            h('li', 'No se enviarán datos personales de estudiantes'),
            h('li', 'La información se envía a DeepSeek (proveedor de IA)'),
            h('li', 'El resultado es un borrador que requiere revisión y aprobación'),
          ]),
        ]),
      ])]),
      Alert('error', error.value),
      h('button', { onClick: generate, disabled: generating.value, class: 'w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2' }, generating.value ? [Spinner(5), 'Generando...'] : 'Generar Planificación'),
    ]);

    const step9 = () => h('div', { class: 'space-y-4 max-w-lg' }, [
      h('div', { class: 'flex items-center justify-between' }, [
        h('h2', { class: 'text-lg font-semibold' }, 'Planificación Generada'),
        planning.value?.status === 'approved' ? h('span', { class: 'bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full' }, '✓ Aprobada') : null,
      ]),
      planning.value?.warnings?.length > 0 ? h('div', { class: 'bg-amber-50 border border-amber-200 p-3 rounded-lg' }, [
        h('p', { class: 'text-sm font-medium text-amber-800 mb-1' }, `⚠ ${planning.value.warnings.length} advertencia(s)`),
        ...planning.value.warnings.map(w => h('p', { class: 'text-xs text-amber-700' }, `[${w.type}] ${w.description}`)),
      ]) : null,
      Alert('error', error.value),
      planning.value?.purpose ? Card([h('div', { class: 'p-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Propósito'),
        h('p', { class: 'text-sm text-slate-600' }, planning.value.purpose),
      ])]) : null,
      planning.value?.activities?.length > 0 ? Card([h('div', { class: 'p-4' }, [
        h('h3', { class: 'font-medium text-sm text-slate-700 mb-2' }, 'Actividades'),
        ...planning.value.activities.map((a, i) =>
          h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
            h('p', { class: 'text-xs font-medium text-blue-600' }, `${a.moment} · ${a.duration} min`),
            h('p', { class: 'text-sm' }, a.title || a.description),
          ])
        ),
      ])]) : null,
      planning.value?.id && planning.value?.status !== 'approved'
        ? h('button', { onClick: approve, disabled: generating.value, class: 'w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition' }, generating.value ? 'Aprobando...' : '✓ Aprobar Planificación')
        : planning.value?.status === 'approved'
          ? h('div', { class: 'bg-green-50 border border-green-200 p-4 rounded-lg text-center' }, [
              h('p', { class: 'text-green-700 font-medium' }, '✅ Planificación aprobada'),
              h('a', { href: '#/dashboard', class: 'text-sm text-blue-600 hover:underline mt-2 inline-block' }, 'Volver al dashboard'),
            ])
          : null,
    ]);

    const step10 = () => h('div', { class: 'text-center py-12' }, [
      h('div', { class: 'text-5xl mb-4' }, '✅'),
      h('h2', { class: 'text-xl font-semibold mb-2' }, 'Planificación Aprobada'),
      h('p', { class: 'text-slate-500 mb-6' }, 'Tu planificación ha sido aprobada y guardada. Puedes verla en tu dashboard.'),
      h('div', { class: 'flex justify-center gap-3' }, [
        planning.value?.id ? h('a', { href: `#/planificacion/${planning.value.id}`, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm' }, 'Ver planificación') : null,
        h('a', { href: '#/dashboard', class: 'bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm' }, 'Dashboard'),
      ]),
    ]);

    const renderStep = () => {
      const steps = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6, 7: step7, 8: step8, 9: step9, 10: step10 };
      return (steps[step.value] || (() => h('p', 'Paso no encontrado')))();
    };

    // Trazabilidad
    const trace = planning.value?.aiContributions?.[0];
    const traceInfo = trace ? h('div', { class: 'mt-8 p-3 bg-slate-50 rounded-lg text-xs text-slate-400' }, [
      h('p', `Generado con: ${trace.provider} / ${trace.model}`),
      h('p', `Fecha: ${new Date(trace.generatedAt).toLocaleString('es-CL')}`),
      h('p', `Tokens: ${trace.inputTokens || '?'} entrada / ${trace.outputTokens || '?'} salida · Costo: $${(trace.cost || 0).toFixed(5)}`),
    ]) : null;

    return () => h(Layout, { title: 'Nueva Planificación', subtitle: 'Sigue los pasos para generar tu planificación de clase' }, () => [
      stepIndicator(),
      renderStep(),
      traceInfo,
    ]);
  }
});

// ──────────── Planning Detail ────────────

const PlanningDetailPage = defineComponent({
  setup() {
    if (!guard()) return () => null;
    const planning = ref(null); const loading = ref(true); const error = ref(''); const exporting = ref(false);

    const id = window.location.hash.split('/').pop();
    onMounted(async () => {
      try {
        const snap = await getDoc(doc(db, 'plannings', id));
        if (!snap.exists) { error.value = 'Planificaci�n no encontrada'; return; }
        const data = snap.data();
        if (data.userId !== store.user.uid) { error.value = 'No tienes acceso a esta planificaci�n'; return; }
        planning.value = { id: snap.id, ...data };
      } catch (e) { error.value = 'Error al cargar planificación'; } finally { loading.value = false; }
    });

    const statusBadge = (s) => {
      const map = { draft: ['bg-yellow-100 text-yellow-700', 'Borrador'], approved: ['bg-green-100 text-green-700', 'Aprobada'] };
      const [c, t] = map[s] || ['bg-slate-100 text-slate-500', s];
      return h('span', { class: `text-xs px-2 py-0.5 rounded-full ${c}` }, t);
    };

    const handleExport = async (format) => {
      exporting.value = true;
      try {
        const result = await exportPlanningFn({ planningId: planning.value.id, format });

        if (format === 'docx' && result.data.url) {
          const a = document.createElement('a');
          a.href = result.data.url;
          a.download = result.data.filename || `planificacion-${planning.value.id}.docx`;
          a.click();
          return;
        }

        if (format === 'pdf') {
          // Usar window.print() para PDF
          window.print();
          return;
        }
      } catch (e) {
        console.error('Export error:', e);
        alert('Error al exportar. Intenta de nuevo.');
      } finally {
        exporting.value = false;
      }
    };

    const exportButtons = () => h('div', { class: 'flex gap-2' }, [
      h('button', {
        onClick: () => handleExport('docx'),
        disabled: exporting.value,
        class: 'bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1',
      }, [h('span', exporting.value ? 'Exportando...' : 'DOCX')]),
      h('button', {
        onClick: () => handleExport('pdf'),
        disabled: exporting.value,
        class: 'bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1',
      }, [h('span', 'PDF')]),
    ]);

    return () => h(Layout, { title: 'Detalle de Planificación' }, () => [
      loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) :
      error.value ? Alert('error', error.value) :
      !planning.value ? EmptyState('📋', 'No encontrada', 'La planificación no existe o fue eliminada') :
      h('div', { class: 'space-y-4 max-w-2xl' }, [
        Card([h('div', { class: 'p-6 space-y-4' }, [
          h('div', { class: 'flex items-center justify-between' }, [
            h('h2', { class: 'text-xl font-bold' }, planning.value.title || 'Sin título'),
            statusBadge(planning.value.status),
          ]),
          h('div', { class: 'flex flex-wrap gap-2 text-xs text-slate-500' }, [
            h('span', { class: 'bg-slate-100 px-2 py-1 rounded' }, planning.value.level?.replace('-basico', '° básico')),
            h('span', { class: 'bg-slate-100 px-2 py-1 rounded' }, planning.value.duration + ' min'),
            h('span', { class: 'bg-slate-100 px-2 py-1 rounded' }, planning.value.modality),
            planning.value.approvedAt ? h('span', { class: 'bg-green-100 text-green-700 px-2 py-1 rounded' }, `Aprobada: ${new Date(planning.value.approvedAt).toLocaleDateString('es-CL')}`) : null,
          ]),
          planning.value.learningObjectives?.length > 0 ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Objetivos de Aprendizaje'),
            ...planning.value.learningObjectives.map(oa => h('p', { class: 'text-sm text-slate-600' }, `${oa.code}: ${oa.text.slice(0, 100)}...`)),
          ]) : null,
          planning.value.purpose ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-1' }, 'Propósito'),
            h('p', { class: 'text-sm text-slate-600' }, planning.value.purpose),
          ]) : null,
          planning.value.activities?.length > 0 ? h('div', [
            h('h3', { class: 'font-medium text-sm text-slate-700 mb-2' }, 'Actividades'),
            ...planning.value.activities.map((a, i) =>
              h('div', { class: 'border-l-2 border-blue-300 pl-3 py-1 mb-2' }, [
                h('div', { class: 'flex items-center gap-2 text-xs' }, [
                  h('span', { class: 'font-medium text-blue-600' }, a.moment),
                  h('span', { class: 'text-slate-400' }, a.duration + ' min'),
                ]),
                h('p', { class: 'text-sm' }, a.description || a.title),
              ])
            ),
          ]) : null,
        ])]),
        planning.value.warnings?.length > 0 ? Card([h('div', { class: 'p-4' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-amber-800 mb-2' }, [
            h('span', '⚠'),
            h('span', `Advertencias pedagógicas (${planning.value.warnings.length})`),
          ]),
          h('div', { class: 'space-y-1' }, planning.value.warnings.map(w =>
            h('div', { class: `flex items-start gap-2 text-xs p-2 rounded ${w.type === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}` }, [
              h('span', { class: 'font-mono font-medium' }, `[${w.ruleId || w.type}]`),
              h('span', w.description || w.msg),
            ])
          )),
        ])]) : null,
        planning.value.dua ? Card([h('div', { class: 'p-4' }, [
          h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800 mb-2' }, [
            h('span', '📐'),
            h('span', 'DUA (Diseño Universal para el Aprendizaje)'),
            h('span', { class: 'bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded' }, planning.value.framework === 'estandar' ? 'Formato estándar' : 'DUA completo'),
          ]),
          planning.value.framework !== 'estandar' ? h('div', { class: 'space-y-2' }, [
            h('div', [h('p', { class: 'text-xs font-medium text-slate-600 mb-0.5' }, '👁️ Representación (el "qué")'), ...(planning.value.dua.representacion || []).map(s => h('p', { class: 'text-xs text-slate-600' }, `• ${s}`))]),
            h('div', [h('p', { class: 'text-xs font-medium text-slate-600 mb-0.5' }, '✍️ Acción y Expresión (el "cómo")'), ...(planning.value.dua.accionExpresion || []).map(s => h('p', { class: 'text-xs text-slate-600' }, `• ${s}`))]),
            h('div', [h('p', { class: 'text-xs font-medium text-slate-600 mb-0.5' }, '❤️ Implicación (el "porqué")'), ...(planning.value.dua.implicacion || []).map(s => h('p', { class: 'text-xs text-slate-600' }, `• ${s}`))]),
          ]) : null,
          planning.value.barriers ? h('div', { class: 'mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded' }, `Barreras: ${planning.value.barriers}`) : null,
        ])]) : null,
        h('div', { class: 'flex gap-2' }, [
          h('a', { href: '#/dashboard', class: 'bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition' }, '← Volver'),
          h('a', { href: `#/editar/${planning.value.id}`, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition' }, '✏️ Editar'),
          exportButtons(),
        ]),
        h(FeedbackForm, { planningId: planning.value.id }),
      ]),
    ]);
  }
});

// ──── Feedback del piloto docente ────
const FeedbackForm = defineComponent({
  props: ['planningId'],
  setup(props) {
    const quality = ref(0);
    const pedagogic = ref(0);
    const ease = ref(0);
    const comments = ref('');
    const sent = ref(false);
    const submitting = ref(false);
    const fbError = ref('');

    const send = async () => {
      if (!quality.value) { fbError.value = 'Evalúa la calidad primero (1-5)'; return; }
      submitting.value = true; fbError.value = '';
      try {
        await submitFeedbackFn({ planningId: props.planningId, quality: quality.value, pedagogic: pedagogic.value, ease: ease.value, comments: comments.value });
        sent.value = true;
      } catch (e) { fbError.value = 'Error al enviar feedback'; }
      finally { submitting.value = false; }
    };

    const starRow = (label, model) => h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'text-xs text-slate-600' }, label),
      h('div', { class: 'flex gap-0.5' }, [1, 2, 3, 4, 5].map(n =>
        h('button', { type: 'button', onClick: () => model.value = n, class: `text-lg leading-none ${n <= model.value ? 'text-amber-400' : 'text-slate-200'}`, 'aria-label': `${n} estrellas` }, '★')
      )),
    ]);

    return () => Card([h('div', { class: 'p-4 space-y-3' }, [
      h('div', { class: 'flex items-center gap-2 text-sm font-medium text-slate-800' }, [h('span', '💬'), h('span', 'Feedback del piloto docente')]),
      h('p', { class: 'text-xs text-slate-400' }, 'Tu evaluación ayuda a mejorar el generador (1 = muy malo, 5 = excelente).'),
      sent.value ? h('div', { class: 'bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg text-center' }, '✓ ¡Gracias por tu feedback!') :
        h('div', { class: 'space-y-2' }, [
          starRow('Calidad pedagógica', quality),
          starRow('Idoneidad para el curso', pedagogic),
          starRow('Facilidad de uso', ease),
          h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm', rows: 2, placeholder: 'Comentarios (opcional)...', onInput: (e) => comments.value = e.target.value }),
          fbError.value ? h('p', { class: 'text-xs text-red-600' }, fbError.value) : null,
          h('button', { onClick: send, disabled: submitting.value, class: 'bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, submitting.value ? 'Enviando...' : 'Enviar feedback'),
        ]),
    ])]);
  }
});

// ──────────── Manual Editor ────────────

const ManualEditor = defineComponent({
  setup() {
    if (!guard()) return () => null;

    const id = window.location.hash.split('/').pop();
    const isEditing = id && id !== 'nueva-manual' && id.length > 10;

    const form = reactive({
      title: '',
      level: '',
      subject: 'historia-geografia-ciencias-sociales',
      unit: '',
      oaCode: '',
      oaText: '',
      duration: 45,
      modality: 'presencial',
      studentCount: '',
      priorKnowledge: '',
      resources: '',
      methodology: '',
      purpose: '',
      activities: [],
      assessmentType: 'formativa',
      assessmentCriteria: '',
      assessmentFeedback: '',
      differentiation: '',
      accessibility: '',
      barriers: '',
      framework: 'dua',
      duaRepresentacion: '',
      duaAccionExpresion: '',
      duaImplicacion: '',
      extension: '',
      homework: '',
    });

    const loading = ref(true);
    const saving = ref(false);
    const error = ref('');
    const success = ref('');
    const lastSaved = ref(null);
    const planningId = ref(null);
    const status = ref('draft');
    const warnings = ref([]);

    // ── Warning evaluator (client-side V-001 to V-012) ──
    const evaluateWarnings = () => {
      const w = [];
      const acts = form.activities || [];
      const totalTime = acts.reduce((s, a) => s + (a.duration || 0), 0);
      const duration = parseInt(form.duration) || 45;

      // V-001: actividades
      if (acts.length === 0) w.push({ type: 'critical', rule: 'V-001', msg: 'No hay actividades definidas para los OA seleccionados' });
      // V-004: criterios de evaluacion
      if (!form.assessmentCriteria) w.push({ type: 'critical', rule: 'V-004', msg: 'La evaluacion no tiene criterios definidos' });
      // V-007: actividad de cierre
      if (!acts.some(a => a.moment === 'cierre')) w.push({ type: 'warning', rule: 'V-007', msg: 'No hay actividad de cierre' });
      // V-009: retroalimentacion
      if (!form.assessmentFeedback) w.push({ type: 'warning', rule: 'V-009', msg: 'No hay estrategia de retroalimentacion' });
      // V-006: duracion
      if (acts.length > 0 && (totalTime < duration * 0.8 || totalTime > duration * 1.1)) {
        w.push({ type: 'warning', rule: 'V-006', msg: `La duracion total de actividades (${totalTime} min) no coincide con la duracion planificada (${duration} min)` });
      }
      return w;
    };
    const levels = LEVELS;
    const moments = ['inicio', 'desarrollo', 'cierre'];
    const momentLabels = { inicio: 'Inicio', desarrollo: 'Desarrollo', cierre: 'Cierre' };

    // ── Load existing ──
    onMounted(async () => {
      if (isEditing) {
        try {
          const snap = await getDoc(doc(db, 'plannings', id));
          if (!snap.exists || snap.data().userId !== store.user.uid) {
            error.value = 'Planificación no encontrada';
            return;
          }
          const d = snap.data();
          planningId.value = d.id || id;
          status.value = d.status || 'draft';
          form.title = d.title || '';
          form.level = d.level || '';
          form.unit = d.unit || '';
          form.oaCode = d.learningObjectives?.[0]?.code || '';
          form.oaText = d.learningObjectives?.[0]?.text || '';
          form.duration = d.duration || 45;
          form.modality = d.modality || 'presencial';
          form.studentCount = d.studentCount || '';
          form.priorKnowledge = d.priorKnowledge || '';
          form.resources = (d.resources || []).join(', ');
          form.methodology = d.methodology || '';
          form.purpose = d.purpose || '';
          form.activities = d.activities || [];
          form.assessmentType = d.assessment?.type || 'formativa';
          form.assessmentCriteria = (d.assessment?.criteria || []).join(', ');
          form.assessmentFeedback = d.assessment?.feedbackStrategy || '';
          form.differentiation = d.differentiation || '';
          form.accessibility = (d.accessibility || []).join(', ');
          form.barriers = d.barriers || '';
          form.framework = d.framework || 'dua';
          form.duaRepresentacion = (d.dua?.representacion || []).join('\n');
          form.duaAccionExpresion = (d.dua?.accionExpresion || []).join('\n');
          form.duaImplicacion = (d.dua?.implicacion || []).join('\n');
          form.extension = d.extension || '';
          form.homework = d.homework || '';
        } catch (e) {
          error.value = 'Error al cargar planificación';
        }
      }
      loading.value = false;
    });

    // ── Autosave ──
    let autosaveTimer = null;
    const startAutosave = () => {
      if (autosaveTimer) clearInterval(autosaveTimer);
      autosaveTimer = setInterval(() => {
        if (form.title || form.level || form.purpose || form.activities.length > 0) {
          save(true);
        }
      }, 30000);
    };

    const stopAutosave = () => { if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; } };

    onMounted(() => {
      if (!isEditing) startAutosave();
      else setTimeout(startAutosave, 1000);
    });

    const cleanup = () => stopAutosave();

    // ── Warning panel ──
    const warningPanel = () => {
      warnings.value = evaluateWarnings();
      if (warnings.value.length === 0) return null;
      const counts = { critical: 0, warning: 0, suggestion: 0 };
      warnings.value.forEach(w => { if (counts[w.type] !== undefined) counts[w.type]++; });
      return h('div', { class: 'bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4' }, [
        h('div', { class: 'flex items-center gap-2 text-sm font-medium text-amber-800 mb-1' }, [
          h('span', '⚠'),
          h('span', `Advertencias pedagógicas (${warnings.value.length})`),
          counts.critical > 0 ? h('span', { class: 'bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded' }, `${counts.critical} crítica(s)`) : null,
          counts.warning > 0 ? h('span', { class: 'bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded' }, `${counts.warning} advertencia(s)`) : null,
        ]),
        h('div', { class: 'space-y-0.5' }, warnings.value.map(w =>
          h('p', { class: `text-xs ${w.type === 'critical' ? 'text-red-700' : 'text-amber-700'}` }, `[${w.rule}] ${w.msg}`)
        )),
      ]);
    };

    // ── Save / Autosave ──
    const save = async (isAutosave = false) => {
      saving.value = true;
      error.value = '';
      const buildData = () => ({
        userId: store.user.uid,
        title: form.title || 'Sin título',
        status: isAutosave ? 'draft' : status.value,
        level: form.level,
        subject: form.subject,
        unit: form.unit,
        duration: parseInt(form.duration) || 45,
        modality: form.modality,
        studentCount: form.studentCount,
        priorKnowledge: form.priorKnowledge,
        resources: form.resources ? form.resources.split(',').map(r => r.trim()).filter(Boolean) : [],
        methodology: form.methodology,
        learningObjectives: form.oaCode ? [{ code: form.oaCode, text: form.oaText, source: 'Ingreso manual' }] : [],
        purpose: form.purpose,
        activities: form.activities,
        assessment: {
          type: form.assessmentType,
          criteria: form.assessmentCriteria ? form.assessmentCriteria.split(',').map(r => r.trim()).filter(Boolean) : [],
          feedbackStrategy: form.assessmentFeedback,
        },
        differentiation: form.differentiation,
        accessibility: form.accessibility ? form.accessibility.split(',').map(r => r.trim()).filter(Boolean) : [],
        barriers: form.barriers || '',
        framework: form.framework || 'dua',
        dua: form.framework === 'estandar' ? null : {
          representacion: form.duaRepresentacion ? form.duaRepresentacion.split('\n').map(s => s.trim()).filter(Boolean) : [],
          accionExpresion: form.duaAccionExpresion ? form.duaAccionExpresion.split('\n').map(s => s.trim()).filter(Boolean) : [],
          implicacion: form.duaImplicacion ? form.duaImplicacion.split('\n').map(s => s.trim()).filter(Boolean) : [],
        },
        extension: form.extension,
        homework: form.homework,
        updatedAt: serverTimestamp(),
      });

      try {
        if (planningId.value) {
          await updateDoc(doc(db, 'plannings', planningId.value), buildData());
          if (!isAutosave) {
            // Save version snapshot
            const verSnap = await getDoc(doc(db, 'plannings', planningId.value));
            const v = (verSnap.data()?.version || 1) + 1;
            await updateDoc(doc(db, 'plannings', planningId.value), { version: v });
            await addDoc(collection(db, 'plannings', planningId.value, 'versions'), {
              snapshot: buildData(),
              version: v,
              createdAt: serverTimestamp(),
              userId: store.user.uid,
            });
            success.value = 'Guardado correctamente';
            lastSaved.value = new Date().toLocaleTimeString('es-CL');
          } else {
            lastSaved.value = new Date().toLocaleTimeString('es-CL');
          }
        } else {
          const ref = await addDoc(collection(db, 'plannings'), { ...buildData(), version: 1, createdAt: serverTimestamp(), aiContributions: [], warnings: [], approvedAt: null });
          planningId.value = ref.id;
          if (!isAutosave) success.value = 'Planificación creada';
        }
      } catch (e) {
        if (!isAutosave) error.value = 'Error al guardar';
        console.error('Save error:', e);
      } finally {
        saving.value = false;
      }
    };

    // ── Activity management ──
    const addActivity = (moment) => {
      form.activities.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
        moment,
        order: form.activities.filter(a => a.moment === moment).length + 1,
        title: '',
        description: '',
        duration: 15,
        teacherActions: [],
        studentActions: [],
        keyQuestions: [],
        monitoringStrategy: '',
        evidence: '',
      });
    };

    const removeActivity = (idx) => { form.activities.splice(idx, 1); };

    const moveActivity = (idx, dir) => {
      const target = idx + dir;
      if (target < 0 || target >= form.activities.length) return;
      [form.activities[idx], form.activities[target]] = [form.activities[target], form.activities[idx]];
    };

    const approve = async () => {
      if (!planningId.value) { error.value = 'Guarda primero la planificación'; return; }
      saving.value = true;
      try {
        await updateDoc(doc(db, 'plannings', planningId.value), { status: 'approved', approvedAt: serverTimestamp() });
        status.value = 'approved';
        success.value = 'Planificación aprobada';
      } catch (e) { error.value = 'Error al aprobar'; } finally { saving.value = false; }
    };

    // ── Render ──

    const renderSection = (title, icon, children) =>
      Card([h('div', { class: 'p-4 space-y-3' }, [
        h('h3', { class: 'font-semibold text-slate-800 flex items-center gap-2 text-sm' }, [h('span', icon), title]),
        ...(Array.isArray(children) ? children : [children]),
      ])]);

    const inputField = (label, model, opts = {}) => h('div', [
      h('label', { class: 'block text-sm font-medium text-slate-700 mb-0.5' }, label),
      opts.type === 'textarea'
        ? h('textarea', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', rows: opts.rows || 3, placeholder: opts.placeholder || '', value: form[model], onInput: (e) => form[model] = e.target.value })
        : opts.type === 'select'
          ? h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', value: form[model], onChange: (e) => form[model] = e.target.value }, opts.options || [])
          : h('input', { type: opts.type || 'text', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none', placeholder: opts.placeholder || '', value: form[model], onInput: (e) => form[model] = e.target.value }),
    ]);

    const renderActivities = () => {
      const byMoment = {};
      moments.forEach(m => { byMoment[m] = form.activities.filter(a => a.moment === m); });

      return h('div', { class: 'space-y-4' }, [
        h('h3', { class: 'font-semibold text-slate-800 flex items-center gap-2' }, [h('span', '📝'), 'Actividades']),
        moments.map(moment =>
          Card([h('div', { class: 'p-4' }, [
            h('div', { class: 'flex items-center justify-between mb-2' }, [
              h('h4', { class: 'font-medium text-sm text-blue-700' }, momentLabels[moment]),
              h('button', { onClick: () => addActivity(moment), class: 'text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition' }, '+ Agregar actividad'),
            ]),
            byMoment[moment].length === 0
              ? h('p', { class: 'text-xs text-slate-400 py-2 text-center' }, 'Sin actividades. Haz clic en "+ Agregar actividad".')
              : byMoment[moment].map((act, localIdx) => {
                  const globalIdx = form.activities.indexOf(act);
                  return Card([h('div', { class: 'p-3 space-y-2' }, [
                    h('div', { class: 'flex items-center justify-between' }, [
                      h('span', { class: 'text-xs font-medium text-slate-500' }, `#${act.order}`),
                      h('div', { class: 'flex gap-1' }, [
                        h('button', { onClick: () => moveActivity(globalIdx, -1), disabled: globalIdx === 0, class: 'text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30' }, '↑'),
                        h('button', { onClick: () => moveActivity(globalIdx, 1), disabled: globalIdx === form.activities.length - 1, class: 'text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30' }, '↓'),
                        h('button', { onClick: () => removeActivity(globalIdx), class: 'text-xs text-red-400 hover:text-red-600' }, '✕'),
                      ]),
                    ]),
                    h('div', { class: 'grid grid-cols-2 gap-2' }, [
                      h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Título'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.title, onInput: (e) => act.title = e.target.value, placeholder: 'Título de la actividad' })]),
                      h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Duración (min)'), h('input', { type: 'number', class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.duration, onInput: (e) => act.duration = parseInt(e.target.value) || 15 })]),
                    ]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Descripción'), h('textarea', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', rows: 2, value: act.description, onInput: (e) => act.description = e.target.value, placeholder: 'Describe la actividad...' })]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Preguntas clave'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.keyQuestions?.[0] || '', onInput: (e) => { act.keyQuestions = [e.target.value]; }, placeholder: 'Pregunta para los estudiantes' })]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Monitoreo'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.monitoringStrategy || '', onInput: (e) => act.monitoringStrategy = e.target.value, placeholder: '¿Cómo monitorearás?' })]),
                    h('div', [h('label', { class: 'text-xs text-slate-500' }, 'Evidencia'), h('input', { class: 'w-full border border-slate-200 rounded px-2 py-1 text-xs', value: act.evidence || '', onInput: (e) => act.evidence = e.target.value, placeholder: '¿Qué evidencia recogerás?' })]),
                  ])], ' mb-2');
                }),
          ])])
        ),
      ]);
    };

    // Cleanup on unmount
    const origBeforeUnmount = null;

    return () => {
      const currentPath = window.location.hash;
      if (currentPath !== '#/nueva-manual' && !currentPath.startsWith('#/editar/') && !currentPath.startsWith('#/planificacion/')) {
        cleanup();
      }
      return h(Layout, { title: isEditing ? 'Editar Planificación' : 'Nueva Planificación (Manual)', subtitle: isEditing ? 'Editando planificación existente' : 'Crea tu planificación desde cero' }, () => [
        loading.value ? h('div', { class: 'flex justify-center py-12' }, Spinner(8)) : [
          error.value ? Alert('error', error.value) : null,
          success.value ? Alert('success', success.value) : null,
          warningPanel(),
          h('div', { class: 'grid lg:grid-cols-3 gap-4' }, [
            // Sidebar
            h('div', { class: 'lg:col-span-1 space-y-3' }, [
              renderSection('Información', '📋', [
                inputField('Título', 'title', { placeholder: 'Título de la clase' }),
                inputField('Nivel', 'level', { type: 'select', options: [h('option', { value: '' }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))] }),
                inputField('Duración', 'duration', { type: 'select', options: [h('option', { value: 45 }, '45 min'), h('option', { value: 90 }, '90 min')] }),
                inputField('Modalidad', 'modality', { type: 'select', options: [['presencial', 'Presencial'], ['hibrida', 'Híbrida'], ['remota', 'Remota']].map(([v, l]) => h('option', { value: v }, l)) }),
              ]),
              renderSection('Currículum', '📚', [
                inputField('Código OA', 'oaCode', { placeholder: 'Ej: HI07 OA 01' }),
                inputField('Texto OA', 'oaText', { type: 'textarea', rows: 2, placeholder: 'Texto del OA...' }),
                inputField('Unidad (opcional)', 'unit', { placeholder: 'Unidad 1: ...' }),
              ]),
              renderSection('Contexto', '👥', [
                inputField('Estudiantes (aprox.)', 'studentCount', { placeholder: '30' }),
                inputField('Conocimientos previos', 'priorKnowledge', { type: 'textarea', rows: 2, placeholder: 'Lo que los estudiantes ya saben...' }),
                h('p', { class: 'text-xs text-amber-600' }, 'No uses nombres ni RUT de estudiantes.'),
                inputField('Recursos (separados por coma)', 'resources', { placeholder: 'proyector, cuadernos, mapas' }),
                inputField('Metodología', 'methodology', { placeholder: 'Clase dialogada, ABP, etc.' }),
              ]),
            ]),
            // Main content
            h('div', { class: 'lg:col-span-2 space-y-3' }, [
              renderSection('Propósito', '🎯', [
                inputField('Propósito de la clase', 'purpose', { type: 'textarea', rows: 2, placeholder: '¿Qué aprenderán los estudiantes hoy?' }),
              ]),
              renderActivities(),
              renderSection('Evaluación', '📊', [
                inputField('Tipo', 'assessmentType', { type: 'select', options: [h('option', { value: 'formativa' }, 'Formativa'), h('option', { value: 'sumativa' }, 'Sumativa')] }),
                inputField('Criterios (separados por coma)', 'assessmentCriteria', { placeholder: 'Identifica, analiza, compara...' }),
                inputField('Estrategia de retroalimentación', 'assessmentFeedback', { type: 'textarea', rows: 2, placeholder: '¿Cómo darás retroalimentación?' }),
              ]),
              renderSection('Diferenciación', '🌈', [
                inputField('Diferenciación', 'differentiation', { type: 'textarea', rows: 2, placeholder: 'Adecuaciones para distintos estudiantes...' }),
                h('p', { class: 'text-xs text-amber-600' }, 'Describe necesidades en términos pedagógicos, sin diagnósticos.'),
                inputField('Accesibilidad (separados por coma)', 'accessibility', { placeholder: 'material en braille, letra grande, audio...' }),
              ]),
              renderSection('DUA (Diseño Universal para el Aprendizaje)', '📐', [
                inputField('Marco de inclusión', 'framework', { type: 'select', options: [h('option', { value: 'dua' }, 'DUA completo'), h('option', { value: 'estandar' }, 'Formato estándar')] }),
                h('p', { class: 'text-xs text-slate-500' }, 'Una estrategia por línea en cada principio (CAST):'),
                inputField('Representación (el "qué")', 'duaRepresentacion', { type: 'textarea', rows: 2, placeholder: 'Ej: presentar el contenido en audio y texto' }),
                inputField('Acción y Expresión (el "cómo")', 'duaAccionExpresion', { type: 'textarea', rows: 2, placeholder: 'Ej: permitir responder de forma oral, escrita o visual' }),
                inputField('Implicación (el "porqué")', 'duaImplicacion', { type: 'textarea', rows: 2, placeholder: 'Ej: tareas con elección y relevancia personal' }),
                inputField('Barreras observadas', 'barriers', { type: 'textarea', rows: 2, placeholder: 'Descripción agregada, sin diagnósticos...' }),
              ]),
              renderSection('Extensión', '🔗', [
                inputField('Actividad de extensión (opcional)', 'extension', { type: 'textarea', rows: 2, placeholder: 'Para estudiantes que terminan rápido...' }),
                inputField('Tarea (opcional)', 'homework', { type: 'textarea', rows: 1, placeholder: 'Tarea para la casa...' }),
              ]),
            ]),
          ]),
          // Action bar
          h('div', { class: 'sticky bottom-0 bg-white border-t border-slate-200 p-3 mt-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-lg' }, [
            h('div', { class: 'flex items-center gap-3 text-xs text-slate-400' }, [
              saving.value ? [Spinner(4), h('span', 'Guardando...')] : lastSaved.value ? h('span', `Último guardado: ${lastSaved.value}`) : h('span', 'Sin cambios'),
              planningId.value ? h('a', { href: `#/planificacion/${planningId.value}`, class: 'text-blue-600 hover:underline' }, 'Ver') : null,
            ]),
            h('div', { class: 'flex gap-2' }, [
              h('button', { onClick: () => save(), disabled: saving.value, class: 'bg-slate-100 text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition' }, saving.value ? 'Guardando...' : 'Guardar'),
              status.value !== 'approved'
                ? h('button', { onClick: approve, disabled: saving.value || !planningId.value, class: 'bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition' }, 'Aprobar')
                : h('span', { class: 'bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium' }, '✓ Aprobada'),
            ]),
          ]),
        ],
      ]);
    };
  }
});

// ──────────── Router ────────────

function resolveRoute() {
  const hash = window.location.hash.slice(1) || '/';

  const routes = {
    '/': LandingPage,
    '/login': LoginPage,
    '/registro': RegisterPage,
    '/verificar-email': VerifyEmailPage,
    '/dashboard': DashboardPage,
    '/perfil': ProfilePage,
    '/nueva': WizardPage,
    '/planificacion/': PlanningDetailPage,
    '/privacidad': () => h(Layout, { title: 'Política de Privacidad' }, () => [
      h('div', { class: 'prose max-w-3xl text-sm space-y-3' }, [
        h('p', 'En PlanificaIA nos tomamos la privacidad muy en serio. No almacenamos datos personales de estudiantes.'),
        h('h3', 'Datos que recopilamos'), h('ul', [h('li', 'Correo y nombre (solo para tu cuenta)'), h('li', 'Preferencias de nivel y asignatura'), h('li', 'Contenido de planificaciones')]),
        h('h3', 'Datos que NO recopilamos'), h('ul', [h('li', 'No almacenamos nombres, RUT, correos ni diagnósticos de estudiantes'), h('li', 'No compartimos datos con terceros')]),
        h('h3', 'Proveedores de IA'), h('p', 'Las planificaciones se generan con DeepSeek (primario) y Gemini Flash (fallback). No se envían datos personales.'),
        h('h3', 'Tus derechos'), h('p', 'Puedes exportar y eliminar tus datos desde "Mi Perfil".'),
      ]),
    ]),
    '/terminos': () => h(Layout, { title: 'Términos de Uso' }, () => [
      h('div', { class: 'prose max-w-3xl text-sm space-y-3' }, [
        h('ul', [h('li', 'La IA genera borradores que requieren revisión y aprobación docente.'), h('li', 'El docente es responsable del contenido final.'), h('li', 'No debes ingresar datos personales de estudiantes.'), h('li', 'El uso es para fines educativos.')]),
      ]),
    ]),
  };

  // Check dynamic routes
  if (hash.startsWith('/planificacion/')) return routes['/planificacion/'];
  if (hash.startsWith('/editar/')) return ManualEditor;
  if (hash === '/nueva-manual') return ManualEditor;

  return routes[hash] || LandingPage;
}

// ──────────── App root ────────────

const App = defineComponent({
  setup() {
    const currentView = shallowRef(markRaw(resolveRoute()));
    const loading = ref(true);

    onAuthStateChanged(auth, async (user) => {
      store.user = user;
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) store.profile = snap.data();
        } catch (e) { /* ignore */ }
      } else {
        store.profile = null;
      }
      store.ready = true;
      loading.value = false;
      currentView.value = markRaw(resolveRoute());
    });

    window.addEventListener('hashchange', () => {
      currentView.value = markRaw(resolveRoute());
    });

    return { currentView, loading };
  },
  render() {
    if (this.loading) {
      return h('div', { class: 'flex items-center justify-center min-h-screen' }, [
        h('div', { class: 'text-center' }, [Spinner(10), h('p', { class: 'text-sm text-slate-400 mt-3' }, 'Cargando PlanificaIA...')]),
      ]);
    }
    return h(this.currentView);
  }
});

createApp(App).mount('#app');
