const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');

function signShop(shop) {
  return jwt.sign({ sub: shop._id.toString(), email: shop.email, role: 'shop-owner' }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.hisabflow_token;
    if (!token) return res.redirect('/auth/login');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const shop = await Shop.findById(payload.sub).lean();
    if (!shop) return res.redirect('/auth/login');
    req.shop = shop;
    next();
  } catch (err) {
    res.clearCookie('hisabflow_token');
    return res.redirect('/auth/login');
  }
}

async function requireApiAuth(req, res, next) {
  try {
    const token = req.cookies.hisabflow_token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const shop = await Shop.findById(payload.sub).lean();
    if (!shop) return res.status(401).json({ error: 'Session is no longer valid.' });
    req.shop = shop;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required.' });
  }
}

module.exports = { signShop, requireAuth, requireApiAuth };
