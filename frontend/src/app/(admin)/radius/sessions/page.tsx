'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/widgets/StatCard';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
} from '@/components/ui/Table';
import {
  Wifi,
  Activity,
  Users,
  Clock,
  WifiOff,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(startTime: string, stopTime?: string): string {
  const start = new Date(startTime);
  const end = stopTime ? new Date(stopTime) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

interface RadiusSession {
  id: string;
  sessionId: string;
  nasIpAddress: string;
  framedIpAddress?: string;
  username?: string;
  startTime: string;
  stopTime?: string;
  status: string;
  totalOctets: number;
  inputOctets: number;
  outputOctets: number;
  terminateCause?: string;
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
    customer?: {
      accountNumber: string;
    };
  };
}

interface SessionStats {
  activeSessions: number;
  totalBandwidth: {
    input: number;
    output: number;
  };
  recentDisconnects: number;
}

export default function RadiusSessionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: sessionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['radius-session-stats'],
    queryFn: async () => {
      const res = await api.getRadiusSessionStats();
      return res.data as unknown as SessionStats;
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['radius-sessions-page', { page, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getRadiusSessions({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      return (res.data as unknown as {
        sessions: RadiusSession[];
        meta: { total: number; page: number; totalPages: number };
      }) || { sessions: [], meta: { total: 0, page: 1, totalPages: 1 } };
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['radius-sessions-page'] });
        queryClient.invalidateQueries({ queryKey: ['radius-session-stats'] });
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, queryClient]);

  const disconnectMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return api.disconnectRadiusSession(sessionId);
    },
    onSuccess: () => {
      toast.success('Session disconnected');
      queryClient.invalidateQueries({ queryKey: ['radius-sessions-page'] });
      queryClient.invalidateQueries({ queryKey: ['radius-session-stats'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to disconnect session');
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['radius-sessions-page'] });
    queryClient.invalidateQueries({ queryKey: ['radius-session-stats'] });
    toast.success('Data refreshed');
  };

  if (!user) return null;

  const sessions = sessionsData?.sessions || [];
  const meta = sessionsData?.meta || { total: 0, page: 1, totalPages: 1 };
  const stats = sessionStats;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              RADIUS Sessions
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Real-time monitoring of network access sessions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded-lg h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              Auto-refresh (30s)
            </label>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>

        {sessionsError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load sessions. Please try again.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Sessions"
            value={stats?.activeSessions || 0}
            icon={Users}
            color="green"
            loading={statsLoading}
          />
          <StatCard
            title="Total Bandwidth"
            value={
              statsLoading
                ? '...'
                : formatBytes(
                    (stats?.totalBandwidth?.input || 0) + (stats?.totalBandwidth?.output || 0)
                  )
            }
            icon={Activity}
            color="blue"
          />
          <StatCard
            title="Disconnects (24h)"
            value={stats?.recentDisconnects || 0}
            icon={Clock}
            color="yellow"
            loading={statsLoading}
          />
          <StatCard
            title="Total Sessions"
            value={meta.total}
            icon={Zap}
            color="purple"
            loading={sessionsLoading}
          />
        </div>

        {/* Bandwidth Breakdown */}
        {stats && !statsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Upload (In)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatBytes(stats.totalBandwidth.input)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <ArrowDownRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Download (Out)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatBytes(stats.totalBandwidth.output)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="ACTIVE">Active Sessions</option>
              <option value="CLOSED">Closed Sessions</option>
              <option value="">All Sessions</option>
            </select>
            {autoRefresh && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live monitoring active
              </div>
            )}
          </div>
        </Card>

        {/* Sessions Table */}
        <Card padding="none">
          {sessionsLoading ? (
            <div className="p-4">
              <TableSkeleton rows={10} cols={8} />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={Wifi}
              title={`No ${statusFilter.toLowerCase()} sessions found`}
              description="Sessions will appear here when users connect to the network."
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {sessions.map((session) => {
                  const startTime = new Date(session.startTime);
                  return (
                    <div
                      key={session.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {session.user
                              ? `${session.user.firstName} ${session.user.lastName}`
                              : session.username || session.framedIpAddress || 'Unknown'}
                          </p>
                          {session.user?.customer?.accountNumber && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {session.user.customer.accountNumber}
                            </p>
                          )}
                        </div>
                        <Badge variant={session.status === 'ACTIVE' ? 'success' : 'default'}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>NAS: {session.nasIpAddress}</span>
                        <span>IP: {session.framedIpAddress || 'N/A'}</span>
                        <span>Data: {formatBytes(session.totalOctets)}</span>
                        <span>
                          Duration:{' '}
                          {session.status === 'ACTIVE'
                            ? formatDuration(session.startTime)
                            : formatDuration(session.startTime, session.stopTime)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        Started: {format(startTime, 'MMM d, yyyy HH:mm')}
                      </div>
                      {session.status === 'ACTIVE' && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (confirm('Disconnect this session?')) {
                                disconnectMutation.mutate(session.id);
                              }
                            }}
                            isLoading={disconnectMutation.isPending}
                          >
                            <WifiOff className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>NAS IP</TableHead>
                      <TableHead>Client IP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data In/Out</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const startTime = new Date(session.startTime);
                      return (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {session.user
                                  ? `${session.user.firstName} ${session.user.lastName}`
                                  : session.username || 'Unknown'}
                              </p>
                              {session.user?.customer?.accountNumber && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {session.user.customer.accountNumber}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm text-gray-900 dark:text-white">
                              {session.nasIpAddress}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm text-gray-900 dark:text-white">
                              {session.framedIpAddress || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={session.status === 'ACTIVE' ? 'success' : 'default'}>
                              {session.status}
                            </Badge>
                            {session.terminateCause && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {session.terminateCause}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                              {formatBytes(session.inputOctets)}
                              <span className="text-gray-400 mx-0.5">/</span>
                              <ArrowDownRight className="h-3 w-3 text-blue-500" />
                              {formatBytes(session.outputOctets)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {format(startTime, 'MMM d, HH:mm:ss')}
                          </TableCell>
                          <TableCell className="text-sm text-gray-900 dark:text-white">
                            {session.status === 'ACTIVE'
                              ? formatDuration(session.startTime)
                              : formatDuration(session.startTime, session.stopTime)}
                          </TableCell>
                          <TableCell className="text-right">
                            {session.status === 'ACTIVE' ? (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  if (confirm('Disconnect this session?')) {
                                    disconnectMutation.mutate(session.id);
                                  }
                                }}
                                isLoading={disconnectMutation.isPending}
                              >
                                <WifiOff className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                              </Button>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {meta.totalPages > 1 && (
                <TablePagination
                  currentPage={page}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                  totalItems={meta.total}
                  itemsPerPage={20}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
