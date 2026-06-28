import { Redis } from '@upstash/redis';

const kv = new Redis({
  url:   process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PLAYERS = ['Alex','David','Mati','Montse','Paco','Pau','Pepe','Santi','Steph'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const all = (await kv.hgetall('predictions')) || {};
      const result = {};
      for (const [player, value] of Object.entries(all)) {
        result[player] = typeof value === 'string' ? JSON.parse(value) : (value || {});
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
