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
  Package,
  Wifi,
  Check,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
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
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to subscribe. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900">Available Plans</h1>
          <p className="mt-1 text-gray-600">Choose a plan that fits your needs</p>
        </div>

        {plansError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Failed to load plans. Please try again.
          </div>
        )}

        {activeSubscription && activePlan && (
          <Card className="border-green-200 bg-green-50">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-800">Active Subscription</h3>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-green-900">{activePlan.name}</span>
                    <StatusBadge status={activeSubscription.status} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-sm">
                    <div>
                      <p className="text-green-700">Price</p>
                      <p className="font-semibold text-green-900">{formatKES(Number(activePlan.price))}</p>
                    </div>
                    <div>
                      <p className="text-green-700">Speed</p>
                      <p className="font-semibold text-green-900">
                        {activePlan.speedLimit ? `${activePlan.speedLimit} Mbps` : 'Unlimited'}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700">Data</p>
                      <p className="font-semibold text-green-900">{formatBytes(activePlan.dataAllowance)}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      Active until: {format(new Date(activeSubscription.endDate), 'MMM d, yyyy')}
                    </p>
                    {activeSubscription.autoRenew && (
                      <p className="flex items-center gap-1 mt-1 text-green-600">
                        <TrendingUp className="h-3 w-3" /> Auto-renew enabled
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {plansLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : plans.length === 0 ? (
          <Card className="border-dashed">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Plans Available</h3>
              <p className="mt-1 text-gray-500">Please check back later for available plans.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isActivePlan = activePlan?.id === plan.id;
              return (
                <Card key={plan.id} className={`relative ${isActivePlan ? 'ring-2 ring-primary-500' : ''}`}>
                  {plan.isFeatured && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-1 rounded">
                        Featured
                      </span>
                    </div>
                  )}
                  {isActivePlan && (
                    <div className="absolute top-3 left-3">
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
                        <Check className="h-3 w-3" /> Current
                      </span>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary-600" />
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                    </div>

                    {plan.description && (
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    )}

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-primary-600">{formatKES(plan.price)}</span>
                      <span className="text-sm text-gray-500">
                        /{plan.type === 'PREPAID' ? `${plan.validityDays}d` : 'mo'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-gray-400" />
                        <span>Speed: {plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-400" />
                        <span>Data: {formatBytes(plan.dataAllowance)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>Valid for: {plan.validityDays} days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          plan.type === 'PREPAID' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {plan.type}
                        </span>
                      </div>
                    </div>

                    {(plan.fupThreshold || plan.fupSpeedLimit) && (
                      <div className="p-2 bg-yellow-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div className="text-xs text-yellow-700">
                            <p className="font-medium">Fair Usage Policy</p>
                            {plan.fupThreshold && (
                              <p>After {formatBytes(plan.fupThreshold)}, speed may be reduced</p>
                            )}
                            {plan.fupSpeedLimit && (
                              <p>Reduced speed: {plan.fupSpeedLimit} Mbps</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      {isActivePlan ? (
                        <Button disabled className="w-full" variant="secondary">
                          <Check className="h-4 w-4 mr-2" /> Current Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={() => subscribeMutation.mutate(plan.id)}
                          isLoading={subscribeMutation.isPending}
                          className="w-full"
                        >
                          Subscribe Now
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
          <Card className="border-dashed">
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                You have an active subscription. Subscribe to a new plan to replace your current one.
              </p>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
