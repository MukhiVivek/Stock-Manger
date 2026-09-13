const Product = require('./models/Product');
const ProductSize = require('./models/ProductSize');
const Warehouse = require('./models/Warehouse');

const PRODUCTS = [
  'Bhagwati Besan',
  'Gaay Besan',
  'Jadu Besan',
  '1962 Besan',
  'Super Besan',
  'Deluxe Besan',
  'Soji',
];

const SIZES = [
  { size: '10 KG', purchase: 400, selling: 450, discount: 2 },
  { size: '30 KG', purchase: 1200, selling: 1300, discount: 2 },
  { size: '50 KG', purchase: 2000, selling: 2150, discount: 2 },
];

const WAREHOUSES = ['Warehouse 1', 'Warehouse 2', 'Warehouse 3'];

async function seedDatabase() {
  try {
    // Check if already seeded
    const warehouseCount = await Warehouse.countDocuments();
    if (warehouseCount > 0) {
      console.log('Database already seeded. Skipping...');
      return;
    }

    console.log('Seeding database...');

    // Create warehouses
    const warehouses = await Warehouse.insertMany(
      WAREHOUSES.map(name => ({ name }))
    );
    console.log(`✓ Created ${warehouses.length} warehouses`);

    // Create products and product sizes
    let totalSizes = 0;
    for (const productName of PRODUCTS) {
      const product = await Product.create({ name: productName });
      const sizes = SIZES.map(s => ({
        product_id: product._id,
        size: s.size,
        current_purchase_price: s.purchase,
        current_selling_price: s.selling,
        default_discount_percent: s.discount,
      }));
      await ProductSize.insertMany(sizes);
      totalSizes += sizes.length;
    }

    console.log(`✓ Created ${PRODUCTS.length} products with ${totalSizes} size variants`);
    console.log('✓ Database seeded successfully!');
  } catch (err) {
    console.error('Seeding error:', err.message);
    throw err;
  }
}

module.exports = seedDatabase;
