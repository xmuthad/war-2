import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.logError(error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logError(error: Error, errorInfo: ErrorInfo): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };

    console.error('Error Log:', JSON.stringify(errorLog, null, 2));
  }

  private handleReload = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h1>出错了</h1>
            <p className="error-message">
              {this.state.error?.message || '发生了一个未知错误'}
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
              <details className="error-stack">
                <summary>错误详情</summary>
                <pre>{this.state.error.stack}</pre>
              </details>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleReset} className="retry-button">
                重试
              </button>
              <button onClick={this.handleReload} className="reload-button">
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <div className="error-fallback">
      <div className="fallback-content">
        <h2>组件加载失败</h2>
        <p>{error.message}</p>
        <button onClick={resetError}>重试</button>
      </div>
    </div>
  );
};

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  loading?: ReactNode;
  errorFallback?: ReactNode;
}

interface AsyncErrorBoundaryState {
  hasError: boolean;
  isLoading: boolean;
  error: Error | null;
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isLoading: true,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AsyncErrorBoundaryState> {
    return {
      hasError: true,
      isLoading: false,
      error
    };
  }

  componentDidUpdate(prevProps: AsyncErrorBoundaryProps): void {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({
        hasError: false,
        isLoading: false,
        error: null
      });
    }
  }

  render(): ReactNode {
    if (this.state.isLoading) {
      return this.props.loading || <div>加载中...</div>;
    }

    if (this.state.hasError) {
      return this.props.errorFallback || (
        <ErrorFallback
          error={this.state.error || new Error('Unknown error')}
          resetError={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
