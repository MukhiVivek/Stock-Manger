const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['RECEIVED', 'GIVEN', 'TRANSFER'], required: true },
  date: { type: Date, required: true },
  product_size_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductSize', required: true },
  quantity: { type: Number, required: true, min: 1 },
  from_warehouse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  to_warehouse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  // For RECEIVED: actual purchase price; For GIVEN: weighted avg FIFO cost
  purchase_price: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  discount_percent: { type: Number, default: 0 },
  // purchase_amount: For RECEIVED = price * qty; For GIVEN = fifo cost total
  purchase_amount: { type: Number, default: 0 },
  // received_amount: For GIVEN = final_selling_price * qty
  received_amount: { type: Number, default: 0 },
  bill_number: { type: String, trim: true, default: '' },
  supplier_name: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  is_reversed: { type: Boolean, default: false },
  reversal_of: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { timestamps: true });

transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
