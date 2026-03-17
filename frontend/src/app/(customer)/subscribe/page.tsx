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
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/widgets/StatCard';
import { format } from 'date-fns';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  Package,
  Wifi,
  Check,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Zap,
  Star,
  XCircle,
} from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'Unlimited';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: 'PREPAID' | 'POSTPAID';
  dataType: 'DATA' | 'VOICE' | 'SMS' | 'BUNDLE';
  price: number;
  speedLimit?: number;
  dataAllowance?: number;
  validityDays: number;
  fupThreshold?: number;
  fupSpeedLimit?: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Subscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  plan: Plan;
}

export default function CustomerPlansPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['customer-plans'],
    queryFn: async () => {
      const res = await api.getPlans();
      return res.data as unknown as { plans: Plan[] };
    },
  });

  const { data: subscriptionsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.getSubscriptions();
      return res.data as unknown as { subscriptions: Subscription[] };
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      return api.createSubscription({ planId });
    },
    onSuccess: () => {
      toast.success('Subscription successful! Your plan is now active.');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['usage-summary'] });
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to subscribe. Please try again.'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ subscriptionId, reason }: { subscriptionId: string; reason?: string }) => {
      return api.cancelSubscription(subscriptionId, reason);
    },
    onSuccess: () => {
      toast.success('Subscription cancelled. It will remain active until the end of the billing period.');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setShowCancelDialog(false);
      setCancelReason('');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to cancel subscription.'));
    },
  });

  if (!user) return null;

  const plans = plansData?.plans?.filter((p) => p.isActive) || [];
  const subscriptions = subscriptionsData?.subscriptions || [];
  const activeSubscription = subscriptions.find((s) => s.status === 'ACTIVE');
  const activePlan = activeSubscription?.plan;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Available Plans</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Choose a plan that fits your needs</p>
        </div>

        {plansError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load plans. Please try again.
          </div>
        )}

        {activeSubscription && activePlan && (
          <>
            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Active Subscription</h3>
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{activePlan.name}</span>
                      <StatusBadge status={activeSubscription.status} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{formatKES(Number(activePlan.price))}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Speed</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                          {activePlan.speedLimit ? `${activePlan.speedLimit} Mbps` : 'Unlimited'}
                        </p>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Data</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{formatBytes(activePlan.dataAllowance)}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <p>
                        Active until: {format(new Date(activeSubscription.endDate), 'MMM d, yyyy')}
                      </p>
                      {activeSubscription.autoRenew && (
                        <p className="flex items-center gap-1 mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" /> Auto-renew enabled
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Cancel Subscription Section */}
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader
                title="Cancel Subscription"
                description="Your subscription will remain active until the end of the billing period."
              />
              {!showCancelDialog ? (
                <Button variant="danger" onClick={() => setShowCancelDialog(true)}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel Subscription
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-amber-700 dark:text-amber-300">
                        <p className="font-semibold">Are you sure you want to cancel?</p>
                        <p className="mt-1">Your subscription will remain active until {format(new Date(activeSubscription.endDate), 'MMM d, yyyy')}. You will not be charged after this date unless you resubscribe.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for cancellation (optional)</label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={2}
                      placeholder="Help us improve by sharing why you're cancelling..."
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="danger"
                      onClick={() => cancelMutation.mutate({ subscriptionId: activeSubscription.id, reason: cancelReason || undefined })}
                      isLoading={cancelMutation.isPending}
                    >
                      Confirm Cancellation
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}
                      disabled={cancelMutation.isPending}
                    >
                      Keep Subscription
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse space-y-4">
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card className="border-dashed border-2">
            <EmptyState
              icon={Package}
              title="No Plans Available"
              description="Please check back later for available plans. Contact support if you need assistance."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isActivePlan = activePlan?.id === plan.id;
              return (
                <Card
                  key={plan.id}
                  className={`relative transition-all duration-200 ${
                    isActivePlan
                      ? 'ring-2 ring-primary-500 dark:ring-primary-400 shadow-md'
                      : plan.isFeatured
                      ? 'ring-1 ring-primary-200 dark:ring-primary-800 shadow-sm hover:shadow-md'
                      : 'hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {plan.isFeatured && !isActivePlan && (
                    <div className="absolute -top-2.5 left-4">
                      <span className="inline-flex items-center gap-1 bg-primary-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Star className="h-3 w-3" /> Featured
                      </span>
                    </div>
                  )}
                  {isActivePlan && (
                    <div className="absolute -top-2.5 left-4">
                      <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Check className="h-3 w-3" /> Current Plan
                      </span>
                    </div>
                  )}
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${plan.isFeatured ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <Package className={`h-5 w-5 ${plan.isFeatured ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                    </div>

                    {plan.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{plan.description}</p>
                    )}

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">{formatKES(plan.price)}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        /{plan.type === 'PREPAID' ? `${plan.validityDays}d` : 'mo'}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
                        <Wifi className="h-4 w-4" />
                        <span>Speed: <strong className="text-gray-900 dark:text-white">{plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
                        <BarChart3 className="h-4 w-4" />
                        <span>Data: <strong className="text-gray-900 dark:text-white">{formatBytes(plan.dataAllowance)}</strong></span>
                      </div>
                      <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span>Valid for: <strong className="text-gray-900 dark:text-white">{plan.validityDays} days</strong></span>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          plan.type === 'PREPAID'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                        }`}>
                          {plan.type}
                        </span>
                      </div>
                    </div>

                    {(plan.fupThreshold || plan.fupSpeedLimit) && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            <p className="font-semibold">Fair Usage Policy</p>
                            {plan.fupThreshold && (
                              <p className="mt-0.5">After {formatBytes(plan.fupThreshold)}, speed may be reduced</p>
                            )}
                            {plan.fupSpeedLimit && (
                              <p className="mt-0.5">Reduced speed: {plan.fupSpeedLimit} Mbps</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      {isActivePlan ? (
                        <Button disabled className="w-full" variant="secondary">
                          <Check className="h-4 w-4 mr-2" /> Current Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={() => subscribeMutation.mutate(plan.id)}
                          isLoading={subscribeMutation.isPending}
                          className="w-full"
                          variant={plan.isFeatured ? 'primary' : 'secondary'}
                        >
                          <Zap className="h-4 w-4 mr-2" /> Subscribe Now
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {activeSubscription && (
          <Card className="border-dashed border-2">
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You have an active subscription. Subscribe to a new plan to replace your current one.
              </p>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
