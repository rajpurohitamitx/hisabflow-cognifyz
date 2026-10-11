const express = require('express');
const bcrypt = require('bcryptjs');
const Shop = require('../models/Shop');
const { signShop, COOKIE } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 3 * 86400000, path: '/' };
}
const registerPage = (res, status, error) => res.status(status).render('auth/register', { title: 'Create your shop', error });
const loginPage = (res, status, error) => res.status(status).render('auth/login', { title: 'Sign in', error });

router.get('/login', (req, res) => loginPage(res, 200, null));
router.get('/register', (req, res) => registerPage(res, 200, null));

router.post('/register', authLimiter, async (req, res) => {
  try {
    const shopName = String(req.body.shopName || '').trim();
    const ownerName = String(req.body.ownerName || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (!shopName || !ownerName || !email || !password) return registerPage(res, 400, 'Please complete every field.');
    if (shopName.length > 100 || ownerName.length > 80 || email.length > 254) return registerPage(res, 400, 'One of the fields is too long.');
    if (!emailRe.test(email)) return registerPage(res, 400, 'Enter a valid email address.');
    // bcrypt only reads the first 72 bytes, so longer passwords would be silently truncated.
    if (Buffer.byteLength(password) > 72) return registerPage(res, 400, 'Use a password of 72 characters or fewer.');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return registerPage(res, 400, 'Use at least 8 characters, one capital letter and one number.');

    if (await Shop.findOne({ email })) return registerPage(res, 409, 'An account with that email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);
    const shop = await Shop.create({ name: shopName, ownerName, email, passwordHash });
    res.cookie(COOKIE, signShop(shop), cookieOptions());
    res.redirect(303, '/dashboard');
  } catch (err) {
    if (err && err.code === 11000) return registerPage(res, 409, 'An account with that email already exists.');
    console.error('[register]', err.message);
    registerPage(res, 500, 'Could not create the account. Please try again.');
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const shop = email.length <= 254 ? await Shop.findOne({ email }) : null;
    const ok = await bcrypt.compare(password.slice(0, 200), shop ? shop.passwordHash : DUMMY_HASH);
    if (!shop || !ok) {
      console.warn(JSON.stringify({ event: 'login_failed', ip: req.ip, at: new Date().toISOString() }));
      return loginPage(res, 401, 'Email or password is incorrect.');
    }
    res.cookie(COOKIE, signShop(shop), cookieOptions());
    res.redirect(303, '/dashboard');
  } catch (err) {
    console.error('[login]', err.message);
    loginPage(res, 500, 'Could not sign you in. Please try again.');
  }
});

router.post('/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.redirect(303, '/auth/login'); });

module.exports = router;
