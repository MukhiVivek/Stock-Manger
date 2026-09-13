const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  warehouse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  product_size_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductSize', required: true },
  quantity: { type: Number, default: 0, min: 0 },
  stock_value: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

stockSchema.index({ warehouse_id: 1, product_size_id: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);
