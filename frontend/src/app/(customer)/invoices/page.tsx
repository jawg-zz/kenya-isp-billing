'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { FileText, CreditCard, Receipt } from 'lucide-react';
import Link from 'next/link';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getInvoices({ page, limit: 10, status: statusFilter || undefined });
      return res.data;
    },
  });

  if (!user) return null;

  const invoices = (data as { invoices?: Record<string, unknown>[] })?.invoices || [];
  const meta = (data as { meta?: { total: number; page: number; totalPages: number } })?.meta || { total: 0, page: 1, totalPages: 1 };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Invoices</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">View and manage your invoices</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Invoices"
            value={meta.total}
            icon={FileText}
            color="blue"
          />
          <StatCard
            title="Unpaid"
            value={invoices.filter((i: Record<string, unknown>) => i.status === 'PENDING' || i.status === 'OVERDUE').length}
            icon={CreditCard}
            color="yellow"
          />
          <StatCard
            title="Paid"
            value={invoices.filter((i: Record<string, unknown>) => i.status === 'PAID').length}
            icon={Receipt}
            color="green"
          />
        </div>

        <Card>
          <CardHeader
            title="Invoice List"
            action={
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            }
          />

          {isLoading ? (
            <div className="p-2">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={statusFilter ? 'No invoices match your filter' : 'No invoices yet'}
              description="Your invoices will appear here when generated."
            />
          ) : (
            <>
              {/* Mobile view */}
              <div className="block lg:hidden space-y-3 p-1">
                {invoices.map((invoice: Record<string, unknown>) => (
                  <div key={invoice.id as string} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber as string}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <StatusBadge status={invoice.status as string} />
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Due: {format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatKES(Number(invoice.totalAmount))}</p>
                        <div className="flex gap-2 mt-2">
                          <Link href={`/invoices/${invoice.id as string}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                          {invoice.status !== 'PAID' && (
                            <Link href="/payments">
                              <Button size="sm">Pay</Button>
                            </Link>
                          )}
                        </div>
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
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice: Record<string, unknown>) => (
                      <TableRow key={invoice.id as string} className="group">
                        <TableCell className="font-mono font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber as string}</TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">{format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">{format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-semibold text-gray-900 dark:text-white">{formatKES(Number(invoice.totalAmount))}</TableCell>
                        <TableCell><StatusBadge status={invoice.status as string} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/invoices/${invoice.id as string}`}>
                              <Button size="sm" variant="ghost">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </Link>
                            {invoice.status !== 'PAID' && (
                              <Link href="/payments">
                                <Button size="sm">
                                  <CreditCard className="h-4 w-4 mr-1" /> Pay
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {meta.totalPages > 1 && (
                <TablePagination
                  currentPage={page}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                  totalItems={meta.total}
                  itemsPerPage={10}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
