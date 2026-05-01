import { AlertTriangle, RefreshCw } from 'lucide-react';
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-surface flex items-center justify-center px-8">
            <div className="max-w-md w-full text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-6">
                <AlertTriangle size={48} className="text-red-600" />
              </div>
              <h1 className="text-3xl font-serif font-bold text-on-surface mb-3">
                Oops! Something went wrong
              </h1>
              <p className="text-on-surface-variant mb-2">
                We encountered an unexpected error. Please try again.
              </p>
              {this.state.error?.message && (
                <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg mb-6 font-mono overflow-auto max-h-20">
                  {this.state.error.message}
                </p>
              )}
              <button
                onClick={this.handleReset}
                className="signature-gradient text-white px-8 py-3 rounded-full font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

