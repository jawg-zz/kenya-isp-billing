'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { User, Shield, MapPin, Phone, Mail, Building2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    addressLine1: user?.addressLine1 || '',
    addressLine2: user?.addressLine2 || '',
    city: user?.city || '',
    county: user?.county || '',
    postalCode: user?.postalCode || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return api.updateProfile(data);
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      setIsEditing(false);
      refreshUser();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update profile');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return api.changePassword(data.currentPassword, data.newPassword);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to change password');
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(form);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  if (!user) return null;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-1 text-gray-600">Manage your account information</p>
        </div>

        {/* Profile Overview */}
        <Card>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-700">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-gray-500">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant={user.accountStatus === 'ACTIVE' ? 'success' : 'danger'}>
                  {user.accountStatus}
                </Badge>
                <Badge variant="info">{user.role}</Badge>
                {user.emailVerified && <Badge variant="success">Email Verified</Badge>}
                {user.phoneVerified && <Badge variant="success">Phone Verified</Badge>}
              </div>
            </div>
            {user.customer && (
              <div className="text-right text-sm">
                <p className="text-gray-500">Account Number</p>
                <p className="font-mono font-medium">{user.customer.accountNumber}</p>
                <p className="text-gray-500 mt-1">Customer Code</p>
                <p className="font-mono font-medium">{user.customer.customerCode}</p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card>
            <CardHeader
              title="Personal Information"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </Button>
              }
            />

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={form.firstName}
                    onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={form.lastName}
                    onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                    required
                  />
                </div>
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
                <Input
                  label="Address Line 1"
                  value={form.addressLine1}
                  onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))}
                />
                <Input
                  label="Address Line 2"
                  value={form.addressLine2}
                  onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))}
                />
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  />
                  <Input
                    label="County"
                    value={form.county}
                    onChange={(e) => setForm((p) => ({ ...p, county: e.target.value }))}
                  />
                  <Input
                    label="Postal Code"
                    value={form.postalCode}
                    onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                  />
                </div>
                <Button type="submit" isLoading={updateProfileMutation.isPending}>
                  Save Changes
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{user.phone || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">
                      {[user.addressLine1, user.city, user.county, user.postalCode].filter(Boolean).join(', ') || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Security */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Security" />
              {isChangingPassword ? (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    required
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                    required
                    helperText="Minimum 8 characters"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" isLoading={changePasswordMutation.isPending}>
                      Update Password
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsChangingPassword(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">Password</p>
                      <p className="text-xs text-gray-500">Last changed: unknown</p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => setIsChangingPassword(true)}>
                    Change Password
                  </Button>
                </div>
              )}
            </Card>

            {/* Account Info */}
            {user.customer && (
              <Card>
                <CardHeader title="Account Details" />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Account Balance</p>
                      <p className="text-xl font-semibold">
                        KES {Number(user.customer.balance).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Credit Limit</p>
                    <p className="font-medium">
                      KES {Number(user.customer.creditLimit).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
