# Implementation Plan - Simple Warehouse Stock Management Application

Build a MERN (MongoDB, Express, React, Node.js) web application for simple warehouse stock management with strict FIFO stock costing, multi-warehouse support, period reports, and a premium mobile-first UI.

## User Review Required

> [!IMPORTANT]
> **Data Seeding & Initial Config:**
> We will automatically seed the database with the **3 Warehouses** (Warehouse 1, Warehouse 2, Warehouse 3) and the **7 Products** (Bhagwati Besan, Gaay Besan, Jadu Besan, 1962 Besan, Super Besan, Deluxe Besan, Soji) in all **3 Sizes** (10 KG, 30 KG, 50 KG) with default pricing:
> * **10 KG:** Purchase Price: ₹400, Selling Price: ₹450, Default Discount: 2%
> * **30 KG:** Purchase Price: ₹1,200, Selling Price: ₹1,300, Default Discount: 2%
> * **50 KG:** Purchase Price: ₹2,000, Selling Price: ₹2,150, Default Discount: 2%
>
> You can update these prices/discounts directly within the application or via database seeding if preferred.

> [!WARNING]
> **FIFO Stock Valuation & Out of Stock Logic:**
> * When giving/selling stock, the application uses **First-In-First-Out (FIFO)** to consume older stock batches first.
> * If a user tries to sell or transfer more stock of a product-size than is currently available in that warehouse, the transaction is rejected with a validation error (e.g., `Insufficient stock. Available quantity: 50`).
> * Stock transfers preserve the original purchase prices and date of the batches.

## Open Questions

> [!NOTE]
> 1. Is the default pricing structure for seeding satisfactory for your initial setup?
> 2. Should we host the MongoDB database locally at `mongodb://127.0.0.1:27017/stock-manager` by default? (We will support configurable database URIs via a `.env` file).

---

## Proposed Changes

We will create a MERN structure inside `/Users/vivekmukhi/Documents/project /business project/Stock Manger `:
* `backend/` for the Express API server and MongoDB integration.
* `frontend/` for the Vite React frontend client.
* A root `package.json` for managing dev runs.

---

### Root Configuration

#### [NEW] [package.json](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/package.json)
Configure scripts to install dependencies and run both frontend and backend concurrently.

---

### Backend Components

The backend handles the REST API, schema definitions, and FIFO computations.

#### [NEW] [package.json](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/package.json)
Add Express, Mongoose, CORS, and dotenv dependencies.

#### [NEW] [Product.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/models/Product.js)
Define `Product` schema:
* `name`: String (unique)
* `active`: Boolean
* `createdAt`: Date

#### [NEW] [ProductSize.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/models/ProductSize.js)
Define `ProductSize` schema:
* `product_id`: ref Product
* `size`: String ('10 KG', '30 KG', '50 KG')
* `current_purchase_price`: Number
* `current_selling_price`: Number
* `default_discount_percent`: Number

#### [NEW] [Warehouse.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/models/Warehouse.js)
Define `Warehouse` schema:
* `name`: String (unique)
* `active`: Boolean

#### [NEW] [Stock.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/models/Stock.js)
Define aggregated `Stock` schema:
* `warehouse_id`: ref Warehouse
* `product_size_id`: ref ProductSize
* `quantity`: Number
* `stock_value`: Number (sum of `remaining_quantity * purchase_price` of active batches)

#### [NEW] [StockBatch.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/models/StockBatch.js)
Define FIFO tracking `StockBatch` schema:
* `warehouse_id`: ref Warehouse
* `product_size_id`: ref ProductSize
* `received_quantity`: Number
* `remaining_quantity`: Number
* `purchase_price`: Number
* `received_date`: Date
* `received_transaction_id`: ref Transaction

#### [NEW] [Transaction.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/models/Transaction.js)
Define permanent `Transaction` logging schema:
* `type`: Enum ('RECEIVED', 'GIVEN', 'TRANSFER')
* `date`: Date
* `product_size_id`: ref ProductSize
* `quantity`: Number
* `from_warehouse_id`: ref Warehouse (GIVEN, TRANSFER)
* `to_warehouse_id`: ref Warehouse (RECEIVED, TRANSFER)
* `purchase_price`: Number (FIFO unit cost for GIVEN, actual price for RECEIVED)
* `selling_price`: Number (GIVEN)
* `discount_percent`: Number (GIVEN)
* `purchase_amount`: Number (for RECEIVED = `purchase_price * quantity`, for GIVEN = `fifo_cost`)
* `received_amount`: Number (for GIVEN = `final_selling_price * quantity`)
* `bill_number`: String
* `notes`: String
* `createdAt`: Date

