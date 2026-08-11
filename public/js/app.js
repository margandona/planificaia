import { createApp, ref, reactive, computed, onMounted, defineComponent, h, markRaw, shallowRef, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, updateProfile, onAuthStateChanged, getIdTokenResult, collection, query, where, orderBy, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, limit, serverTimestamp, DEFAULT_SUBJECTS, PLANS, planLabel, store, auth, db, fx, LEVELS, LEVELS_BASICA, LEVELS_MEDIA, levelLabel, subjectLabel, activeSubjects, loadSubjectCatalog, go, guard, redirectAuth, mapError, Spinner, Alert, EmptyState, PageTitle, Card, Layout, perfTrace, reportError, generatePlanningFn, regenerateSectionFn, approvePlanningFn, exportPlanningFn, submitFeedbackFn, setUserRoleFn, createOrganizationFn, inviteMemberFn, acceptInviteFn, removeMemberFn, acceptTermsFn, setUserPlanFn, TERMS_VERSION, PRIVACY_VERSION, hasAcceptedTerms, isAdmin, isOrgAdmin } from './core.js';

// Páginas ligeras (carga inicial). Las páginas pesadas viven en /js/pages/*.js
// y se cargan con import() dinámico (S-5.4).
const LandingPage = defineComponent({
  setup() {
    if (redirectAuth()) return () => null;
    return () => h(Layout, () => [
      h('div', { class: 'text-center py-16' }, [
        h('h1', { class: 'text-5xl font-bold text-slate-900 mb-3' }, 'PlanificaIA'),
        h('p', { class: 'text-xl text-slate-500 max-w-xl mx-auto mb-6' }, 'Generador ético de planificaciones educativas asistido por inteligencia artificial'),
        h('p', { class: 'text-base text-slate-500 italic mb-8' }, 'La IA propone, el sistema verifica y el docente decide.'),
        h('div', { class: 'flex justify-center gap-3' }, [
          store.user
            ? h('a', { href: '#/dashboard', class: 'bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition' }, 'Ir al Dashboard')
            : h('a', { href: '#/registro', class: 'bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition' }, 'Comenzar gratis'),
          h('a', { href: '#/login', class: 'bg-white text-slate-700 px-6 py-2.5 rounded-lg font-medium border border-slate-300 hover:bg-slate-50 transition' }, 'Iniciar sesión'),
        ]),
      ]),
      h('div', { class: 'grid md:grid-cols-3 gap-6 max-w-4xl mx-auto pb-16' }, [
        Card([h('div', { class: 'p-6' }, [
          h('div', { class: 'text-3xl mb-3', 'aria-hidden': 'true' }, '🎯'),
          h('h3', { class: 'font-semibold mb-1' }, 'Alineación Curricular'),
          h('p', { class: 'text-sm text-slate-500' }, 'OA desde el currículum oficial chileno. La IA nunca modifica el texto oficial.'),
        ])]),
        Card([h('div', { class: 'p-6' }, [
          h('div', { class: 'text-3xl mb-3', 'aria-hidden': 'true' }, '👩‍🏫'),
          h('h3', { class: 'font-semibold mb-1' }, 'Control Docente'),
          h('p', { class: 'text-sm text-slate-500' }, 'Tú decides. Edita, regenera por secciones y aprueba antes de exportar.'),
        ])]),
        Card([h('div', { class: 'p-6' }, [
          h('div', { class: 'text-3xl mb-3', 'aria-hidden': 'true' }, '🔒'),
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
        const now = new Date().toISOString();
        await setDoc(doc(db, 'users', cred.user.uid), { uid: cred.user.uid, email: f.email, displayName: f.displayName, level: f.level, institutionType: f.institutionType, termsVersion: TERMS_VERSION, termsAcceptedAt: now, privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: now, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1', for: 'reg-level' }, 'Nivel'), h('select', { id: 'reg-level', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', onInput: (e) => f.level = e.target.value }, [h('option', { value: '', disabled: true }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))])]),
          ]),
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Correo'), h('input', { type: 'email', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'docente@ejemplo.cl', onInput: (e) => f.email = e.target.value })]),
          h('div', { class: 'grid grid-cols-2 gap-3' }, [
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Contraseña'), h('input', { type: 'password', required: true, minLength: 6, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'Mín. 6 caracteres', onInput: (e) => f.password = e.target.value })]),
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1' }, 'Confirmar'), h('input', { type: 'password', required: true, class: 'w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none', placeholder: 'Repite', onInput: (e) => f.confirm = e.target.value })]),
          ]),
          h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1', for: 'reg-institution' }, 'Establecimiento (opcional)'), h('select', { id: 'reg-institution', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', onInput: (e) => f.institutionType = e.target.value }, ...institutions.map(([v, l]) => h('option', { value: v }, l)))]),
          h('label', { class: 'flex items-start gap-2 text-xs text-slate-500 cursor-pointer' }, [
            h('input', { type: 'checkbox', class: 'mt-0.5', onChange: (e) => f.acceptTerms = e.target.checked }),
            h('span', ['Acepto la ', h('a', { href: '#/privacidad', class: 'text-blue-600 hover:underline', onClick: (e) => e.stopPropagation() }, 'política de privacidad'), ' y los ', h('a', { href: '#/terminos', class: 'text-blue-600 hover:underline', onClick: (e) => e.stopPropagation() }, 'términos de uso'), ` (versión ${TERMS_VERSION})`]),
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
        h('button', { type: 'button', onClick: send, disabled: loading.value, class: 'w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, loading.value ? 'Enviando...' : 'Reenviar verificación'),
        h('button', { type: 'button', onClick: check, class: 'w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition' }, 'Ya verifiqué mi correo'),
        resent.value ? h('p', { class: 'text-xs text-green-600 mt-2' }, '✓ Correo reenviado') : null,
      ]),
      h('button', { type: 'button', onClick: () => { signOut(auth); go('/login'); }, class: 'mt-6 text-xs text-slate-400 hover:text-slate-600 underline' }, 'Volver al inicio de sesión'),
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
          h('button', { type: 'button', class: `px-3 py-1 rounded-full text-sm ${filter.value === v ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`, onClick: () => filter.value = v }, l)
        )),
        h('div', { class: 'flex gap-2' }, [
          h('a', { href: '#/nueva', class: 'bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition' }, '+ Con IA'),
          h('a', { href: '#/nueva-manual', class: 'bg-white text-blue-600 border border-blue-300 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition' }, '+ Manual'),
        ]),
      ]),
      !loading.value && plans.value.length === 0 ? Card([h('div', { class: 'p-5 flex flex-col md:flex-row md:items-center gap-4' }, [
        h('div', { class: 'text-3xl', 'aria-hidden': 'true' }, '🚀'),
        h('div', { class: 'flex-1' }, [
          h('h3', { class: 'font-semibold text-slate-800 mb-1' }, 'Primeros pasos'),
          h('p', { class: 'text-sm text-slate-500' }, 'Crea tu primera planificación con IA o revisa la guía rápida de ayuda.'),
          h('div', { class: 'flex gap-2 mt-2' }, [
            h('a', { href: '#/ayuda', class: 'text-sm text-blue-600 hover:underline' }, 'Ver Ayuda y tutoriales'),
          ]),
        ]),
      ])]) : null,
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

    const myPlan = computed(() => (store.profile?.plan === 'pro' ? 'pro' : 'free'));
    const newPlan = ref(myPlan.value);
    const setPlan = async () => {
      saving.value = true; error.value = ''; success.value = '';
      try {
        await setUserPlanFn({ targetUid: store.user.uid, plan: newPlan.value });
        if (store.profile) store.profile.plan = newPlan.value; else store.profile = { plan: newPlan.value };
        success.value = `Plan actualizado a ${PLANS[newPlan.value].label}`;
      } catch (e) { error.value = e.message === 'ACCESO_NO_AUTORIZADO' ? 'No tienes permisos para cambiar planes.' : 'Error al actualizar el plan'; } finally { saving.value = false; }
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
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1', for: 'perfil-nivel' }, 'Nivel'), h('select', { id: 'perfil-nivel', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', value: form.level, onInput: (e) => form.level = e.target.value }, [h('option', { value: '' }, 'Selecciona...'), ...levels.map(([v, l]) => h('option', { value: v }, l))])]),
            h('div', [h('label', { class: 'block text-sm font-medium text-slate-700 mb-1', for: 'perfil-institucion' }, 'Establecimiento'), h('select', { id: 'perfil-institucion', class: 'w-full border border-slate-300 rounded-lg px-3 py-2', value: form.institutionType, onInput: (e) => form.institutionType = e.target.value }, [['', 'Selecciona...'], ['municipal', 'Municipal'], ['subvencionado', 'Subvencionado'], ['particular', 'Particular'], ['otro', 'Otro']].map(([v, l]) => h('option', { value: v }, l)))])]),
          h('button', { type: 'submit', disabled: saving.value, class: 'bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, saving.value ? 'Guardando...' : 'Guardar cambios'),
        ])]),
      h('div', { class: 'mt-6' }, Card([h('div', { class: 'p-6' }, [
        h('div', { class: 'flex items-center gap-2 mb-1' }, [
          h('h3', { class: 'text-base font-semibold text-slate-800' }, 'Mi Plan'),
          h('span', { class: 'text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium' }, planLabel()),
        ]),
        h('p', { class: 'text-sm text-slate-500 mb-3' }, `Límite diario: ${PLANS[myPlan.value].dailyGenerations} generaciones con IA. El plan Pro está pensado para equipos e instituciones (piloto).`),
        isAdmin() ? h('div', { class: 'flex items-center gap-2' }, [
          h('label', { class: 'sr-only', for: 'perfil-plan' }, 'Seleccionar plan'),
          h('select', { id: 'perfil-plan', value: newPlan.value, onInput: (e) => newPlan.value = e.target.value, class: 'w-48 border border-slate-300 rounded-lg px-3 py-2' }, [h('option', { value: 'free' }, 'Gratis (10/día)'), h('option', { value: 'pro' }, 'Pro (1000/día)')]),
          h('button', { type: 'button', onClick: setPlan, disabled: saving.value, class: 'bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, 'Cambiar plan'),
        ]) : h('p', { class: 'text-xs text-slate-400' }, 'Para el plan Pro institucional, contacta a hola@planificaia.cl.'),
      ])])),
      h('div', { class: 'mt-6' }, Card([h('div', { class: 'p-6' }, [
        h('h3', { class: 'text-base font-semibold text-red-600 mb-1' }, 'Eliminar cuenta'),
        h('p', { class: 'text-sm text-slate-500 mb-3' }, 'Exportaremos tus planificaciones antes de eliminar. Esta acción no se puede deshacer.'),
        h('button', { type: 'button', onClick: deleteAccount, disabled: saving.value, class: 'bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition' }, 'Eliminar mi cuenta'),
      ])])),
    ]);
  }
});

