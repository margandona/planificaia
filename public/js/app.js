import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, isAdmin, isOrgAdmin } from './core.js';

// Páginas ligeras (carga inicial). Las páginas pesadas viven en /js/pages/*.js
// y se cargan con import() dinámico (S-5.4).
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
    const teamPlans = ref([]); const teamLoading = ref(false);

    const load = async () => {
      loading.value = true;
      try {
        const q = query(collection(db, 'plannings'), where('userId', '==', store.user.uid), orderBy('createdAt', 'desc'), limit(20));
        plans.value = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        store.plannings = plans.value;
      } catch (e) { console.error(e); } finally { loading.value = false; }
    };
    const loadTeam = async () => {
      if (!store.org) return;
      teamLoading.value = true;
      try {
        const q = query(collection(db, 'plannings'), where('orgId', '==', store.org.id), where('userId', '!=', store.user.uid), orderBy('createdAt', 'desc'), limit(20));
        teamPlans.value = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error(e); } finally { teamLoading.value = false; }
    };
    onMounted(() => { load(); loadTeam(); });

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
                    h('span', { class: 'text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full' }, ({ class: 'Clase', unit: 'Unidad', monthly: 'Mensual', annual: 'Anual', evaluation: 'Evaluación', multigrade: 'Multigrado' })[p.type] || 'Clase'),
                    p.warnings?.length > 0 ? h('span', { class: `text-xs px-1.5 py-0.5 rounded-full ${p.warnings.some(w => w.type === 'critical') ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}` }, `${p.warnings.length} adv`) : null,
                  ]),
                  h('p', { class: 'text-xs text-slate-400' }, `${p.levels?.length ? p.levels.map(l => levelLabel(l)).join(' + ') : (p.level || '')} · ${p.type === 'annual' ? 'año lectivo' : (p.duration + ' min')} · ${new Date(p.createdAt).toLocaleDateString('es-CL')}`),
                ]),
                statusBadge(p.status),
              ]),
            ])
          )),
        store.org && teamPlans.value.length > 0 ? Card([h('div', { class: 'p-5' }, [
          h('div', { class: 'flex items-center justify-between mb-3' }, [
            h('h3', { class: 'font-medium text-sm text-slate-700' }, '📚 Biblioteca compartida'),
            h('a', { href: '#/institucional', class: 'text-xs text-blue-600 hover:underline' }, 'Ver institucional'),
          ]),
          h('div', { class: 'grid gap-2' }, teamPlans.value.map(p =>
            h('a', { href: `#/planificacion/${p.id}`, class: 'block bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-blue-300 transition' }, [
              h('div', { class: 'flex items-center justify-between gap-2' }, [
                h('span', { class: 'text-sm font-medium text-slate-800 truncate' }, p.title || 'Sin título'),
                statusBadge(p.status),
              ]),
              h('p', { class: 'text-xs text-slate-400 mt-1' }, `de ${p.userName || p.userId} · ${p.levels?.length ? p.levels.map(l => levelLabel(l)).join(' + ') : (p.level || '')}`),
            ])
          )),
        ])]) : null,
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

// ──────────── Router ────────────

async function resolveRoute() {
  const hash = window.location.hash.slice(1) || '/';

  // Rutas con carga diferida (S-5.4): se importan solo al navegar.
  if (hash === '/nueva') return (await import('./pages/wizard.js')).WizardPage;
  if (hash.startsWith('/planificacion/')) return (await import('./pages/detail.js')).PlanningDetailPage;
  if (hash.startsWith('/editar/')) return (await import('./pages/editor.js')).ManualEditor;
  if (hash === '/nueva-manual') return (await import('./pages/editor.js')).ManualEditor;
  if (hash.startsWith('/unirme/')) return (await import('./pages/institucional.js')).JoinOrgPage;
  if (hash === '/institucional') return (await import('./pages/institucional.js')).InstitucionalPage;

  const routes = {
    '/': LandingPage,
    '/login': LoginPage,
    '/registro': RegisterPage,
    '/verificar-email': VerifyEmailPage,
    '/dashboard': DashboardPage,
    '/perfil': ProfilePage,
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

  return routes[hash] || LandingPage;
}

// ──────────── App root ────────────

const App = defineComponent({
  setup() {
    const currentView = shallowRef(null);
    const loading = ref(true);
    const bootTrace = perfTrace('planificacion_carga_inicial');
    if (bootTrace) bootTrace.start();

    const loadRoute = async () => {
      try {
        currentView.value = markRaw(await resolveRoute());
      } catch (e) {
        reportError('route_error', { message: e.message, code: 'route' }, e);
        currentView.value = markRaw(LandingPage);
      }
    };

    onAuthStateChanged(auth, async (user) => {
      store.user = user;
      store.claims = null;
      store.org = null;
      store.orgRole = null;
      if (user) {
        try {
          const idToken = await getIdTokenResult(user);
          store.claims = idToken.claims;
        } catch (e) { /* ignore */ }
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) store.profile = snap.data();
          const orgId = snap.exists() ? snap.data().orgId : null;
          if (orgId) {
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            if (orgSnap.exists()) {
              store.org = { id: orgSnap.id, ...orgSnap.data() };
              const memberSnap = await getDoc(doc(db, 'organizations', orgId, 'members', user.uid));
              if (memberSnap.exists()) store.orgRole = memberSnap.data().role;
            }
          }
        } catch (e) { /* ignore */ }
      } else {
        store.profile = null;
      }
      store.ready = true;
      await loadRoute();
      loading.value = false;
      if (bootTrace) { bootTrace.putAttribute('autenticado', user ? 'true' : 'false'); try { bootTrace.stop(); } catch (te) { /* ignore */ } }
    });

    window.addEventListener('hashchange', () => { loadRoute(); });

    return { currentView, loading };
  },
  render() {
    if (this.loading || !this.currentView) {
      return h('div', { class: 'flex items-center justify-center min-h-screen' }, [
        h('div', { class: 'text-center' }, [Spinner(10), h('p', { class: 'text-sm text-slate-400 mt-3' }, 'Cargando PlanificaIA...')]),
      ]);
    }
    return h(this.currentView);
  }
});

createApp(App).mount('#app');
