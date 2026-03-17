'use client';
export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { CreditCard, Smartphone, CheckCircle2, Clock, Zap } from 'lucide-react';

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
  const pollCountRef = useRef(0);

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

        pollCountRef.current = 0;
        let pollInterval: ReturnType<typeof setInterval>;
        const startTime = Date.now();
        const maxPollDuration = 120000;

        const getPollDelay = (count: number) => {
          const baseDelay = Math.min(20000, 5000 * Math.pow(2, count));
          const jitter = Math.random() * 1000;
          return baseDelay + jitter;
        };

        const poll = async () => {
          if (Date.now() - startTime > maxPollDuration) {
            clearInterval(pollInterval);
            setPollingPaymentId(null);
            return;
          }

          try {
            const status = await api.checkMpesaStatus(result.data!.paymentId);
            if (status.data?.payment?.status === 'COMPLETED') {
              clearInterval(pollInterval);
              setPollingPaymentId(null);
              toast.success('Payment completed successfully!');
              queryClient.invalidateQueries({ queryKey: ['payments'] });
              return;
            } else if (status.data?.payment?.status === 'FAILED' || status.data?.payment?.status === 'TIMEOUT') {
              clearInterval(pollInterval);
              setPollingPaymentId(null);
              toast.error('Payment failed or timed out');
              return;
            }
          } catch {
            // Continue polling
          }

          pollCountRef.current += 1;
          clearInterval(pollInterval);
          pollInterval = setInterval(poll, getPollDelay(pollCountRef.current));
        };

        pollInterval = setInterval(poll, 5000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setPollingPaymentId(null);
        }, maxPollDuration);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Payment initiation failed');
    } finally {
      setIsPaying(false);
    }
  };

  if (!user) return null;

  const payments = (data as unknown as { payments?: Record<string, unknown>[] })?.payments || [];
  const meta = (data as unknown as { meta?: { total: number; page: number; totalPages: number } })?.meta || { total: 0, page: 1, totalPages: 1 };

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payments</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Make payments and view your payment history</p>
        </div>

        {/* Make Payment */}
        <Card hover>
          <CardHeader title="Make a Payment" description="Top up your account via M-Pesa or Airtel Money" />
          <div className="space-y-5 max-w-lg">
            {/* Payment method selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('mpesa')}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  paymentMethod === 'mpesa'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className={`p-2 rounded-lg ${paymentMethod === 'mpesa' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <Smartphone className="h-5 w-5" />
                </div>
                <span className="font-medium">M-Pesa</span>
              </button>
              <button
                onClick={() => setPaymentMethod('airtel')}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  paymentMethod === 'airtel'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className={`p-2 rounded-lg ${paymentMethod === 'airtel' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <CreditCard className="h-5 w-5" />
                </div>
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

            <div className="flex gap-2 flex-wrap">
              {[100, 500, 1000, 2000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(String(preset))}
                  className={`px-4 py-2 text-sm rounded-xl border transition-all duration-200 ${
                    amount === String(preset)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
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
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  {amount ? `Pay ${formatKES(parseFloat(amount))}` : 'Enter Amount'}
                </>
              )}
            </Button>

            {pollingPaymentId && (
              <div className="flex items-center gap-2.5 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
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
            <div className="p-2">
              <TableSkeleton rows={6} cols={5} />
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No payments yet"
              description="Make your first payment to top up your account."
              action={
                <Button size="sm">
                  <Zap className="h-4 w-4 mr-2" /> Make Payment
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile view */}
              <div className="block lg:hidden space-y-3 p-1">
                {payments.map((payment: Record<string, unknown>) => (
                  <div key={payment.id as string} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{payment.paymentNumber as string}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{(payment.method as string).replace('_', ' ')}</p>
                      </div>
                      <StatusBadge status={payment.status as string} />
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(payment.createdAt as string), 'MMM d, yyyy HH:mm')}
                      </p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatKES(Number(payment.amount))}</p>
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
                      <TableRow key={payment.id as string} className="group">
                        <TableCell className="font-mono font-medium text-gray-900 dark:text-white">{payment.paymentNumber as string}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            {payment.method === 'MPESA' ? (
                              <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-900/30">
                                <Smartphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                            ) : (
                              <div className="p-1 rounded bg-red-100 dark:bg-red-900/30">
                                <CreditCard className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                              </div>
                            )}
                            {(payment.method as string).replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">{format(new Date(payment.createdAt as string), 'MMM d, yyyy HH:mm')}</TableCell>
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatKES(Number(payment.amount))}</TableCell>
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
