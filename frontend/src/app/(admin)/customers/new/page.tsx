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

export default function NewCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();

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
      return api.createCustomer(data);
    },
    onSuccess: () => {
      toast.success('Customer created successfully');
      router.push('/customers');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to create customer');
    },
  });

  if (!user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
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

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader title="Personal Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name *</label>
                <Input name="firstName" value={form.firstName} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name *</label>
                <Input name="lastName" value={form.lastName} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                <Input name="email" type="email" value={form.email} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone *</label>
                <Input name="phone" value={form.phone} onChange={handleChange} required placeholder="+254..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ID Number</label>
                <Input name="idNumber" value={form.idNumber} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">KRA PIN</label>
                <Input name="kraPin" value={form.kraPin} onChange={handleChange} />
              </div>
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader title="Address" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address Line 1</label>
                <Input name="addressLine1" value={form.addressLine1} onChange={handleChange} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Address Line 2</label>
                <Input name="addressLine2" value={form.addressLine2} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">City</label>
                <Input name="city" value={form.city} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">County</label>
                <Input name="county" value={form.county} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Postal Code</label>
                <Input name="postalCode" value={form.postalCode} onChange={handleChange} />
              </div>
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
            <Button type="submit" isLoading={createMutation.isPending}>
              <UserPlus className="h-4 w-4 mr-2" /> Create Customer
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
