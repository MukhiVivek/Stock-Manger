const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');

// GET /api/warehouses
router.get('/', async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ active: true }).lean();
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
