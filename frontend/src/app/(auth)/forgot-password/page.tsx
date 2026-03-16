'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader } from '@/components/ui/Card';
import { Wifi } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await api.forgotPassword(email);

      if (!result.success) {
        throw new Error(result.message || 'Failed to send reset email');
      }

      toast.success('Reset email sent!');
      setIsSubmitted(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-gray-600">Enter your email to receive a reset link</p>
        </div>

        <Card>
          <CardHeader title="Forgot Password" description="We'll send you a link to reset your password" />
          {isSubmitted ? (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">
                If an account with that email exists, we've sent a password reset link. Please check your inbox.
              </p>
              <Link href="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Send Reset Link
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-primary-600 hover:text-primary-500">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Your ISP. All rights reserved.
        </p>
      </div>
    </div>
  );
}