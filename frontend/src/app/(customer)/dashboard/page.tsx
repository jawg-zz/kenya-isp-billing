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

  const { data: usageData } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await api.getUsageSummary();
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', { limit: 5 }],
    queryFn: async () => {
      const res = await api.getInvoices({ limit: 5 });
      return res.data;
    },
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['payments', { limit: 5 }],
    queryFn: async () => {
      const res = await api.getPaymentHistory({ limit: 5 });
      return res.data;
    },
  });

  const { data: subscriptionsData } = useQuery({
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
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.firstName}!
          </h1>
          <p className="mt-1 text-gray-600">
            Here&apos;s an overview of your account
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-primary-100 rounded-lg">
                <Wifi className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Plan</p>
                <p className="text-lg font-semibold text-gray-900">
                  {plan?.name || 'No Plan'}
                </p>
                {activeSub && (
                  <StatusBadge status={activeSub.status as string} />
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Data Used</p>
                <p className="text-lg font-semibold text-gray-900">
                  {usage ? formatBytes(Number(usage.totalUsed || 0)) : '—'}
                </p>
                {usage && (
                  <p className="text-xs text-gray-500">
                    {Number(usage.percentageUsed || 0).toFixed(0)}% of allowance
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-yellow-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Balance</p>
                <p className="text-lg font-semibold text-gray-900">
                  {user.customer ? formatKES(Number(user.customer.balance)) : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Invoices</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(invoices as Record<string, unknown>[]).filter((i: Record<string, unknown>) => i.status === 'PENDING').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Usage & Plan Details */}
        {activeSub && (
          <Card>
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
              <div>
                <p className="text-sm text-gray-500">Plan Price</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatKES(Number(plan?.price || 0))}
                </p>
                <p className="text-xs text-gray-500">
                  {plan?.billingCycle?.toString().toLowerCase() || `Valid for ${plan?.validityDays} days`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data Allowance</p>
                <p className="text-xl font-semibold text-gray-900">
                  {plan?.dataAllowance ? formatBytes(Number(plan.dataAllowance)) : 'Unlimited'}
                </p>
                {plan?.speedLimit && (
                  <p className="text-xs text-gray-500">{plan.speedLimit} Mbps</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Subscription Period</p>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(activeSub.startDate as string), 'MMM d, yyyy')} —{' '}
                  {format(new Date(activeSub.endDate as string), 'MMM d, yyyy')}
                </p>
                {activeSub.autoRenew && (
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" /> Auto-renew enabled
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* No active subscription */}
        {!activeSub && (
          <Card className="border-dashed">
            <div className="text-center py-8">
              <Wifi className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Active Plan</h3>
              <p className="mt-1 text-gray-500">Subscribe to a plan to get started</p>
              <Link href="/subscribe">
                <Button className="mt-4">Browse Plans</Button>
              </Link>
            </div>
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
            {(invoices as Record<string, unknown>[]).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {(invoices as Record<string, unknown>[]).slice(0, 5).map((invoice: Record<string, unknown>) => (
                  <div key={invoice.id as string} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber as string}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
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
            {(payments as Record<string, unknown>[]).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {(payments as Record<string, unknown>[]).slice(0, 5).map((payment: Record<string, unknown>) => (
                  <div key={payment.id as string} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{payment.paymentNumber as string}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{payment.method as string}</span>
                          <span>•</span>
                          <span>{format(new Date(payment.createdAt as string), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
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
          <Card className="border-yellow-200 bg-yellow-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Low Balance</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Your account balance is negative. Please make a payment to avoid service interruption.
                </p>
                <Link href="/payments">
                  <Button size="sm" className="mt-3">
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
                <Card className="border-yellow-200 bg-yellow-50">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">Subscription Expiring Soon</h3>
                      <p className="mt-1 text-sm text-yellow-700">
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
