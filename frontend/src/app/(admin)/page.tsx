'use client';
export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { format } from 'date-fns';
import {
  Users,
  CreditCard,
  FileText,
  TrendingUp,
  ArrowRight,
  Package,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: customerStats, isLoading: statsLoading } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const res = await api.getCustomerStats();
      return res.data;
    },
  });

  const { data: invoiceStats, isLoading: invoiceStatsLoading } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: async () => {
      const res = await api.getInvoiceStats();
      return res.data;
    },
  });

  const { data: paymentStats, isLoading: paymentStatsLoading } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      const res = await api.getPaymentStats({});
      return res.data;
    },
  });

  const { data: recentPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-recent-payments'],
    queryFn: async () => {
      const res = await api.getAllPayments({ limit: 5 });
      return res.data;
    },
  });

  const { data: recentInvoices, isLoading: invoicesLoading } = useQuery({
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Overview of your ISP billing system
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Customers"
            value={(stats?.totalCustomers as number) || 0}
            subtitle={`+${stats?.newCustomers as number || 0} this month`}
            icon={Users}
            color="blue"
            loading={statsLoading}
          />
          <StatCard
            title="Revenue (30d)"
            value={formatKES(Number(pStats?.totalRevenue || 0))}
            subtitle={`${pStats?.totalTransactions as number || 0} transactions`}
            icon={DollarSign}
            color="green"
            loading={paymentStatsLoading}
          />
          <StatCard
            title="Pending Invoices"
            value={(iStats?.pendingInvoices as number) || 0}
            subtitle={formatKES(Number(iStats?.pendingAmount || 0)) + ' pending'}
            icon={FileText}
            color="yellow"
            loading={invoiceStatsLoading}
          />
          <StatCard
            title="Overdue"
            value={(iStats?.overdueInvoices as number) || 0}
            subtitle="invoices"
            icon={AlertTriangle}
            color="red"
            loading={invoiceStatsLoading}
          />
        </div>

        {/* Quick Actions */}
        <Card hover>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/customers" className="group">
              <Button variant="secondary" className="w-full justify-start group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                <Users className="h-4 w-4 mr-2" /> Customers
              </Button>
            </Link>
            <Link href="/plans" className="group">
              <Button variant="secondary" className="w-full justify-start group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                <Package className="h-4 w-4 mr-2" /> Plans
              </Button>
            </Link>
            <Link href="/invoices/management" className="group">
              <Button variant="secondary" className="w-full justify-start group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                <FileText className="h-4 w-4 mr-2" /> Invoices
              </Button>
            </Link>
            <Link href="/revenue" className="group">
              <Button variant="secondary" className="w-full justify-start group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
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
                <Link href="/invoices/management">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            {paymentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : payments.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payments yet"
                description="Payments will appear here when customers make payments."
              />
            ) : (
              <div className="space-y-3">
                {payments.map((payment: Record<string, unknown>) => {
                  const customer = payment.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={payment.id as string} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                            {u ? `${(u.firstName as string)?.[0]}${(u.lastName as string)?.[0]}` : '??'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{payment.method as string} • {format(new Date(payment.createdAt as string), 'MMM d, HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatKES(Number(payment.amount))}</p>
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
                <Link href="/invoices/management">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            {invoicesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between animate-pulse">
                    <div>
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                      <div className="h-3 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoices will be generated automatically or created manually."
              />
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice: Record<string, unknown>) => {
                  const customer = invoice.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={invoice.id as string} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber as string}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {u ? `${u.firstName} ${u.lastName}` : 'Unknown'} • {format(new Date(invoice.dueDate as string), 'MMM d')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatKES(Number(invoice.totalAmount))}</p>
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
                  <div key={c.county} className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{c._count}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{c.county}</p>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
