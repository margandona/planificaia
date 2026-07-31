const res = await fetch('https://www.curriculumnacional.cl/curriculum/1o-6o-basico/matematica/5-basico', { headers: { 'User-Agent': 'Mozilla/5.0' } });
console.log('Status:', res.status);
const html = await res.text();
console.log('HTML length:', typeof html, html.length);
console.log('First 300 chars:', html.slice(0, 300));
