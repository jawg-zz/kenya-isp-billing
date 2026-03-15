'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
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
  const dataUsed = usage ? Number((usage as Record<string, unknown>).totalUsed || 0) : 0;
  const dataRemaining = usage ? Number((usage as Record<string, unknown>).totalRemaining || 0) : 0;
  const percentUsed = usage ? Number((usage as Record<string, unknown>).percentageUsed || 0) : 0;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Usage</h1>
          <p className="mt-1 text-gray-600">Monitor your data consumption and usage history</p>
        </div>

        {/* Usage Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Allowance</p>
                <p className="text-lg font-semibold">
                  {dataAllowance > 0 ? formatBytes(dataAllowance) : 'Unlimited'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <ArrowUp className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Used</p>
                <p className="text-lg font-semibold">{formatBytes(dataUsed)}</p>
                <p className="text-xs text-gray-500">{percentUsed.toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <ArrowDown className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Remaining</p>
                <p className="text-lg font-semibold">
                  {dataAllowance > 0 ? formatBytes(dataRemaining) : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-lg font-semibold">
                  {usage?.isFupThresholdReached ? (
                    <Badge variant="warning">FUP Reached</Badge>
                  ) : (
                    <Badge variant="success">Normal</Badge>
                  )}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Usage Progress */}
        {dataAllowance > 0 && (
          <Card>
            <CardHeader title="Usage Progress" />
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{formatBytes(dataUsed)} of {formatBytes(dataAllowance)}</span>
                <span className={`font-medium ${percentUsed > 90 ? 'text-red-600' : percentUsed > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {percentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentUsed > 90 ? 'bg-red-500' : percentUsed > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
              {plan?.fupThreshold && (
                <p className="text-xs text-gray-500">
                  Fair Usage Policy threshold: {formatBytes(Number(plan.fupThreshold))}
                  {plan.fupSpeedLimit && ` (speed reduced to ${plan.fupSpeedLimit} Mbps after)`}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Real-time Stats */}
        {realtime && (
          <Card>
            <CardHeader title="Current Session" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Download</p>
                <p className="text-lg font-semibold">{formatBytes(Number((realtime as Record<string, unknown>).totalDownload || 0))}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Upload</p>
                <p className="text-lg font-semibold">{formatBytes(Number((realtime as Record<string, unknown>).totalUpload || 0))}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Session Time</p>
                <p className="text-lg font-semibold">{(realtime as Record<string, unknown>).sessionTime || '0m'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">
                    {(realtime as Record<string, unknown>).isActive ? 'Connected' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Active Plan Info */}
        {activeSub && plan && (
          <Card>
            <CardHeader title="Plan Details" action={<Wifi className="h-5 w-5 text-gray-400" />} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Plan</p>
                <p className="font-medium">{plan.name as string}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Speed</p>
                <p className="font-medium">{plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Period</p>
                <p className="font-medium text-sm">
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
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : (history as Record<string, unknown>[]).length === 0 ? (
            <p className="text-center text-gray-500 py-8">No usage records found</p>
          ) : (
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
                  <TableRow key={record.id as string}>
                    <TableCell>{format(new Date(record.timestamp as string), 'MMM d, HH:mm')}</TableCell>
                    <TableCell>{formatBytes(Number(record.outputOctets || 0))}</TableCell>
                    <TableCell>{formatBytes(Number(record.inputOctets || 0))}</TableCell>
                    <TableCell className="font-medium">{formatBytes(Number(record.totalOctets || 0))}</TableCell>
                    <TableCell className="text-gray-500">{(record.ipAddress as string) || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
