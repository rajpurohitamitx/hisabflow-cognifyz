const Transaction = require('../models/Transaction');

/**
 * Per-customer balance = credit given − payments received.
 *   balance > 0  → the customer owes the shop (due)
 *   balance < 0  → the customer has paid extra; the shop holds it as an advance
 *                  and it is adjusted automatically against their next purchase.
 * Returns shop-level totals so advances never silently reduce other customers' dues.
 */
async function getTotals(shopId) {
  const rows = await Transaction.aggregate([
    { $match: { shopId } },
    { $group: {
      _id: '$customerId',
      credit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
      payment: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } }
    } },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $match: { 'c.archived': false } }
  ]);
  let outstanding = 0, advance = 0, advanceCustomers = 0;
  rows.forEach(r => {
    const bal = Math.round((r.credit - r.payment) * 100) / 100;
    if (bal > 0) outstanding += bal;
    else if (bal < 0) { advance += -bal; advanceCustomers++; }
  });
  const r2 = n => Math.round(n * 100) / 100;
  return { outstanding: r2(outstanding), advance: r2(advance), advanceCustomers };
}

module.exports = { getTotals };