// ──────────── Onboarding / Ayuda (S-7) ────────────

const HelpSection = (heading, children) => h('section', { class: 'space-y-2' }, [
  h('h3', { class: 'text-base font-semibold text-slate-800' }, heading),
  ...children,
]);

const AyudaPage = () => h(Layout, { title: 'Ayuda y Primeros Pasos' }, () => [
  h('div', { class: 'max-w-3xl text-sm text-slate-600 space-y-8' }, [
    HelpSection('1. Crea tu primera planificación', [
      h('p', 'Ingresa a "Dashboard" y pulsa "+ Con IA". El asistente te guía en 10 pasos: tipo de planificación, nivel, asignatura, objetivos de aprendizaje, contexto, metodología, estructura, evaluación e inclusión. Al final se genera un borrador que puedes editar, regenerar por secciones y aprobar.'),
      h('p', ['Tip: en el paso 2 puedes filtrar los OA por eje/unidad y buscar por texto o código con la barra de búsqueda.',]),
    ]),
    HelpSection('2. Tipos de planificación', [
      h('ul', { class: 'list-disc list-inside space-y-1' }, [
        h('li', 'Clase: una sesión (inicio, desarrollo, cierre).'),
        h('li', 'Unidad didáctica: 4 a 8 clases con secuencia y evaluación.'),
        h('li', 'Mensual: semanas y distribución de OA.'),
        h('li', 'Anual: meses y cobertura del año lectivo.'),
        h('li', 'Evaluación: instrumentos, rúbricas e indicadores (Decreto 67).'),
        h('li', 'Multigrado: combina dos niveles en una misma planificación.'),
      ]),
    ]),
    HelpSection('3. Uso ético de la IA', [
      h('p', 'La IA propone, el sistema verifica y el docente decide. Las planificaciones son borradores que debes revisar, adaptar a tu contexto y aprobar antes de usar. No ingreses datos personales de estudiantes.'),
    ]),
    HelpSection('4. Colabora con tu equipo', [
      h('p', 'Si tu establecimiento usa PlanificaIA, crea o únete a un colegio desde "Institucional": podrás invitar docentes, revisar la biblioteca compartida y aprobar planificaciones como UTP (coordinador).'),
    ]),
    HelpSection('5. Preguntas frecuentes', [
      h('ul', { class: 'list-disc list-inside space-y-1' }, [
        h('li', '¿Puedo exportar? Sí, cada planificación se exporta a PDF y DOCX con la declaración de IA.'),
        h('li', '¿Límite diario? El plan Gratis permite 10 generaciones diarias; el Pro, 1000.'),
        h('li', '¿Cómo recupero mi contraseña? En "Iniciar sesión" pulsa "¿Olvidaste tu contraseña?".'),
      ]),
    ]),
  ]),
]);

