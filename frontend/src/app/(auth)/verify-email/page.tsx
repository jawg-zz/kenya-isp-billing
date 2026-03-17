'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Wifi, CheckCircle, XCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    const verify = async () => {
      try {
        const result = await api.verifyEmail(token);
        if (result.success) {
          setStatus('success');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Email Verification</h1>
          <p className="mt-2 text-gray-600">Confirming your email address</p>
        </div>

        <Card>
          {status === 'loading' && (
            <>
              <CardHeader title="Verifying..." description="Please wait while we verify your email" />
              <div className="flex flex-col items-center py-6 gap-3">
                <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
                <p className="text-sm text-gray-500">Verifying your email address...</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <CardHeader title="Email Verified" description="Your email has been confirmed" />
              <div className="flex flex-col items-center py-6 gap-3">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-gray-600 text-center">
                  Your email has been verified! You can now log in.
                </p>
                <Link href="/login" className="mt-2">
                  <Button>Go to Login</Button>
                </Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <CardHeader title="Verification Failed" description="We could not verify your email" />
              <div className="flex flex-col items-center py-6 gap-3">
                <XCircle className="h-12 w-12 text-red-500" />
                <p className="text-gray-600 text-center">
                  Invalid or expired verification link. Please request a new one.
                </p>
                <div className="flex gap-3 mt-2">
                  <Link href="/login">
                    <Button variant="primary">Go to Login</Button>
                  </Link>
                  <Link href="/forgot-password">
                    <Button variant="secondary">Request New Link</Button>
                  </Link>
                </div>
              </div>
            </>
          )}

          {status === 'no-token' && (
            <>
              <CardHeader title="Missing Token" description="No verification token was provided" />
              <div className="flex flex-col items-center py-6 gap-3">
                <XCircle className="h-12 w-12 text-yellow-500" />
                <p className="text-gray-600 text-center">
                  No verification token was found in the URL. Please use the link from your email.
                </p>
                <div className="flex gap-3 mt-2">
                  <Link href="/login">
                    <Button variant="primary">Go to Login</Button>
                  </Link>
                  <Link href="/forgot-password">
                    <Button variant="secondary">Request New Link</Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Your ISP. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
