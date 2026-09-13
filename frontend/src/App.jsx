import { useState, useEffect, useCallback } from 'react';
import { Home as HomeIcon, PackagePlus, PackageMinus, Package, Sun, Moon } from 'lucide-react';
import Home from './components/Home';
import Received from './components/Received';
import Given from './components/Given';
import Stock from './components/Stock';

const TABS = [
  { id: 'home',     label: 'Home',     icon: HomeIcon,      component: Home },
  { id: 'received', label: 'Received', icon: PackagePlus,   component: Received },
  { id: 'given',    label: 'Given',    icon: PackageMinus,  component: Given },
  { id: 'stock',    label: 'Stock',    icon: Package,       component: Stock },
];

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="color-scheme"]').content = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || Home;

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-header-title">📦 StockPro</h1>
        <div className="header-actions">
          <button
            id="theme-toggle-btn"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark'
              ? <Sun size={16} />
              : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Toast Notifications */}
      <div className="toast-container" role="alert" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && '✓ '}
            {t.type === 'error' && '✗ '}
            {t.message}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <main className="app-main">
        <ActiveComponent showToast={showToast} navigate={setActiveTab} />
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-icon-wrap">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
