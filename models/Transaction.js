const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type: { type: String, enum: ['credit', 'payment'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, trim: true, maxlength: 200 },
  items: [{ _id: false, name: { type: String, trim: true, maxlength: 80 }, qty: Number, unit: { type: String, trim: true, maxlength: 20 }, price: Number, total: Number }],
  occurredAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['manual', 'natural-language'], default: 'manual' }
}, { timestamps: true });

transactionSchema.index({ shopId: 1, customerId: 1, occurredAt: -1 });
module.exports = mongoose.model('Transaction', transactionSchema);
