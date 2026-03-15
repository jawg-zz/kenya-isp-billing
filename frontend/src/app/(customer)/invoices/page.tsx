'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { format } from 'date-fns';
import { FileText, Download, CreditCard } from 'lucide-react';
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
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-gray-600">View and manage your invoices</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Invoices</p>
            <p className="text-2xl font-bold">{meta.total}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Unpaid</p>
            <p className="text-2xl font-bold text-yellow-600">
              {invoices.filter((i: Record<string, unknown>) => i.status === 'PENDING' || i.status === 'OVERDUE').length}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Paid</p>
            <p className="text-2xl font-bold text-green-600">
              {invoices.filter((i: Record<string, unknown>) => i.status === 'PAID').length}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Invoice List"
            action={
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            }
          />

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No invoices found</p>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="block lg:hidden space-y-3">
                {invoices.map((invoice: Record<string, unknown>) => (
                  <div key={invoice.id as string} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber as string}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <StatusBadge status={invoice.status as string} />
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm text-gray-500">Due: {format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatKES(Number(invoice.totalAmount))}</p>
                        <div className="flex gap-2 mt-2">
                          <Link href={`/invoices/${invoice.id as string}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                          {invoice.status !== 'PAID' && (
                            <Link href={`/payments`}>
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
                      <TableRow key={invoice.id as string}>
                        <TableCell className="font-medium">{invoice.invoiceNumber as string}</TableCell>
                        <TableCell>{format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{formatKES(Number(invoice.totalAmount))}</TableCell>
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
