'use client';

import { useEffect } from 'react';
import { Wifi, RefreshCw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Customer portal error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
        </div>

        <Card>
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4">
              <UserX className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Customer Portal Error</h2>
            <p className="text-gray-600 mb-6">
              Something went wrong in the customer portal. Please try again or contact support for assistance.
            </p>
            <Button onClick={reset} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Your ISP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
