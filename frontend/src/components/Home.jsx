import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, ShoppingCart, Warehouse, BarChart3, Calendar, ChevronRight } from 'lucide-react';
import { api, formatINR, formatDate } from '../api';
import History from './History';

const PERIODS = [
  { id: 'today',      label: 'Today' },
  { id: 'yesterday',  label: 'Yesterday' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom',     label: 'Custom' },
];

const WH_DOT_CLASSES = ['wh-dot-1', 'wh-dot-2', 'wh-dot-3'];

export default function Home({ showToast }) {
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchReport = useCallback(async (p, start, end) => {
    setReportLoading(true);
    try {
      const params = { period: p };
      if (p === 'custom') {
        if (!start || !end) { setReportLoading(false); return; }
        params.startDate = start;
        params.endDate = end;
      }
      const data = await api.getPeriodReport(params);
      setReport(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReportLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (period !== 'custom') {
      fetchReport(period);
    }
  }, [period, fetchReport]);

  const handlePeriodClick = (pid) => {
    setPeriod(pid);
    if (pid === 'custom') setShowCustom(true);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    setShowCustom(false);
    fetchReport('custom', customStart, customEnd);
  };

  if (showHistory) {
    return <History showToast={showToast} onBack={() => setShowHistory(false)} />;
  }

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  const profit = dashboard?.lifetimeProfit ?? 0;

  return (
    <div className="page slide-in">
      {/* Header row */}
      <div className="page-title-row">
        <h2 className="page-title">Dashboard</h2>
        <button
          id="refresh-dashboard-btn"
          className="btn btn-ghost btn-sm"
          onClick={fetchDashboard}
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Lifetime Metrics Grid */}
      <div className="metric-grid">
        <div className="metric-card purchase">
          <div className="metric-icon" style={{ background: 'rgba(99,179,237,0.15)', color: 'var(--accent-blue)' }}>
            <ShoppingCart size={16} />
          </div>
          <div className="metric-label">Total Purchase</div>
          <div className="metric-value">{formatINR(dashboard?.totalPurchase)}</div>
        </div>

        <div className="metric-card received">
          <div className="metric-icon" style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--accent-green)' }}>
            <TrendingUp size={16} />
          </div>
          <div className="metric-label">Total Received</div>
          <div className="metric-value positive">{formatINR(dashboard?.totalReceived)}</div>
        </div>

        <div className="metric-card stock">
          <div className="metric-icon" style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--accent-purple)' }}>
            <Warehouse size={16} />
          </div>
          <div className="metric-label">Stock Value</div>
          <div className="metric-value">{formatINR(dashboard?.currentStockValue)}</div>
        </div>

        <div className={`metric-card profit ${profit >= 0 ? 'profit' : ''}`}>
          <div className="metric-icon" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--accent-amber)' }}>
            <BarChart3 size={16} />
          </div>
          <div className="metric-label">Lifetime Profit</div>
          <div className={`metric-value ${profit >= 0 ? 'positive' : 'negative'}`}>
            {formatINR(profit)}
          </div>
        </div>
      </div>

      {/* Period Report */}
      <div className="card">
        <div className="card-title">
          <Calendar size={14} />
          Period Report
        </div>

        {/* Period Pills */}
        <div className="period-pills">
          {PERIODS.map(p => (
            <button
              key={p.id}
              id={`period-${p.id}`}
              className={`period-pill ${period === p.id ? 'active' : ''}`}
              onClick={() => handlePeriodClick(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {showCustom && (
          <form onSubmit={handleCustomSubmit} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="form-row-2" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From</label>
                <input
                  id="custom-start-date"
                  type="date"
                  className="form-input"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">To</label>
                <input
                  id="custom-end-date"
                  type="date"
                  className="form-input"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <button id="apply-custom-date" type="submit" className="btn btn-primary btn-sm">Apply</button>
          </form>
        )}

        {/* Report Stats */}
        {reportLoading ? (
          <div className="loading-center" style={{ padding: 'var(--space-5)' }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : report ? (
          <div className="report-stats">
            <div className="report-stat">
              <div className="report-stat-label">Purchase</div>
              <div className="report-stat-value">{formatINR(report.periodPurchase)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">Received</div>
              <div className="report-stat-value green">{formatINR(report.periodSelling)}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">Profit</div>
              <div className={`report-stat-value ${report.periodProfit >= 0 ? 'green' : 'red'}`}>
                {formatINR(report.periodProfit)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Warehouse Summary */}
      <div className="card">
        <div className="card-title">
          <Warehouse size={14} />
          Warehouse Summary
        </div>
        {dashboard?.warehouseSummary?.length ? (
          dashboard.warehouseSummary.map((wh, i) => (
            <div key={wh._id} className="warehouse-row">
              <span className={`warehouse-dot ${WH_DOT_CLASSES[i % 3]}`} />
              <span className="warehouse-name">{wh.name}</span>
              <span className="warehouse-qty">{wh.totalQuantity} bags</span>
              <span className="warehouse-value">{formatINR(wh.totalValue)}</span>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
            <p className="empty-text">No stock yet</p>
          </div>
        )}
      </div>

      {/* View History */}
      <button
        id="view-history-btn"
        className="btn btn-ghost btn-full"
        onClick={() => setShowHistory(true)}
        style={{ marginTop: 'var(--space-2)' }}
      >
        Transaction History <ChevronRight size={16} />
      </button>
    </div>
  );
}
