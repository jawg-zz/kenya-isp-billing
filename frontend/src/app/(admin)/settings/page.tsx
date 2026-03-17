'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import {
  Save,
  Loader2,
} from 'lucide-react';

interface SettingEntry {
  key: string;
  value: string;
}

interface SettingsMap {
  [key: string]: string;
}

export default function SettingsPage() {
  const { user } = useAuth();

  const [company, setCompany] = useState<SettingsMap>({});
  const [payment, setPayment] = useState<SettingsMap>({});
  const [billing, setBilling] = useState<SettingsMap>({});
  const [branding, setBranding] = useState<SettingsMap>({});
  const [operations, setOperations] = useState<SettingsMap>({});
  const [apiRadius, setApiRadius] = useState<SettingsMap>({});

  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingOperations, setSavingOperations] = useState(false);
  const [savingApiRadius, setSavingApiRadius] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await api.getSettings();
      if (res.success && res.data) {
        // Backend returns: { settings: { company: [{key, value}], ... }, total }
        const settingsGroup = (res.data as any).settings || {};
        const toMap = (arr: SettingEntry[]): SettingsMap =>
          Object.fromEntries((arr || []).map((s) => [s.key, s.value]));
        setCompany(toMap(settingsGroup.company));
        setPayment(toMap(settingsGroup.payment));
        setBilling(toMap(settingsGroup.billing));
        setBranding(toMap(settingsGroup.branding));
        setOperations(toMap(settingsGroup.operations));
        setApiRadius(toMap(settingsGroup.api_radius));
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
      // Transform flat map to array of {key, value} as expected by the backend
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      await api.bulkUpdateSettings(settingsArray);
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

            {/* Branding Settings */}
            <Card>
              <CardHeader
                title="Branding Settings"
                description="Customize your brand appearance"
              />
              <div className="space-y-4">
                <Input
                  label="Company Logo URL"
                  value={branding.company_logo_url || ''}
                  onChange={(e) =>
                    setBranding({ ...branding, company_logo_url: e.target.value })
                  }
                  placeholder="https://example.com/logo.png"
                />
                <Input
                  label="Company Tagline"
                  value={branding.company_tagline || ''}
                  onChange={(e) =>
                    setBranding({ ...branding, company_tagline: e.target.value })
                  }
                  placeholder="Your tagline here"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.primary_color || '#3b82f6'}
                        onChange={(e) =>
                          setBranding({ ...branding, primary_color: e.target.value })
                        }
                        className="h-10 w-14 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <Input
                        value={branding.primary_color || ''}
                        onChange={(e) =>
                          setBranding({ ...branding, primary_color: e.target.value })
                        }
                        placeholder="#3b82f6"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.secondary_color || '#6366f1'}
                        onChange={(e) =>
                          setBranding({ ...branding, secondary_color: e.target.value })
                        }
                        className="h-10 w-14 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <Input
                        value={branding.secondary_color || ''}
                        onChange={(e) =>
                          setBranding({ ...branding, secondary_color: e.target.value })
                        }
                        placeholder="#6366f1"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Currency"
                    value={branding.currency || ''}
                    onChange={(e) =>
                      setBranding({ ...branding, currency: e.target.value })
                    }
                    placeholder="KES"
                  />
                  <Input
                    label="Currency Symbol"
                    value={branding.currency_symbol || ''}
                    onChange={(e) =>
                      setBranding({ ...branding, currency_symbol: e.target.value })
                    }
                    placeholder="KSh"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Footer Text
                  </label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    rows={3}
                    value={branding.footer_text || ''}
                    onChange={(e) =>
                      setBranding({ ...branding, footer_text: e.target.value })
                    }
                    placeholder="© 2024 Your Company. All rights reserved."
                  />
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() =>
                      saveSection('Branding', branding, setSavingBranding)
                    }
                    isLoading={savingBranding}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Branding Settings
                  </Button>
                </div>
              </div>
            </Card>

            {/* Operations Settings */}
            <Card>
              <CardHeader
                title="Operations Settings"
                description="Configure automation and invoicing"
              />
              <div className="space-y-4">
                <Toggle
                  label="Auto-Suspend Overdue Accounts"
                  checked={operations.auto_suspend_overdue === 'true'}
                  onChange={(v) =>
                    setOperations({
                      ...operations,
                      auto_suspend_overdue: String(v),
                    })
                  }
                />
                <Input
                  label="Grace Days Before Suspension"
                  type="number"
                  value={operations.auto_suspend_grace_days || ''}
                  onChange={(e) =>
                    setOperations({
                      ...operations,
                      auto_suspend_grace_days: e.target.value,
                    })
                  }
                  placeholder="3"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Late Fee Percentage
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={operations.late_fee_percentage || ''}
                      onChange={(e) =>
                        setOperations({
                          ...operations,
                          late_fee_percentage: e.target.value,
                        })
                      }
                      placeholder="1.5"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                      %
                    </span>
                  </div>
                </div>
                <Input
                  label="Invoice Number Prefix"
                  value={operations.invoice_number_prefix || ''}
                  onChange={(e) =>
                    setOperations({
                      ...operations,
                      invoice_number_prefix: e.target.value,
                    })
                  }
                  placeholder="INV-"
                />
                <Input
                  label="Invoice Due Days"
                  type="number"
                  value={operations.invoice_due_days || ''}
                  onChange={(e) =>
                    setOperations({
                      ...operations,
                      invoice_due_days: e.target.value,
                    })
                  }
                  placeholder="30"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Low Balance Alert Threshold
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                      KSh
                    </span>
                    <Input
                      type="number"
                      className="pl-10"
                      value={operations.low_balance_alert_threshold || ''}
                      onChange={(e) =>
                        setOperations({
                          ...operations,
                          low_balance_alert_threshold: e.target.value,
                        })
                      }
                      placeholder="1000"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() =>
                      saveSection('Operations', operations, setSavingOperations)
                    }
                    isLoading={savingOperations}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Operations Settings
                  </Button>
                </div>
              </div>
            </Card>

            {/* API/RADIUS Settings */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="API / RADIUS Settings"
                description="Configure RADIUS server and API rate limits"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input
                  label="RADIUS Secret"
                  type="password"
                  value={apiRadius.radius_secret || ''}
                  onChange={(e) =>
                    setApiRadius({ ...apiRadius, radius_secret: e.target.value })
                  }
                  placeholder="••••••••"
                />
                <Input
                  label="RADIUS NAS IP"
                  value={apiRadius.radius_nas_ip || ''}
                  onChange={(e) =>
                    setApiRadius({ ...apiRadius, radius_nas_ip: e.target.value })
                  }
                  placeholder="192.168.1.1"
                />
                <Input
                  label="RADIUS NAS Port"
                  type="number"
                  value={apiRadius.radius_nas_port || ''}
                  onChange={(e) =>
                    setApiRadius({ ...apiRadius, radius_nas_port: e.target.value })
                  }
                  placeholder="1812"
                />
                <Input
                  label="RADIUS Accounting Port"
                  type="number"
                  value={apiRadius.radius_acct_port || ''}
                  onChange={(e) =>
                    setApiRadius({ ...apiRadius, radius_acct_port: e.target.value })
                  }
                  placeholder="1813"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Session Timeout
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={apiRadius.session_timeout_default || ''}
                      onChange={(e) =>
                        setApiRadius({
                          ...apiRadius,
                          session_timeout_default: e.target.value,
                        })
                      }
                      placeholder="3600"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                      seconds
                    </span>
                  </div>
                </div>
                <Input
                  label="API Rate Limit (per minute)"
                  type="number"
                  value={apiRadius.api_rate_limit_per_minute || ''}
                  onChange={(e) =>
                    setApiRadius({
                      ...apiRadius,
                      api_rate_limit_per_minute: e.target.value,
                    })
                  }
                  placeholder="60"
                />
              </div>
              <div className="mt-4 pt-2">
                <Button
                  onClick={() =>
                    saveSection('API/RADIUS', apiRadius, setSavingApiRadius)
                  }
                  isLoading={savingApiRadius}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save API / RADIUS Settings
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
