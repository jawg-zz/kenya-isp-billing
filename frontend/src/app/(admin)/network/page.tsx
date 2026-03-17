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
import { format } from 'date-fns';
import {
  Wifi,
  Activity,
  Users,
  Database,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Server,
  HardDrive,
  Phone,
  Mail,
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
    if (!service) return { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Unknown' };
    switch (service.status) {
      case 'ok':
      case 'configured':
      case 'connected':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Healthy' };
      case 'error':
      case 'disconnected':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Error' };
      default:
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Degraded' };
    }
  };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Network Management</h1>
          <p className="mt-1 text-gray-600">Monitor RADIUS sessions and network health</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats?.activeSessions || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Bandwidth</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading
                    ? '...'
                    : formatBytes((stats?.totalBandwidth?.input || 0) + (stats?.totalBandwidth?.output || 0))}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Disconnects (24h)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats?.recentDisconnects || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-purple-100 rounded-lg">
                <Server className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">System Status</p>
                <p className="text-2xl font-bold text-gray-900">
                  {healthLoading ? '...' : health?.status === 'ok' ? 'Online' : 'Degraded'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Network Health Status */}
        <Card>
          <CardHeader title="Network Health Status" description="Service availability and latency" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Database', service: health?.services?.database },
              { name: 'Redis Cache', service: health?.services?.redis },
              { name: 'RADIUS', service: health?.services?.radius },
            ].map((item) => {
              const status = getServiceStatus(item.service);
              const Icon = status.icon;
              return (
                <div key={item.name} className={`p-4 rounded-lg ${status.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${status.color}`} />
                    <span className="font-medium">{item.name}</span>
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Active Sessions</option>
              <option value="CLOSED">Closed Sessions</option>
              <option value="">All Sessions</option>
            </select>
          </div>
        </Card>

        {sessionsError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Failed to load RADIUS sessions. Please try again.
          </div>
        )}

        {/* Sessions Table */}
        <Card padding="none">
          {sessionsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Wifi className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No {statusFilter.toLowerCase()} sessions found</p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {session.user
                            ? `${session.user.firstName} ${session.user.lastName}`
                            : session.framedIpAddress || session.nasIpAddress}
                        </p>
                        <p className="text-sm text-gray-500">{session.user?.customer?.accountNumber || session.sessionId}</p>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-500">
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
                        <TableRow key={session.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {session.user
                                  ? `${session.user.firstName} ${session.user.lastName}`
                                  : 'Unknown'}
                              </p>
                              {session.user?.customer?.accountNumber && (
                                <p className="text-xs text-gray-500">{session.user.customer.accountNumber}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs">{session.sessionId.slice(0, 16)}...</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm">{session.framedIpAddress || 'N/A'}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm">{session.nasIpAddress}</p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={session.status} />
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{formatBytes(session.totalOctets)}</p>
                            <p className="text-xs text-gray-500">
                              ↑{formatBytes(session.outputOctets)} ↓{formatBytes(session.inputOctets)}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {format(startTime, 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell className="text-sm">
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
            <p className="text-sm text-gray-500 text-center py-4">No recent events</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {event.status === 'ACTIVE' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {event.user
                          ? `${event.user.firstName} ${event.user.lastName}`
                          : 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.status === 'ACTIVE'
                          ? 'Connected'
                          : `Disconnected${event.terminateCause ? ` (${event.terminateCause})` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {format(new Date(event.startTime), 'MMM d, HH:mm')}
                    </p>
                    {event.stopTime && (
                      <p className="text-xs text-gray-500">
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
