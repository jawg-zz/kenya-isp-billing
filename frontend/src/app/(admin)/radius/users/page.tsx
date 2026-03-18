'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
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
  Users,
  Search,
  Eye,
  KeyRound,
  WifiOff,
  UserCheck,
  UserX,
  X,
  BarChart3,
  Clock,
  Shield,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface RadiusUser {
  id: string;
  customerId: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  status: string;
  activeSessions: number;
  planName?: string;
  totalDataUsed: number;
  lastConnectedAt?: string;
}

interface RadiusCustomerDetail {
  id: string;
  customerId: string;
  username: string;
  status: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    accountNumber: string;
    status: string;
  };
  plan?: {
    name: string;
    speedLimit: number;
    dataAllowance: number;
  };
  sessions: Array<{
    id: string;
    sessionId: string;
    nasIpAddress: string;
    startTime: string;
    stopTime?: string;
    status: string;
    totalOctets: number;
    inputOctets: number;
    outputOctets: number;
  }>;
  stats: {
    totalSessions: number;
    totalDataUsed: number;
    activeSessions: number;
  };
}

export default function RadiusUsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);

  // Fetch all RADIUS sessions to derive user info
  const { data: sessionsData, isLoading, error } = useQuery({
    queryKey: ['radius-users'],
    queryFn: async () => {
      const res = await api.getRadiusSessions({ limit: 1000 });
      return (res.data as { sessions: Record<string, unknown>[]; meta: Record<string, unknown> }) || { sessions: [], meta: {} };
    },
    refetchInterval: 60000,
  });

  // Fetch customer detail when viewing
  const { data: customerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['radius-customer-detail', detailCustomerId],
    queryFn: async () => {
      if (!detailCustomerId) return null;
      const res = await api.getRadiusCustomer(detailCustomerId);
      return (res.data as unknown as { customer: RadiusCustomerDetail })?.customer || null;
    },
    enabled: !!detailCustomerId,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return api.resetRadiusPassword(customerId);
    },
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to reset password');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return api.disconnectRadiusCustomer(customerId);
    },
    onSuccess: () => {
      toast.success('All sessions disconnected');
      queryClient.invalidateQueries({ queryKey: ['radius-users'] });
      queryClient.invalidateQueries({ queryKey: ['radius-sessions'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to disconnect sessions');
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return api.enableRadiusCustomer(customerId);
    },
    onSuccess: () => {
      toast.success('User enabled');
      queryClient.invalidateQueries({ queryKey: ['radius-users'] });
      queryClient.invalidateQueries({ queryKey: ['radius-customer-detail'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to enable user');
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return api.disableRadiusCustomer(customerId);
    },
    onSuccess: () => {
      toast.success('User disabled');
      queryClient.invalidateQueries({ queryKey: ['radius-users'] });
      queryClient.invalidateQueries({ queryKey: ['radius-customer-detail'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to disable user');
    },
  });

  // Derive unique users from sessions
  const users = useMemo(() => {
    const sessions = (sessionsData as unknown as { sessions: Record<string, unknown>[] })?.sessions || [];
    const userMap = new Map<string, RadiusUser>();

    sessions.forEach((s: Record<string, unknown>) => {
      const session = s as unknown as {
        id: string;
        userId?: string;
        username?: string;
        framedIpAddress?: string;
        nasIpAddress: string;
        startTime: string;
        stopTime?: string;
        status: string;
        totalOctets: number;
        inputOctets: number;
        outputOctets: number;
        user?: {
          id?: string;
          firstName: string;
          lastName: string;
          email?: string;
          customer?: { accountNumber: string };
        };
      };

      const key = session.userId || session.username || session.user?.id || session.framedIpAddress || session.nasIpAddress;
      if (!key) return;

      if (!userMap.has(key)) {
        userMap.set(key, {
          id: key,
          customerId: session.userId || session.user?.id || '',
          username: session.username || session.framedIpAddress || key,
          firstName: session.user?.firstName || '',
          lastName: session.user?.lastName || '',
          email: session.user?.email,
          status: session.status === 'ACTIVE' ? 'ACTIVE' : 'ACTIVE',
          activeSessions: 0,
          totalDataUsed: 0,
          lastConnectedAt: session.startTime,
        });
      }

      const user = userMap.get(key)!;
      if (session.status === 'ACTIVE') {
        user.activeSessions++;
      }
      user.totalDataUsed += session.totalOctets || 0;
      if (new Date(session.startTime) > new Date(user.lastConnectedAt || 0)) {
        user.lastConnectedAt = session.startTime;
      }
    });

    return Array.from(userMap.values());
  }, [sessionsData]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.activeSessions > 0) ||
        (statusFilter === 'INACTIVE' && u.activeSessions === 0);
      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  // Pagination
  const itemsPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = filteredUsers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  if (!user) return null;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              RADIUS Users
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Manage customer RADIUS credentials and session access
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load RADIUS users. Please try again.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {users.filter((u) => u.activeSessions > 0).length}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Data Used</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatBytes(users.reduce((sum, u) => sum + u.totalDataUsed, 0))}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by username or customer name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="ALL">All Users</option>
              <option value="ACTIVE">With Active Sessions</option>
              <option value="INACTIVE">No Active Sessions</option>
            </select>
          </div>
        </Card>

        {/* Users Table */}
        <Card padding="none">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={6} />
            </div>
          ) : paginatedUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No RADIUS users found"
              description={
                search || statusFilter !== 'ALL'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'RADIUS users will appear here when customers connect to the network.'
              }
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {paginatedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{u.username}</p>
                      </div>
                      <Badge variant={u.activeSessions > 0 ? 'success' : 'default'}>
                        {u.activeSessions > 0 ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>Sessions: {u.activeSessions}</span>
                      <span>Data: {formatBytes(u.totalDataUsed)}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDetailCustomerId(u.customerId)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Reset password for this user?')) {
                            resetPasswordMutation.mutate(u.customerId);
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {u.activeSessions > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Disconnect all sessions?')) {
                              disconnectMutation.mutate(u.customerId);
                            }
                          }}
                        >
                          <WifiOff className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active Sessions</TableHead>
                      <TableHead>Data Usage</TableHead>
                      <TableHead>Last Connected</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {u.username}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {u.firstName} {u.lastName}
                            </p>
                            {u.email && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.activeSessions > 0 ? 'success' : 'default'}>
                            {u.activeSessions > 0 ? 'Online' : 'Offline'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {u.activeSessions}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {formatBytes(u.totalDataUsed)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            {u.lastConnectedAt ? format(new Date(u.lastConnectedAt), 'MMM d, HH:mm') : 'Never'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDetailCustomerId(u.customerId)} title="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Reset password for this user?')) {
                                  resetPasswordMutation.mutate(u.customerId);
                                }
                              }}
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            {u.activeSessions > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm('Disconnect all sessions?')) {
                                    disconnectMutation.mutate(u.customerId);
                                  }
                                }}
                                title="Disconnect sessions"
                              >
                                <WifiOff className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Disable this user?')) {
                                  disableMutation.mutate(u.customerId);
                                }
                              }}
                              title="Disable user"
                            >
                              <UserX className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={filteredUsers.length}
                  itemsPerPage={itemsPerPage}
                />
              )}
            </>
          )}
        </Card>

        {/* Detail Modal */}
        {detailCustomerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader
                title="RADIUS User Details"
                action={
                  <button
                    onClick={() => setDetailCustomerId(null)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                }
              />
              {detailLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ))}
                </div>
              ) : customerDetail ? (
                <div className="space-y-6">
                  {/* Customer Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {customerDetail.customer.firstName} {customerDetail.customer.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Account Number</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        {customerDetail.customer.accountNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">RADIUS Username</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">{customerDetail.username}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                      <Badge variant={customerDetail.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {customerDetail.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Plan Info */}
                  {customerDetail.plan && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Plan</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Name</p>
                          <p className="font-medium text-gray-900 dark:text-white">{customerDetail.plan.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Speed</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {customerDetail.plan.speedLimit ? `${customerDetail.plan.speedLimit} Mbps` : 'Unlimited'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Data</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {customerDetail.plan.dataAllowance ? formatBytes(customerDetail.plan.dataAllowance) : 'Unlimited'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {customerDetail.stats.totalSessions}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Sessions</p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {customerDetail.stats.activeSessions}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Active Sessions</p>
                    </div>
                    <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl text-center">
                      <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                        {formatBytes(customerDetail.stats.totalDataUsed)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Data Used</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (confirm('Reset password?')) {
                          resetPasswordMutation.mutate(detailCustomerId);
                        }
                      }}
                      isLoading={resetPasswordMutation.isPending}
                    >
                      <KeyRound className="h-4 w-4 mr-1.5" /> Reset Password
                    </Button>
                    {customerDetail.status === 'ACTIVE' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => disableMutation.mutate(detailCustomerId)}
                        isLoading={disableMutation.isPending}
                      >
                        <UserX className="h-4 w-4 mr-1.5" /> Disable
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => enableMutation.mutate(detailCustomerId)}
                        isLoading={enableMutation.isPending}
                      >
                        <UserCheck className="h-4 w-4 mr-1.5" /> Enable
                      </Button>
                    )}
                    {customerDetail.stats.activeSessions > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => disconnectMutation.mutate(detailCustomerId)}
                        isLoading={disconnectMutation.isPending}
                      >
                        <WifiOff className="h-4 w-4 mr-1.5" /> Disconnect All
                      </Button>
                    )}
                  </div>

                  {/* Recent Sessions */}
                  {customerDetail.sessions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Sessions</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {customerDetail.sessions.slice(0, 10).map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant={session.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                                {session.status}
                              </Badge>
                              <span className="text-gray-600 dark:text-gray-400">{session.nasIpAddress}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-900 dark:text-white">{formatBytes(session.totalOctets)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(session.startTime), 'MMM d, HH:mm')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState icon={Users} title="User not found" description="Could not load user details." />
              )}
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
