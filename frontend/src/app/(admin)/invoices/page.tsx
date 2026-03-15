'use client';

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
import { format } from 'date-fns';
import { FileText, Download, Send } from 'lucide-react';

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

  const { data: stats } = useQuery({
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
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="mt-1 text-gray-600">Manage all customer invoices</p>
          </div>
          <Button onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending}>
            <Send className="h-4 w-4 mr-2" /> Generate Due Invoices
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{(s?.totalInvoices as number) || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Paid</p>
            <p className="text-2xl font-bold text-green-600">{(s?.paidInvoices as number) || 0}</p>
            <p className="text-xs text-gray-500">{formatKES(Number(s?.paidAmount || 0))}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{(s?.pendingInvoices as number) || 0}</p>
            <p className="text-xs text-gray-500">{formatKES(Number(s?.pendingAmount || 0))}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{(s?.overdueInvoices as number) || 0}</p>
          </Card>
        </div>

        {/* Table */}
        <Card padding="none">
          <div className="p-4 border-b">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No invoices found</p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {invoices.map((invoice: Record<string, unknown>) => {
                  const customer = invoice.customer as Record<string, unknown> | undefined;
                  const u = customer?.user as Record<string, unknown> | undefined;
                  return (
                    <div key={invoice.id as string} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber as string}</p>
                          <p className="text-sm text-gray-500">
                            {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
                          </p>
                        </div>
                        <StatusBadge status={invoice.status as string} />
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-gray-500">Due: {format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</span>
                        <span className="font-semibold">{formatKES(Number(invoice.totalAmount))}</span>
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
                        <TableRow key={invoice.id as string}>
                          <TableCell className="font-medium">{invoice.invoiceNumber as string}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatKES(Number(invoice.totalAmount))}</TableCell>
                          <TableCell>{format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}</TableCell>
                          <TableCell><StatusBadge status={invoice.status as string} /></TableCell>
                          <TableCell className="text-sm text-gray-500">
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
