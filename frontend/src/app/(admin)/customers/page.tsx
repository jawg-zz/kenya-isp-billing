'use client';

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
import { format } from 'date-fns';
import { Users, Search, Plus, Eye, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

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

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', { page, search, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getCustomers({ page, limit: 15, search: search || undefined, status: statusFilter || undefined });
      return res.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const res = await api.getCustomerStats();
      return res.data;
    },
  });

  if (!user) return null;

  const customers = (data as { customers?: Record<string, unknown>[] })?.customers || [];
  const meta = (data as { meta?: { total: number; page: number; totalPages: number } })?.meta as any || { total: 0, page: 1, totalPages: 1 };
  const s = stats as Record<string, unknown> | undefined;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-1 text-gray-600">Manage your customer accounts</p>
          </div>
          <Link href="/admin/customers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Customer
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{(s?.totalCustomers as number) || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{(s?.activeCustomers as number) || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Suspended</p>
            <p className="text-2xl font-bold text-yellow-600">{(s?.suspendedCustomers as number) || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">New (30d)</p>
            <p className="text-2xl font-bold text-blue-600">{(s?.newCustomers as number) || 0}</p>
          </Card>
        </div>

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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
              <option value="PENDING_VERIFICATION">Pending</option>
            </select>
          </div>
        </Card>

        {/* Customer Table */}
        <Card padding="none">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No customers found</p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {customers.map((customer: Record<string, unknown>) => {
                  const u = customer.user as Record<string, unknown> | undefined;
                  const activeSub = (customer.subscriptions as Record<string, unknown>[])?.[0];
                  return (
                    <Link key={customer.id as string} href={`/admin/customers/${customer.id as string}`}>
                      <div className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{customer.accountNumber as string}</p>
                          </div>
                          <StatusBadge status={(u?.accountStatus as string) || 'UNKNOWN'} />
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span>{u?.phone as string || '—'}</span>
                          <span>{activeSub?.plan ? (activeSub.plan as Record<string, unknown>).name as string : 'No plan'}</span>
                        </div>
                        <div className="mt-1 text-sm">
                          Balance: <span className="font-medium">{formatKES(Number(customer.balance))}</span>
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
                    {customers.map((customer: Record<string, unknown>) => {
                      const u = customer.user as Record<string, unknown> | undefined;
                      const activeSub = (customer.subscriptions as Record<string, unknown>[])?.[0];
                      return (
                        <TableRow key={customer.id as string}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary-700">
                                  {u ? `${(u.firstName as string)?.[0]}${(u.lastName as string)?.[0]}` : '??'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                                <p className="text-xs text-gray-500">{u?.email as string}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm">{customer.accountNumber as string}</p>
                            <p className="text-xs text-gray-500">{customer.customerCode as string}</p>
                          </TableCell>
                          <TableCell>
                            {activeSub ? (
                              <span className="text-sm">{(activeSub.plan as Record<string, unknown>)?.name as string}</span>
                            ) : (
                              <span className="text-sm text-gray-400">None</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{formatKES(Number(customer.balance))}</TableCell>
                          <TableCell><StatusBadge status={(u?.accountStatus as string) || 'UNKNOWN'} /></TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {format(new Date(customer.createdAt as string), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/admin/customers/${customer.id as string}`}>
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
