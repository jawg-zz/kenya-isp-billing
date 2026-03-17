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
import { HardDrive, Users, Clock, Package, Download, Loader2, Trophy } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

type Period = 'day' | 'week' | 'month';

export default function UsageReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = {
    groupBy: period,
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  const { data: bandwidthData, isLoading: bandwidthLoading } = useQuery({
    queryKey: ['report-usage-bandwidth', params],
    queryFn: async () => {
      const res = await api.getUsageBandwidth(params);
      return res.data;
    },
  });

  const { data: topUsersData, isLoading: topUsersLoading } = useQuery({
    queryKey: ['report-usage-top-users', { startDate, endDate }],
    queryFn: async () => {
      const res = await api.getUsageTopUsers({ topN: 10, startDate, endDate });
      return res.data;
    },
  });

  const { data: peakHoursData, isLoading: peakHoursLoading } = useQuery({
    queryKey: ['report-usage-peak-hours', { startDate, endDate }],
    queryFn: async () => {
      const res = await api.getUsagePeakHours({ startDate, endDate });
      return res.data;
    },
  });

  const { data: byPlanData, isLoading: byPlanLoading } = useQuery({
    queryKey: ['report-usage-by-plan', { startDate, endDate }],
    queryFn: async () => {
      const res = await api.getUsageByPlan({ startDate, endDate });
      return res.data;
    },
  });

  if (!user) return null;

  const bandwidth = (bandwidthData as Array<{ period: string; totalGB: number; recordCount: number }>) || [];
  const topUsers = (topUsersData as Array<{ rank: number; name: string; email: string; accountNumber: string; planName: string; totalGB: number; recordCount: number }>) || [];
  const peakHours = (peakHoursData as Array<{ hourLabel: string; totalGB: number; sessionCount: number }>) || [];
  const byPlan = (byPlanData as Array<{ planName: string; totalGB: number; customerCount: number }>) || [];

  const totalGB = bandwidth.reduce((sum, r) => sum + r.totalGB, 0);
  const totalSessions = peakHours.reduce((sum, r) => sum + r.sessionCount, 0);
  const peakHour = peakHours.reduce((max, r) => r.totalGB > max.totalGB ? r : max, peakHours[0] || { hourLabel: 'N/A', totalGB: 0 });

  const handleExportCSV = () => {
    window.open(api.getExportUrl('usage', 'csv', params), '_blank');
  };

  const handleExportPDF = () => {
    window.open(api.getExportUrl('usage', 'pdf', params), '_blank');
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Usage Reports</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Bandwidth consumption, top users, and usage patterns</p>
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
          <StatCard title="Total Bandwidth" value={`${totalGB.toFixed(2)} GB`} icon={HardDrive} color="blue" loading={bandwidthLoading} />
          <StatCard title="Top Users" value={topUsers.length} icon={Trophy} color="green" loading={topUsersLoading} />
          <StatCard title="Peak Hour" value={peakHour.hourLabel} subtitle={`${peakHour.totalGB.toFixed(2)} GB`} icon={Clock} color="yellow" loading={peakHoursLoading} />
          <StatCard title="Active Plans" value={byPlan.length} icon={Package} color="purple" loading={byPlanLoading} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Bandwidth */}
          <Card className="lg:col-span-2">
            <CardHeader title="Total Bandwidth Over Time" description="Data consumption trends" />
            {bandwidthLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : bandwidth.length === 0 ? (
              <EmptyState icon={HardDrive} title="No data" description="Bandwidth data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bandwidth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip formatter={(value: number) => [`${value} GB`, 'Bandwidth']} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    <Line type="monotone" dataKey="totalGB" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="GB" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardHeader title="Peak Usage Hours" description="Hourly distribution of data usage" />
            {peakHoursLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : peakHours.length === 0 ? (
              <EmptyState icon={Clock} title="No data" description="Peak hours data will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="hourLabel" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip formatter={(value: number) => [`${value} GB`, 'Usage']} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="totalGB" fill="#3b82f6" radius={[4, 4, 0, 0]} name="GB" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Usage By Plan */}
          <Card>
            <CardHeader title="Usage By Plan" description="Total bandwidth consumed per plan" />
            {byPlanLoading ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
            ) : byPlan.length === 0 ? (
              <EmptyState icon={Package} title="No data" description="Usage by plan will appear here." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byPlan} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis dataKey="planName" type="category" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
                    <Tooltip formatter={(value: number) => [`${value} GB`, 'Usage']} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="totalGB" fill="#10b981" radius={[0, 4, 4, 0]} name="GB" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Top Users Table */}
        <Card padding="none">
          <CardHeader title="Top 10 Users by Data Consumption" description="Highest bandwidth consumers" />
          {topUsersLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2 animate-pulse">
                  <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          ) : topUsers.length === 0 ? (
            <EmptyState icon={Trophy} title="No usage data" description="Top user data will appear here when usage records are available." />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Data Used</TableHead>
                      <TableHead>Records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUsers.map((u) => (
                      <TableRow key={u.rank} className="group">
                        <TableCell>
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            u.rank <= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {u.rank}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">{u.accountNumber}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{u.planName}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{u.totalGB} GB</span>
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{u.recordCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {topUsers.map((u) => (
                  <div key={u.rank} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                          u.rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.rank}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{u.planName}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{u.totalGB} GB</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
