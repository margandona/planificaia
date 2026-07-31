import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const snap = await db.collection('curriculum')
  .where('level', '==', '7-basico')
  .where('subject', '==', 'historia-geografia-ciencias-sociales')
  .orderBy('code')
  .get();

const oas = snap.docs.filter(d => !d.data().type);
const codes = [...new Set(oas.map(d => d.data().code))];
console.log(`Query OK: ${codes.length} OA unicos`);
console.log('Duplicados:', oas.length - codes.length, 'documentos extras');

if (oas.length > codes.length) {
  // Delete duplicates, keep first of each code
  const seen = new Set();
  let deleted = 0;
  for (const doc of snap.docs) {
    const code = doc.data().code;
    if (doc.data().type) continue;
    if (seen.has(code)) {
      await doc.ref.delete();
      deleted++;
    } else {
      seen.add(code);
    }
  }
  console.log(`Limpieza: ${deleted} OA duplicados eliminados`);

  // Also clean skills and attitudes
  for (const doc of snap.docs) {
    const type = doc.data().type;
    if (!type) continue;
    const key = type + ':' + doc.data().code;
    if (seen.has(key)) {
      await doc.ref.delete();
    } else {
      seen.add(key);
    }
  }
}

process.exit(0);
