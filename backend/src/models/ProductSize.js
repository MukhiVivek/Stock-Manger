const mongoose = require('mongoose');

const productSizeSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  size: { type: String, enum: ['10 KG', '30 KG', '50 KG'], required: true },
  current_purchase_price: { type: Number, required: true, min: 0 },
  current_selling_price: { type: Number, required: true, min: 0 },
  default_discount_percent: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

productSizeSchema.index({ product_id: 1, size: 1 }, { unique: true });

module.exports = mongoose.model('ProductSize', productSizeSchema);
