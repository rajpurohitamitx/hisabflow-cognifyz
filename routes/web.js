const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, COOKIE } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { getFollowUps } = require('../services/followUps');
const { balancesByCustomer } = require('../services/balances');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.cookies[COOKIE]) return res.redirect('/dashboard');
  res.render('landing', { title: 'HisabFlow — a khata that understands you', description: 'Type a credit entry the way you would say it. HisabFlow splits it into items, quantity, price and payment, then tells you who to follow up with today.' });
});
router.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy' }));
router.get('/terms', (req, res) => res.render('terms', { title: 'Terms' }));

router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  const [grouped, customerCount, recent, followUps] = await Promise.all([
    Transaction.aggregate([{ $match: { shopId: req.shop._id } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Customer.countDocuments({ shopId: req.shop._id, archived: false }),
    Transaction.find({ shopId: req.shop._id }).sort({ occurredAt: -1 }).limit(6).populate('customerId', 'name').lean(),
    getFollowUps(req.shop._id)
  ]);
  const map = Object.fromEntries(grouped.map(x => [x._id, x]));
  const credit = map.credit?.total || 0, payments = map.payment?.total || 0;
  res.render('dashboard/index', { title: 'Overview', shop: req.shop, stats: { credit, payments, outstanding: Math.max(0, credit - payments), customers: customerCount }, followUps, recent });
});

router.get('/customers', async (req, res) => {
  const [customers, balances] = await Promise.all([
    Customer.find({ shopId: req.shop._id, archived: false }).sort({ name: 1 }).lean(),
    balancesByCustomer(req.shop._id)
  ]);
  res.render('customers/index', { title: 'Customers', customers: customers.map(c => ({ ...c, balance: balances.get(String(c._id)) || 0 })) });
});

router.get('/customers/:id', async (req, res) => {
  const notFound = () => res.status(404).render('error', { title: 'Customer not found', message: 'That customer does not exist in your shop.' });
  if (!mongoose.isValidObjectId(req.params.id)) return notFound();
  const customer = await Customer.findOne({ _id: req.params.id, shopId: req.shop._id, archived: false }).lean();
  if (!customer) return notFound();
  const transactions = await Transaction.find({ shopId: req.shop._id, customerId: customer._id }).sort({ occurredAt: -1 }).lean();
  const credit = transactions.filter(x => x.type === 'credit').reduce((a, x) => a + x.amount, 0);
  const payment = transactions.filter(x => x.type === 'payment').reduce((a, x) => a + x.amount, 0);
  // Running balance, oldest first, then shown newest first.
  let running = 0;
  const withBalance = [...transactions].reverse().map(tx => { running += tx.type === 'credit' ? tx.amount : -tx.amount; return { ...tx, running: Math.round(running * 100) / 100 }; }).reverse();
  res.render('customers/detail', { title: customer.name, customer, transactions: withBalance, balance: Math.max(0, credit - payment) });
});

router.get('/entry', async (req, res) => {
  const customers = await Customer.find({ shopId: req.shop._id, archived: false }).sort({ name: 1 }).lean();
  res.render('transactions/entry', { title: 'Add entry', customers });
});

router.get('/daily-closing', async (req, res) => {
  // Day boundaries in India time, independent of the server's timezone (Vercel runs in UTC).
  const IST = 330 * 60000;
  const nowIst = new Date(Date.now() + IST);
  const start = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST);
  const end = new Date(start.getTime() + 86400000 - 1);
  const [grouped, all, followUps] = await Promise.all([
    Transaction.aggregate([{ $match: { shopId: req.shop._id, occurredAt: { $gte: start, $lte: end } } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $match: { shopId: req.shop._id } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
    getFollowUps(req.shop._id)
  ]);
  const today = Object.fromEntries(grouped.map(x => [x._id, x]));
  const totals = Object.fromEntries(all.map(x => [x._id, x.total]));
  res.render('dashboard/closing', { title: 'Daily closing', today, outstanding: Math.max(0, (totals.credit || 0) - (totals.payment || 0)), followUps });
});

module.exports = router;
