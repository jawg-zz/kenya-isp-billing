'use client';
export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { ArrowLeft, User, Mail, Phone, MapPin, CreditCard, FileText } from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

interface Customer {
  id: string;
  accountNumber: string;
  customerCode: string;
  balance: number | string;
  creditLimit: number | string;
  notes?: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    accountStatus: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
  };
  subscriptions?: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    plan?: {
      name: string;
      price: number;
    };
  }>;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const customerId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      const res = await api.getCustomer(customerId);
      return res.data as { customer: Customer };
    },
    enabled: !!customerId,
  });

  if (!user) return null;

  const customer = data?.customer;
  const u = customer?.user;

  if (isLoading) {
    return (
      <MainLayout user={user}>
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !customer) {
    return (
      <MainLayout user={user}>
        <div className="space-y-6">
          <Link href="/customers" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
          </Link>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Customer not found or failed to load.
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/customers" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
          </Link>
          <Button variant="outline" size="sm">Edit Customer</Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-xl font-medium text-primary-700">
              {u ? `${u.firstName[0]}${u.lastName[0]}` : '??'}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
            </h1>
            <p className="text-gray-600">Account: {customer.accountNumber} | Code: {customer.customerCode}</p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={u?.accountStatus || 'UNKNOWN'} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader title="Contact Information" />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{u?.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{u?.phone || 'No phone'}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  {u?.addressLine1 && <p>{u.addressLine1}</p>}
                  {u?.addressLine2 && <p>{u.addressLine2}</p>}
                  <p>{[u?.city, u?.county, u?.postalCode].filter(Boolean).join(', ') || 'No address'}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Account Balance" />
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-2xl font-bold">{formatKES(Number(customer.balance))}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Credit Limit</p>
                <p className="text-lg font-medium">{formatKES(Number(customer.creditLimit))}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Member Since</p>
                <p className="text-sm">{format(new Date(customer.createdAt), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-2">
              <Link href="/invoices/management">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" /> View Invoices
                </Button>
              </Link>
              <Link href="/payments">
                <Button variant="outline" className="w-full justify-start">
                  <CreditCard className="h-4 w-4 mr-2" /> View Payments
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Active Subscriptions" />
          {customer.subscriptions && customer.subscriptions.length > 0 ? (
            <div className="space-y-3">
              {customer.subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{sub.plan?.name || 'Unknown Plan'}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(sub.startDate), 'MMM d, yyyy')} - {format(new Date(sub.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={sub.status} />
                    {sub.plan?.price && (
                      <p className="text-sm text-gray-500 mt-1">{formatKES(sub.plan.price)}/mo</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No active subscriptions</p>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
