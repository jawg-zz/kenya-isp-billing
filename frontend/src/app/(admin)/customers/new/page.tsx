'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { validators } from '@/lib/validation';
import { getApiErrorMessage, getApiFieldErrors } from '@/lib/api-errors';

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postalCode: string;
  idNumber: string;
  kraPin: string;
  notes: string;
}

const schema = {
  firstName: [validators.required('First name is required'), validators.minLength(2, 'Must be at least 2 characters')],
  lastName: [validators.required('Last name is required'), validators.minLength(2, 'Must be at least 2 characters')],
  email: [validators.required('Email is required'), validators.email()],
  phone: [validators.required('Phone number is required'), validators.kenyaPhone()],
};

export default function NewCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { errors, validateFieldOnChange, validateFieldOnBlur, validateAll, setFieldError } = useFormValidation({ debounceMs: 400 });

  const [form, setForm] = useState<CustomerForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postalCode: '',
    idNumber: '',
    kraPin: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerForm) => {
      return api.createCustomer(data as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Customer created successfully');
      router.push('/customers');
    },
    onError: (err: unknown) => {
      const fieldErrors = getApiFieldErrors(err);
      for (const [field, message] of Object.entries(fieldErrors)) {
        setFieldError(field, message);
      }
      if (Object.keys(fieldErrors).length === 0) {
        toast.error(getApiErrorMessage(err, 'Failed to create customer'));
      }
    },
  });

  if (!user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name in schema) {
      validateFieldOnChange(name, value, schema[name as keyof typeof schema]);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name in schema) {
      validateFieldOnBlur(name, value, schema[name as keyof typeof schema]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = validateAll(
      {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      },
      schema
    );
    if (!isValid) return;
    createMutation.mutate(form);
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Link href="/customers" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Add New Customer</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <Card>
            <CardHeader title="Personal Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name *"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.firstName}
              />
              <Input
                label="Last Name *"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.lastName}
              />
              <Input
                label="Email *"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.email}
              />
              <Input
                label="Phone *"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="+254..."
                error={errors.phone}
              />
              <Input
                label="ID Number"
                name="idNumber"
                value={form.idNumber}
                onChange={handleChange}
              />
              <Input
                label="KRA PIN"
                name="kraPin"
                value={form.kraPin}
                onChange={handleChange}
              />
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader title="Address" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Address Line 1"
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={handleChange}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Address Line 2"
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={handleChange}
                />
              </div>
              <Input
                label="City"
                name="city"
                value={form.city}
                onChange={handleChange}
              />
              <Input
                label="County"
                name="county"
                value={form.county}
                onChange={handleChange}
              />
              <Input
                label="Postal Code"
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
              />
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader title="Notes" />
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
              placeholder="Additional notes about this customer..."
            />
          </Card>

          <div className="mt-6 flex justify-end gap-3">
            <Link href="/customers">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
            <Button type="submit" isLoading={createMutation.isPending} disabled={createMutation.isPending}>
              <UserPlus className="h-4 w-4 mr-2" /> Create Customer
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
