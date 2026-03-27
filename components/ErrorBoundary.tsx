import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Nebula Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-deep)' }}>
          <div role="alert" className="glass max-w-md w-full rounded-2xl p-8">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'var(--red-bg)' }}>
              <svg className="w-7 h-7" style={{ color: 'var(--red)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-center mb-3 font-brand" style={{ color: 'var(--text-primary)' }}>
              Something went wrong
            </h1>
            <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full text-white py-2.5 rounded-full font-semibold transition-colors text-sm hover:opacity-90"
              style={{ backgroundColor: 'var(--pink)', boxShadow: '0 2px 12px var(--pink-dim)' }}
            >
              Reload
            </button>
            <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
              Check browser console for details
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
