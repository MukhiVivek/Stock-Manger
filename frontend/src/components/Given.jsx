import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeftRight, X } from 'lucide-react';
import { api, formatINR, formatDate, todayISO } from '../api';

const DISCOUNT_PRESETS = [0, 1, 2, 3, 5, 10];

export default function Given({ showToast }) {
  const [activeTab, setActiveTab] = useState('give'); // 'give' | 'transfer'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [availableStock, setAvailableStock] = useState(null);

  // Give form
  const [giveForm, setGiveForm] = useState({
    date: todayISO(),
    bill_number: '',
    warehouse_id: '',
    product_size_id: '',
    quantity: '',
    selling_price: '',
    discount_percent: '0',
    notes: '',
  });

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    date: todayISO(),
    from_warehouse_id: '',
    to_warehouse_id: '',
    product_size_id: '',
    quantity: '',
    notes: '',
  });

  const [selectedPS, setSelectedPS] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txData, productData, whData] = await Promise.all([
        api.getTransactions({ type: activeTab === 'give' ? 'GIVEN' : 'TRANSFER', limit: 50 }),
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
  }, [showToast, activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch available stock when warehouse+product changes
  const fetchAvailableStock = useCallback(async (warehouseId, productSizeId) => {
    if (!warehouseId || !productSizeId) { setAvailableStock(null); return; }
    try {
      const stocks = await api.getStock({ warehouse_id: warehouseId, product_size_id: productSizeId });
      const s = stocks.find(s => s.product_size_id._id === productSizeId && s.warehouse_id._id === warehouseId);
      setAvailableStock(s?.quantity ?? 0);
    } catch {
      setAvailableStock(null);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'give') {
      fetchAvailableStock(giveForm.warehouse_id, giveForm.product_size_id);
    } else {
      fetchAvailableStock(transferForm.from_warehouse_id, transferForm.product_size_id);
    }
  }, [giveForm.warehouse_id, giveForm.product_size_id, transferForm.from_warehouse_id, transferForm.product_size_id, activeTab, fetchAvailableStock]);

  const handleProductSizeChange = (psid) => {
    const ps = products.flatMap(p => (p.sizes || []).map(s => ({ ...s, productName: p.name }))).find(s => s._id === psid);
    setSelectedPS(ps || null);
    if (activeTab === 'give') {
      setGiveForm(f => ({
        ...f,
        product_size_id: psid,
        selling_price: ps ? ps.current_selling_price.toString() : '',
        discount_percent: ps ? ps.default_discount_percent.toString() : '0',
      }));
    } else {
      setTransferForm(f => ({ ...f, product_size_id: psid }));
    }
  };

  // Calculation
  const disc = parseFloat(giveForm.discount_percent) || 0;
  const sellingPrice = parseFloat(giveForm.selling_price) || 0;
  const discountAmount = sellingPrice * (disc / 100);
  const finalPrice = sellingPrice - discountAmount;
  const total = finalPrice * (parseInt(giveForm.quantity) || 0);

  const handleGiveSubmit = async (e) => {
    e.preventDefault();
    if (!giveForm.warehouse_id) { showToast('Select a warehouse', 'error'); return; }
    if (!giveForm.product_size_id) { showToast('Select a product', 'error'); return; }
    if (!giveForm.quantity || parseInt(giveForm.quantity) <= 0) { showToast('Enter valid quantity', 'error'); return; }

    const qty = parseInt(giveForm.quantity);
    if (availableStock !== null && qty > availableStock) {
      showToast(`Insufficient stock. Available: ${availableStock} bags`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.addGiven(giveForm);
      showToast('Stock given successfully', 'success');
      setShowForm(false);
      setGiveForm({ date: todayISO(), bill_number: '', warehouse_id: '', product_size_id: '', quantity: '', selling_price: '', discount_percent: '0', notes: '' });
      setSelectedPS(null);
      setAvailableStock(null);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (transferForm.from_warehouse_id === transferForm.to_warehouse_id) {
      showToast('Cannot transfer to same warehouse', 'error'); return;
    }
    if (!transferForm.quantity || parseInt(transferForm.quantity) <= 0) {
      showToast('Enter valid quantity', 'error'); return;
    }

    const qty = parseInt(transferForm.quantity);
    if (availableStock !== null && qty > availableStock) {
      showToast(`Insufficient stock. Available: ${availableStock} bags`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.addTransfer(transferForm);
      showToast('Stock transferred successfully', 'success');
      setShowForm(false);
      setTransferForm({ date: todayISO(), from_warehouse_id: '', to_warehouse_id: '', product_size_id: '', quantity: '', notes: '' });
      setAvailableStock(null);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowForm(false);
    setAvailableStock(null);
  };

  return (
    <div className="page slide-in">
      <div className="page-title-row">
        <h2 className="page-title">Given</h2>
        <button
          id="add-given-btn"
          className="btn btn-success"
          onClick={() => setShowForm(true)}
        >
          <Plus size={16} /> New
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="tab-switcher" role="tablist">
        <button
          id="tab-give"
          className={`tab-btn ${activeTab === 'give' ? 'active' : ''}`}
          onClick={() => handleTabChange('give')}
          role="tab"
          aria-selected={activeTab === 'give'}
        >
          <Plus size={15} /> Give Stock
        </button>
        <button
          id="tab-transfer"
          className={`tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
          onClick={() => handleTabChange('transfer')}
          role="tab"
          aria-selected={activeTab === 'transfer'}
        >
          <ArrowLeftRight size={15} /> Transfer
        </button>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{activeTab === 'give' ? '📤' : '🔄'}</div>
          <p className="empty-text">
            {activeTab === 'give' ? 'No given stock yet.' : 'No transfers yet.'}
          </p>
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
                    {tx.type === 'GIVEN' && <span>🏭 {tx.from_warehouse_id?.name}</span>}
                    {tx.type === 'TRANSFER' && (
                      <span>
                        {tx.from_warehouse_id?.name} → {tx.to_warehouse_id?.name}
                      </span>
                    )}
                    {tx.bill_number && <span>Bill #{tx.bill_number}</span>}
                    {tx.type === 'GIVEN' && tx.discount_percent > 0 && (
                      <span>Disc {tx.discount_percent}%</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`tx-badge ${tx.type.toLowerCase()}`}>{tx.type}</span>
                  {tx.type === 'GIVEN' && (
                    <div className="tx-amount credit" style={{ marginTop: 4 }}>
                      {formatINR(tx.received_amount)}
                    </div>
                  )}
                  {tx.type === 'TRANSFER' && (
                    <div className="tx-amount neutral" style={{ marginTop: 4, fontSize: '0.8rem' }}>
                      {tx.quantity} bags
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {tx.type === 'GIVEN' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    @ {formatINR(tx.selling_price)}/bag
                    {tx.discount_percent > 0 && ` (${tx.discount_percent}% off)`}
                  </span>
                )}
                <span className="tx-date" style={{ marginLeft: 'auto' }}>{formatDate(tx.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <h3 className="modal-title" style={{ marginBottom: 0 }}>
                {activeTab === 'give' ? 'Give Stock' : 'Transfer Stock'}
              </h3>
              <button id="close-given-form" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {activeTab === 'give' ? (
              // Give Stock Form
              <form onSubmit={handleGiveSubmit} id="give-stock-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="gv-date">Date</label>
                    <input id="gv-date" type="date" className="form-input"
                      value={giveForm.date}
                      onChange={e => setGiveForm(f => ({ ...f, date: e.target.value }))}
                      required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="gv-bill">Bill Number</label>
                    <input id="gv-bill" type="text" className="form-input" placeholder="Optional"
                      value={giveForm.bill_number}
                      onChange={e => setGiveForm(f => ({ ...f, bill_number: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gv-warehouse">Warehouse</label>
                  <select id="gv-warehouse" className="form-select"
                    value={giveForm.warehouse_id}
                    onChange={e => setGiveForm(f => ({ ...f, warehouse_id: e.target.value }))}
                    required>
                    <option value="">Select warehouse...</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gv-product">Product & Size</label>
                  <select id="gv-product" className="form-select"
                    value={giveForm.product_size_id}
                    onChange={e => handleProductSizeChange(e.target.value)}
                    required>
                    <option value="">Select product...</option>
                    {products.map(p =>
                      (p.sizes || []).map(s => (
                        <option key={s._id} value={s._id}>{p.name} – {s.size}</option>
                      ))
                    )}
                  </select>
                  {availableStock !== null && (
                    <div className="form-helper">
                      <span className="avail-badge">📦 Available: {availableStock} bags</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gv-qty">Quantity (Bags)</label>
                  <input id="gv-qty" type="number" className="form-input" placeholder="0" min="1"
                    value={giveForm.quantity}
                    onChange={e => setGiveForm(f => ({ ...f, quantity: e.target.value }))}
                    required />
                  {availableStock !== null && parseInt(giveForm.quantity) > availableStock && (
                    <div className="form-error">
                      ⚠ Insufficient stock. Available: {availableStock} bags
                    </div>
                  )}
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="gv-price">Selling Price (₹)</label>
                    <input id="gv-price" type="number" className="form-input" placeholder="0" min="0" step="0.01"
                      value={giveForm.selling_price}
                      onChange={e => setGiveForm(f => ({ ...f, selling_price: e.target.value }))}
                      required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="gv-discount">Discount %</label>
                    <input id="gv-discount" type="number" className="form-input" placeholder="0" min="0" max="99" step="0.1"
                      value={giveForm.discount_percent}
                      onChange={e => setGiveForm(f => ({ ...f, discount_percent: e.target.value }))} />
                  </div>
                </div>

                {/* Quick discount presets */}
                <div className="filter-bar" style={{ marginBottom: 'var(--space-4)', marginTop: '-var(--space-2)' }}>
                  {DISCOUNT_PRESETS.map(d => (
                    <button key={d} type="button"
                      className={`filter-chip ${giveForm.discount_percent == d ? 'active' : ''}`}
                      onClick={() => setGiveForm(f => ({ ...f, discount_percent: d.toString() }))}>
                      {d}%
                    </button>
                  ))}
                </div>

                {/* Calculation Display */}
                {giveForm.selling_price && giveForm.quantity && (
                  <div className="calc-display">
                    <div className="calc-display-label">Total Received</div>
                    <div className="calc-display-value">{formatINR(total)}</div>
                    <div className="calc-breakdown">
                      {formatINR(sellingPrice)} - {disc}% = {formatINR(finalPrice)}/bag
                      × {giveForm.quantity || 0} bags
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="gv-notes">Notes</label>
                  <input id="gv-notes" type="text" className="form-input" placeholder="Optional"
                    value={giveForm.notes}
                    onChange={e => setGiveForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <button id="submit-give" type="submit" className="btn btn-success btn-full btn-lg" disabled={submitting}>
                  {submitting ? 'Saving...' : '✓ Save Given Stock'}
                </button>
              </form>
            ) : (
              // Transfer Form
              <form onSubmit={handleTransferSubmit} id="transfer-stock-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="tr-date">Date</label>
                    <input id="tr-date" type="date" className="form-input"
                      value={transferForm.date}
                      onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))}
                      required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="tr-qty">Quantity (Bags)</label>
                    <input id="tr-qty" type="number" className="form-input" placeholder="0" min="1"
                      value={transferForm.quantity}
                      onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))}
                      required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tr-from">From Warehouse</label>
                  <select id="tr-from" className="form-select"
                    value={transferForm.from_warehouse_id}
                    onChange={e => setTransferForm(f => ({ ...f, from_warehouse_id: e.target.value }))}
                    required>
                    <option value="">Select warehouse...</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tr-to">To Warehouse</label>
                  <select id="tr-to" className="form-select"
                    value={transferForm.to_warehouse_id}
                    onChange={e => setTransferForm(f => ({ ...f, to_warehouse_id: e.target.value }))}
                    required>
                    <option value="">Select warehouse...</option>
                    {warehouses.filter(w => w._id !== transferForm.from_warehouse_id).map(w => (
                      <option key={w._id} value={w._id}>{w.name}</option>
                    ))}
                  </select>
                  {transferForm.from_warehouse_id && transferForm.to_warehouse_id &&
                    transferForm.from_warehouse_id === transferForm.to_warehouse_id && (
                    <div className="form-error">⚠ Cannot transfer to same warehouse</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tr-product">Product & Size</label>
                  <select id="tr-product" className="form-select"
                    value={transferForm.product_size_id}
                    onChange={e => handleProductSizeChange(e.target.value)}
                    required>
                    <option value="">Select product...</option>
                    {products.map(p =>
                      (p.sizes || []).map(s => (
                        <option key={s._id} value={s._id}>{p.name} – {s.size}</option>
                      ))
                    )}
                  </select>
                  {availableStock !== null && (
                    <div className="form-helper">
                      <span className="avail-badge">📦 Available: {availableStock} bags</span>
                    </div>
                  )}
                  {availableStock !== null && parseInt(transferForm.quantity) > availableStock && (
                    <div className="form-error">⚠ Insufficient stock. Available: {availableStock} bags</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tr-notes">Notes</label>
                  <input id="tr-notes" type="text" className="form-input" placeholder="Optional"
                    value={transferForm.notes}
                    onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <button id="submit-transfer" type="submit" className="btn btn-primary btn-full btn-lg" disabled={submitting}>
                  {submitting ? 'Transferring...' : '↔ Transfer Stock'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
