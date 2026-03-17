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
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package, Plus, Edit, Trash2, X, Wifi, BarChart3, Clock, Star } from 'lucide-react';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
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

interface PlansResponse {
  plans: Plan[];
}

export default function AdminPlansPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    type: 'PREPAID',
    dataType: 'DATA',
    price: '',
    speedLimit: '',
    dataAllowance: '',
    validityDays: '30',
    fupThreshold: '',
    fupSpeedLimit: '',
    isFeatured: false,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await api.getPlans();
      return res.data as unknown as PlansResponse;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return api.createPlan(payload);
    },
    onSuccess: () => {
      toast.success('Plan created');
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to create plan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      return api.updatePlan(id, payload);
    },
    onSuccess: () => {
      toast.success('Plan updated');
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      setShowForm(false);
      setEditingPlan(null);
      resetForm();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deletePlan(id);
    },
    onSuccess: () => {
      toast.success('Plan deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to deactivate plan');
    },
  });

  const resetForm = () => {
    setForm({
      name: '', code: '', description: '', type: 'PREPAID', dataType: 'DATA',
      price: '', speedLimit: '', dataAllowance: '', validityDays: '30',
      fupThreshold: '', fupSpeedLimit: '', isFeatured: false,
    });
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name || '',
      code: plan.code || '',
      description: plan.description || '',
      type: plan.type || 'PREPAID',
      dataType: plan.dataType || 'DATA',
      price: String(plan.price || ''),
      speedLimit: plan.speedLimit ? String(plan.speedLimit) : '',
      dataAllowance: plan.dataAllowance ? String(Number(plan.dataAllowance) / (1024 * 1024)) : '',
      validityDays: String(plan.validityDays || 30),
      fupThreshold: plan.fupThreshold ? String(Number(plan.fupThreshold) / (1024 * 1024)) : '',
      fupSpeedLimit: plan.fupSpeedLimit ? String(plan.fupSpeedLimit) : '',
      isFeatured: plan.isFeatured || false,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: parseFloat(form.price),
      speedLimit: form.speedLimit ? parseInt(form.speedLimit) : null,
      dataAllowance: form.dataAllowance ? parseFloat(form.dataAllowance) : null,
      validityDays: parseInt(form.validityDays),
      fupThreshold: form.fupThreshold ? parseFloat(form.fupThreshold) : null,
      fupSpeedLimit: form.fupSpeedLimit ? parseInt(form.fupSpeedLimit) : null,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!user) return null;

  const plans = data?.plans || [];

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Plans</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your service plans and pricing</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingPlan(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Plan
          </Button>
        </div>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load plans. Please try again.
          </div>
        )}

        {/* Plan Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader
                title={editingPlan ? 'Edit Plan' : 'Create Plan'}
                action={
                  <button onClick={() => { setShowForm(false); setEditingPlan(null); }} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                }
              />
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Plan Name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required />
                  <Input label="Code" value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))} required placeholder="e.g., BASIC_5MB" />
                </div>
                <Input label="Description" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
                    <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors">
                      <option value="PREPAID">Prepaid</option>
                      <option value="POSTPAID">Postpaid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Data Type</label>
                    <select value={form.dataType} onChange={(e) => setForm(p => ({ ...p, dataType: e.target.value }))} className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors">
                      <option value="DATA">Data</option>
                      <option value="VOICE">Voice</option>
                      <option value="SMS">SMS</option>
                      <option value="BUNDLE">Bundle</option>
                    </select>
                  </div>
                  <Input label="Price (KES)" type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input label="Speed Limit (Mbps)" type="number" value={form.speedLimit} onChange={(e) => setForm(p => ({ ...p, speedLimit: e.target.value }))} helperText="Leave empty for unlimited" />
                  <Input label="Data Allowance (MB)" type="number" value={form.dataAllowance} onChange={(e) => setForm(p => ({ ...p, dataAllowance: e.target.value }))} helperText="Leave empty for unlimited" />
                  <Input label="Validity (days)" type="number" value={form.validityDays} onChange={(e) => setForm(p => ({ ...p, validityDays: e.target.value }))} required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="FUP Threshold (MB)" type="number" value={form.fupThreshold} onChange={(e) => setForm(p => ({ ...p, fupThreshold: e.target.value }))} />
                  <Input label="FUP Speed Limit (Mbps)" type="number" value={form.fupSpeedLimit} onChange={(e) => setForm(p => ({ ...p, fupSpeedLimit: e.target.value }))} />
                </div>

                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm(p => ({ ...p, isFeatured: e.target.checked }))} className="rounded-lg h-4 w-4 text-primary-600 focus:ring-primary-500" />
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Featured plan</span>
                  </div>
                </label>

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
                    {editingPlan ? 'Update Plan' : 'Create Plan'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingPlan(null); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Plans List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse space-y-4">
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card className="border-dashed border-2">
            <EmptyState
              icon={Package}
              title="No plans yet"
              description="Create your first service plan to offer to customers."
              action={
                <Button onClick={() => { resetForm(); setEditingPlan(null); setShowForm(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Create Plan
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} hover className="relative">
                {plan.isFeatured && (
                  <div className="absolute -top-2.5 left-4">
                    <span className="inline-flex items-center gap-1 bg-primary-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      <Star className="h-3 w-3" /> Featured
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

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{formatKES(plan.price)}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      /{plan.type === 'PREPAID' ? `${plan.validityDays}d` : 'mo'}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-2"><Wifi className="h-4 w-4" /> Speed</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{plan.speedLimit ? `${plan.speedLimit} Mbps` : 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Data</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{plan.dataAllowance ? formatBytes(plan.dataAllowance) : 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Validity</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{plan.validityDays} days</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(plan)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Deactivate this plan?')) {
                          deleteMutation.mutate(plan.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <div className="ml-auto">
                      <Badge variant={plan.isActive ? 'success' : 'default'}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
