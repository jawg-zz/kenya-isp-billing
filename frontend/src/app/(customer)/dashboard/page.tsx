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
  BarChart3,
  CreditCard,
  FileText,
  TrendingUp,
  Wifi,
  ArrowRight,
  Clock,
  AlertCircle,
  Package,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function CustomerDashboard() {
  const { user } = useAuth();

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await api.getUsageSummary();
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', { limit: 5 }],
    queryFn: async () => {
      const res = await api.getInvoices({ limit: 5 });
      return res.data;
    },
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', { limit: 5 }],
    queryFn: async () => {
      const res = await api.getPaymentHistory({ limit: 5 });
      return res.data;
    },
  });

  const { data: subscriptionsData, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.getSubscriptions();
      return res.data;
    },
  });

  if (!user) return null;

  const usage = usageData as Record<string, unknown> | undefined;
  const invoices = (invoicesData as { invoices?: unknown[] })?.invoices || [];
  const payments = (paymentsData as { payments?: unknown[] })?.payments || [];
  const subscriptions = (subscriptionsData as { subscriptions?: unknown[] })?.subscriptions || [];
  const activeSub = subscriptions.find((s: Record<string, unknown>) => s.status === 'ACTIVE') as Record<string, unknown> | undefined;
  const plan = activeSub?.plan as Record<string, unknown> | undefined;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Welcome back, {user.firstName}!
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Here&apos;s an overview of your account
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Current Plan"
            value={plan?.name || 'No Plan'}
            subtitle={activeSub ? undefined : 'Subscribe to a plan'}
            icon={Wifi}
            color="blue"
            loading={subsLoading}
          />
          <StatCard
            title="Data Used"
            value={usage ? formatBytes(Number(usage.totalUsed || 0)) : '—'}
            subtitle={usage ? `${Number(usage.percentageUsed || 0).toFixed(0)}% of allowance` : undefined}
            icon={BarChart3}
            color="green"
            loading={usageLoading}
          />
          <StatCard
            title="Account Balance"
            value={user.customer ? formatKES(Number(user.customer.balance)) : '—'}
            icon={CreditCard}
            color="yellow"
          />
          <StatCard
            title="Pending Invoices"
            value={(invoices as Record<string, unknown>[]).filter((i: Record<string, unknown>) => i.status === 'PENDING').length}
            subtitle="invoices"
            icon={FileText}
            color="indigo"
            loading={invoicesLoading}
          />
        </div>

        {/* Usage & Plan Details */}
        {activeSub && (
          <Card hover>
            <CardHeader
              title="Current Subscription"
              description={`${plan?.name} - ${plan?.type === 'PREPAID' ? 'Prepaid' : 'Postpaid'}`}
              action={
                <Link href="/usage">
                  <Button variant="ghost" size="sm">
                    View Details <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Plan Price</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatKES(Number(plan?.price || 0))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {plan?.billingCycle?.toString().toLowerCase() || `Valid for ${plan?.validityDays} days`}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Data Allowance</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {plan?.dataAllowance ? formatBytes(Number(plan.dataAllowance)) : 'Unlimited'}
                </p>
                {plan?.speedLimit && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{plan.speedLimit} Mbps</p>
                )}
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Subscription Period</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                  {format(new Date(activeSub.startDate as string), 'MMM d, yyyy')} —{' '}
                  {format(new Date(activeSub.endDate as string), 'MMM d, yyyy')}
                </p>
                {activeSub.autoRenew && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" /> Auto-renew enabled
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* No active subscription */}
        {!activeSub && (
          <Card className="border-dashed border-2">
            <EmptyState
              icon={Package}
              title="No Active Plan"
              description="Subscribe to a plan to get started with your internet service."
              action={
                <Link href="/subscribe">
                  <Button>Browse Plans</Button>
                </Link>
              }
            />
          </Card>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Invoices */}
          <Card>
            <CardHeader
              title="Recent Invoices"
              action={
                <Link href="/invoices">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            {invoicesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between animate-pulse p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div>
                        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : (invoices as Record<string, unknown>[]).length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Your invoices will appear here when generated."
              />
            ) : (
              <div className="space-y-3">
                {(invoices as Record<string, unknown>[]).slice(0, 5).map((invoice: Record<string, unknown>) => (
                  <div key={invoice.id as string} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                        <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber as string}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatKES(Number(invoice.totalAmount))}
                      </p>
                      <StatusBadge status={invoice.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader
              title="Recent Payments"
              action={
                <Link href="/payments">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            {paymentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between animate-pulse p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div>
                        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : (payments as Record<string, unknown>[]).length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payments yet"
                description="Make your first payment to top up your account."
                action={
                  <Link href="/payments">
                    <Button size="sm">Make Payment</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {(payments as Record<string, unknown>[]).slice(0, 5).map((payment: Record<string, unknown>) => (
                  <div key={payment.id as string} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                        <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{payment.paymentNumber as string}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span>{payment.method as string}</span>
                          <span>•</span>
                          <span>{format(new Date(payment.createdAt as string), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatKES(Number(payment.amount))}
                      </p>
                      <StatusBadge status={payment.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Account Alerts */}
        {user.customer && Number(user.customer.balance) < 0 && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Low Balance</h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Your account balance is negative. Please make a payment to avoid service interruption.
                </p>
                <Link href="/payments" className="inline-block mt-3">
                  <Button size="sm">
                    Make Payment
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Subscription Expiry Warning */}
        {activeSub && (
          (() => {
            const endDate = new Date(activeSub.endDate as string);
            const now = new Date();
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7 && daysLeft > 0) {
              return (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Subscription Expiring Soon</h3>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        Your plan expires in {daysLeft} day{daysLeft > 1 ? 's' : ''}. Renew to avoid interruption.
                      </p>
                    </div>
                  </div>
                </Card>
              );
            }
            return null;
          })()
        )}
      </div>
    </MainLayout>
  );
}
