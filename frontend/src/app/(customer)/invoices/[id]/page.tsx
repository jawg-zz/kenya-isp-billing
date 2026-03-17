'use client';
export const dynamic = 'force-dynamic';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const res = await api.getInvoice(invoiceId);
      return res.data as unknown as { invoice: Record<string, unknown> };
    },
    enabled: !!invoiceId,
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
          <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
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
  const subscription = invoice?.subscription as { plan?: { name: string } } | undefined;
  const payments = (invoice?.payments || []) as Array<Record<string, unknown>>;
  const isUnpaid = invoice?.status === 'PENDING' || invoice?.status === 'OVERDUE';

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Back link */}
        <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {isLoading ? 'Loading...' : invoice?.invoiceNumber as string}
              </h1>
              {invoice && <StatusBadge status={invoice.status as string} />}
            </div>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {invoice && <>Created {format(new Date(invoice.createdAt as string), 'MMM d, yyyy')}</>}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={downloadPDF} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
            {isUnpaid && (
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
            {/* Invoice summary */}
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
              {isUnpaid && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link href="/payments" className="block">
                    <Button className="w-full">
                      <CreditCard className="h-4 w-4 mr-2" /> Pay Now
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Notes */}
            {invoice?.notes && (
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
