'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader } from '@/components/ui/Card';
import { Wifi, Eye, EyeOff, UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    addressLine1: '',
    city: '',
    county: '',
    postalCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, user } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        addressLine1: form.addressLine1 || undefined,
        city: form.city || undefined,
        county: form.county || undefined,
        postalCode: form.postalCode || undefined,
      });
      toast.success('Registration successful!');

      // Redirect based on user role
      if (user?.role === 'ADMIN' || user?.role === 'SUPPORT') {
        router.push('/customers');
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-500/25">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create Account</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Sign up for ISP Billing Portal</p>
        </div>

        <Card hover>
          <CardHeader title="Sign Up" description="Fill in your details to create an account" />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="John"
                required
              />
              <Input
                label="Last Name"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>

            <Input
              label="Email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <Input
              label="Phone Number"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+254 7XX XXX XXX"
              required
              helperText="We'll send payment confirmations to this number"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
            />

            <div className="pt-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Address (optional)</p>
            </div>

            <Input
              label="Address"
              name="addressLine1"
              value={form.addressLine1}
              onChange={handleChange}
              placeholder="Street address"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="City"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Nairobi"
              />
              <Input
                label="County"
                name="county"
                value={form.county}
                onChange={handleChange}
                placeholder="Nairobi"
              />
              <Input
                label="Postal Code"
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
                placeholder="00100"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              {!isLoading && <UserPlus className="h-4 w-4 mr-2" />}
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
