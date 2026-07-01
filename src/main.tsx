import { StrictMode, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Logger } from "./utils/logger";
import { reportWebVitals } from "./lib/reportWebVitals";
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Logger.error(error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: 20 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '500px', width: '100%' }}>
            <h1 style={{ margin: '0 0 16px', color: '#0f172a', fontSize: '24px', fontWeight: 'bold' }}>Application Error</h1>
            <p style={{ margin: '0 0 24px', color: '#64748b' }}>An unexpected error occurred. The details have been logged.</p>
            <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '24px' }}>
              <code style={{ color: '#ef4444', fontSize: '14px' }}>{this.state.error?.toString()}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', width: '100%' }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

reportWebVitals();
