'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { Package, AlertTriangle, XCircle, Users, Eye, Pause, Play, Ban, Search } from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

function formatData(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

interface Subscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  dataUsed?: number;
  customer?: {
    id: string;
    accountNumber: string;
    user?: {
      firstName: string;
      lastName: string;
      email?: string;
    };
  };
  plan?: {
    id: string;
    name: string;
    price: number;
    speedMbps?: number;
    dataLimitMb?: number;
  };
}

export default function AdminSubscriptionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', { page, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getAllSubscriptions({ page, limit: 15, status: statusFilter || undefined });
      return res.data;
    },
  });

  const { data: expiringData } = useQuery({
    queryKey: ['expiring-subscriptions'],
    queryFn: async () => {
      const res = await api.getExpiringSubscriptions(7);
      return res.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return api.cancelSubscription(id, reason);
    },
    onSuccess: () => {
      toast.success('Subscription cancelled');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-subscriptions'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to cancel subscription');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.suspendSubscription(id);
    },
    onSuccess: () => {
      toast.success('Subscription suspended');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to suspend subscription');
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.activateSubscription(id);
    },
    onSuccess: () => {
      toast.success('Subscription activated');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to activate subscription');
    },
  });

  if (!user) return null;

  const subscriptions = (data as unknown as { subscriptions?: Subscription[] })?.subscriptions || [];
  const meta = (data as unknown as { meta?: { total: number; page: number; totalPages: number } })?.meta || { total: 0, page: 1, totalPages: 1 };
  const expiring = (expiringData as unknown as { subscriptions?: Subscription[] })?.subscriptions || [];

  // Compute stats from current page data
  const allSubs = subscriptions;
  const activeCount = allSubs.filter(s => s.status === 'ACTIVE').length;
  const expiringCount = expiring.length;
  const cancelledCount = allSubs.filter(s => s.status === 'CANCELLED').length;

  // Filter by search query
  const filteredSubscriptions = searchQuery
    ? allSubs.filter(s => {
        const name = `${s.customer?.user?.firstName || ''} ${s.customer?.user?.lastName || ''}`.toLowerCase();
        const account = (s.customer?.accountNumber || '').toLowerCase();
        const plan = (s.plan?.name || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || account.includes(q) || plan.includes(q);
      })
    : allSubs;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Subscriptions</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage all customer subscriptions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Active"
            value={activeCount}
            subtitle="Currently active subscriptions"
            icon={Package}
            color="green"
          />
          <StatCard
            title="Expiring Soon"
            value={expiringCount}
            subtitle="Within next 7 days"
            icon={AlertTriangle}
            color="yellow"
          />
          <StatCard
            title="Cancelled"
            value={cancelledCount}
            subtitle="Cancelled subscriptions"
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Filters */}
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name, account, or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </Card>

        {/* Table */}
        <Card padding="none">
          {isLoading ? (
            <TableSkeleton rows={10} cols={7} />
          ) : filteredSubscriptions.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No subscriptions found"
              description={statusFilter ? 'Try adjusting your filters' : 'No subscriptions have been created yet'}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Data Used</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {sub.customer?.user ? `${sub.customer.user.firstName} ${sub.customer.user.lastName}` : 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {sub.customer?.accountNumber || '—'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{sub.plan?.name || 'Unknown'}</p>
                          {sub.plan?.speedMbps && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{sub.plan.speedMbps} Mbps · {formatKES(sub.plan.price)}/mo</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sub.status} />
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400">
                        {format(new Date(sub.startDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400">
                        {format(new Date(sub.endDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400">
                        {sub.dataUsed != null ? formatData(sub.dataUsed) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link href={`/customers/${sub.customer?.id || ''}`}>
                            <Button variant="ghost" size="sm" title="View customer">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {sub.status === 'ACTIVE' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Suspend"
                              onClick={() => suspendMutation.mutate(sub.id)}
                              disabled={suspendMutation.isPending}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {sub.status === 'SUSPENDED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Activate"
                              onClick={() => activateMutation.mutate(sub.id)}
                              disabled={activateMutation.isPending}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancel"
                              onClick={() => cancelMutation.mutate({ id: sub.id, reason: 'Cancelled by admin' })}
                              disabled={cancelMutation.isPending}
                            >
                              <Ban className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
