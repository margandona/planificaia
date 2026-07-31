const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.error('Falta DEEPSEEK_API_KEY (cargala desde functions/.env)');
  process.exit(1);
}

const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${KEY}`,
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'Eres un asistente pedagogico. Responde SIEMPRE en JSON valido.' },
      { role: 'user', content: 'Genera una planificacion de clase para OA HI07 OA 01 sobre hominizacion, 45 minutos. Devuelve JSON con: purpose, activities (array de objetos con moment, description, duration), assessment (con criteria array y feedbackStrategy), differentiation, resources.' },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  }),
});

const status = response.status;
const body = await response.text();
console.log('STATUS:', status);
console.log('BODY (first 1000):', body.slice(0, 1000));
