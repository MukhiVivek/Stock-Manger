const mongoose = require('mongoose');

const stockBatchSchema = new mongoose.Schema({
  warehouse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  product_size_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductSize', required: true },
  received_quantity: { type: Number, required: true, min: 1 },
  remaining_quantity: { type: Number, required: true, min: 0 },
  purchase_price: { type: Number, required: true, min: 0 },
  received_date: { type: Date, required: true },
  received_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
}, { timestamps: true });

// FIFO: always sort by received_date ASC when consuming
stockBatchSchema.index({ warehouse_id: 1, product_size_id: 1, received_date: 1 });

module.exports = mongoose.model('StockBatch', stockBatchSchema);
