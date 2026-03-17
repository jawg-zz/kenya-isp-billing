'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/widgets/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, TrendingDown, Globe, PieChart as PieChartIcon, Download, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const statusColors: Record<string, string> = {
  ACTIVE: '#10b981',
  SUSPENDED: '#f59e0b',
  TERMINATED: '#ef4444',
  PENDING_VERIFICATION: '#3b82f6',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  PENDING_VERIFICATION: 'Pending',
};

type Period = 'day' | 'week' | 'month';

export default function CustomerReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = {
    groupBy: period,
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['report-customer-trends', params],
    queryFn: async () => {
      const res = await api.getCustomerRegistrationTrends(params);
      return res.data;
    },
  });

  const { data: churnData, isLoading: churnLoading } = useQuery({
    queryKey: ['report-customer-churn', params],
    queryFn: async () => {
      const res = await api.getCustomerChurnAnalysis(params);
      return res.data;
    },
  });

  const { data: geoData, isLoading: geoLoading } = useQuery({
    queryKey: ['report-customer-geo'],
    queryFn: async () => {
      const res = await api.getCustomerGeographicDistribution();
      return res.data;
    },
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['report-customer-status'],
    queryFn: async () => {
      const res = await api.getCustomerStatusBreakdown();
      return res.data;
    },
  });

  if (!user) return null;

  const trends = (trendsData as Array<{ period: string; count: number }>) || [];
  const churn = (churnData as Array<{ period: string; churned: number; suspended: number; churnRate: number }>) || [];
  const geo = (geoData as Array<{ county: string; count: number }>) || [];
  const status = statusData as { total: number; statuses: Array<{ status: string; count: number; percentage: number }> } | undefined;

  const pieData = status?.statuses.map((s) => ({
    name: statusLabels[s.status] || s.status,
    value: s.count,
  })) || [];

  const activeCount = status?.statuses.find((s) => s.status === 'ACTIVE')?.count || 0;
  const churnedCount = status?.statuses.find((s) => s.status === 'TERMINATED')?.count || 0;

  const handleExportCSV = () => {
    window.open(api.getExportUrl('customers', 'csv', params), '_blank');
  };

  const handleExportPDF = () => {
    window.open(api.getExportUrl('customers', 'pdf', params), '_blank');
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Customer Reports</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Registration trends, churn analysis, and customer distribution</p>
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
          <StatCard title="Total Customers" value={status?.total || 0} icon={Users} color="blue" loading={statusLoading} />
          <StatCard title="Active" value={activeCount} icon={Users} color="green" loading={statusLoading} />
          <StatCard title="Terminated" value={churnedCount} icon={TrendingDown} color="red" loading={statusLoading} />
          <StatCard title="Counties" value={geo.length} icon={Globe} color="purple" loading={geoLoading} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registration Trends */}
          <Card>
            <CardHeader title="Registration Trends" description="New customer registrations over time" />
            {trendsLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : trends.length === 0 ? (
              <EmptyState icon={Users} title="No data" description="Registration data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} name="New Customers" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader title="Status Breakdown" description="Customer account statuses" />
            {statusLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : pieData.length === 0 ? (
              <EmptyState icon={PieChartIcon} title="No data" description="Status breakdown will appear here." />
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Churn Analysis */}
          <Card>
            <CardHeader title="Churn Analysis" description="Terminated & suspended customers over time" />
            {churnLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : churn.length === 0 ? (
              <EmptyState icon={TrendingDown} title="No data" description="Churn data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={churn}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Bar dataKey="churned" fill="#ef4444" name="Churned" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="suspended" fill="#f59e0b" name="Suspended" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Geographic Distribution */}
          <Card>
            <CardHeader title="Geographic Distribution" description="Customers by Kenyan county" />
            {geoLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : geo.length === 0 ? (
              <EmptyState icon={Globe} title="No data" description="Geographic data will appear here." />
            ) : (
              <div className="h-72 overflow-y-auto">
                <div className="space-y-2 pr-2">
                  {geo.map((item, i) => {
                    const maxCount = geo[0]?.count || 1;
                    const pct = (item.count / maxCount) * 100;
                    return (
                      <div key={item.county} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-36 truncate">{item.county}</span>
                        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${pct}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
