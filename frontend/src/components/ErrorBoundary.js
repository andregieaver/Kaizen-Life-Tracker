import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * ErrorBoundary Component
 * 
 * React Error Boundary to catch JavaScript errors in child components,
 * log those errors, and display a fallback UI instead of crashing the whole app.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * Or with custom fallback:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error info in state for display
    this.setState({ errorInfo });
    
    // TODO: Log to error reporting service (e.g., Sentry)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      // Custom fallback UI provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 text-center border border-gray-700/50">
            {/* Error Icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            {/* Error Title */}
            <h2 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h2>

            {/* Error Description */}
            <p className="text-gray-400 mb-6">
              We encountered an unexpected error. This has been logged and we're working on it.
            </p>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="mb-6 p-4 bg-gray-900/50 rounded-lg text-left overflow-auto max-h-32">
                <p className="text-xs font-mono text-red-400 break-words">
                  {error.toString()}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            {/* Reload hint */}
            <p className="mt-6 text-sm text-gray-500">
              If the problem persists,{' '}
              <button
                onClick={this.handleReload}
                className="text-teal-400 hover:underline"
              >
                refresh the page
              </button>
            </p>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}

/**
 * withErrorBoundary HOC
 * 
 * Wrap any component with an error boundary
 * 
 * Usage:
 * export default withErrorBoundary(MyComponent);
 */
export function withErrorBoundary(Component, fallback = null) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
