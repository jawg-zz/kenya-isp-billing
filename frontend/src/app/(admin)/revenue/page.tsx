'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { format } from 'date-fns';
import { BarChart3, TrendingUp, CreditCard, Smartphone, Banknote } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

const COLORS = ['#4cb050', '#ed1c24', '#3b82f6', '#f59e0b', '#8b5cf6'];

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
    name: m.method,
    value: parseFloat(m._sum.amount),
  }));

  const methodIcon = (method: string) => {
    switch (method) {
      case 'MPESA': return <Smartphone className="h-4 w-4 text-green-600" />;
      case 'AIREL_MONEY': return <CreditCard className="h-4 w-4 text-red-600" />;
      case 'CASH': return <Banknote className="h-4 w-4 text-yellow-600" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue & Payments</h1>
          <p className="mt-1 text-gray-600">Payment analytics and transaction history</p>
        </div>

        {/* Date Filter */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <Button variant="secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Clear
            </Button>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold">{formatKES(Number(stats?.totalRevenue || 0))}</p>
                <p className="text-xs text-gray-500">{stats?.totalTransactions as number || 0} transactions</p>
              </div>
            </div>
          </Card>

          {/* Revenue by Method */}
          {paymentsByMethod.map((m, i) => (
            <Card key={m.method}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: `${COLORS[i]}20` }}>
                  {methodIcon(m.method)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">{m.method.replace('_', ' ')}</p>
                  <p className="text-xl font-bold">{formatKES(parseFloat(m._sum.amount))}</p>
                  <p className="text-xs text-gray-500">{m._count} transactions</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader title="Daily Revenue" />
            {chartData.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No data for this period</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [formatKES(value), 'Amount']}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader title="By Method" />
            {pieData.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No data</p>
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
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatKES(value)} />
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
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No payments found</p>
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
                        <TableRow key={payment.id as string}>
                          <TableCell className="font-mono text-sm">{payment.paymentNumber as string}</TableCell>
                          <TableCell>
                            <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{u?.phone as string}</p>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              {methodIcon(payment.method as string)}
                              {(payment.method as string).replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-green-600">{formatKES(Number(payment.amount))}</TableCell>
                          <TableCell className="text-sm text-gray-500">
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
                    <div key={payment.id as string} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{(payment.method as string).replace('_', ' ')}</p>
                        </div>
                        <StatusBadge status={payment.status as string} />
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-sm text-gray-500">{format(new Date(payment.createdAt as string), 'MMM d, yyyy')}</span>
                        <span className="font-semibold text-green-600">{formatKES(Number(payment.amount))}</span>
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
