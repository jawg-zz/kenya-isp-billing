'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import {
  Users,
  CreditCard,
  FileText,
  TrendingUp,
  ArrowRight,
  Wifi,
  AlertTriangle,
  Package,
} from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: customerStats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const res = await api.getCustomerStats();
      return res.data;
    },
  });

  const { data: invoiceStats } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: async () => {
      const res = await api.getInvoiceStats();
      return res.data;
    },
  });

  const { data: paymentStats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      const res = await api.getPaymentStats({});
      return res.data;
    },
  });

  const { data: recentPayments } = useQuery({
    queryKey: ['admin-recent-payments'],
    queryFn: async () => {
      const res = await api.getAllPayments({ limit: 5 });
      return res.data;
    },
  });

  const { data: recentInvoices } = useQuery({
    queryKey: ['admin-recent-invoices'],
    queryFn: async () => {
      const res = await api.getAllInvoices({ limit: 5 });
      return res.data;
    },
  });

  if (!user) return null;

  const stats = customerStats as Record<string, unknown> | undefined;
  const iStats = invoiceStats as Record<string, unknown> | undefined;
  const pStats = paymentStats as Record<string, unknown> | undefined;
  const payments = (recentPayments as { payments?: Record<string, unknown>[] })?.payments || [];
  const invoices = (recentInvoices as { invoices?: Record<string, unknown>[] })?.invoices || [];

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-gray-600">Overview of your ISP billing system</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Customers</p>
                <p className="text-2xl font-bold">{(stats?.totalCustomers as number) || 0}</p>
                <p className="text-xs text-green-600">
                  +{stats?.newCustomers as number || 0} this month
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue (30d)</p>
                <p className="text-2xl font-bold">{formatKES(Number(pStats?.totalRevenue || 0))}</p>
                <p className="text-xs text-gray-500">
                  {pStats?.totalTransactions as number || 0} transactions
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FileText className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Invoices</p>
                <p className="text-2xl font-bold">{(iStats?.pendingInvoices as number) || 0}</p>
                <p className="text-xs text-gray-500">
                  {formatKES(Number(iStats?.pendingAmount || 0))} pending
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overdue</p>
                <p className="text-2xl font-bold">{(iStats?.overdueInvoices as number) || 0}</p>
                <p className="text-xs text-gray-500">invoices</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/admin/customers">
              <Button variant="secondary" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" /> Customers
              </Button>
            </Link>
            <Link href="/admin/plans">
              <Button variant="secondary" className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" /> Plans
              </Button>
            </Link>
            <Link href="/admin/invoices">
              <Button variant="secondary" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" /> Invoices
              </Button>
            </Link>
            <Link href="/admin/revenue">
              <Button variant="secondary" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" /> Revenue
              </Button>
            </Link>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payments */}
          <Card>
            <CardHeader
              title="Recent Payments"
              action={
                <Link href="/admin/revenue">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment: Record<string, unknown>) => {
                  const customer = payment.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={payment.id as string} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-700">
                            {u ? `${(u.firstName as string)?.[0]}${(u.lastName as string)?.[0]}` : '??'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">{payment.method as string} • {format(new Date(payment.createdAt as string), 'MMM d, HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">{formatKES(Number(payment.amount))}</p>
                        <StatusBadge status={payment.status as string} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader
              title="Recent Invoices"
              action={
                <Link href="/admin/invoices">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice: Record<string, unknown>) => {
                  const customer = invoice.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={invoice.id as string} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber as string}</p>
                        <p className="text-xs text-gray-500">
                          {u ? `${u.firstName} ${u.lastName}` : 'Unknown'} • {format(new Date(invoice.dueDate as string), 'MMM d')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatKES(Number(invoice.totalAmount))}</p>
                        <StatusBadge status={invoice.status as string} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Customer Distribution */}
        {stats?.customersByCounty && (
          <Card>
            <CardHeader title="Customers by County" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(stats.customersByCounty as Array<{ county: string | null; _count: number }>)
                .filter((c) => c.county)
                .sort((a, b) => b._count - a._count)
                .slice(0, 10)
                .map((c) => (
                  <div key={c.county} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-primary-600">{c._count}</p>
                    <p className="text-sm text-gray-600">{c.county}</p>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
