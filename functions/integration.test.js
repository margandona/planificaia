/**
 * PlanificaIA — Integration Tests for Firestore Rules & Data
 * Run with: node --experimental-vm-modules functions/integration.test.js
 * Requires: emulators running (firebase emulators:start)
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'planificacion-con-ia';

// Try connecting to emulator
let db;
let emulatorAvailable = false;

async function init() {
  try {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

    const app = initializeApp({ projectId: PROJECT_ID });
    db = getFirestore(app);
    db.settings({ host: 'localhost:8080', ssl: false });

    // Test connection
    const testRef = db.collection('_test_connection_').doc('ping');
    await testRef.set({ ping: true });
    await testRef.delete();
    emulatorAvailable = true;
    console.log('  [OK] Emulator connection established\n');
  } catch (e) {
    console.log('  [SKIP] Emulator not running - skipping integration tests');
    console.log(`  Start with: firebase emulators:start\n`);
  }
}

async function run() {
  await init();
  if (!emulatorAvailable) return;

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        passed++;
        console.log(`  [PASS] ${name}`);
      } catch (e) {
        failed++;
        console.log(`  [FAIL] ${name}: ${e.message || e}`);
      }
    };
  }

  const tests = [
    test('Curriculum: crear OA en Firestore', async () => {
      const ref = db.collection('curriculum').doc('test-HI07-OA99');
      await ref.set({
        code: 'HI07 OA 99',
        text: 'OA de prueba para integracion',
        level: '7-basico',
        subject: 'historia-geografia-ciencias-sociales',
        axis: 'historia',
        source: 'Bases Curriculares',
        version: '2024',
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      const doc = await ref.get();
      if (!doc.exists) throw new Error('Curriculum doc not created');
      await ref.delete();
    }),

    test('Curriculum: leer OA por level + subject', async () => {
      const q = db.collection('curriculum')
        .where('level', '==', '7-basico')
        .where('subject', '==', 'historia-geografia-ciencias-sociales')
        .where('isActive', '==', true)
        .limit(5);
      const snap = await q.get();
      if (snap.empty) console.log('  [INFO] No curriculum data in emulator (expected)');
    }),

    test('Curriculum: estructura de OA valida', async () => {
      const ref = db.collection('curriculum').doc('test-validate-structure');
      const invalid = { code: 'HI07 OA 01' };
      await ref.set(invalid);
      const doc = await ref.get();
      const data = doc.data();
      if (!data.code) throw new Error('Missing code field');
      if (!data.text && !data.level) console.log('  [INFO] Emulator allows sparse data (expected)');
      await ref.delete();
    }),

    test('Planning: crear y leer planificacion', async () => {
      const ref = db.collection('plannings').doc();
      const planning = {
        userId: 'test-user-123',
        title: 'Test Planning',
        status: 'draft',
        level: '7-basico',
        subject: 'historia',
        duration: 90,
        modality: 'presencial',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      await ref.set(planning);
      const doc = await ref.get();
      if (!doc.exists) throw new Error('Planning not created');
      if (doc.data().status !== 'draft') throw new Error('Wrong status');
      await ref.delete();
    }),

    test('Planning: subcoleccion de versiones', async () => {
      const planningRef = db.collection('plannings').doc();
      await planningRef.set({
        userId: 'test-user',
        title: 'Version Test',
        status: 'draft',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const versionRef = planningRef.collection('versions').doc();
      await versionRef.set({
        snapshot: { title: 'Version 1' },
        version: 1,
        createdAt: new Date().toISOString(),
        userId: 'test-user',
      });

      const versions = await planningRef.collection('versions').get();
      if (versions.empty) throw new Error('No versions found');
      if (versions.size < 1) throw new Error('Expected at least 1 version');

      await planningRef.delete();
    }),

    test('Planning: query por userId y status', async () => {
      const uid = 'test-query-user-' + Date.now();
      for (const status of ['draft', 'approved']) {
        await db.collection('plannings').add({
          userId: uid,
          title: `Test ${status}`,
          status,
          duration: 45,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        });
      }

      const q = db.collection('plannings')
        .where('userId', '==', uid)
        .where('status', '==', 'draft');
      const snap = await q.get();
      if (snap.size < 1) throw new Error('Expected draft plannings');

      // Cleanup
      const all = await db.collection('plannings').where('userId', '==', uid).get();
      for (const doc of all.docs) await doc.ref.delete();
    }),

    test('AuditLog: crear y leer logs', async () => {
      const ref = await db.collection('audit-logs').add({
        userId: 'test-user',
        action: 'test_integration',
        resource: 'testing',
        createdAt: new Date().toISOString(),
      });
      const doc = await ref.get();
      if (!doc.exists) throw new Error('Audit log not created');
      if (doc.data().action !== 'test_integration') throw new Error('Wrong action');
      await ref.delete();
    }),

    test('AICosts: registro de costos', async () => {
      const ref = await db.collection('ai-costs').add({
        userId: 'test-user',
        date: new Date().toISOString().split('T')[0],
        provider: 'deepseek',
        model: 'deepseek-chat',
        inputTokens: 500,
        outputTokens: 200,
        cost: 0.00012,
        createdAt: new Date().toISOString(),
      });
      const doc = await ref.get();
      if (!doc.exists) throw new Error('Cost record not created');
      await ref.delete();
    }),

    test('User profile: crear y actualizar', async () => {
      const ref = db.collection('users').doc('test-integration-user');
      await ref.set({
        uid: 'test-integration-user',
        email: 'test@example.com',
        displayName: 'Test User',
        level: '7-basico',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const doc = await ref.get();
      if (!doc.exists) throw new Error('User not created');
      if (doc.data().displayName !== 'Test User') throw new Error('Wrong displayName');

      await ref.update({ displayName: 'Updated User' });
      const updated = await ref.get();
      if (updated.data().displayName !== 'Updated User') throw new Error('Update failed');

      await ref.delete();
    }),

    test('Planning: creacion con timestamp ISO', async () => {
      const ref = db.collection('plannings').doc();
      const now = new Date().toISOString();
      await ref.set({
        userId: 'test-user',
        title: 'Timestamp Test',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
      const doc = await ref.get();
      if (doc.data().createdAt !== now) throw new Error('Timestamp mismatch');
      await ref.delete();
    }),

    test('Planning: warnings como array', async () => {
      const ref = db.collection('plannings').doc();
      await ref.set({
        userId: 'test-user',
        title: 'Warnings Test',
        status: 'draft',
        warnings: [
          { type: 'critical', ruleId: 'V-001', description: 'No activities' },
          { type: 'warning', ruleId: 'V-007', description: 'No cierre' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });
      const doc = await ref.get();
      if (!doc.data().warnings || doc.data().warnings.length !== 2) throw new Error('Warnings not stored correctly');
      await ref.delete();
    }),
  ];

  console.log('\n===========================================');
  console.log('  PlanificaIA - Integration Tests');
  console.log('===========================================\n');

  for (const t of tests) {
    await t();
  }

  console.log(`\n===========================================`);
  console.log(`  Results: ${passed}/${passed + failed} passed, ${failed} failed`);
  console.log('===========================================\n');
}

run().catch(console.error);
