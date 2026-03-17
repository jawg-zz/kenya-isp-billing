'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { ArrowLeft, User, Mail, Phone, MapPin, CreditCard, FileText, Shield } from 'lucide-react';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { validators } from '@/lib/validation';
import { getApiErrorMessage, getApiFieldErrors } from '@/lib/api-errors';

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

interface Customer {
  id: string;
  accountNumber: string;
  customerCode: string;
  balance: number | string;
  creditLimit: number | string;
  notes?: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    accountStatus: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
  };
  subscriptions?: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    plan?: {
      name: string;
      price: number;
    };
  }>;
}

const editSchema = {
  firstName: [validators.required('First name is required'), validators.minLength(2, 'Must be at least 2 characters')],
  lastName: [validators.required('Last name is required'), validators.minLength(2, 'Must be at least 2 characters')],
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const customerId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postalCode: '',
    accountStatus: 'ACTIVE',
  });

  const formValidation = useFormValidation({ debounceMs: 400 });

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: async () => {
      const res = await api.getCustomer(customerId);
      return res.data as unknown as { customer: Customer };
    },
    enabled: !!customerId,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return api.updateCustomer(customerId, payload);
    },
    onSuccess: () => {
      toast.success('Customer updated successfully');
      setIsEditing(false);
      formValidation.clearErrors();
      queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      const fieldErrors = getApiFieldErrors(err);
      for (const [field, message] of Object.entries(fieldErrors)) {
        formValidation.setFieldError(field, message);
      }
      if (Object.keys(fieldErrors).length === 0) {
        toast.error(getApiErrorMessage(err, 'Failed to update customer'));
      }
    },
  });

  const startEditing = () => {
    if (u) {
      setEditForm({
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        phone: u.phone || '',
        addressLine1: u.addressLine1 || '',
        addressLine2: u.addressLine2 || '',
        city: u.city || '',
        county: u.county || '',
        postalCode: u.postalCode || '',
        accountStatus: u.accountStatus || 'ACTIVE',
      });
    }
    setIsEditing(true);
    formValidation.clearErrors();
  };

  const handleSave = () => {
    const isValid = formValidation.validateAll(
      { firstName: editForm.firstName, lastName: editForm.lastName },
      editSchema
    );
    if (!isValid) return;
    updateMutation.mutate(editForm);
  };

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (field in editSchema) {
      formValidation.validateFieldOnChange(field, value, editSchema[field as keyof typeof editSchema]);
    }
  };

  const handleEditBlur = (field: string, value: string) => {
    if (field in editSchema) {
      formValidation.validateFieldOnBlur(field, value, editSchema[field as keyof typeof editSchema]);
    }
  };

  if (!user) return null;

  const customer = data?.customer;
  const u = customer?.user;

  if (isLoading) {
    return (
      <MainLayout user={user}>
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !customer) {
    return (
      <MainLayout user={user}>
        <div className="space-y-6">
          <Link href="/customers" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
          </Link>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            Customer not found or failed to load.
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/customers" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
          </Link>
          <Button variant="secondary" size="sm" onClick={isEditing ? () => { setIsEditing(false); formValidation.clearErrors(); } : startEditing}>
            {isEditing ? 'Cancel' : 'Edit Customer'}
          </Button>
        </div>

        {/* Customer Header */}
        <Card hover>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <span className="text-2xl font-bold text-white">
                {u ? `${u.firstName[0]}${u.lastName[0]}` : '??'}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {u ? `${u.firstName} ${u.lastName}` : 'Unknown'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-mono mt-1">
                Account: {customer.accountNumber} | Code: {customer.customerCode}
              </p>
            </div>
            <div>
              <StatusBadge status={u?.accountStatus || 'UNKNOWN'} />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Information */}
          <Card>
            <CardHeader title="Contact Information" />
            {isEditing ? (
              <div className="space-y-4">
                <Input
                  label="First Name"
                  value={editForm.firstName}
                  onChange={(e) => handleEditChange('firstName', e.target.value)}
                  onBlur={(e) => handleEditBlur('firstName', e.target.value)}
                  error={formValidation.errors.firstName}
                />
                <Input
                  label="Last Name"
                  value={editForm.lastName}
                  onChange={(e) => handleEditChange('lastName', e.target.value)}
                  onBlur={(e) => handleEditBlur('lastName', e.target.value)}
                  error={formValidation.errors.lastName}
                />
                <Input
                  label="Phone"
                  value={editForm.phone}
                  onChange={(e) => handleEditChange('phone', e.target.value)}
                  error={formValidation.errors.phone}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">{u?.email || 'No email'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                    <p className="font-medium text-gray-900 dark:text-white">{u?.phone || 'No phone'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {[u?.addressLine1, u?.addressLine2, u?.city, u?.county, u?.postalCode].filter(Boolean).join(', ') || 'No address'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Account Balance / Edit Address */}
          {isEditing ? (
            <Card>
              <CardHeader title="Address" />
              <div className="space-y-4">
                <Input label="Address Line 1" value={editForm.addressLine1} onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })} />
                <Input label="Address Line 2" value={editForm.addressLine2} onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })} />
                <Input label="City" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                <Input label="County" value={editForm.county} onChange={(e) => setEditForm({ ...editForm, county: e.target.value })} />
                <Input label="Postal Code" value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })} />
              </div>
            </Card>
          ) : (
          <Card hover>
            <CardHeader title="Account Balance" />
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatKES(Number(customer.balance))}</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Credit Limit</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatKES(Number(customer.creditLimit))}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{format(new Date(customer.createdAt), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          </Card>
          )}

          {/* Balance Adjustment */}
          {!isEditing && (
            <BalanceAdjustmentCard customerId={customerId} onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
            }} />
          )}

          {/* Account Status & Save (edit mode) */}
          {isEditing ? (
            <Card>
              <CardHeader title="Account Status" />
              <div className="space-y-4">
                <div className="w-full">
                  <label htmlFor="accountStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Status</label>
                  <select
                    id="accountStatus"
                    value={editForm.accountStatus}
                    onChange={(e) => setEditForm({ ...editForm, accountStatus: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleSave}
                  isLoading={updateMutation.isPending}
                  disabled={updateMutation.isPending}
                >
                  Save Changes
                </Button>
              </div>
            </Card>
          ) : (
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-3">
              <Link href="/invoices/management" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" /> View Invoices
                </Button>
              </Link>
              <Link href="/revenue" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <CreditCard className="h-4 w-4 mr-2" /> View Payments
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" /> Manage Account
              </Button>
            </div>
          </Card>
          )}
        </div>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader title="Active Subscriptions" />
          {customer.subscriptions && customer.subscriptions.length > 0 ? (
            <div className="space-y-3">
              {customer.subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{sub.plan?.name || 'Unknown Plan'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(sub.startDate), 'MMM d, yyyy')} - {format(new Date(sub.endDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={sub.status} />
                    {sub.plan?.price && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatKES(sub.plan.price)}/mo</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No active subscriptions</p>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}

function BalanceAdjustmentCard({ customerId, onSuccess }: { customerId: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const validation = useFormValidation({ debounceMs: 300 });

  const adjustMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      return api.adjustCustomerBalance(customerId, amount, reason);
    },
    onSuccess: () => {
      toast.success('Balance adjusted successfully');
      setAmount('');
      setReason('');
      validation.clearErrors();
      onSuccess();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Failed to adjust balance'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    // Validate
    const isValid = validation.validateAll(
      { amount, reason },
      {
        amount: [
          validators.required('Amount is required'),
          validators.number('Please enter a valid number'),
        ],
        reason: [validators.required('Please provide a reason for the adjustment')],
      }
    );
    if (!isValid) return;

    if (numAmount === 0) {
      validation.setFieldError('amount', 'Amount cannot be zero');
      return;
    }

    adjustMutation.mutate({ amount: numAmount, reason: reason.trim() });
  };

  return (
    <Card>
      <CardHeader title="Balance Adjustment" description="Add credit or debit the customer account" />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="balance-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount (KES)
          </label>
          <input
            id="balance-amount"
            type="number"
            step="0.01"
            placeholder="e.g. 500 or -200"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              validation.validateFieldOnChange('amount', e.target.value, [
                validators.required('Amount is required'),
                validators.number('Please enter a valid number'),
              ]);
            }}
            onBlur={(e) => validation.validateFieldOnBlur('amount', e.target.value, [
              validators.required('Amount is required'),
              validators.number('Please enter a valid number'),
            ])}
            className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
              validation.errors.amount ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {validation.errors.amount && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.amount}</p>}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Positive = credit, Negative = debit</p>
        </div>
        <div>
          <label htmlFor="balance-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason
          </label>
          <textarea
            id="balance-reason"
            placeholder="Reason for this adjustment..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              validation.validateFieldOnChange('reason', e.target.value, [validators.required('Please provide a reason for the adjustment')]);
            }}
            onBlur={(e) => validation.validateFieldOnBlur('reason', e.target.value, [validators.required('Please provide a reason for the adjustment')])}
            rows={3}
            className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
              validation.errors.reason ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {validation.errors.reason && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.reason}</p>}
        </div>
        <Button type="submit" className="w-full" isLoading={adjustMutation.isPending} disabled={adjustMutation.isPending}>
          Apply Adjustment
        </Button>
      </form>
    </Card>
  );
}
