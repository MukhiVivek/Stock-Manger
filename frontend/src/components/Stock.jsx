import { useState, useEffect, useCallback } from 'react';
import { Search, Package } from 'lucide-react';
import { api, formatINR } from '../api';

const SIZES = ['10 KG', '30 KG', '50 KG'];

export default function Stock({ showToast }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [totalValue, setTotalValue] = useState(0);

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterWarehouse) params.warehouse_id = filterWarehouse;
      if (filterSize) params.size = filterSize;
      if (search.trim()) params.search = search.trim();

      const [stockData, whData] = await Promise.all([
        api.getStock(params),
        api.getWarehouses(),
      ]);

      setStocks(stockData || []);
      setWarehouses(whData || []);
      const tv = (stockData || []).reduce((sum, s) => sum + (s.stock_value || 0), 0);
      setTotalValue(tv);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, filterWarehouse, filterSize, search]);

  useEffect(() => {
    const timer = setTimeout(() => loadStock(), 300);
    return () => clearTimeout(timer);
  }, [loadStock]);

  // Group stocks by warehouse for display
  const grouped = {};
  for (const s of stocks) {
    const whName = s.warehouse_id?.name || 'Unknown';
    if (!grouped[whName]) grouped[whName] = [];
    grouped[whName].push(s);
  }

  return (
    <div className="page slide-in">
      <div className="page-title-row">
        <h2 className="page-title">Stock</h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Value</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent-green)' }}>
            {formatINR(totalValue)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="search-input-wrap">
        <Search size={16} />
        <input
          id="stock-search"
          type="text"
          className="search-input"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search stock"
        />
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <button
          id="filter-all-wh"
          className={`filter-chip ${!filterWarehouse ? 'active' : ''}`}
          onClick={() => setFilterWarehouse('')}
        >
          All Warehouses
        </button>
        {warehouses.map(wh => (
          <button
            key={wh._id}
            id={`filter-wh-${wh._id}`}
            className={`filter-chip ${filterWarehouse === wh._id ? 'active' : ''}`}
            onClick={() => setFilterWarehouse(filterWarehouse === wh._id ? '' : wh._id)}
          >
            {wh.name}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <button
          id="filter-all-size"
          className={`filter-chip ${!filterSize ? 'active' : ''}`}
          onClick={() => setFilterSize('')}
        >
          All Sizes
        </button>
        {SIZES.map(sz => (
          <button
            key={sz}
            id={`filter-size-${sz.replace(' ', '-')}`}
            className={`filter-chip ${filterSize === sz ? 'active' : ''}`}
            onClick={() => setFilterSize(filterSize === sz ? '' : sz)}
          >
            {sz}
          </button>
        ))}
      </div>

      {/* Stock List */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : stocks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p className="empty-text">
            {search ? `No stock found for "${search}"` : 'No stock available.'}
          </p>
        </div>
      ) : (
        <div className="stock-grid">
          {Object.entries(grouped).map(([whName, items]) => (
            <div key={whName}>
              {/* Warehouse Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) 0 var(--space-2)',
                borderBottom: '1px solid var(--border)',
                marginBottom: 'var(--space-2)',
              }}>
                <Package size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {whName}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatINR(items.reduce((s, i) => s + (i.stock_value || 0), 0))}
                </span>
              </div>

              {items.map(s => (
                <div key={s._id} className="stock-item">
                  <div className="stock-item-info">
                    <div className="stock-product-name">
                      {s.product_size_id?.product_id?.name}
                    </div>
                    <div>
                      <span className="stock-size-badge">{s.product_size_id?.size}</span>
                    </div>
                  </div>
                  <div className="stock-numbers">
                    <div className="stock-qty">{s.quantity}</div>
                    <div className="stock-unit">Bags</div>
                    <div className="stock-value-text">{formatINR(s.stock_value)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