// ──────────── Páginas legales (S-6: Ley 19.628 / Ley 21.719, RF-013) ────────────

const Legal = (title, version, children) => h(Layout, { title }, () => [
  h('div', { class: 'max-w-3xl text-sm text-slate-600 space-y-6' }, [
    h('p', { class: 'text-xs text-slate-500' }, `Versión ${version} · Última actualización: 31 de julio de 2026`),
    ...children,
  ]),
]);

const PrivacyPage = () => Legal('Política de Privacidad', PRIVACY_VERSION, [
  h('p', 'En PlanificaIA nos tomamos la privacidad muy en serio. Esta política explica qué datos tratamos, para qué y tus derechos. Es conforme a la Ley 19.628 (texto vigente) y está diseñada para cumplir la Ley 21.719, que entrará en vigencia el 01/12/2026.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '1. Responsable del tratamiento'),
  h('p', 'PlanificaIA (MaKuaZ) es el responsable del tratamiento de los datos personales recopilados en esta plataforma. Consultas: privacidad@planificaia.cl.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '2. Datos que recopilamos y para qué'),
  h('ul', { class: 'list-disc list-inside space-y-1' }, [
    h('li', 'Correo y nombre: creación de la cuenta y comunicación de tu cuenta.'),
    h('li', 'Preferencias: nivel educativo y tipo de establecimiento, para mejorar tu experiencia.'),
    h('li', 'Contenido de planificaciones: el trabajo que creas, almacenado en tu cuenta.'),
    h('li', 'Datos de uso técnico: trazas de rendimiento y registros de error, sin datos personales identificables.'),
  ]),
  h('p', 'La base legal del tratamiento es la ejecución del contrato de servicio y tu consentimiento expreso al aceptar estos términos y esta política.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '3. Datos que NO recopilamos'),
  h('ul', { class: 'list-disc list-inside space-y-1' }, [
    h('li', 'No tratamos datos de estudiantes: ni nombres, RUT, correos, diagnósticos clínicos, calificaciones ni fotografías.'),
    h('li', 'No tratamos datos sensibles (salud, biometría, opiniones políticas).'),
    h('li', 'El diseño del producto lo impide y el sistema filtra datos personales en los envíos a los proveedores de IA.'),
  ]),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '4. Tratamiento y cesión'),
  h('p', 'No vendemos ni cedemos tus datos a terceros. Para generar planificaciones enviamos el contexto pedagógico (nivel, asignatura, objetivos, contexto de tu curso) a proveedores de IA: DeepSeek (primario) y Gemini Flash de Google (respaldo). No se incluyen datos personales identificables.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '5. Retención de datos'),
  h('ul', { class: 'list-disc list-inside space-y-1' }, [
    h('li', 'Perfil de usuario: mientras la cuenta esté activa, más 90 días.'),
    h('li', 'Planificaciones: mientras exista la cuenta.'),
    h('li', 'Trazabilidad y costos de IA: 2 años.'),
    h('li', 'Logs de auditoría y de error: 1 año.'),
  ]),
  h('p', 'Los datos vencidos se eliminan automáticamente mediante una tarea programada diaria.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '6. Tus derechos'),
  h('p', 'Tienes derecho de acceso, rectificación, supresión, oposición y portabilidad sobre tus datos. Puedes ejercerlos desde "Mi Perfil" (exportar y eliminar tus datos) o escribiendo a privacidad@planificaia.cl.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '7. Seguridad'),
  h('p', 'Usamos cifrado en tránsito (HTTPS), reglas de seguridad de acceso por propietario y acceso restringido a los datos por parte del equipo. Los datos se alojan en infraestructura de Google Cloud (región us-central1).'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '8. Delegado de Protección de Datos'),
  h('p', 'De acuerdo con el artículo 50 de la Ley 21.719, si el volumen de datos lo exige se designará un Delegado de Protección de Datos antes de la vigencia de esa ley (01/12/2026). Contacto del responsable: privacidad@planificaia.cl.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '9. Menores de 16 años'),
  h('p', 'El servicio está dirigido a docentes y personal educativo. No está dirigido a menores de 16 años y no debes ingresar datos de estudiantes en ningún campo.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '10. Cambios a esta política'),
  h('p', 'Esta política es versionada. Si se publica una versión nueva con cambios relevantes, te solicitaremos su aceptación antes de continuar usando el servicio.'),
]);

const TermsPage = () => Legal('Términos de Uso', TERMS_VERSION, [
  h('p', 'Estos Términos de Uso regulan el acceso y uso de PlanificaIA, un generador de planificaciones educativas asistido por inteligencia artificial, alineado al currículum chileno. Al crear una cuenta aceptas estos términos.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '1. Aceptación y versionado'),
  h('p', 'Al registrarte aceptas esta versión de los términos. Los términos son vinculantes y versionados; si publicamos una versión nueva te pediremos aceptación antes de continuar.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '2. El servicio'),
  h('p', 'PlanificaIA genera borradores de planificaciones de clase, unidad, mensuales, anuales, evaluaciones y multigrado, usando el currículum oficial del Ministerio de Educación de Chile.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '3. Inteligencia artificial y supervisión humana'),
  h('p', 'Las planificaciones se generan con modelos de IA (DeepSeek primario, Gemini Flash de respaldo). Todo contenido generado es un borrador: la IA propone, el sistema verifica y el docente decide.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '4. Responsabilidad del docente'),
  h('p', 'El docente es responsable del contenido final de sus planificaciones y debe revisarlas, adaptarlas a su contexto y aprobarlas antes de usarlas. El contenido generado no reemplaza el criterio profesional.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '5. Datos de estudiantes'),
  h('p', 'Queda estrictamente prohibido ingresar datos personales de estudiantes (nombres, RUT, correos, diagnósticos, calificaciones u otros) en la plataforma. El incumplimiento puede conllevar la suspensión de la cuenta.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '6. Cuentas'),
  h('p', 'Debes mantener seguras tus credenciales y eres responsable de la actividad de tu cuenta. Puedes eliminar tu cuenta y tus datos en cualquier momento desde "Mi Perfil".'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '7. Contenido curricular'),
  h('p', 'Los textos oficiales del currículum se usan con fines educativos y pertenecen a sus titulares (Ministerio de Educación de Chile). No se reutilizan como obra propia ni se redistribuyen fuera de la plataforma.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '8. Propiedad intelectual del usuario'),
  h('p', 'Tus planificaciones te pertenecen. Puedes exportarlas (PDF, DOCX) y conservarlas fuera de la plataforma.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '9. Limitación de responsabilidad'),
  h('p', 'El servicio se entrega "tal cual". No garantizamos disponibilidad ininterrumpida ni exactitud total del contenido generado. El uso es bajo tu responsabilidad y conforme a la normativa educacional vigente.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '10. Cambios a los términos'),
  h('p', 'Podemos actualizar estos términos con aviso previo mediante una nueva versión que deberás aceptar. La versión vigente es siempre la más reciente publicada en esta página.'),
  h('h3', { class: 'text-base font-semibold text-slate-800' }, '11. Contacto'),
  h('p', 'Consultas: hola@planificaia.cl · Privacidad: privacidad@planificaia.cl.'),
]);

// ──────────── Modal de re-consentimiento (RF-013) ────────────

const TermsConsentModal = defineComponent({
  setup() {
    const error = ref(''); const loading = ref(false);
    const accept = async () => {
      loading.value = true; error.value = '';
      try {
        await acceptTermsFn({ version: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
        if (store.profile) { store.profile.termsVersion = TERMS_VERSION; store.profile.privacyVersion = PRIVACY_VERSION; }
        else { store.profile = { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }; }
      } catch (e) { error.value = 'No se pudo registrar la aceptación. Reintenta.'; } finally { loading.value = false; }
    };
    return () => h('div', { class: 'fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'consent-title' }, [
      h('div', { class: 'bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6' }, [
        h('h2', { id: 'consent-title', class: 'text-lg font-bold text-slate-900 mb-2' }, 'Términos actualizados'),
        h('p', { class: 'text-sm text-slate-600 mb-4' }, `Publicamos una nueva versión de nuestros Términos de Uso y Política de Privacidad (versión ${TERMS_VERSION}). Para continuar usando PlanificaIA, debes leer y aceptar la nueva versión.`),
        h('div', { class: 'flex gap-3 mb-4 text-sm' }, [
          h('a', { href: '#/terminos', class: 'text-blue-600 hover:underline' }, 'Leer Términos de Uso'),
          h('a', { href: '#/privacidad', class: 'text-blue-600 hover:underline' }, 'Leer Política de Privacidad'),
        ]),
        h('div', { role: 'alert' }, [Alert('error', error.value)]),
        h('button', { onClick: accept, disabled: loading.value, class: 'w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition' }, loading.value ? 'Guardando...' : 'He leído y acepto la nueva versión'),
      ]),
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
  if (hash === '/gamificaciones') return (await import('./pages/gamificaciones.js')).GamificacionesPage;
  if (hash === '/prompts-externos') return (await import('./pages/externos.js')).ExternalPromptsPage;
  if (hash.startsWith('/participar/')) return (await import('./pages/participar.js')).ParticipatePage;

  const routes = {
    '/': LandingPage,
    '/login': LoginPage,
    '/registro': RegisterPage,
    '/verificar-email': VerifyEmailPage,
    '/dashboard': DashboardPage,
    '/perfil': ProfilePage,
    '/ayuda': AyudaPage,
    '/privacidad': PrivacyPage,
    '/terminos': TermsPage,
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
    if (store.user && store.user.emailVerified && !hasAcceptedTerms()) {
      return h(TermsConsentModal);
    }
    return h(this.currentView);
  }
});

createApp(App).mount('#app');
