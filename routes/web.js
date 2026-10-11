const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { getFollowUps } = require('../services/followUps');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.cookies.hisabflow_token) return res.redirect('/dashboard');
  res.render('landing', { title: 'HisaabFlow' });
});

router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  const [grouped, customerCount, recent] = await Promise.all([
    Transaction.aggregate([{ $match: { shopId: req.shop._id } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Customer.countDocuments({ shopId: req.shop._id, archived: false }),
    Transaction.find({ shopId: req.shop._id }).sort({ occurredAt: -1 }).limit(6).populate('customerId', 'name').lean()
  ]);
  const map = Object.fromEntries(grouped.map(x => [x._id, x]));
  const followUps = await getFollowUps(req.shop._id);
  res.render('dashboard/index', { title: 'Dashboard', shop: req.shop, stats: { credit: map.credit?.total || 0, payments: map.payment?.total || 0, outstanding: Math.max(0, (map.credit?.total || 0) - (map.payment?.total || 0)), customers: customerCount }, followUps, recent });
});

router.get('/customers', async (req, res) => {
  const customers = await Customer.find({ shopId: req.shop._id, archived: false }).sort({ name: 1 }).lean();
  const rows = await Promise.all(customers.map(async c => {
    const data = await Transaction.aggregate([{ $match: { shopId: req.shop._id, customerId: c._id } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]);
    const map = Object.fromEntries(data.map(x => [x._id, x.total]));
    return { ...c, balance: Math.max(0, (map.credit || 0) - (map.payment || 0)) };
  }));
  res.render('customers/index', { title: 'Customers', customers: rows });
});

router.get('/customers/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, shopId: req.shop._id, archived: false }).lean();
  if (!customer) return res.status(404).render('error', { title: 'Customer not found', message: 'That customer does not exist.' });
  const transactions = await Transaction.find({ shopId: req.shop._id, customerId: customer._id }).sort({ occurredAt: -1 }).lean();
  const credit = transactions.filter(x => x.type === 'credit').reduce((a, x) => a + x.amount, 0);
  const payment = transactions.filter(x => x.type === 'payment').reduce((a, x) => a + x.amount, 0);
  res.render('customers/detail', { title: customer.name, customer, transactions, balance: Math.max(0, credit - payment) });
});

router.get('/entry', async (req, res) => {
  const customers = await Customer.find({ shopId: req.shop._id, archived: false }).sort({ name: 1 }).lean();
  res.render('transactions/entry', { title: 'Add entry', customers });
});

router.get('/daily-closing', async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const grouped = await Transaction.aggregate([{ $match: { shopId: req.shop._id, occurredAt: { $gte: start, $lte: end } } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  const all = await Transaction.aggregate([{ $match: { shopId: req.shop._id } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]);
  const today = Object.fromEntries(grouped.map(x => [x._id, x]));
  const totals = Object.fromEntries(all.map(x => [x._id, x.total]));
  const followUps = await getFollowUps(req.shop._id);
  res.render('dashboard/closing', { title: 'Daily closing', today, outstanding: Math.max(0, (totals.credit || 0) - (totals.payment || 0)), followUps });
});

module.exports = router;
