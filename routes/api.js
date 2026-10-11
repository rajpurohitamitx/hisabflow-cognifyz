const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { requireApiAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { getFollowUps } = require('../services/followUps');
const { parseTransaction, describeItems } = require('../services/naturalLanguage');
const { createDraft, getDraft } = require('../services/draftStore');
const { customerBalance } = require('../services/balances');

const router = express.Router();
router.use(requireApiAuth);
router.use(rateLimit({ windowMs: 60 * 1000, max: 120, key: (req) => `api:${req.shop._id}` }));

const MAX_AMOUNT = 10000000;
const validId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
const cleanText = (value, max = 200) => (typeof value === 'string' ? value : '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
function positiveAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? Math.round(n * 100) / 100 : null;
}
function parseDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) || t > Date.now() + 86400000 ? null : d;
}
const nameRegex = (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

router.get('/me', (req, res) => res.json({ shop: { id: req.shop._id, name: req.shop.name, ownerName: req.shop.ownerName, email: req.shop.email } }));

// ---- Customers -------------------------------------------------------------------------------
router.get('/customers', async (req, res) => {
  const customers = await Customer.find({ shopId: req.shop._id, archived: false }).sort({ name: 1 }).lean();
  res.json({ customers });
});

router.post('/customers', async (req, res) => {
  const name = cleanText(req.body.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Customer name must be at least 2 characters.' });
  if (await Customer.exists({ shopId: req.shop._id, archived: false, name: nameRegex(name) })) return res.status(409).json({ error: `${name} is already in your customer list.` });
  const customer = await Customer.create({ shopId: req.shop._id, name, phone: cleanText(req.body.phone, 20), notes: cleanText(req.body.notes, 300) });
  res.status(201).json({ customer });
});

router.put('/customers/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid customer id.' });
  const name = cleanText(req.body.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Customer name must be at least 2 characters.' });
  if (await Customer.exists({ shopId: req.shop._id, archived: false, name: nameRegex(name), _id: { $ne: req.params.id } })) return res.status(409).json({ error: `${name} is already in your customer list.` });
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, shopId: req.shop._id, archived: false },
    { $set: { name, phone: cleanText(req.body.phone, 20), notes: cleanText(req.body.notes, 300) } },
    { new: true, runValidators: true }
  );
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  res.json({ customer });
});

router.delete('/customers/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid customer id.' });
  const customer = await Customer.findOneAndUpdate({ _id: req.params.id, shopId: req.shop._id, archived: false }, { archived: true }, { new: true });
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  res.json({ ok: true });
});

router.get('/customers/:id/transactions', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid customer id.' });
  const customer = await Customer.findOne({ _id: req.params.id, shopId: req.shop._id, archived: false }).lean();
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  const transactions = await Transaction.find({ shopId: req.shop._id, customerId: customer._id }).sort({ occurredAt: -1 }).lean();
  res.json({ customer, transactions });
});

// ---- Transactions ----------------------------------------------------------------------------
router.post('/transactions', async (req, res) => {
  const customerId = typeof req.body.customerId === 'string' ? req.body.customerId : '';
  const type = typeof req.body.type === 'string' ? req.body.type : '';
  const value = positiveAmount(req.body.amount);
  if (!validId(customerId) || !['credit', 'payment'].includes(type) || !value) return res.status(400).json({ error: 'Choose a customer, a transaction type and an amount between ₹0.01 and ₹1,00,00,000.' });
  const occurredAt = parseDate(req.body.occurredAt);
  if (occurredAt === null) return res.status(400).json({ error: 'That date is not valid.' });

  const customer = await Customer.findOne({ _id: customerId, shopId: req.shop._id, archived: false });
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const tx = await Transaction.create({ shopId: req.shop._id, customerId, type, amount: value, description: cleanText(req.body.description), occurredAt: occurredAt || new Date(), source: 'manual' });
  res.status(201).json({ transaction: tx });
});

