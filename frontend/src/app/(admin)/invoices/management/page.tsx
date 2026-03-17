'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { FileText, Send, DollarSign, Clock, AlertTriangle } from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function AdminInvoicesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', { page, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getAllInvoices({ page, limit: 15, status: statusFilter || undefined });
      return res.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: async () => {
      const res = await api.getInvoiceStats();
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return api.generateInvoices();
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Invoices generated');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to generate invoices');
    },
  });

  if (!user) return null;

  const invoices = (data as { invoices?: Record<string, unknown>[] })?.invoices || [];
  const meta = (data as { meta?: { total: number; page: number; totalPages: number } })?.meta || { total: 0, page: 1, totalPages: 1 };
  const s = stats as Record<string, unknown> | undefined;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Invoices</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage all customer invoices</p>
          </div>
          <Button onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending}>
            <Send className="h-4 w-4 mr-2" /> Generate Due Invoices
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            title="Total"
            value={(s?.totalInvoices as number) || 0}
            icon={FileText}
            color="blue"
            loading={statsLoading}
          />
          <StatCard
            title="Paid"
            value={(s?.paidInvoices as number) || 0}
            subtitle={formatKES(Number(s?.paidAmount || 0))}
            icon={DollarSign}
            color="green"
            loading={statsLoading}
          />
          <StatCard
            title="Pending"
            value={(s?.pendingInvoices as number) || 0}
            subtitle={formatKES(Number(s?.pendingAmount || 0))}
            icon={Clock}
            color="yellow"
            loading={statsLoading}
          />
          <StatCard
            title="Overdue"
            value={(s?.overdueInvoices as number) || 0}
            icon={AlertTriangle}
            color="red"
            loading={statsLoading}
          />
        </div>

        {/* Table */}
        <Card padding="none">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={6} />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found"
              description={statusFilter ? 'Try changing the status filter.' : 'Invoices will appear here when generated.'}
              action={
                !statusFilter ? (
                  <Button onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending}>
                    <Send className="h-4 w-4 mr-2" /> Generate Invoices
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {invoices.map((invoice: Record<string, unknown>) => {
                  const customer = invoice.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={invoice.id as string} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber as string}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                          </p>
                        </div>
                        <StatusBadge status={invoice.status as string} />
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Due: {format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{formatKES(Number(invoice.totalAmount))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice: Record<string, unknown>) => {
                      const customer = invoice.customer as Record<string, unknown> | undefined;
                      const u = customer?.user as Record<string, unknown> | undefined;
                      return (
                        <TableRow key={invoice.id as string} className="group">
                          <TableCell className="font-mono font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber as string}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-900 dark:text-white">{formatKES(Number(invoice.totalAmount))}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400">{format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</TableCell>
                          <TableCell><StatusBadge status={invoice.status as string} /></TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}
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
