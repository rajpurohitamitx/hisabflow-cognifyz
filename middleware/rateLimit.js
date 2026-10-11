/**
 * Small fixed-window rate limiter.
 * Counters live in memory, so on serverless hosting the limit applies per warm instance.
 * That still blunts password guessing and accidental request loops; for strict global limits
 * use a shared store (e.g. Redis/Upstash).
 */
function rateLimit({ windowMs, max, message, key = (req) => req.ip }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();

  return (req, res, next) => {
    const k = String(key(req));
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) { entry = { count: 0, reset: now + windowMs }; hits.set(k, entry); }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - entry.count));
    if (entry.count > max) {
      const retry = Math.ceil((entry.reset - now) / 1000);
      res.setHeader('Retry-After', retry);
      console.warn(JSON.stringify({ event: 'rate_limited', path: req.path, ip: req.ip }));
      const wantsJson = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/') || req.is('json');
      if (wantsJson) return res.status(429).json({ error: message || 'Too many requests. Please wait a moment.' });
      return res.status(429).render('error', { title: 'Too many attempts', message: message || 'Please wait a few minutes and try again.' });
    }
    next();
  };
}

module.exports = { rateLimit };