router.put('/transactions/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id.' });
  const value = positiveAmount(req.body.amount);
  if (!['credit', 'payment'].includes(req.body.type) || !value) return res.status(400).json({ error: 'A valid type and an amount above ₹0 are required.' });
  const occurredAt = parseDate(req.body.occurredAt);
  if (occurredAt === null) return res.status(400).json({ error: 'That date is not valid.' });
  const tx = await Transaction.findOneAndUpdate(
    { _id: req.params.id, shopId: req.shop._id },
    { $set: { type: req.body.type, amount: value, description: cleanText(req.body.description), ...(occurredAt ? { occurredAt } : {}) } },
    { new: true, runValidators: true }
  );
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ transaction: tx });
});

router.delete('/transactions/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id.' });
  const tx = await Transaction.findOneAndDelete({ _id: req.params.id, shopId: req.shop._id });
  if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ ok: true });
});

// ---- Insights --------------------------------------------------------------------------------
router.get('/follow-ups', async (req, res) => res.json({ followUps: await getFollowUps(req.shop._id) }));

router.get('/dashboard', async (req, res) => {
  const grouped = await Transaction.aggregate([
    { $match: { shopId: req.shop._id } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } }
  ]);
  const map = Object.fromEntries(grouped.map(x => [x._id, x.total]));
  const followUps = await getFollowUps(req.shop._id);
  res.json({ credit: map.credit || 0, payments: map.payment || 0, outstanding: Math.max(0, (map.credit || 0) - (map.payment || 0)), attention: followUps.filter(x => x.level !== 'healthy').length, followUps });
});

// ---- Natural-language entry ------------------------------------------------------------------
const parseLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Too many entries in a minute. Please slow down.', key: (req) => `nl:${req.shop._id}` });

router.post('/natural-language/parse', parseLimiter, async (req, res) => {
  const customers = await Customer.find({ shopId: req.shop._id, archived: false }).select('name').lean();
  const parsed = parseTransaction(typeof req.body.text === 'string' ? req.body.text : '', customers.map(c => c.name));
  if (!parsed.ok) return res.status(400).json(parsed);

  const match = customers.find(c => c.name.toLowerCase() === parsed.customer.toLowerCase());
  parsed.knownCustomer = Boolean(match);

  if (parsed.settleAll) {
    const balance = match ? await customerBalance(req.shop._id, match._id) : 0;
    if (balance <= 0) return res.status(400).json({ ok: false, error: `${parsed.customer} has nothing outstanding right now, so there is nothing to settle.` });
    parsed.payment = balance;
    parsed.net = -balance;
    parsed.warnings.push(`Settling the full outstanding balance of ₹${balance.toLocaleString('en-IN')}.`);
  }
  const draftId = createDraft(req.shop._id, parsed);
  res.json({ ...parsed, draftId });
});

router.post('/natural-language/save', async (req, res) => {
  const parsed = getDraft(req.shop._id, req.body.draftId);
  if (!parsed) return res.status(400).json({ error: 'This preview has expired. Review the sentence again.' });

  let customer = await Customer.findOne({ shopId: req.shop._id, name: nameRegex(parsed.customer), archived: false });
  if (!customer) customer = await Customer.create({ shopId: req.shop._id, name: parsed.customer.slice(0, 80) });

  const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();
  const docs = [];
  if (parsed.credit > 0) docs.push({ shopId: req.shop._id, customerId: customer._id, type: 'credit', amount: parsed.credit, description: describeItems(parsed.items) || 'Credit entry', items: parsed.items.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, price: i.price, total: i.total })), occurredAt, source: 'natural-language' });
  if (parsed.payment > 0) docs.push({ shopId: req.shop._id, customerId: customer._id, type: 'payment', amount: parsed.payment, description: 'Payment received', occurredAt, source: 'natural-language' });
  const transactions = await Transaction.insertMany(docs);
  res.status(201).json({ customer, transactions, parsed });
});

module.exports = router;
