const BASE = '/api';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  // Dashboard
  getDashboard: () => req('GET', '/dashboard'),
  getPeriodReport: (params) => req('GET', `/dashboard/report?${new URLSearchParams(params)}`),

  // Products
  getProducts: () => req('GET', '/products'),
  getProductSizes: () => req('GET', '/products/sizes'),
  updateProductSize: (id, body) => req('PUT', `/products/size/${id}`, body),

  // Warehouses
  getWarehouses: () => req('GET', '/warehouses'),

  // Transactions
  getTransactions: (params = {}) => req('GET', `/transactions?${new URLSearchParams(params)}`),
  addReceived: (body) => req('POST', '/transactions/received', body),
  addGiven: (body) => req('POST', '/transactions/given', body),
  addTransfer: (body) => req('POST', '/transactions/transfer', body),

  // Stock
  getStock: (params = {}) => req('GET', `/stock?${new URLSearchParams(params)}`),
  getStockSummary: (params = {}) => req('GET', `/stock/summary?${new URLSearchParams(params)}`),
};

export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}
