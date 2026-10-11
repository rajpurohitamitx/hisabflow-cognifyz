require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Shop = require('../models/Shop');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed while NODE_ENV=production.');
  await mongoose.connect(process.env.MONGODB_URI);
  // Only the demo shop is reset; real accounts are never touched.
  const demoEmail = process.env.ADMIN_EMAIL || 'demo@hisabflow.local';
  const old = await Shop.findOne({ email: demoEmail });
  if (old) await Promise.all([Transaction.deleteMany({ shopId: old._id }), Customer.deleteMany({ shopId: old._id }), Shop.deleteOne({ _id: old._id })]);
  const shop = await Shop.create({ name: 'Green Basket Stores', ownerName: 'Ananya', email: process.env.ADMIN_EMAIL || 'demo@hisabflow.local', passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'DemoPass123!', 12), phone: '+919999999999' });
  const people = await Customer.insertMany([
    { shopId: shop._id, name: 'Ramesh', phone: '+919876543210', notes: 'Regular customer' },
    { shopId: shop._id, name: 'Suresh', phone: '+919812345678' },
    { shopId: shop._id, name: 'Kumar', phone: '+919800112233' },
    { shopId: shop._id, name: 'Priya', phone: '+919877665544' }
  ]);
  const byName = Object.fromEntries(people.map(x => [x.name, x]));
  const daysAgo = n => new Date(Date.now() - n * 86400000);
  await Transaction.insertMany([
    { shopId: shop._id, customerId: byName.Ramesh._id, type: 'credit', amount: 1240, description: 'Groceries', occurredAt: daysAgo(32) },
    { shopId: shop._id, customerId: byName.Ramesh._id, type: 'payment', amount: 300, description: 'Part payment', occurredAt: daysAgo(40) },
    { shopId: shop._id, customerId: byName.Suresh._id, type: 'credit', amount: 680, description: 'Household items', occurredAt: daysAgo(18) },
    { shopId: shop._id, customerId: byName.Kumar._id, type: 'credit', amount: 240, description: 'Snacks', occurredAt: daysAgo(3) },
    { shopId: shop._id, customerId: byName.Priya._id, type: 'credit', amount: 900, description: 'Monthly groceries', occurredAt: daysAgo(12) },
    { shopId: shop._id, customerId: byName.Priya._id, type: 'payment', amount: 400, description: 'Payment', occurredAt: daysAgo(2) }
  ]);
  console.log(`Seeded demo shop: ${shop.email} / ${process.env.ADMIN_PASSWORD || 'DemoPass123!'}`);
  await mongoose.disconnect();
}
seed().catch(err => { console.error(err); process.exit(1); });
