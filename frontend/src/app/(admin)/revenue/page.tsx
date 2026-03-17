'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { format } from 'date-fns';
import { TrendingUp, CreditCard, Smartphone, Banknote, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function AdminRevenuePage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: paymentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['payment-stats', { startDate, endDate }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.getPaymentStats(params);
      return res.data;
    },
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-payments', { page, startDate, endDate }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.getAllPayments(params);
      return res.data;
    },
  });

  if (!user) return null;

  const stats = paymentStats as Record<string, unknown> | undefined;
  const payments = (paymentsData as { payments?: Record<string, unknown>[] })?.payments || [];
  const meta = (paymentsData as { meta?: { total: number; page: number; totalPages: number } })?.meta || { total: 0, page: 1, totalPages: 1 };

  const paymentsByDay = (stats?.paymentsByDay as Array<{ date: string; totalAmount: string; count: string }>) || [];
  const paymentsByMethod = (stats?.paymentsByMethod as Array<{ method: string; _sum: { amount: string }; _count: number }>) || [];

  const chartData = paymentsByDay.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    amount: parseFloat(d.totalAmount),
    count: parseInt(d.count),
  }));

  const pieData = paymentsByMethod.map((m) => ({
    name: m.method.replace('_', ' '),
    value: parseFloat(m._sum.amount),
  }));

  const methodIcon = (method: string) => {
    switch (method) {
      case 'MPESA': return <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'AIREL_MONEY': return <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'CASH': return <Banknote className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      default: return <CreditCard className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Revenue & Payments</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Payment analytics and transaction history</p>
        </div>

        {/* Date Filter */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>
            <Button variant="secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Clear
            </Button>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Revenue"
            value={formatKES(Number(stats?.totalRevenue || 0))}
            subtitle={`${stats?.totalTransactions as number || 0} transactions`}
            icon={DollarSign}
            color="green"
            loading={statsLoading}
          />
          {paymentsByMethod.map((m, i) => (
            <StatCard
              key={m.method}
              title={m.method.replace('_', ' ')}
              value={formatKES(parseFloat(m._sum.amount))}
              subtitle={`${m._count} transactions`}
              icon={m.method === 'MPESA' ? Smartphone : m.method === 'CASH' ? Banknote : CreditCard}
              color={i === 0 ? 'green' : i === 1 ? 'red' : 'blue'}
              loading={statsLoading}
            />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader title="Daily Revenue" />
            {chartData.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No data for this period"
                description="Revenue data will appear here when payments are made."
              />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip
                      formatter={(value: number) => [formatKES(value), 'Amount']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader title="By Method" />
            {pieData.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No data"
                description="Payment method distribution will appear here."
              />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      strokeWidth={2}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatKES(value)} contentStyle={{ borderRadius: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Payments Table */}
        <Card padding="none">
          <CardHeader
            title="All Payments"
            description={`${meta.total} total payments`}
          />

          {paymentsLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2 animate-pulse">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No payments found"
              description={startDate || endDate ? 'Try adjusting the date range.' : 'Payments will appear here when received.'}
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: Record<string, unknown>) => {
                      const customer = payment.customer as Record<string, unknown> | undefined;
                      const u = customer?.user as Record<string, unknown> | undefined;
                      return (
                        <TableRow key={payment.id as string} className="group">
                          <TableCell className="font-mono text-sm text-gray-900 dark:text-white">{payment.paymentNumber as string}</TableCell>
                          <TableCell>
                            <p className="font-medium text-gray-900 dark:text-white">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{u?.phone as string}</p>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              {methodIcon(payment.method as string)}
                              {(payment.method as string).replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKES(Number(payment.amount))}</TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(payment.createdAt as string), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                          <TableCell><StatusBadge status={payment.status as string} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {payments.map((payment: Record<string, unknown>) => {
                  const customer = payment.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={payment.id as string} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{(payment.method as string).replace('_', ' ')}</p>
                        </div>
                        <StatusBadge status={payment.status as string} />
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{format(new Date(payment.createdAt as string), 'MMM d, yyyy')}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKES(Number(payment.amount))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {meta.totalPages > 1 && (
                <TablePagination
                  currentPage={page}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                  totalItems={meta.total}
                  itemsPerPage={15}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
