const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');

const COOKIE = 'hisabflow_token';
const verifyOptions = { algorithms: ['HS256'] };

function signShop(shop) {
  return jwt.sign({ sub: shop._id.toString(), role: 'shop-owner' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '3d' });
}

function readToken(req, allowBearer) {
  const cookie = req.cookies && req.cookies[COOKIE];
  if (cookie) return cookie;
  if (!allowBearer) return null;
  const header = req.headers.authorization || '';
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '') : null;
}

async function requireAuth(req, res, next) {
  try {
    const token = readToken(req, false);
    if (!token) return res.redirect('/auth/login');
    const payload = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
    const shop = await Shop.findById(payload.sub).select('-passwordHash').lean();
    if (!shop) return res.redirect('/auth/login');
    req.shop = shop;
    res.locals.shop = shop;
    next();
  } catch (err) {
    res.clearCookie(COOKIE);
    return res.redirect('/auth/login');
  }
}

async function requireApiAuth(req, res, next) {
  try {
    const token = readToken(req, true);
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
    const shop = await Shop.findById(payload.sub).select('-passwordHash').lean();
    if (!shop) return res.status(401).json({ error: 'Session is no longer valid.' });
    req.shop = shop;
    next();
  } catch {
    console.warn(JSON.stringify({ event: 'api_auth_failed', path: req.originalUrl, ip: req.ip }));
    res.status(401).json({ error: 'Authentication required.' });
  }
}

module.exports = { signShop, requireAuth, requireApiAuth, COOKIE };
