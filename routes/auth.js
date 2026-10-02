const express = require('express');
const bcrypt = require('bcryptjs');
const Shop = require('../models/Shop');
const { signShop } = require('../middleware/auth');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000 };
}

router.get('/login', (req, res) => res.render('auth/login', { title: 'Sign in', error: null }));
router.get('/register', (req, res) => res.render('auth/register', { title: 'Create shop', error: null }));

router.post('/register', async (req, res) => {
  try {
    const shopName = String(req.body.shopName || '').trim();
    const ownerName = String(req.body.ownerName || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (!shopName || !ownerName || !email || !password) return res.status(400).render('auth/register', { title: 'Create shop', error: 'Please complete every field.' });
    if (!emailRe.test(email)) return res.status(400).render('auth/register', { title: 'Create shop', error: 'Enter a valid email address.' });
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).render('auth/register', { title: 'Create shop', error: 'Use at least 8 characters, one capital letter and one number.' });

    const exists = await Shop.findOne({ email });
    if (exists) return res.status(409).render('auth/register', { title: 'Create shop', error: 'An account with that email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const shop = await Shop.create({ name: shopName, ownerName, email, passwordHash });
    res.cookie('hisabflow_token', signShop(shop), cookieOptions());
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[register]', err.message);
    res.status(500).render('auth/register', { title: 'Create shop', error: 'Could not create the account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const shop = await Shop.findOne({ email });
    if (!shop || !(await bcrypt.compare(password, shop.passwordHash))) {
      return res.status(401).render('auth/login', { title: 'Sign in', error: 'Email or password is incorrect.' });
    }
    res.cookie('hisabflow_token', signShop(shop), cookieOptions());
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).render('auth/login', { title: 'Sign in', error: 'Could not sign you in. Please try again.' });
  }
});

router.post('/logout', (req, res) => { res.clearCookie('hisabflow_token'); res.redirect('/auth/login'); });

module.exports = router;
