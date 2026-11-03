const Product = require('./models/Product');
const ProductSize = require('./models/ProductSize');
const Warehouse = require('./models/Warehouse');

const PRODUCTS = [
  'Gaay Besan',
  'Jadu Besan',
  'Super Besan',
  'Deluxe Besan',
  'Soji',
  'Deluxe Maido',
  'Tanduri Atta'
];

const SIZES = [
  { size: '30 KG', purchase: 1200, selling: 1300, discount: 2 },
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
