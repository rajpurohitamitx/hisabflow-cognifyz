const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 80 },
  qty: { type: Number, min: 0 },
  unit: { type: String, trim: true, maxlength: 12 },
  price: { type: Number, min: 0 },
  total: { type: Number, min: 0 }
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type: { type: String, enum: ['credit', 'payment'], required: true },
  amount: { type: Number, required: true, min: 0.01, max: 10000000 },
  description: { type: String, trim: true, maxlength: 200 },
  items: { type: [itemSchema], default: undefined },
  occurredAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['manual', 'natural-language'], default: 'manual' }
}, { timestamps: true });

transactionSchema.index({ shopId: 1, customerId: 1, occurredAt: -1 });
module.exports = mongoose.model('Transaction', transactionSchema);
