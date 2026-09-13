const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const StockBatch = require('../models/StockBatch');

// Helper: get or create Stock document
async function getOrCreateStock(warehouse_id, product_size_id) {
  let stock = await Stock.findOne({ warehouse_id, product_size_id });
  if (!stock) {
    stock = await Stock.create({ warehouse_id, product_size_id, quantity: 0, stock_value: 0 });
  }
  return stock;
}

// Helper: recalculate stock quantity + value from remaining batches
async function recalcStockValue(warehouse_id, product_size_id) {
  const batches = await StockBatch.find({
    warehouse_id,
    product_size_id,
    remaining_quantity: { $gt: 0 },
  });
  const qty = batches.reduce((s, b) => s + b.remaining_quantity, 0);
  const value = batches.reduce((s, b) => s + b.remaining_quantity * b.purchase_price, 0);
  await Stock.findOneAndUpdate(
    { warehouse_id, product_size_id },
    { quantity: qty, stock_value: value },
    { upsert: true }
  );
}

// Helper: FIFO deduction — returns total FIFO cost consumed (no session)
async function fifoDeduct(warehouse_id, product_size_id, qty) {
  // Re-fetch available stock to double-check
  const stock = await Stock.findOne({ warehouse_id, product_size_id });
  const available = stock?.quantity || 0;
  if (available < qty) {
    throw new Error(`Insufficient stock. Available quantity: ${available}`);
  }

  const batches = await StockBatch.find({
    warehouse_id,
    product_size_id,
    remaining_quantity: { $gt: 0 },
  }).sort({ received_date: 1, createdAt: 1 });

  let remaining = qty;
  let totalCost = 0;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.remaining_quantity, remaining);
    totalCost += take * batch.purchase_price;
    batch.remaining_quantity -= take;
    remaining -= take;
    await batch.save();
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock. Available quantity: ${qty - remaining}`);
  }

  return totalCost;
}

// ─── GET /api/transactions ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      type, warehouse_id, product_size_id,
      startDate, endDate,
      page = 1, limit = 50,
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (product_size_id) filter.product_size_id = product_size_id;
    if (warehouse_id) {
      filter.$or = [
        { from_warehouse_id: warehouse_id },
        { to_warehouse_id: warehouse_id },
      ];
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate({ path: 'product_size_id', populate: { path: 'product_id', select: 'name' } })
      .populate('from_warehouse_id', 'name')
      .populate('to_warehouse_id', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ transactions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/transactions/received ─────────────────────────────────────────
router.post('/received', async (req, res) => {
  try {
    const {
      date, bill_number, supplier_name,
      product_size_id, quantity, purchase_price, discount_percent,
      warehouse_id, notes,
    } = req.body;

    // Validation
    if (!date || !product_size_id || !quantity || !purchase_price || !warehouse_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const parsedQty = parseInt(quantity);
    const parsedPrice = parseFloat(purchase_price);
    const disc = parseFloat(discount_percent) || 0;
    if (parsedQty <= 0) return res.status(400).json({ message: 'Quantity must be positive' });
    if (parsedPrice <= 0) return res.status(400).json({ message: 'Purchase price must be positive' });
    if (disc < 0 || disc >= 100) return res.status(400).json({ message: 'Discount must be between 0 and 100' });

    const txDate = new Date(date);
    const discountAmount = parsedPrice * (disc / 100);
    const netPurchasePrice = parsedPrice - discountAmount;
    const purchaseAmount = parsedQty * netPurchasePrice;

    // 1. Create transaction record
    const transaction = await Transaction.create({
      type: 'RECEIVED',
      date: txDate,
      product_size_id,
      quantity: parsedQty,
      to_warehouse_id: warehouse_id,
      purchase_price: parsedPrice,
      discount_percent: disc,
      purchase_amount: purchaseAmount,
      bill_number: bill_number || '',
      supplier_name: supplier_name || '',
      notes: notes || '',
    });

    // 2. Create FIFO batch
    await StockBatch.create({
      warehouse_id,
      product_size_id,
      received_quantity: parsedQty,
      remaining_quantity: parsedQty,
      purchase_price: netPurchasePrice,
      received_date: txDate,
      received_transaction_id: transaction._id,
    });

    // 3. Ensure stock doc exists, then recalc
    await getOrCreateStock(warehouse_id, product_size_id);
    await recalcStockValue(warehouse_id, product_size_id);

    const populated = await Transaction.findById(transaction._id)
      .populate({ path: 'product_size_id', populate: { path: 'product_id', select: 'name' } })
      .populate('to_warehouse_id', 'name');

    res.status(201).json({ message: 'Stock received successfully', transaction: populated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── POST /api/transactions/given ────────────────────────────────────────────
router.post('/given', async (req, res) => {
  try {
    const {
      date, bill_number,
      warehouse_id, product_size_id,
      quantity, selling_price, discount_percent, notes,
    } = req.body;

    // Validation
    if (!date || !warehouse_id || !product_size_id || !quantity || selling_price === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const parsedQty = parseInt(quantity);
    const parsedPrice = parseFloat(selling_price);
    const disc = parseFloat(discount_percent) || 0;

    if (parsedQty <= 0) return res.status(400).json({ message: 'Quantity must be positive' });
    if (parsedPrice < 0) return res.status(400).json({ message: 'Selling price cannot be negative' });
    if (disc < 0 || disc >= 100) return res.status(400).json({ message: 'Discount must be between 0 and 100' });

    // Check stock BEFORE any writes
    const stock = await Stock.findOne({ warehouse_id, product_size_id });
    if (!stock || stock.quantity < parsedQty) {
      return res.status(400).json({
        message: `Insufficient stock. Available quantity: ${stock?.quantity || 0}`,
      });
    }

    // Calculate selling amount
    const discountAmount = parsedPrice * (disc / 100);
    const finalPrice = parsedPrice - discountAmount;
    const receivedAmount = finalPrice * parsedQty;

    // 1. FIFO deduct (updates batches in-place)
    const fifoCost = await fifoDeduct(warehouse_id, product_size_id, parsedQty);
    const avgFifoPrice = fifoCost / parsedQty;

    // 2. Recalc stock totals
    await recalcStockValue(warehouse_id, product_size_id);

    // 3. Create transaction record
    const transaction = await Transaction.create({
      type: 'GIVEN',
      date: new Date(date),
      product_size_id,
      quantity: parsedQty,
      from_warehouse_id: warehouse_id,
      purchase_price: avgFifoPrice,
      selling_price: parsedPrice,
      discount_percent: disc,
      purchase_amount: fifoCost,
      received_amount: receivedAmount,
      bill_number: bill_number || '',
      notes: notes || '',
    });

    const populated = await Transaction.findById(transaction._id)
      .populate({ path: 'product_size_id', populate: { path: 'product_id', select: 'name' } })
      .populate('from_warehouse_id', 'name');

    res.status(201).json({ message: 'Stock given successfully', transaction: populated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── POST /api/transactions/transfer ─────────────────────────────────────────
router.post('/transfer', async (req, res) => {
  try {
    const {
      date, from_warehouse_id, to_warehouse_id,
      product_size_id, quantity, notes,
    } = req.body;

    // Validation
    if (!date || !from_warehouse_id || !to_warehouse_id || !product_size_id || !quantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (from_warehouse_id === to_warehouse_id) {
      return res.status(400).json({ message: 'Cannot transfer to the same warehouse' });
    }
    const parsedQty = parseInt(quantity);
    if (parsedQty <= 0) return res.status(400).json({ message: 'Quantity must be positive' });

    // Check source stock BEFORE any writes
    const stock = await Stock.findOne({ warehouse_id: from_warehouse_id, product_size_id });
    if (!stock || stock.quantity < parsedQty) {
      return res.status(400).json({
        message: `Insufficient stock. Available quantity: ${stock?.quantity || 0}`,
      });
    }

    // Fetch FIFO batches to determine cost and preserve original prices
    const batches = await StockBatch.find({
      warehouse_id: from_warehouse_id,
      product_size_id,
      remaining_quantity: { $gt: 0 },
    }).sort({ received_date: 1, createdAt: 1 });

    let remaining = parsedQty;
    let totalCost = 0;
    const newBatches = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.remaining_quantity, remaining);
      totalCost += take * batch.purchase_price;

      // Build new batch for destination (same price & date = FIFO preserved)
      newBatches.push({
        warehouse_id: to_warehouse_id,
        product_size_id,
        received_quantity: take,
        remaining_quantity: take,
        purchase_price: batch.purchase_price,
        received_date: batch.received_date,
        received_transaction_id: batch.received_transaction_id,
      });

      batch.remaining_quantity -= take;
      remaining -= take;
      await batch.save();
    }

    if (remaining > 0) {
      return res.status(400).json({
        message: `Insufficient stock. Available quantity: ${parsedQty - remaining}`,
      });
    }

    // Insert new batches into destination warehouse
    await StockBatch.insertMany(newBatches);

    const avgPrice = totalCost / parsedQty;

    // Create transaction record (no purchase_amount / received_amount — transfer is neutral)
    const transaction = await Transaction.create({
      type: 'TRANSFER',
      date: new Date(date),
      product_size_id,
      quantity: parsedQty,
      from_warehouse_id,
      to_warehouse_id,
      purchase_price: avgPrice,
      notes: notes || '',
    });

    // Ensure dest stock doc exists, then recalc both warehouses
    await getOrCreateStock(to_warehouse_id, product_size_id);
    await recalcStockValue(from_warehouse_id, product_size_id);
    await recalcStockValue(to_warehouse_id, product_size_id);

    const populated = await Transaction.findById(transaction._id)
      .populate({ path: 'product_size_id', populate: { path: 'product_id', select: 'name' } })
      .populate('from_warehouse_id', 'name')
      .populate('to_warehouse_id', 'name');

    res.status(201).json({ message: 'Stock transferred successfully', transaction: populated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
