const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const Warehouse = require('../models/Warehouse');
const ProductSize = require('../models/ProductSize');
const Product = require('../models/Product');

// GET /api/stock?warehouse_id=&product_id=&size=&search=&product_size_id=
router.get('/', async (req, res) => {
  try {
    const { warehouse_id, product_id, product_size_id, size, search } = req.query;

    // Build product size filter
    let productSizeIds = null;
    if (product_size_id) {
      // Direct product_size_id filter
      productSizeIds = [product_size_id];
    } else if (product_id || size || search) {
      const psFilter = {};
      if (size) psFilter.size = size;
      if (product_id) psFilter.product_id = product_id;

      if (search) {
        const matchedProducts = await Product.find({ name: { $regex: search, $options: 'i' } }).lean();
        const matchedIds = matchedProducts.map(p => p._id);
        psFilter.product_id = { $in: matchedIds };
      }

      const psList = await ProductSize.find(psFilter).lean();
      productSizeIds = psList.map(ps => ps._id);
    }

    const stockFilter = { quantity: { $gt: 0 } };
    if (warehouse_id) stockFilter.warehouse_id = warehouse_id;
    if (productSizeIds) stockFilter.product_size_id = { $in: productSizeIds };

    const stocks = await Stock.find(stockFilter)
      .populate({
        path: 'product_size_id',
        populate: { path: 'product_id', select: 'name' },
      })
      .populate('warehouse_id', 'name')
      .lean();

    res.json(stocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stock/summary - grouped by product+size across all warehouses
router.get('/summary', async (req, res) => {
  try {
    const { product_size_id } = req.query;
    const filter = { quantity: { $gt: 0 } };
    if (product_size_id) filter.product_size_id = product_size_id;

    const stocks = await Stock.find(filter)
      .populate({ path: 'product_size_id', populate: { path: 'product_id', select: 'name' } })
      .populate('warehouse_id', 'name')
      .lean();

    // Group by product_size_id
    const grouped = {};
    for (const s of stocks) {
      const key = s.product_size_id._id.toString();
      if (!grouped[key]) {
        grouped[key] = {
          product_size_id: s.product_size_id,
          warehouses: [],
          totalQuantity: 0,
          totalValue: 0,
        };
      }
      grouped[key].warehouses.push({
        warehouse: s.warehouse_id,
        quantity: s.quantity,
        value: s.stock_value,
      });
      grouped[key].totalQuantity += s.quantity;
      grouped[key].totalValue += s.stock_value;
    }

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
