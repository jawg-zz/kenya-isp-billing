'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader } from '@/components/ui/Card';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { Wifi } from 'lucide-react';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { validators } from '@/lib/validation';
import { getApiErrorMessage } from '@/lib/api-errors';

const passwordRules = [validators.required('Password is required'), validators.passwordSimple()];

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { errors, validateFieldOnChange, validateFieldOnBlur, validateAll, setFieldError } = useFormValidation({ debounceMs: 400 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validateAll(
      { password, confirmPassword },
      {
        password: [validators.required('Password is required'), validators.passwordSimple()],
        confirmPassword: [
          validators.required('Please confirm your password'),
          validators.passwordMatch(() => password, 'Passwords do not match'),
        ],
      }
    );

    if (!isValid) return;

    setIsLoading(true);

    try {
      const result = await api.resetPassword(token, password);

      if (!result.success) {
        throw new Error(result.message || 'Failed to reset password');
      }

      toast.success('Password reset successfully!');
      router.push('/login');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to reset password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
              <Wifi className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Invalid Reset Link</h1>
            <p className="mt-2 text-gray-600">No reset token was provided.</p>
          </div>

          <Card>
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">
                Please request a new password reset from the login page.
              </p>
              <Link href="/forgot-password" className="text-primary-600 hover:text-primary-500 font-medium">
                Request new reset code
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
          <p className="mt-2 text-gray-600">Enter your new password below</p>
        </div>

        <Card>
          <CardHeader title="Reset Password" description="Choose a new password for your account" />
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validateFieldOnChange('password', e.target.value, passwordRules);
                  // Re-validate confirm password when password changes
                  if (confirmPassword) {
                    validateFieldOnChange('confirmPassword', confirmPassword, [
                      validators.required('Please confirm your password'),
                      validators.passwordMatch(() => e.target.value, 'Passwords do not match'),
                    ]);
                  }
                }}
                onBlur={(e) => validateFieldOnBlur('password', e.target.value, passwordRules)}
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.password}
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                validateFieldOnChange('confirmPassword', e.target.value, [
                  validators.required('Please confirm your password'),
                  validators.passwordMatch(() => password, 'Passwords do not match'),
                ]);
              }}
              onBlur={(e) => validateFieldOnBlur('confirmPassword', e.target.value, [
                validators.required('Please confirm your password'),
                validators.passwordMatch(() => password, 'Passwords do not match'),
              ])}
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword}
            />

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading} disabled={isLoading}>
              Reset Password
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-primary-600 hover:text-primary-500">
                Back to login
              </Link>
            </div>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Your ISP. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
