'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
} from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import {
  Wifi,
  Activity,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Server,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface RadiusSession {
  id: string;
  sessionId: string;
  nasIpAddress: string;
  framedIpAddress?: string;
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
    phone?: string;
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

interface HealthService {
  status: string;
  latencyMs?: number;
  error?: string;
}

interface HealthStatus {
  status: string;
  services: {
    database?: HealthService;
    redis?: HealthService;
    radius?: HealthService;
    mpesa?: HealthService;
    airtel?: HealthService;
    sms?: HealthService;
  };
}

interface Event {
  id: string;
  sessionId: string;
  status: string;
  startTime: string;
  stopTime?: string;
  terminateCause?: string;
  user?: {
    firstName: string;
    lastName: string;
    customer?: {
      accountNumber: string;
    };
  };
}

export default function AdminNetworkPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const { data: sessionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['radius-session-stats'],
    queryFn: async () => {
      const res = await api.getRadiusSessionStats();
      return res.data as unknown as SessionStats;
    },
    refetchInterval: 30000,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health-detailed'],
    queryFn: async () => {
      const res = await api.getHealthDetailed();
      return res.data as unknown as HealthStatus;
    },
    refetchInterval: 60000,
  });

  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['radius-sessions', { page, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getRadiusSessions({ page, limit: 15, status: statusFilter || undefined });
      return res.data as unknown as { sessions: RadiusSession[]; meta: { total: number; page: number; totalPages: number } };
    },
  });

  const { data: eventsData } = useQuery({
    queryKey: ['radius-events'],
    queryFn: async () => {
      const res = await api.getRadiusEvents({ limit: 10 });
      return res.data as unknown as { events: Event[] };
    },
    refetchInterval: 30000,
  });

  if (!user) return null;

  const sessions = sessionsData?.sessions || [];
  const meta = sessionsData?.meta || { total: 0, page: 1, totalPages: 1 };
  const events = eventsData?.events || [];
  const stats = sessionStats;
  const health = healthData;

  const getServiceStatus = (service?: { status: string }) => {
    if (!service) return { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', label: 'Unknown' };
    switch (service.status) {
      case 'ok':
      case 'configured':
      case 'connected':
        return { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Healthy' };
      case 'error':
      case 'disconnected':
        return { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Error' };
      default:
        return { icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Degraded' };
    }
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Network Management</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Monitor RADIUS sessions and network health</p>
        </div>

        {/* Stats Overview */}
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
            value={statsLoading ? '...' : formatBytes((stats?.totalBandwidth?.input || 0) + (stats?.totalBandwidth?.output || 0))}
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
            title="System Status"
            value={health?.status === 'ok' ? 'Online' : health?.status === 'degraded' ? 'Degraded' : 'Offline'}
            icon={Server}
            color={health?.status === 'ok' ? 'green' : health?.status === 'degraded' ? 'yellow' : 'red'}
            loading={healthLoading}
          />
        </div>

        {/* Network Health Status */}
        <Card>
          <CardHeader title="Network Health Status" description="Service availability and latency" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Database', service: health?.services?.database },
              { name: 'Redis Cache', service: health?.services?.redis },
              { name: 'RADIUS', service: health?.services?.radius },
              { name: 'M-Pesa', service: health?.services?.mpesa },
            ].map((item) => {
              const status = getServiceStatus(item.service);
              const Icon = status.icon;
              return (
                <div key={item.name} className={`p-4 rounded-xl ${status.bg} transition-colors`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${status.color}`} />
                    <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                  </div>
                  <p className={`mt-1 text-sm ${status.color}`}>
                    {status.label}
                    {item.service?.latencyMs && ` (${item.service.latencyMs}ms)`}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Sessions Filter */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="ACTIVE">Active Sessions</option>
              <option value="CLOSED">Closed Sessions</option>
              <option value="">All Sessions</option>
            </select>
          </div>
        </Card>

        {sessionsError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load RADIUS sessions. Please try again.
          </div>
        )}

        {/* Sessions Table */}
        <Card padding="none">
          {sessionsLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={8} />
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
                {sessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {session.user
                            ? `${session.user.firstName} ${session.user.lastName}`
                            : session.framedIpAddress || session.nasIpAddress}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{session.user?.customer?.accountNumber || session.sessionId}</p>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>IP: {session.framedIpAddress || 'N/A'}</span>
                      <span>Data: {formatBytes(session.totalOctets)}</span>
                      <span>NAS: {session.nasIpAddress}</span>
                      <span>Start: {format(new Date(session.startTime), 'HH:mm')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Session ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>NAS IP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Usage</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const startTime = new Date(session.startTime);
                      const endTime = session.stopTime ? new Date(session.stopTime) : new Date();
                      const durationMs = endTime.getTime() - startTime.getTime();
                      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                      const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                      return (
                        <TableRow key={session.id} className="group">
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {session.user
                                  ? `${session.user.firstName} ${session.user.lastName}`
                                  : 'Unknown'}
                              </p>
                              {session.user?.customer?.accountNumber && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{session.user.customer.accountNumber}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{session.sessionId.slice(0, 16)}...</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm text-gray-900 dark:text-white">{session.framedIpAddress || 'N/A'}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm text-gray-900 dark:text-white">{session.nasIpAddress}</p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={session.status} />
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-gray-900 dark:text-white">{formatBytes(session.totalOctets)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ↑{formatBytes(session.outputOctets)} ↓{formatBytes(session.inputOctets)}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {format(startTime, 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell className="text-sm text-gray-900 dark:text-white">
                            {session.status === 'ACTIVE'
                              ? `${durationHours}h ${durationMins}m`
                              : `${durationHours}h ${durationMins}m`}
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
                  itemsPerPage={15}
                />
              )}
            </>
          )}
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader title="Recent Events" description="Connection and disconnection events from the last 24 hours" />
          {events.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent events"
              description="Network events will appear here as they happen."
            />
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-3">
                    {event.status === 'ACTIVE' ? (
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.user
                          ? `${event.user.firstName} ${event.user.lastName}`
                          : 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.status === 'ACTIVE'
                          ? 'Connected'
                          : `Disconnected${event.terminateCause ? ` (${event.terminateCause})` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {format(new Date(event.startTime), 'MMM d, HH:mm')}
                    </p>
                    {event.stopTime && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Ended: {format(new Date(event.stopTime), 'HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
