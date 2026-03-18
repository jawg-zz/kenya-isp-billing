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
  Server,
  Plus,
  Edit,
  Trash2,
  X,
  Wifi,
  Activity,
  Globe,
  Shield,
} from 'lucide-react';

interface NasDevice {
  id: string;
  name: string;
  ipAddress: string;
  type: string;
  secret: string;
  description?: string;
  status: string;
  activeSessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function RadiusNasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingNas, setEditingNas] = useState<NasDevice | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<NasDevice | null>(null);
  const [form, setForm] = useState({
    name: '',
    ipAddress: '',
    secret: '',
    type: 'MIKROTIK',
    description: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['radius-nas'],
    queryFn: async () => {
      const res = await api.getRadiusNas();
      return (res.data as unknown as { nas: NasDevice[] })?.nas || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return api.createRadiusNas(payload);
    },
    onSuccess: () => {
      toast.success('NAS device created successfully');
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to create NAS device');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      return api.updateRadiusNas(id, payload);
    },
    onSuccess: () => {
      toast.success('NAS device updated successfully');
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] });
      setShowForm(false);
      setEditingNas(null);
      resetForm();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update NAS device');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteRadiusNas(id);
    },
    onSuccess: () => {
      toast.success('NAS device deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] });
      setDeleteConfirm(null);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete NAS device');
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      ipAddress: '',
      secret: '',
      type: 'MIKROTIK',
      description: '',
    });
  };

  const handleEdit = (nas: NasDevice) => {
    setEditingNas(nas);
    setForm({
      name: nas.name || '',
      ipAddress: nas.ipAddress || '',
      secret: nas.secret || '',
      type: nas.type || 'MIKROTIK',
      description: nas.description || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      ipAddress: form.ipAddress,
      secret: form.secret,
      type: form.type,
      description: form.description,
    };

    if (editingNas) {
      updateMutation.mutate({ id: editingNas.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!user) return null;

  const nasDevices = data || [];

  const nasTypes = [
    { value: 'MIKROTIK', label: 'MikroTik' },
    { value: 'CISCO', label: 'Cisco' },
    { value: 'HUAWEI', label: 'Huawei' },
    { value: 'UBIQUITI', label: 'Ubiquiti' },
    { value: 'OTHER', label: 'Other' },
  ];

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              NAS Devices
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Manage MikroTik routers and NAS devices connected to the RADIUS server
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingNas(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add NAS Device
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Failed to load NAS devices. Please try again.
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{nasDevices.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Devices</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {nasDevices.filter((n) => n.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {nasDevices.reduce((sum, n) => sum + (n.activeSessionCount || 0), 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* NAS Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg">
              <CardHeader
                title={editingNas ? 'Edit NAS Device' : 'Add NAS Device'}
                action={
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingNas(null);
                    }}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                }
              />
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Device Name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="e.g., MikroTik-Router-01"
                />
                <Input
                  label="IP Address"
                  value={form.ipAddress}
                  onChange={(e) => setForm((p) => ({ ...p, ipAddress: e.target.value }))}
                  required
                  placeholder="e.g., 192.168.1.1"
                />
                <Input
                  label="Shared Secret"
                  value={form.secret}
                  onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                  required
                  placeholder="RADIUS shared secret"
                  type="password"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Device Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
                  >
                    {nasTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                />
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
                    {editingNas ? 'Update Device' : 'Add Device'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowForm(false);
                      setEditingNas(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete NAS Device
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong> ({deleteConfirm.ipAddress})?
                This action cannot be undone. Active sessions on this device may be affected.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                  isLoading={deleteMutation.isPending}
                >
                  Delete
                </Button>
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* NAS Devices Table */}
        <Card padding="none">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} cols={5} />
            </div>
          ) : nasDevices.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No NAS devices configured"
              description="Add your first NAS device (MikroTik router) to start managing network access."
              action={
                <Button
                  onClick={() => {
                    resetForm();
                    setEditingNas(null);
                    setShowForm(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add NAS Device
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden p-4 space-y-3">
                {nasDevices.map((nas) => (
                  <div
                    key={nas.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{nas.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{nas.ipAddress}</p>
                      </div>
                      <Badge variant={nas.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {nas.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{nas.type}</span>
                      <span>Sessions: {nas.activeSessionCount || 0}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(nas)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(nas)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
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
                      <TableHead>Name</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active Sessions</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nasDevices.map((nas) => (
                      <TableRow key={nas.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                              <Server className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{nas.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-mono text-sm text-gray-900 dark:text-white">{nas.ipAddress}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="info">{nas.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={nas.status === 'ACTIVE' ? 'success' : 'danger'}>
                            {nas.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {nas.activeSessionCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] block">
                            {nas.description || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(nas)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(nas)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
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
