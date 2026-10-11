const Transaction = require('../models/Transaction');

/** Outstanding balance (credit minus payments, never below zero) for each customer of a shop. */
async function balancesByCustomer(shopId) {
  const rows = await Transaction.aggregate([
    { $match: { shopId } },
    { $group: {
      _id: '$customerId',
      credit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
      payment: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } }
    } }
  ]);
  return new Map(rows.map(r => [String(r._id), Math.max(0, Math.round((r.credit - r.payment) * 100) / 100)]));
}

async function customerBalance(shopId, customerId) {
  const map = await balancesByCustomer(shopId);
  return map.get(String(customerId)) || 0;
}

module.exports = { balancesByCustomer, customerBalance };
