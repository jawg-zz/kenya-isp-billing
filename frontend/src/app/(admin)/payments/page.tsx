'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', { page, status: statusFilter }],
    queryFn: async () => {
      const res = await api.getAllPayments({ page, limit: 15, status: statusFilter || undefined });
      return res.data as { payments: Record<string, unknown>[]; meta: { total: number; page: number; totalPages: number } };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      const res = await api.getPaymentStats({});
      return res.data as Record<string, unknown>;
    },
  });

  if (!user) return null;

  const payments = data?.payments || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const s = stats;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-gray-600">View all customer payments</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Payments</p>
            <p className="text-2xl font-bold">{(s?.totalPayments as number) || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">{(s?.completedPayments as number) || 0}</p>
            <p className="text-xs text-gray-500">{formatKES(Number(s?.completedAmount || 0))}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{(s?.pendingPayments as number) || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-2xl font-bold text-red-600">{(s?.failedPayments as number) || 0}</p>
          </Card>
        </div>

        <Card padding="none">
          <div className="p-4 border-b">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No payments found</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: Record<string, unknown>) => {
                      const customer = payment.customer as Record<string, unknown> | undefined;
                      const u = customer?.user as Record<string, unknown> | undefined;
                      return (
                        <TableRow key={payment.id as string}>
                          <TableCell className="font-mono text-sm">{payment.paymentNumber as string}</TableCell>
                          <TableCell>
                            <p className="font-medium">{u ? `${u.firstName} ${u.lastName}` : 'Unknown'}</p>
                          </TableCell>
                          <TableCell className="font-medium">{formatKES(Number(payment.amount))}</TableCell>
                          <TableCell>{payment.method as string}</TableCell>
                          <TableCell><StatusBadge status={payment.status as string} /></TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {format(new Date(payment.createdAt as string), 'MMM d, yyyy HH:mm')}
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
