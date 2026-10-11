const Transaction = require('../models/Transaction');
const { classify } = require('./classify');

async function getFollowUps(shopId) {
  const rows = await Transaction.aggregate([
    { $match: { shopId } },
    { $group: {
      _id: '$customerId',
      credit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
      payment: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } },
      lastPayment: { $max: { $cond: [{ $eq: ['$type', 'payment'] }, '$occurredAt', null] } },
      lastTransaction: { $max: '$occurredAt' }
    }},
    { $addFields: { balance: { $subtract: ['$credit', '$payment'] } } },
    { $match: { balance: { $gt: 0 } } },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
    { $unwind: '$customer' },
    { $match: { 'customer.archived': false, 'customer.shopId': shopId } }
  ]);

  const now = Date.now();
  return rows.map((row) => {
    const lastDate = row.lastPayment || row.lastTransaction;
    const daysSincePayment = Math.max(0, Math.floor((now - new Date(lastDate).getTime()) / 86400000));
    return {
      customerId: row._id,
      name: row.customer.name,
      phone: row.customer.phone || '',
      balance: row.balance,
      daysSincePayment,
      ...classify({ balance: row.balance, daysSincePayment })
    };
  }).sort((a, b) => b.score - a.score || b.balance - a.balance);
}

module.exports = { getFollowUps, classify };