#### [NEW] [dashboard.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/routes/dashboard.js)
Endpoints:
1. `GET /api/dashboard`: Calculate and return:
   * **Total Purchase**: Sum of `purchase_amount` of RECEIVED transactions.
   * **Total Received**: Sum of `received_amount` of GIVEN transactions.
   * **Current Stock Value**: Sum of `stock_value` from `Stock` collection.
   * **Lifetime Profit**: `Total Received - Total Purchase + Current Stock Value`.
   * **Warehouse Summary**: List of warehouses with total stock quantities and values.
2. `GET /api/dashboard/report`: Calculate and return Period Reports based on selected filters (Today, Yesterday, This Month, Last Month, Custom Date):
   * **Period Purchase**: Sum of `purchase_amount` of RECEIVED transactions in the period.
   * **Period Received**: Sum of `received_amount` of GIVEN transactions in the period.
   * **Period FIFO Cost**: Sum of `purchase_amount` (the FIFO cost recorded) of GIVEN transactions in the period.
   * **Period Profit**: `Period Received - Period FIFO Cost`.
   * **Change in Stock Value**: `Period Purchase - Period FIFO Cost`.

#### [NEW] [transactions.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/routes/transactions.js)
Endpoints:
1. `GET /api/transactions`: Search/filter transaction history.
2. `POST /api/transactions/received`: Record newly purchased stock. Increments stock, adds to batches, updates dashboard figures.
3. `POST /api/transactions/given`: Record sale. Employs FIFO deduction from `StockBatch` and validates stock limits.
4. `POST /api/transactions/transfer`: Transfer stock between warehouses. Subtracts FIFO from source warehouse batches, inserts corresponding batches into target warehouse with original prices and dates, without impacting profits.

#### [NEW] [products.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/routes/products.js)
Endpoints to fetch products, sizes, prices, and update default pricing.

#### [NEW] [warehouses.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/routes/warehouses.js)
Endpoint to fetch warehouses.

#### [NEW] [index.js](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/backend/src/index.js)
Configure DB connection, load routers, and auto-seed database on startup if no data is found.

---

### Frontend Components

The React app provides a premium, responsive user experience utilizing high-end CSS customization.

#### [NEW] [package.json](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/package.json)
Configure dependencies (`react`, `react-dom`, `lucide-react`) and Vite.

#### [NEW] [index.html](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/index.html)
Add premium fonts (Outfit and Inter from Google Fonts), viewport parameters, and the light/dark mode flash prevention script.

#### [NEW] [main.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/main.jsx)
React entry mounting.

#### [NEW] [App.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/App.jsx)
Core layout containing the bottom navigation bar and views switching (Home, Received, Given, Stock). Handles global toast alerts and themes.

#### [NEW] [index.css](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/index.css)
Custom stylesheets featuring:
* Premium Dark & Light UI using CSS custom properties (`light-dark()`).
* Glassmorphism, smooth micro-animations, custom scrollbars, and inputs.
* Responsive layouts tailored for smartphones and larger tablet/desktop displays.

#### [NEW] [Home.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/components/Home.jsx)
Display the 4 key metrics, Period Report selector (and custom date modal), and Warehouse summaries. Includes a button to view Transaction History.

#### [NEW] [Received.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/components/Received.jsx)
The intake tracker. Displays a record of recent receipts and the "+ Add Received Stock" form.

#### [NEW] [Given.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/components/Given.jsx)
The outgoing stock logger. Features a dual-tab selector `[ Give Stock ]` or `[ Transfer ]` rendering respective validation-supported forms.

#### [NEW] [Stock.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/components/Stock.jsx)
Real-time inventory grid. Includes searching, filtering by Warehouse/Product/Size, and shows individual & aggregated stock totals.

#### [NEW] [History.jsx](file:///Users/vivekmukhi/Documents/project%20/business%20project/Stock%20Manger%20/frontend/src/components/History.jsx)
Transaction history view with filters by Type, Product, Warehouse, and Date.

---

## Verification Plan

### Automated Tests
* We will verify endpoints and stock calculations by running unit/integration tests or validation scripts in `backend/src/tests/` or manually using curl command runs.

### Manual Verification
1. Open the application in the browser.
2. Check automatic database seeding (21 product-sizes and 3 warehouses).
3. Test **RECEIVED** transactions: Add stock for Bhagwati Besan 30 KG in Warehouse 1 at ₹1,200. Verify stock card increases.
4. Test **GIVEN** transactions:
   * Try selling Bhagwati Besan 30 KG in Warehouse 1 with quantity 10 -> verify it succeeds and calculates prices properly.
   * Try selling quantity 60 -> verify it blocks due to insufficient stock.
5. Test **TRANSFER** transactions: Transfer stock from Warehouse 1 to Warehouse 2 and verify quantity is correctly adjusted and profit metrics are unchanged.
6. Check **Period Report** toggles (Today, Yesterday, etc.) to verify math correctness.
7. Test **Dark Mode** toggle and responsive mobile viewport layouts.
