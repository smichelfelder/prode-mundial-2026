import { Redis } from '@upstash/redis';

const kv = new Redis({
  url:   process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PLAYERS = ['Alex','David','Mati','Montse','Paco','Pau','Pepe','Santi','Steph'];

// Horarios de los partidos (UTC). Debe mantenerse en sync con MATCH_DATES de index.html.
const MATCH_DATES = {
  1:"2026-06-11T19:00Z",2:"2026-06-12T02:00Z",3:"2026-06-12T19:00Z",
  4:"2026-06-13T01:00Z",5:"2026-06-13T19:00Z",6:"2026-06-13T22:00Z",
  7:"2026-06-14T01:00Z",8:"2026-06-14T04:00Z",9:"2026-06-14T17:00Z",
  10:"2026-06-14T20:00Z",11:"2026-06-14T23:00Z",12:"2026-06-15T02:00Z",
  13:"2026-06-15T16:00Z",14:"2026-06-15T19:00Z",15:"2026-06-15T22:00Z",
  16:"2026-06-16T01:00Z",17:"2026-06-16T19:00Z",18:"2026-06-16T22:00Z",
  19:"2026-06-17T01:00Z",20:"2026-06-17T04:00Z",21:"2026-06-17T17:00Z",
  22:"2026-06-17T20:00Z",23:"2026-06-17T23:00Z",24:"2026-06-18T02:00Z",
  25:"2026-06-18T16:00Z",26:"2026-06-18T19:00Z",27:"2026-06-18T22:00Z",
  28:"2026-06-19T01:00Z",29:"2026-06-19T19:00Z",30:"2026-06-19T22:00Z",
  31:"2026-06-20T00:30Z",32:"2026-06-20T03:00Z",33:"2026-06-20T17:00Z",
  34:"2026-06-20T20:00Z",35:"2026-06-21T00:00Z",36:"2026-06-21T04:00Z",
  37:"2026-06-21T16:00Z",38:"2026-06-21T19:00Z",39:"2026-06-21T22:00Z",
  40:"2026-06-22T01:00Z",41:"2026-06-22T17:00Z",42:"2026-06-22T21:00Z",
  43:"2026-06-23T00:00Z",44:"2026-06-23T03:00Z",45:"2026-06-23T17:00Z",
  46:"2026-06-23T20:00Z",47:"2026-06-23T23:00Z",48:"2026-06-24T02:00Z",
  49:"2026-06-24T19:00Z",50:"2026-06-24T19:00Z",51:"2026-06-24T22:00Z",
  52:"2026-06-24T22:00Z",53:"2026-06-25T01:00Z",54:"2026-06-25T01:00Z",
  55:"2026-06-25T20:00Z",56:"2026-06-25T20:00Z",57:"2026-06-25T23:00Z",
  58:"2026-06-25T23:00Z",59:"2026-06-26T02:00Z",60:"2026-06-26T02:00Z",
  61:"2026-06-26T19:00Z",62:"2026-06-26T19:00Z",63:"2026-06-27T00:00Z",
  64:"2026-06-27T00:00Z",65:"2026-06-27T03:00Z",66:"2026-06-27T03:00Z",
  67:"2026-06-27T21:00Z",68:"2026-06-27T21:00Z",69:"2026-06-27T23:30Z",
  70:"2026-06-27T23:30Z",71:"2026-06-28T02:00Z",72:"2026-06-28T02:00Z",
  73:"2026-06-28T19:00Z",74:"2026-06-29T17:00Z",75:"2026-06-29T20:30Z",
  76:"2026-06-30T01:00Z",77:"2026-06-30T17:00Z",78:"2026-06-30T21:00Z",
  79:"2026-07-01T01:00Z",80:"2026-07-01T16:00Z",81:"2026-07-01T20:00Z",
  82:"2026-07-02T19:00Z",83:"2026-07-02T23:00Z",84:"2026-07-03T00:00Z",
  85:"2026-07-03T03:00Z",86:"2026-07-03T18:00Z",87:"2026-07-03T22:00Z",
  88:"2026-07-04T01:30Z",
  89:"2026-07-04T18:00Z",90:"2026-07-04T22:00Z",
  91:"2026-07-05T18:00Z",92:"2026-07-05T22:00Z",
  93:"2026-07-06T18:00Z",94:"2026-07-06T22:00Z",
  95:"2026-07-07T18:00Z",96:"2026-07-07T22:00Z",
  97:"2026-07-09T20:00Z",98:"2026-07-10T20:00Z",
  99:"2026-07-11T18:00Z",100:"2026-07-11T22:00Z",
  101:"2026-07-14T20:00Z",102:"2026-07-15T20:00Z",
  103:"2026-07-18T18:00Z",104:"2026-07-19T19:00Z"
};

// Los pronósticos de un partido se revelan al público 30 minutos antes del inicio.
const REVEAL_BUFFER_MS = 30 * 60 * 1000;
function isMatchRevealed(matchNum) {
  const iso = MATCH_DATES[matchNum];
  if (!iso) return false; // sin fecha (TBD) → permanece oculto
  return Date.now() >= new Date(iso).getTime() - REVEAL_BUFFER_MS;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const all = (await kv.hgetall('predictions')) || {};
      const result = {};
      for (const [player, value] of Object.entries(all)) {
        const parsed = typeof value === 'string' ? JSON.parse(value) : (value || {});
        // Solo se devuelven los pronósticos de partidos ya revelados (T-30').
        const visible = {};
        for (const [matchNum, p] of Object.entries(parsed)) {
          if (isMatchRevealed(matchNum)) visible[matchNum] = p;
        }
        result[player] = visible;
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ predictions: result });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { name, pin, predictions, action } = body;

      if (!name || !PLAYERS.includes(name)) {
        return res.status(400).json({ error: 'Jugador inválido' });
      }
      if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ error: 'El PIN debe ser de 4 a 6 dígitos' });
      }

      // Modo "verify": solo chequea PIN, no guarda nada
      if (action === 'verify') {
        const existingPin = await kv.hget('pins', name);
        if (!existingPin) return res.status(200).json({ first_time: true });
        if (String(existingPin) !== pin) return res.status(403).json({ error: 'PIN incorrecto' });
        return res.status(200).json({ ok: true });
      }

      // Modo "mine": verifica PIN y devuelve TODOS los pronósticos propios (incluso los ocultos).
      // Es la única forma de ver lo que cargaste antes de que el partido se revele.
      if (action === 'mine') {
        const existingPin = await kv.hget('pins', name);
        if (!existingPin) return res.status(200).json({ first_time: true, predictions: {} });
        if (String(existingPin) !== pin) return res.status(403).json({ error: 'PIN incorrecto' });
        const raw = await kv.hget('predictions', name);
        let mine = {};
        if (raw) mine = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        return res.status(200).json({ ok: true, predictions: mine });
      }

      if (!predictions || typeof predictions !== 'object') {
        return res.status(400).json({ error: 'Pronósticos inválidos' });
      }

      const existingPin = await kv.hget('pins', name);
      if (existingPin) {
        if (String(existingPin) !== pin) {
          return res.status(403).json({ error: 'PIN incorrecto' });
        }
      } else {
        await kv.hset('pins', { [name]: pin });
      }

      const existingRaw = await kv.hget('predictions', name);
      let existing = {};
      if (existingRaw) {
        existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
      }

      const merged = { ...existing };
      for (const [matchNum, p] of Object.entries(predictions)) {
        if (!p || typeof p !== 'object') continue;
        const h = Number(p.home);
        const a = Number(p.away);
        if (!Number.isInteger(h) || !Number.isInteger(a)) continue;
        if (h < 0 || h > 30 || a < 0 || a > 30) continue;
        merged[matchNum] = { home: h, away: a };
      }

      await kv.hset('predictions', { [name]: merged });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('predictions handler error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
