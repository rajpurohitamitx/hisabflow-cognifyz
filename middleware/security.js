/** Rejects cross-site state-changing requests (CSRF defence in depth on top of SameSite cookies). */
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host !== req.get('host')) {
      console.warn(JSON.stringify({ event: 'csrf_blocked', path: req.path, origin }));
      if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'Cross-site request blocked.' });
      return res.status(403).render('error', { title: 'Request blocked', message: 'This request came from another website and was blocked.' });
    }
  }
  next();
}

module.exports = { sameOrigin };
