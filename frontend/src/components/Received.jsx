import { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { api, formatINR, formatDate, todayISO } from '../api';

const DISCOUNT_PRESETS = [0, 1, 2, 3, 5, 10];

export default function Received({ showToast }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Form state
  const [form, setForm] = useState({
    date: todayISO(),
    bill_number: '',
    supplier_name: '',
    product_size_id: '',
    quantity: '',
    purchase_price: '',
    discount_percent: '0',
    warehouse_id: '',
    notes: '',
  });

  const [selectedPS, setSelectedPS] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txData, productData, whData] = await Promise.all([
        api.getTransactions({ type: 'RECEIVED', limit: 50 }),
        api.getProducts(),
        api.getWarehouses(),
      ]);
      setTransactions(txData.transactions || []);
      setProducts(productData || []);
      setWarehouses(whData || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Flat list of product sizes
  const allSizes = products.flatMap(p =>
    (p.sizes || []).map(s => ({
      ...s,
      label: `${p.name} – ${s.size}`,
      productName: p.name,
    }))
  );

  const handleProductSizeChange = (e) => {
    const psid = e.target.value;
    setForm(f => ({ ...f, product_size_id: psid, purchase_price: '' }));
    const ps = allSizes.find(s => s._id === psid);
    if (ps) {
      setSelectedPS(ps);
      setForm(f => ({
        ...f,
        purchase_price: ps.current_purchase_price.toString(),
        discount_percent: '0',
      }));
    } else {
      setSelectedPS(null);
    }
  };

  // Calculation display
  const disc = parseFloat(form.discount_percent) || 0;
  const purchasePrice = parseFloat(form.purchase_price) || 0;
  const discountAmount = purchasePrice * (disc / 100);
  const finalPrice = purchasePrice - discountAmount;
  const total = finalPrice * (parseInt(form.quantity) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_size_id) { showToast('Select a product', 'error'); return; }
    if (!form.warehouse_id) { showToast('Select a warehouse', 'error'); return; }
    if (!form.quantity || parseInt(form.quantity) <= 0) { showToast('Enter valid quantity', 'error'); return; }
    if (!form.purchase_price || parseFloat(form.purchase_price) <= 0) { showToast('Enter valid purchase price', 'error'); return; }

    setSubmitting(true);
    try {
      await api.addReceived(form);
      showToast('Stock received successfully', 'success');
      setShowForm(false);
      setForm({
        date: todayISO(),
        bill_number: '',
        supplier_name: '',
        product_size_id: '',
        quantity: '',
        purchase_price: '',
        discount_percent: '0',
        warehouse_id: '',
        notes: '',
      });
      setSelectedPS(null);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page slide-in">
      <div className="page-title-row">
        <h2 className="page-title">Received</h2>
        <button
          id="add-received-btn"
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
        >
          <Plus size={16} /> Add Stock
        </button>
      </div>

      {/* Recent Received Transactions */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📥</div>
          <p className="empty-text">No received stock yet.<br />Tap "Add Stock" to begin.</p>
        </div>
      ) : (
        <div className="tx-list">
          {transactions.map(tx => (
            <div key={tx._id} className="tx-item">
              <div className="tx-item-header">
                <div>
                  <div className="tx-product">
                    {tx.product_size_id?.product_id?.name} – {tx.product_size_id?.size}
                  </div>
                  <div className="tx-meta">
                    <span>📦 {tx.quantity} bags</span>
                    <span>🏭 {tx.to_warehouse_id?.name}</span>
                    {tx.bill_number && <span>Bill #{tx.bill_number}</span>}
                    {tx.supplier_name && <span>{tx.supplier_name}</span>}
                    {tx.discount_percent > 0 && <span>Disc {tx.discount_percent}%</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tx-badge received">Received</span>
                  <div className="tx-amount" style={{ color: 'var(--accent-blue)', marginTop: 4 }}>
                    {formatINR(tx.purchase_amount)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  @ {formatINR(tx.purchase_price)}/bag
                  {tx.discount_percent > 0 && ` (${tx.discount_percent}% off)`}
                </span>
                <span className="tx-date">{formatDate(tx.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Received Form Modal */}
      {showForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add Received Stock">
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <h3 className="modal-title" style={{ marginBottom: 0 }}>Add Received Stock</h3>
              <button
                id="close-received-form"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} id="received-stock-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="rx-date">Date</label>
                  <input
                    id="rx-date"
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="rx-bill">Bill Number</label>
                  <input
                    id="rx-bill"
                    type="text"
                    className="form-input"
                    placeholder="Optional"
                    value={form.bill_number}
                    onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rx-supplier">Supplier Name</label>
                <input
                  id="rx-supplier"
                  type="text"
                  className="form-input"
                  placeholder="Optional"
                  value={form.supplier_name}
                  onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rx-product">Product & Size</label>
                <select
                  id="rx-product"
                  className="form-select"
                  value={form.product_size_id}
                  onChange={handleProductSizeChange}
                  required
                >
                  <option value="">Select product...</option>
                  {products.map(p =>
                    (p.sizes || []).map(s => (
                      <option key={s._id} value={s._id}>
                        {p.name} – {s.size}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rx-warehouse">Warehouse</label>
                <select
                  id="rx-warehouse"
                  className="form-select"
                  value={form.warehouse_id}
                  onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                  required
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w._id} value={w._id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rx-qty">Quantity (Bags)</label>
                <input
                  id="rx-qty"
                  type="number"
                  className="form-input"
                  placeholder="0"
                  min="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="rx-price">Purchase Price (₹)</label>
                  <input
                    id="rx-price"
                    type="number"
                    className="form-input"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="rx-discount">Discount %</label>
                  <input
                    id="rx-discount"
                    type="number"
                    className="form-input"
                    placeholder="0"
                    min="0"
                    max="99"
                    step="0.1"
                    value={form.discount_percent}
                    onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))}
                  />
                </div>
              </div>

              {/* Quick discount presets */}
              <div className="filter-bar" style={{ marginBottom: 'var(--space-4)', marginTop: '-var(--space-2)' }}>
                {DISCOUNT_PRESETS.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`filter-chip ${form.discount_percent == d ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, discount_percent: d.toString() }))}
                  >
                    {d}%
                  </button>
                ))}
              </div>

              {/* Total Display */}
              {form.purchase_price && form.quantity && (
                <div className="calc-display">
                  <div className="calc-display-label">Total Purchase Amount</div>
                  <div className="calc-display-value">{formatINR(total)}</div>
                  <div className="calc-breakdown">
                    {formatINR(purchasePrice)} - {disc}% = {formatINR(finalPrice)}/bag × {form.quantity || 0} bags
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="rx-notes">Notes</label>
                <input
                  id="rx-notes"
                  type="text"
                  className="form-input"
                  placeholder="Optional"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <button
                id="submit-received"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : '✓ Save Received Stock'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
