'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { withAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import {
  ArrowLeft,
  FileText,
  Download,
  CreditCard,
  Calendar,
  DollarSign,
  User,
  Package,
  Clock,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

const STATUS_OPTIONS = ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];

function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusNotes, setStatusNotes] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPPORT';

  const { data, isLoading } = useQuery({
    queryKey: [isAdmin ? 'admin-invoice' : 'invoice', invoiceId],
    queryFn: async () => {
      const res = isAdmin
        ? await api.getAdminInvoice(invoiceId)
        : await api.getInvoice(invoiceId);
      return res.data as unknown as { invoice: Record<string, unknown> };
    },
    enabled: !!invoiceId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      return api.updateInvoiceStatus(invoiceId, status, notes);
    },
    onSuccess: (_res, variables) => {
      toast.success(`Invoice status updated to ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['admin-invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
      setStatusNotes('');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  const downloadPDF = async () => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const tokens = api.getTokens();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/invoices/${invoiceId}/download`,
        {
          headers: {
            Authorization: `Bearer ${tokens?.accessToken}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const invoice = data?.invoice;
      a.download = `Invoice_${invoice?.invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded');
    } catch {
      toast.error('Failed to download invoice PDF');
    }
  };

  if (!user) return null;

  const invoice = data?.invoice;
  if (!isLoading && !invoice) {
    return (
      <MainLayout user={user}>
        <div className="space-y-6">
          <Link href={isAdmin ? "/invoices/management" : "/invoices"} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </Link>
          <Card>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invoice not found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">This invoice may have been removed or you don&apos;t have access.</p>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const metadata = invoice?.metadata as { items?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }> } | undefined;
  const items = metadata?.items || [];
  const subscription = invoice?.subscription as { plan?: { name: string }; startDate?: string; endDate?: string } | undefined;
  const customer = invoice?.customer as { user?: { firstName?: string; lastName?: string; email?: string; phone?: string; addressLine1?: string; city?: string; county?: string }; customerCode?: string; accountNumber?: string } | undefined;
  const payments = (invoice?.payments || []) as Array<Record<string, unknown>>;
  const isUnpaid = invoice?.status === 'PENDING' || invoice?.status === 'OVERDUE';
  const currentStatus = invoice?.status as string;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Back link */}
        <Link href={isAdmin ? "/invoices/management" : "/invoices"} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {isLoading ? 'Loading...' : (invoice?.invoiceNumber as string)}
              </h1>
              {invoice && <StatusBadge status={currentStatus} />}
            </div>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {invoice && <>Created {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}</>}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={downloadPDF} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
            {!isAdmin && isUnpaid && (
              <Link href="/payments">
                <Button>
                  <CreditCard className="h-4 w-4 mr-2" /> Pay Now
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer info (admin only) */}
            {isAdmin && customer && (
              <Card>
                <CardHeader title="Customer Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {customer?.user?.firstName || ''} {customer?.user?.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Code: {customer?.customerCode || '—'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Account: {customer?.accountNumber || '—'}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {customer?.user?.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="h-3.5 w-3.5" /> {customer.user.email}
                      </div>
                    )}
                    {customer?.user?.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="h-3.5 w-3.5" /> {customer.user.phone}
                      </div>
                    )}
                    {customer?.user?.addressLine1 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="h-3.5 w-3.5" /> {customer.user.addressLine1}{customer.user.city ? `, ${customer.user.city}` : ''}{customer.user.county ? `, ${customer.user.county}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Invoice details */}
            <Card>
              <CardHeader title="Invoice Details" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                    <FileText className="h-3.5 w-3.5" /> Invoice #
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm font-mono">{invoice?.invoiceNumber as string}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Date
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {invoice && format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                    <Clock className="h-3.5 w-3.5" /> Due Date
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {invoice && format(new Date(invoice.dueDate as string), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
                    <Package className="h-3.5 w-3.5" /> Plan
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {subscription?.plan?.name || '—'}
                  </p>
                </div>
              </div>
              {subscription && subscription.startDate && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium">Subscription Period</p>
                  <p>{subscription.startDate ? format(new Date(subscription.startDate), 'MMM d, yyyy') : '—'} — {subscription.endDate ? format(new Date(subscription.endDate), 'MMM d, yyyy') : '—'}</p>
                </div>
              )}
            </Card>

            {/* Line items */}
            <Card>
              <CardHeader title="Line Items" />
              {items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 pr-4 font-semibold text-gray-600 dark:text-gray-400">Description</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Qty</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">Unit Price</th>
                        <th className="text-right py-3 pl-4 font-semibold text-gray-600 dark:text-gray-400">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-3 pr-4 text-gray-900 dark:text-white">{item.description}</td>
                          <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{item.quantity}</td>
                          <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{formatKES(item.unitPrice)}</td>
                          <td className="py-3 pl-4 text-right font-semibold text-gray-900 dark:text-white">{formatKES(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No line items available.</p>
              )}
            </Card>

            {/* Payment history */}
            <Card>
              <CardHeader title="Payment History" />
              {payments.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No payments recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id as string} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                          <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{formatKES(Number(payment.amount))}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {payment.method as string} &middot; {payment.processedAt ? format(new Date(payment.processedAt as string), 'MMM d, yyyy') : 'Pending'}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={payment.status as string} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Amount summary */}
            <Card>
              <CardHeader title="Amount Summary" />
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatKES(Number(invoice?.subtotal || 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">VAT ({(Number(invoice?.taxRate || 0) * 100).toFixed(0)}%)</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatKES(Number(invoice?.taxAmount || 0))}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{formatKES(Number(invoice?.totalAmount || 0))}</span>
                </div>
              </div>
              {!isAdmin && isUnpaid && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link href="/payments" className="block">
                    <Button className="w-full">
                      <CreditCard className="h-4 w-4 mr-2" /> Pay Now
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Admin: Update status */}
            {isAdmin && (
              <Card>
                <CardHeader title="Update Status" />
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={currentStatus}
                      onChange={(e) => {
                        updateStatusMutation.mutate({ status: e.target.value, notes: statusNotes || undefined });
                      }}
                      disabled={updateStatusMutation.isPending}
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      rows={3}
                      placeholder="Optional notes..."
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </div>
                {invoice?.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Existing Notes</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.notes as string}</p>
                  </div>
                )}
              </Card>
            )}

            {/* Customer: Notes */}
            {!isAdmin && invoice?.notes && (
              <Card>
                <CardHeader title="Notes" />
                <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.notes as string}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default withAuth(InvoiceDetailPage);
