'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import {
  Building2,
  CreditCard,
  Calculator,
  Save,
  Loader2,
} from 'lucide-react';

interface SettingsMap {
  [key: string]: string;
}

export default function SettingsPage() {
  const { user } = useAuth();

  const [company, setCompany] = useState<SettingsMap>({});
  const [payment, setPayment] = useState<SettingsMap>({});
  const [billing, setBilling] = useState<SettingsMap>({});

  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await api.getSettings();
      if (res.success && res.data) {
        const all = res.data as Record<string, SettingsMap>;
        setCompany(all.company || {});
        setPayment(all.payment || {});
        setBilling(all.billing || {});
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSection(
    category: string,
    settings: SettingsMap,
    setSaving: (v: boolean) => void
  ) {
    try {
      setSaving(true);
      await api.bulkUpdateSettings(
        Object.fromEntries(
          Object.entries(settings).map(([k, v]) => [k, String(v)])
        )
      );
      toast.success(`${category} settings saved`);
    } catch {
      toast.error(`Failed to save ${category.toLowerCase()} settings`);
    } finally {
      setSaving(false);
    }
  }

  function Toggle({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }) {
    return (
      <label className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </label>
    );
  }

  if (!user) return null;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your ISP billing system configuration
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Settings */}
            <Card>
              <CardHeader
                title="Company Settings"
                description="Your business information"
              />
              <div className="space-y-4">
                <Input
                  label="Company Name"
                  value={company.company_name || ''}
                  onChange={(e) =>
                    setCompany({ ...company, company_name: e.target.value })
                  }
                  placeholder="Acme ISP Ltd"
                />
                <Input
                  label="Company Email"
                  type="email"
                  value={company.company_email || ''}
                  onChange={(e) =>
                    setCompany({ ...company, company_email: e.target.value })
                  }
                  placeholder="billing@acme-isp.com"
                />
                <Input
                  label="Company Phone"
                  value={company.company_phone || ''}
                  onChange={(e) =>
                    setCompany({ ...company, company_phone: e.target.value })
                  }
                  placeholder="+254700000000"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Address
                  </label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    rows={3}
                    value={company.company_address || ''}
                    onChange={(e) =>
                      setCompany({
                        ...company,
                        company_address: e.target.value,
                      })
                    }
                    placeholder="123 Business Park, Nairobi"
                  />
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() =>
                      saveSection('Company', company, setSavingCompany)
                    }
                    isLoading={savingCompany}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Company Settings
                  </Button>
                </div>
              </div>
            </Card>

            {/* Payment Settings */}
            <Card>
              <CardHeader
                title="Payment Settings"
                description="Configure payment methods"
              />
              <div className="space-y-4">
                <Toggle
                  label="M-Pesa Enabled"
                  checked={payment.mpesa_enabled === 'true'}
                  onChange={(v) =>
                    setPayment({
                      ...payment,
                      mpesa_enabled: String(v),
                    })
                  }
                />
                <Toggle
                  label="Airtel Money Enabled"
                  checked={payment.airtel_enabled === 'true'}
                  onChange={(v) =>
                    setPayment({
                      ...payment,
                      airtel_enabled: String(v),
                    })
                  }
                />
                <div className="pt-2">
                  <Button
                    onClick={() =>
                      saveSection('Payment', payment, setSavingPayment)
                    }
                    isLoading={savingPayment}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Payment Settings
                  </Button>
                </div>
              </div>
            </Card>

            {/* Billing Settings */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Billing Settings"
                description="Configure tax, grace period, and fair usage"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label="Tax Rate (%)"
                  type="number"
                  step="0.01"
                  value={billing.tax_rate || ''}
                  onChange={(e) =>
                    setBilling({ ...billing, tax_rate: e.target.value })
                  }
                  placeholder="16"
                />
                <Input
                  label="Tax Name"
                  value={billing.tax_name || ''}
                  onChange={(e) =>
                    setBilling({ ...billing, tax_name: e.target.value })
                  }
                  placeholder="VAT"
                />
                <Input
                  label="Grace Period (days)"
                  type="number"
                  value={billing.grace_period_days || ''}
                  onChange={(e) =>
                    setBilling({
                      ...billing,
                      grace_period_days: e.target.value,
                    })
                  }
                  placeholder="7"
                />
                <div className="flex items-end pb-1">
                  <Toggle
                    label="FUP Enabled"
                    checked={billing.fup_enabled === 'true'}
                    onChange={(v) =>
                      setBilling({
                        ...billing,
                        fup_enabled: String(v),
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-4 pt-2">
                <Button
                  onClick={() =>
                    saveSection('Billing', billing, setSavingBilling)
                  }
                  isLoading={savingBilling}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Billing Settings
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
