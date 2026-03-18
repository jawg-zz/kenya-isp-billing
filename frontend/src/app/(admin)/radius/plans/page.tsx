'use client';
export const dynamic = 'force-dynamic';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  Package,
  RefreshCw,
  Wifi,
  BarChart3,
  Upload,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
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
  isFeatured: boolean;
  isActive: boolean;
  radiusSynced?: boolean;
  radiusProfile?: string;
  lastSyncedAt?: string;
}

export default function RadiusPlansPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['radius-plans'],
    queryFn: async () => {
      const res = await api.getPlans();
      return (res.data as unknown as { plans: Plan[] })?.plans || [];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (planId: string) => {
      return api.syncPlanToRadius(planId);
    },
    onSuccess: (_data, variables) => {
      toast.success('Plan synced to RADIUS successfully');
      queryClient.invalidateQueries({ queryKey: ['radius-plans'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to sync plan to RADIUS');
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      return api.syncAllPlansToRadius();
    },
    onSuccess: () => {
      toast.success('All plans synced to RADIUS successfully');
      queryClient.invalidateQueries({ queryKey: ['radius-plans'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to sync all plans to RADIUS');
    },
  });

  if (!user) return null;

  const plans = data || [];
  const syncedCount = plans.filter((p) => p.radiusSynced).length;
  const unsyncedCount = plans.length - syncedCount;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              RADIUS Plan Sync
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Synchronize service plans with the RADIUS server for speed and data limit enforcement
            </p>
          </div>
          <Button
            onClick={() => syncAllMutation.mutate()}
            isLoading={syncAllMutation.isPending}
            disabled={unsyncedCount === 0}
          >
            <Upload className="h-4 w-4 mr-2" /> Sync All Plans
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load plans. Please try again.
          </div>
        )}

        {/* Sync Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Plans</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{plans.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Synced</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{syncedCount}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Sync</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{unsyncedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-300">About RADIUS Plan Sync</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                Syncing plans to RADIUS creates user profiles on the MikroTik routers that define
                speed limits and data caps. When a customer connects, their plan&apos;s RADIUS profile
                determines their bandwidth allocation. Plans with speed limits will be enforced
                via RADIUS attributes (MikroTik-Rate-Limit).
              </p>
            </div>
          </div>
        </Card>

        {/* Plans Table */}
        <Card padding="none">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} cols={7} />
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No plans available"
              description="Create service plans first, then sync them to the RADIUS server."
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{plan.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{plan.code}</p>
                      </div>
                      <Badge variant={plan.radiusSynced ? 'success' : 'warning'}>
                        {plan.radiusSynced ? 'Synced' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>Speed: {plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}</span>
                      <span>Data: {plan.dataAllowance ? formatBytes(plan.dataAllowance) : 'Unlimited'}</span>
                      <span>Type: {plan.type}</span>
                      <span>Validity: {plan.validityDays}d</span>
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => syncMutation.mutate(plan.id)}
                        isLoading={syncMutation.isPending && syncMutation.variables === plan.id}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" /> Sync to RADIUS
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Speed Limit</TableHead>
                      <TableHead>Data Allowance</TableHead>
                      <TableHead>RADIUS Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                              <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{plan.name}</p>
                              {!plan.isActive && (
                                <Badge variant="default" size="sm">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm text-gray-900 dark:text-white">
                            {plan.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Badge variant="info" size="sm">{plan.type}</Badge>
                            <Badge variant="default" size="sm">{plan.dataType}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {plan.dataAllowance ? formatBytes(plan.dataAllowance) : 'Unlimited'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={plan.radiusSynced ? 'success' : 'warning'}>
                              {plan.radiusSynced ? 'Synced' : 'Pending'}
                            </Badge>
                            {plan.lastSyncedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(plan.lastSyncedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => syncMutation.mutate(plan.id)}
                            isLoading={syncMutation.isPending && syncMutation.variables === plan.id}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
