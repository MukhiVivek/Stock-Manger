const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const ProductSize = require('../models/ProductSize');

// GET /api/products - all active products with their sizes
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ active: true }).lean();
    const result = [];
    for (const p of products) {
      const sizes = await ProductSize.find({ product_id: p._id }).lean();
      result.push({ ...p, sizes });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/sizes - flat list of all product sizes
router.get('/sizes', async (req, res) => {
  try {
    const sizes = await ProductSize.find()
      .populate('product_id', 'name active')
      .lean();
    res.json(sizes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/products/:productId/sizes/:sizeId
router.get('/size/:id', async (req, res) => {
  try {
    const ps = await ProductSize.findById(req.params.id)
      .populate('product_id', 'name')
      .lean();
    if (!ps) return res.status(404).json({ message: 'Not found' });
    res.json(ps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/products/size/:id - update pricing/discount
router.put('/size/:id', async (req, res) => {
  try {
    const { current_purchase_price, current_selling_price, default_discount_percent } = req.body;
    const updates = {};
    if (current_purchase_price !== undefined) updates.current_purchase_price = current_purchase_price;
    if (current_selling_price !== undefined) updates.current_selling_price = current_selling_price;
    if (default_discount_percent !== undefined) updates.default_discount_percent = default_discount_percent;

    const ps = await ProductSize.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ps) return res.status(404).json({ message: 'Not found' });
    res.json(ps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
