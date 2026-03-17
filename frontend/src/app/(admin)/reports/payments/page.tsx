'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { StatCard } from '@/components/widgets/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreditCard, Smartphone, Banknote, Download, Loader2, AlertTriangle, DollarSign, Clock } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

type Period = 'day' | 'week' | 'month';

export default function PaymentReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = {
    groupBy: period,
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  const { data: collectionData, isLoading: collectionLoading } = useQuery({
    queryKey: ['report-payment-collection', params],
    queryFn: async () => {
      const res = await api.getPaymentCollectionRate(params);
      return res.data;
    },
  });

  const { data: avgDaysData, isLoading: avgDaysLoading } = useQuery({
    queryKey: ['report-payment-avg-days', { startDate, endDate }],
    queryFn: async () => {
      const res = await api.getPaymentAvgDaysToPayment({ startDate, endDate });
      return res.data;
    },
  });

  const { data: methodData, isLoading: methodLoading } = useQuery({
    queryKey: ['report-payment-methods', { startDate, endDate }],
    queryFn: async () => {
      const res = await api.getPaymentMethodBreakdown({ startDate, endDate });
      return res.data;
    },
  });

  const { data: failedData, isLoading: failedLoading } = useQuery({
    queryKey: ['report-payment-failed', { startDate, endDate }],
    queryFn: async () => {
      const res = await api.getPaymentFailedRate({ startDate, endDate });
      return res.data;
    },
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['report-payment-revenue', params],
    queryFn: async () => {
      const res = await api.getRevenueVsOutstanding(params);
      return res.data;
    },
  });

  if (!user) return null;

  const collection = (collectionData as Array<{ period: string; total: number; paid: number; outstanding: number; collectionRate: number }>) || [];
  const avgDays = avgDaysData as { averageDays: number } | undefined;
  const methods = (methodData as Array<{ method: string; methodLabel: string; count: number; totalAmount: number; completedCount: number; completedAmount: number }>) || [];
  const failed = failedData as { totalPayments: number; failedPayments: number; failureRate: number; topFailureReasons: Array<{ reason: string; count: number }> } | undefined;
  const revenue = (revenueData as Array<{ period: string; collected: number; outstanding: number }>) || [];

  const pieData = methods.map((m) => ({
    name: m.methodLabel,
    value: m.totalAmount,
    count: m.count,
  }));

  const totalCollected = revenue.reduce((sum, r) => sum + r.collected, 0);
  const totalOutstanding = revenue.reduce((sum, r) => sum + r.outstanding, 0);

  const methodIcon = (method: string) => {
    switch (method) {
      case 'MPESA': return Smartphone;
      case 'AIREL_MONEY': return CreditCard;
      case 'CASH': return Banknote;
      default: return CreditCard;
    }
  };

  const handleExportCSV = () => {
    window.open(api.getExportUrl('payments', 'csv', params), '_blank');
  };

  const handleExportPDF = () => {
    window.open(api.getExportUrl('payments', 'pdf', params), '_blank');
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payment Reports</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Collection rates, payment methods, and revenue analysis</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExportCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="secondary" onClick={handleExportPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group By</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}
                className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
            <Button variant="secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</Button>
          </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            title="Avg Days to Payment"
            value={`${avgDays?.averageDays || 0} days`}
            icon={Clock}
            color="blue"
            loading={avgDaysLoading}
          />
          <StatCard
            title="Failed Payment Rate"
            value={`${failed?.failureRate || 0}%`}
            subtitle={`${failed?.failedPayments || 0} of ${failed?.totalPayments || 0}`}
            icon={AlertTriangle}
            color="red"
            loading={failedLoading}
          />
          <StatCard
            title="Total Collected"
            value={formatKES(totalCollected)}
            icon={DollarSign}
            color="green"
            loading={revenueLoading}
          />
          <StatCard
            title="Total Outstanding"
            value={formatKES(totalOutstanding)}
            icon={CreditCard}
            color="yellow"
            loading={revenueLoading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Collection Rate */}
          <Card>
            <CardHeader title="Collection Rate Over Time" description="% of invoices paid vs outstanding" />
            {collectionLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : collection.length === 0 ? (
              <EmptyState icon={CreditCard} title="No data" description="Collection rate data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={collection}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [name === 'collectionRate' ? `${value}%` : value, name === 'collectionRate' ? 'Collection Rate' : name]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="collectionRate" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="Collection Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader title="Payment Methods" description="Breakdown by payment provider" />
            {methodLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : pieData.length === 0 ? (
              <EmptyState icon={CreditCard} title="No data" description="Payment method data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
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

          {/* Revenue vs Outstanding */}
          <Card className="lg:col-span-2">
            <CardHeader title="Revenue vs Outstanding" description="Collected and outstanding amounts over time" />
            {revenueLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : revenue.length === 0 ? (
              <EmptyState icon={DollarSign} title="No data" description="Revenue data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip formatter={(value: number) => formatKES(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Bar dataKey="collected" fill="#10b981" name="Collected" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Failed Payments Details */}
        {failed && failed.topFailureReasons.length > 0 && (
          <Card>
            <CardHeader
              title="Top Failure Reasons"
              description={`${failed.failureRate}% failure rate across ${failed.totalPayments} payments`}
            />
            <div className="space-y-3">
              {failed.topFailureReasons.map((reason, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-60 truncate" title={reason.reason}>
                    {reason.reason || 'Unknown'}
                  </span>
                  <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${(reason.count / (failed.topFailureReasons[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">{reason.count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Payment Methods Summary Table */}
        {methods.length > 0 && (
          <Card padding="none">
            <CardHeader title="Payment Method Details" description="Detailed breakdown of payment methods" />
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Total Transactions</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Completed Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods.map((m) => {
                    const Icon = methodIcon(m.method);
                    return (
                      <TableRow key={m.method}>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                            <Icon className="h-4 w-4 text-gray-500" />
                            {m.methodLabel}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{m.count}</TableCell>
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKES(m.totalAmount)}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{m.completedCount}</TableCell>
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKES(m.completedAmount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="block lg:hidden p-4 space-y-3">
              {methods.map((m) => {
                const Icon = methodIcon(m.method);
                return (
                  <div key={m.method} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                        <Icon className="h-4 w-4" />
                        {m.methodLabel}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatKES(m.totalAmount)}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{m.count} transactions</span>
                      <span>{m.completedCount} completed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
