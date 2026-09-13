const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const Warehouse = require('../models/Warehouse');
const ProductSize = require('../models/ProductSize');
const Product = require('../models/Product');

// Helper: get date range for period
function getDateRange(period, startDate, endDate) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd };
    case 'yesterday': {
      const s = new Date(todayStart.getTime() - 86400000);
      const e = new Date(todayStart.getTime() - 1);
      return { start: s, end: e };
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'custom':
      return {
        start: new Date(startDate),
        end: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    default:
      return null;
  }
}

// GET /api/dashboard - Lifetime metrics
router.get('/', async (req, res) => {
  try {
    // Total Purchase: sum of purchase_amount from RECEIVED transactions (not reversed)
    const purchaseAgg = await Transaction.aggregate([
      { $match: { type: 'RECEIVED', is_reversed: false } },
      { $group: { _id: null, total: { $sum: '$purchase_amount' } } },
    ]);
    const totalPurchase = purchaseAgg[0]?.total || 0;

    // Total Received: sum of received_amount from GIVEN transactions (not reversed)
    const receivedAgg = await Transaction.aggregate([
      { $match: { type: 'GIVEN', is_reversed: false } },
      { $group: { _id: null, total: { $sum: '$received_amount' } } },
    ]);
    const totalReceived = receivedAgg[0]?.total || 0;

    // Current Stock Value: sum of all stock_value in Stock collection
    const stockValueAgg = await Stock.aggregate([
      { $group: { _id: null, total: { $sum: '$stock_value' } } },
    ]);
    const currentStockValue = stockValueAgg[0]?.total || 0;

    // Lifetime Profit
    const lifetimeProfit = totalReceived - totalPurchase + currentStockValue;

    // Warehouse Summary
    const warehouses = await Warehouse.find({ active: true }).lean();
    const warehouseSummary = [];
    for (const wh of warehouses) {
      const stockAgg = await Stock.aggregate([
        { $match: { warehouse_id: wh._id } },
        {
          $group: {
            _id: null,
            totalQty: { $sum: '$quantity' },
            totalValue: { $sum: '$stock_value' },
          },
        },
      ]);
      warehouseSummary.push({
        _id: wh._id,
        name: wh.name,
        totalQuantity: stockAgg[0]?.totalQty || 0,
        totalValue: stockAgg[0]?.totalValue || 0,
      });
    }

    res.json({
      totalPurchase,
      totalReceived,
      currentStockValue,
      lifetimeProfit,
      warehouseSummary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/dashboard/report?period=today|yesterday|this_month|last_month|custom&startDate=&endDate=
router.get('/report', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const range = getDateRange(period, startDate, endDate);

    if (!range) {
      return res.status(400).json({ message: 'Invalid period' });
    }

    const dateFilter = { date: { $gte: range.start, $lte: range.end } };

    // Period Purchase
    const pAgg = await Transaction.aggregate([
      { $match: { type: 'RECEIVED', is_reversed: false, ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$purchase_amount' } } },
    ]);
    const periodPurchase = pAgg[0]?.total || 0;

    // Period Selling (received_amount from GIVEN)
    const sAgg = await Transaction.aggregate([
      { $match: { type: 'GIVEN', is_reversed: false, ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$received_amount' } } },
    ]);
    const periodSelling = sAgg[0]?.total || 0;

    // Period FIFO cost of goods sold (purchase_amount in GIVEN = FIFO cost)
    const cAgg = await Transaction.aggregate([
      { $match: { type: 'GIVEN', is_reversed: false, ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$purchase_amount' } } },
    ]);
    const periodCost = cAgg[0]?.total || 0;

    // Period Profit = Selling - FIFO Cost
    const periodProfit = periodSelling - periodCost;

    res.json({
      period,
      startDate: range.start,
      endDate: range.end,
      periodPurchase,
      periodSelling,
      periodCost,
      periodProfit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
