'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '@/components/ui/Table';
import { format } from 'date-fns';
import { CreditCard, Smartphone, CheckCircle2, Clock } from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'airtel'>('mpesa');
  const [isPaying, setIsPaying] = useState(false);
  const [pollingPaymentId, setPollingPaymentId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', { page }],
    queryFn: async () => {
      const res = await api.getPaymentHistory({ page, limit: 10 });
      return res.data;
    },
  });

  const handlePayment = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsPaying(true);

    try {
      let result;
      if (paymentMethod === 'mpesa') {
        result = await api.initiateMpesaPayment({
          amount: numAmount,
          phoneNumber: phone || undefined,
        });
      } else {
        result = await api.initiateAirtelPayment({
          amount: numAmount,
          phoneNumber: phone || undefined,
        });
      }

      if (result.success && result.data?.paymentId) {
        toast.success(result.message || 'Payment initiated! Check your phone.');
        setPollingPaymentId(result.data.paymentId);
        setAmount('');

        // Poll for payment status
        const pollInterval = setInterval(async () => {
          try {
            const status = await api.checkMpesaStatus(result.data!.paymentId);
            if (status.data?.payment?.status === 'COMPLETED') {
              clearInterval(pollInterval);
              setPollingPaymentId(null);
              toast.success('Payment completed successfully!');
              queryClient.invalidateQueries({ queryKey: ['payments'] });
            } else if (status.data?.payment?.status === 'FAILED' || status.data?.payment?.status === 'TIMEOUT') {
              clearInterval(pollInterval);
              setPollingPaymentId(null);
              toast.error('Payment failed or timed out');
            }
          } catch {
            // Continue polling
          }
        }, 5000);

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setPollingPaymentId(null);
        }, 120000);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Payment initiation failed');
    } finally {
      setIsPaying(false);
    }
  };

  if (!user) return null;

  const payments = (data as { payments?: Record<string, unknown>[] })?.payments || [];
  const meta = (data as { meta?: { total: number; page: number; totalPages: number } })?.meta || { total: 0, page: 1, totalPages: 1 };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-gray-600">Make payments and view your payment history</p>
        </div>

        {/* Make Payment */}
        <Card>
          <CardHeader title="Make a Payment" description="Top up your account via M-Pesa or Airtel Money" />
          <div className="space-y-4 max-w-lg">
            {/* Payment method selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('mpesa')}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'mpesa'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Smartphone className="h-5 w-5" />
                <span className="font-medium">M-Pesa</span>
              </button>
              <button
                onClick={() => setPaymentMethod('airtel')}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'airtel'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span className="font-medium">Airtel Money</span>
              </button>
            </div>

            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              helperText="The number registered with your mobile money account"
            />

            <Input
              label="Amount (KES)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
            />

            <div className="flex gap-2">
              {[100, 500, 1000, 2000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(String(preset))}
                  className="px-3 py-1 text-sm rounded-full border border-gray-300 hover:bg-gray-50"
                >
                  {formatKES(preset)}
                </button>
              ))}
            </div>

            <Button
              onClick={handlePayment}
              isLoading={isPaying}
              disabled={!amount || pollingPaymentId !== null}
              className="w-full"
              size="lg"
            >
              {pollingPaymentId ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Waiting for payment...
                </>
              ) : (
                `Pay ${amount ? formatKES(parseFloat(amount)) : ''}`
              )}
            </Button>

            {pollingPaymentId && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                <Clock className="h-4 w-4 animate-spin" />
                <span>Check your phone for the {paymentMethod === 'mpesa' ? 'M-Pesa' : 'Airtel Money'} prompt...</span>
              </div>
            )}
          </div>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader title="Payment History" />

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No payments yet</p>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="block lg:hidden space-y-3">
                {payments.map((payment: Record<string, unknown>) => (
                  <div key={payment.id as string} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{payment.paymentNumber as string}</p>
                        <p className="text-sm text-gray-500">{payment.method as string}</p>
                      </div>
                      <StatusBadge status={payment.status as string} />
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-sm text-gray-500">
                        {format(new Date(payment.createdAt as string), 'MMM d, yyyy HH:mm')}
                      </p>
                      <p className="font-semibold text-green-600">+{formatKES(Number(payment.amount))}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: Record<string, unknown>) => (
                      <TableRow key={payment.id as string}>
                        <TableCell className="font-medium">{payment.paymentNumber as string}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {payment.method === 'MPESA' ? (
                              <Smartphone className="h-4 w-4 text-green-600" />
                            ) : (
                              <CreditCard className="h-4 w-4" />
                            )}
                            {payment.method as string}
                          </span>
                        </TableCell>
                        <TableCell>{format(new Date(payment.createdAt as string), 'MMM d, yyyy HH:mm')}</TableCell>
                        <TableCell className="font-medium text-green-600">+{formatKES(Number(payment.amount))}</TableCell>
                        <TableCell><StatusBadge status={payment.status as string} /></TableCell>
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
