'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { Users, Search, Plus, Eye, UserCheck, UserX, UserPlus } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  accountNumber: string;
  customerCode: string;
  balance: number | string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    accountStatus: string;
  };
  subscriptions?: {
    plan?: {
      name: string;
    };
  }[];
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  newCustomers: number;
}

interface CustomerResponse {
  customers: Customer[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
  };
}

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-customers', { page, search, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getCustomers({ page, limit: 15, search: search || undefined, status: statusFilter || undefined });
      return res.data as CustomerResponse;
    },
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const res = await api.getCustomerStats();
      return res.data as CustomerStats;
    },
  });

  if (!user) return null;

  const customers = data?.customers || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const s = stats;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Customers</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your customer accounts</p>
          </div>
          <Link href="/customers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Customer
            </Button>
          </Link>
        </div>

        {/* Stats */}
        {statsError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load customer statistics
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Total"
              value={s?.totalCustomers || 0}
              icon={Users}
              color="blue"
              loading={statsLoading}
            />
            <StatCard
              title="Active"
              value={s?.activeCustomers || 0}
              icon={UserCheck}
              color="green"
              loading={statsLoading}
            />
            <StatCard
              title="Suspended"
              value={s?.suspendedCustomers || 0}
              icon={UserX}
              color="yellow"
              loading={statsLoading}
            />
            <StatCard
              title="New (30d)"
              value={s?.newCustomers || 0}
              icon={UserPlus}
              color="indigo"
              loading={statsLoading}
            />
          </div>
        )}

        {/* Filters */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, email, phone, account..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
              <option value="PENDING_VERIFICATION">Pending</option>
            </select>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load customers. Please try again.
          </div>
        )}

        {/* Customer Table */}
        <Card padding="none">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={7} />
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? 'No customers match your search' : 'No customers yet'}
              description={search ? 'Try adjusting your search terms or filters.' : 'Add your first customer to get started.'}
              action={
                !search ? (
                  <Link href="/customers/new">
                    <Button><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {customers.map((customer) => {
                  const u = customer.user;
                  const activeSub = customer.subscriptions?.[0];
                  return (
                    <Link key={customer.id} href={`/customers/${customer.id}`}>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{customer.accountNumber}</p>
                          </div>
                          <StatusBadge status={u?.accountStatus || 'UNKNOWN'} />
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{u?.phone || '—'}</span>
                          <span>{activeSub?.plan ? activeSub.plan.name : 'No plan'}</span>
                        </div>
                        <div className="mt-1.5 text-sm">
                          Balance: <span className="font-semibold text-gray-900 dark:text-white">{formatKES(Number(customer.balance))}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => {
                      const u = customer.user;
                      const activeSub = customer.subscriptions?.[0];
                      return (
                        <TableRow key={customer.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                                  {u ? `${u.firstName[0]}${u.lastName[0]}` : '??'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{u?.email || ''}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm text-gray-900 dark:text-white">{customer.accountNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{customer.customerCode}</p>
                          </TableCell>
                          <TableCell>
                            {activeSub?.plan ? (
                              <span className="text-sm text-gray-900 dark:text-white">{activeSub.plan.name}</span>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500">None</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-gray-900 dark:text-white">{formatKES(Number(customer.balance))}</TableCell>
                          <TableCell><StatusBadge status={u?.accountStatus || 'UNKNOWN'} /></TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(customer.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/customers/${customer.id}`}>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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
      </div>
    </MainLayout>
  );
}
