'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-8 min-h-[400px]">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
                <Wifi className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ISP Billing Portal</h1>
            </div>

            <Card>
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-4">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Something went wrong
                </h2>
                <p className="text-gray-600 mb-6">
                  An unexpected error occurred in this section. You can try again or navigate to a different page.
                </p>
                {this.state.error && (
                  <details className="mb-4 text-left">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      Error details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-red-600 overflow-auto max-h-32">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <Button onClick={this.handleReset} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
