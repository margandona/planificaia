import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const snap = await db.collection('prompt-templates').where('status', '==', 'active').limit(1).get();
if (snap.empty) {
  console.log('No template found');
  process.exit(1);
}

const ref = snap.docs[0].ref;

const newUser = `Genera una planificacion de clase para el OA {{oaCode}}: {{oaText}}

Duracion: {{duration}} minutos
Modalidad: {{modality}}
Estudiantes: {{students}}
Conocimientos previos: {{priorKnowledge}}
Recursos disponibles: {{resources}}
Metodologia: {{methodology}}
Marco de inclusion: {{framework}}
Barreras observadas: {{barriers}}

{{dua}}

IMPORTANTE: Responde UNICAMENTE con un objeto JSON sin texto adicional, con EXACTAMENTE esta estructura (nombres de campos en ingles):

{
  "purpose": "string - proposito de la clase",
  "activities": [
    {
      "moment": "inicio" | "desarrollo" | "cierre",
      "title": "string",
      "description": "string",
      "duration": number (minutos, solo numeros),
      "keyQuestions": ["string"],
      "monitoringStrategy": "string",
      "evidence": "string"
    }
  ],
  "assessment": {
    "type": "formativa" | "sumativa",
    "criteria": ["string"],
    "feedbackStrategy": "string"
  },
  "differentiation": "string",
  "resources": ["string"],
  "dua": {
    "representacion": ["string - estrategia DUA para representacion"],
    "accionExpresion": ["string - estrategia DUA para accion y expresion"],
    "implicacion": ["string - estrategia DUA para implicacion"]
  }
}

Genera al menos 3 actividades: una de inicio, una o mas de desarrollo, y una de cierre. La suma de duracion de todas las actividades debe ser aproximadamente {{duration}} minutos. Los campos moment deben usar exactamente los valores: inicio, desarrollo, cierre (en minuscula). El campo duration debe ser un numero (no texto). Si el marco de inclusion es DUA, genera el objeto "dua" con estrategias concretas y factibles para ESTA clase. Si el marco es estandar, puedes omitir el campo dua.`;

await ref.update({ user: newUser, updatedAt: new Date().toISOString() });
console.log('Template actualizado correctamente');
process.exit(0);
