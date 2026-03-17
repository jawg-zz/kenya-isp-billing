'use client';
export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { format } from 'date-fns';
import { BarChart3, ArrowDown, ArrowUp, Activity, Wifi } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function UsagePage() {
  const { user } = useAuth();

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await api.getUsageSummary();
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ['usage-realtime'],
    queryFn: async () => {
      const res = await api.getRealtimeUsage();
      return res.data;
    },
    refetchInterval: 15000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['usage-history'],
    queryFn: async () => {
      const res = await api.getUsageHistory({ limit: 30 });
      return res.data;
    },
  });

  const { data: subsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.getSubscriptions();
      return res.data;
    },
  });

  if (!user) return null;

  const usage = usageData as Record<string, unknown> | undefined;
  const realtime = realtimeData as Record<string, unknown> | undefined;
  const history = (historyData as { records?: Record<string, unknown>[] })?.records || [];
  const subscriptions = (subsData as { subscriptions?: Record<string, unknown>[] })?.subscriptions || [];
  const activeSub = subscriptions.find((s: Record<string, unknown>) => s.status === 'ACTIVE') as Record<string, unknown> | undefined;
  const plan = activeSub?.plan as Record<string, unknown> | undefined;

  const dataAllowance = plan?.dataAllowance ? Number(plan.dataAllowance) : 0;

  // Real-time data from /usage/realtime endpoint
  const realtimeUsage = realtime?.usage as Record<string, unknown> | undefined;
  const dataUsed = realtimeUsage ? Number(realtimeUsage.totalUsed || 0) : 0;
  const dataRemaining = realtimeUsage ? Number(realtimeUsage.totalRemaining || 0) : 0;
  const percentUsed = realtimeUsage ? Number(realtimeUsage.percentageUsed || 0) : 0;
  const fupReached = realtimeUsage ? Boolean(realtimeUsage.isFupThresholdReached) : false;

  // Summary data from /usage/summary endpoint
  const usageSummary = usage as Record<string, unknown> | undefined;
  const totalDownload = usageSummary?.total ? Number((usageSummary.total as Record<string, unknown>)?.outputOctets || 0) : 0;
  const totalUpload = usageSummary?.total ? Number((usageSummary.total as Record<string, unknown>)?.inputOctets || 0) : 0;
  const daysRemaining = usageSummary ? Number(usageSummary.daysRemaining || 0) : 0;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Data Usage</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Monitor your data consumption and usage history</p>
        </div>

        {/* Usage Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Allowance"
            value={dataAllowance > 0 ? formatBytes(dataAllowance) : 'Unlimited'}
            icon={BarChart3}
            color="blue"
            loading={usageLoading}
          />
          <StatCard
            title="Used"
            value={formatBytes(dataUsed)}
            subtitle={`${percentUsed.toFixed(1)}%`}
            icon={ArrowUp}
            color="red"
            loading={usageLoading}
          />
          <StatCard
            title="Remaining"
            value={dataAllowance > 0 ? formatBytes(dataRemaining) : '—'}
            icon={ArrowDown}
            color="green"
            loading={usageLoading}
          />
          <StatCard
            title="Status"
            value={fupReached ? 'FUP Reached' : 'Normal'}
            icon={Activity}
            color={fupReached ? 'yellow' : 'green'}
            loading={usageLoading}
          />
        </div>

        {/* Usage Progress */}
        {dataAllowance > 0 && (
          <Card hover>
            <CardHeader title="Usage Progress" />
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{formatBytes(dataUsed)} of {formatBytes(dataAllowance)}</span>
                <span className={`font-semibold ${
                  percentUsed > 90 ? 'text-red-600 dark:text-red-400' :
                  percentUsed > 70 ? 'text-amber-600 dark:text-amber-400' :
                  'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {percentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    percentUsed > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    percentUsed > 70 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                    'bg-gradient-to-r from-emerald-500 to-emerald-600'
                  }`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
              {plan?.fupThreshold && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Fair Usage Policy threshold: {formatBytes(Number(plan.fupThreshold))}
                    {plan.fupSpeedLimit && ` (speed reduced to ${plan.fupSpeedLimit} Mbps after)`}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Current Usage Stats */}
        {realtimeUsage && (
          <Card hover>
            <CardHeader title="Current Usage" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Download</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatBytes(totalDownload)}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Upload</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatBytes(totalUpload)}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Days Remaining</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{daysRemaining} days</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Usage Status</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${fupReached ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {fupReached ? 'FUP Applied' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Active Plan Info */}
        {activeSub && plan && (
          <Card hover>
            <CardHeader title="Plan Details" action={<Wifi className="h-5 w-5 text-gray-400" />} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{plan.name as string}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Speed</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Period</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                  {format(new Date(activeSub.startDate as string), 'MMM d')} — {format(new Date(activeSub.endDate as string), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Usage History */}
        <Card>
          <CardHeader title="Usage History" description="Recent data usage records" />
          {historyLoading ? (
            <div className="space-y-3 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2 animate-pulse">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          ) : (history as Record<string, unknown>[]).length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No usage records"
              description="Your data usage history will appear here once you start using your connection."
            />
          ) : (
            <>
              {/* Mobile view */}
              <div className="block lg:hidden space-y-3 p-1">
                {(history as Record<string, unknown>[]).slice(0, 10).map((record: Record<string, unknown>) => (
                  <div key={record.id as string} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {format(new Date(record.timestamp as string), 'MMM d, HH:mm')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{(record.ipAddress as string) || '—'}</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">↓ Download</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatBytes(Number(record.outputOctets || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">↑ Upload</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatBytes(Number(record.inputOctets || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatBytes(Number(record.totalOctets || 0))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Download</TableHead>
                      <TableHead>Upload</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(history as Record<string, unknown>[]).map((record: Record<string, unknown>) => (
                      <TableRow key={record.id as string} className="group">
                        <TableCell className="text-gray-600 dark:text-gray-400">{format(new Date(record.timestamp as string), 'MMM d, HH:mm')}</TableCell>
                        <TableCell className="text-gray-900 dark:text-white">{formatBytes(Number(record.outputOctets || 0))}</TableCell>
                        <TableCell className="text-gray-900 dark:text-white">{formatBytes(Number(record.inputOctets || 0))}</TableCell>
                        <TableCell className="font-semibold text-gray-900 dark:text-white">{formatBytes(Number(record.totalOctets || 0))}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">{(record.ipAddress as string) || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
