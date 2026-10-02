const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { requireApiAuth } = require('../middleware/auth');
const { getFollowUps } = require('../services/followUps');
const { parseTransaction } = require('../services/naturalLanguage');
const { createDraft, getDraft, removeDraft } = require('../services/draftStore');

const router = express.Router();
router.use(requireApiAuth);

function validId(id) { return mongoose.isValidObjectId(id); }
function positiveAmount(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }
function cleanText(value, max = 200) { return String(value || '').trim().slice(0, max); }

router.get('/me', (req, res) => res.json({ shop: { id: req.shop._id, name: req.shop.name, ownerName: req.shop.ownerName, email: req.shop.email } }));

router.get('/customers', async (req, res) => {
  const customers = await Customer.find({ shopId: req.shop._id, archived: false }).sort({ name: 1 }).lean();
  res.json({ customers });
});

router.post('/customers', async (req, res) => {
  const name = cleanText(req.body.name, 80);
  const phone = cleanText(req.body.phone, 20);
  const notes = cleanText(req.body.notes, 300);
  if (name.length < 2) return res.status(400).json({ error: 'Customer name must be at least 2 characters.' });
  const customer = await Customer.create({ shopId: req.shop._id, name, phone, notes });
  res.status(201).json({ customer });
});

router.put('/customers/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid customer id.' });
  const name = cleanText(req.body.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Customer name must be at least 2 characters.' });
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

router.post('/transactions', async (req, res) => {
  const customerId = String(req.body.customerId || '');
  const type = String(req.body.type || '');
  const value = positiveAmount(req.body.amount);
  if (!validId(customerId) || !['credit', 'payment'].includes(type) || !value) return res.status(400).json({ error: 'Choose a customer, transaction type and a positive amount.' });

  const customer = await Customer.findOne({ _id: customerId, shopId: req.shop._id, archived: false });
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const tx = await Transaction.create({ shopId: req.shop._id, customerId, type, amount: value, description: cleanText(req.body.description), occurredAt: req.body.occurredAt || Date.now(), source: 'manual' });
  res.status(201).json({ transaction: tx });
});

router.put('/transactions/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id.' });
  const value = positiveAmount(req.body.amount);
  if (!['credit', 'payment'].includes(req.body.type) || !value) return res.status(400).json({ error: 'Valid type and positive amount are required.' });
  const tx = await Transaction.findOneAndUpdate(
    { _id: req.params.id, shopId: req.shop._id },
    { $set: { type: req.body.type, amount: value, description: cleanText(req.body.description), ...(req.body.occurredAt && !Number.isNaN(new Date(req.body.occurredAt).getTime()) ? { occurredAt: new Date(req.body.occurredAt) } : {}) } },
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

router.post('/natural-language/parse', (req, res) => {
  const parsed = parseTransaction(req.body.text);
  if (!parsed.ok) return res.status(400).json(parsed);
  const draftId = createDraft(req.shop._id, parsed);
  res.json({ ...parsed, draftId });
});

router.post('/natural-language/save', async (req, res) => {
  const parsed = getDraft(req.shop._id, String(req.body.draftId || ''));
  if (!parsed) return res.status(400).json({ error: 'This preview has expired. Parse the sentence again.' });

  let customer = await Customer.findOne({
    shopId: req.shop._id,
    name: new RegExp(`^${parsed.customer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    archived: false
  });
  if (!customer) customer = await Customer.create({ shopId: req.shop._id, name: parsed.customer });

  const docs = [{ shopId: req.shop._id, customerId: customer._id, type: 'credit', amount: parsed.credit, description: 'Natural-language entry', source: 'natural-language' }];
  if (parsed.payment > 0) docs.push({ shopId: req.shop._id, customerId: customer._id, type: 'payment', amount: parsed.payment, description: 'Payment from natural-language entry', source: 'natural-language' });
  const transactions = await Transaction.insertMany(docs);
  removeDraft(req.body.draftId);
  res.status(201).json({ customer, transactions, parsed });
});

module.exports = router;
