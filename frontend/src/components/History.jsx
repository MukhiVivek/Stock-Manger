import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Filter } from 'lucide-react';
import { api, formatINR, formatDate } from '../api';

const TX_TYPES = ['RECEIVED', 'GIVEN', 'TRANSFER'];

export default function History({ showToast, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 30;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, page };
      if (filterType) params.type = filterType;
      if (filterWarehouse) params.warehouse_id = filterWarehouse;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [txData, whData] = await Promise.all([
        api.getTransactions(params),
        api.getWarehouses(),
      ]);
      setTransactions(txData.transactions || []);
      setTotal(txData.total || 0);
      setWarehouses(whData || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, filterType, filterWarehouse, startDate, endDate, page]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const getAmount = (tx) => {
    if (tx.type === 'RECEIVED') return { label: formatINR(tx.purchase_amount), cls: '' };
    if (tx.type === 'GIVEN') return { label: formatINR(tx.received_amount), cls: 'credit' };
    return { label: `${tx.quantity} bags`, cls: 'neutral' };
  };

  const getWarehouseDisplay = (tx) => {
    if (tx.type === 'RECEIVED') return tx.to_warehouse_id?.name;
    if (tx.type === 'GIVEN') return tx.from_warehouse_id?.name;
    return `${tx.from_warehouse_id?.name} → ${tx.to_warehouse_id?.name}`;
  };

  return (
    <div className="page slide-in">
      {/* Header */}
      <div className="page-title-row">
        <button id="history-back-btn" className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back">
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="page-title" style={{ marginBottom: 0 }}>History</h2>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-title"><Filter size={14} /> Filters</div>

        <div className="filter-bar" style={{ marginBottom: 'var(--space-3)' }}>
          <button id="hist-all" className={`filter-chip ${!filterType ? 'active' : ''}`} onClick={() => { setFilterType(''); setPage(1); }}>All</button>
          {TX_TYPES.map(t => (
            <button key={t} id={`hist-type-${t}`}
              className={`filter-chip ${filterType === t ? 'active' : ''}`}
              onClick={() => { setFilterType(filterType === t ? '' : t); setPage(1); }}>
              {t}
            </button>
          ))}
        </div>

        <div className="filter-bar" style={{ marginBottom: 'var(--space-3)' }}>
          <button id="hist-all-wh" className={`filter-chip ${!filterWarehouse ? 'active' : ''}`} onClick={() => { setFilterWarehouse(''); setPage(1); }}>All Wh.</button>
          {warehouses.map(wh => (
            <button key={wh._id} id={`hist-wh-${wh._id}`}
              className={`filter-chip ${filterWarehouse === wh._id ? 'active' : ''}`}
              onClick={() => { setFilterWarehouse(filterWarehouse === wh._id ? '' : wh._id); setPage(1); }}>
              {wh.name}
            </button>
          ))}
        </div>

        <div className="form-row-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="hist-start">From Date</label>
            <input id="hist-start" type="date" className="form-input"
              value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="hist-end">To Date</label>
            <input id="hist-end" type="date" className="form-input"
              value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
        Showing {transactions.length} of {total} transactions
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗄</div>
          <p className="empty-text">No transactions found</p>
        </div>
      ) : (
        <>
          <div className="tx-list">
            {transactions.map(tx => {
              const { label, cls } = getAmount(tx);
              return (
                <div key={tx._id} className="tx-item">
                  <div className="tx-item-header">
                    <div>
                      <div className="tx-product">
                        {tx.product_size_id?.product_id?.name} – {tx.product_size_id?.size}
                      </div>
                      <div className="tx-meta">
                        <span>📦 {tx.quantity} bags</span>
                        <span>🏭 {getWarehouseDisplay(tx)}</span>
                        {tx.bill_number && <span>#{tx.bill_number}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`tx-badge ${tx.type.toLowerCase()}`}>{tx.type}</span>
                      <div className={`tx-amount ${cls}`} style={{ marginTop: 4 }}>{label}</div>
                    </div>
                  </div>
                  <span className="tx-date">{formatDate(tx.date)}</span>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
              <button id="hist-prev" className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </button>
              <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page}
              </span>
              <button id="hist-next" className="btn btn-ghost btn-sm" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
