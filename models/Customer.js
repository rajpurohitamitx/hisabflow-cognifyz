const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, trim: true, maxlength: 20 },
  notes: { type: String, trim: true, maxlength: 300 },
  archived: { type: Boolean, default: false }
}, { timestamps: true });

customerSchema.index({ shopId: 1, name: 1 });
module.exports = mongoose.model('Customer', customerSchema);
