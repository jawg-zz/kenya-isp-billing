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
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { validators } from '@/lib/validation';
import { getApiErrorMessage } from '@/lib/api-errors';

interface SettingEntry {
  key: string;
  value: string;
}

interface SettingsMap {
  [key: string]: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const validation = useFormValidation({ debounceMs: 500 });

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
    setSaving: (v: boolean) => void,
    validationRules?: Record<string, { key: string; rules: import('@/lib/validation').ValidationRule[] }[]>
  ) {
    // Validate fields if rules provided
    if (validationRules) {
      const values: Record<string, string> = {};
      const schema: Record<string, import('@/lib/validation').ValidationRule[]> = {};
      for (const group of Object.values(validationRules)) {
        for (const { key, rules } of group) {
          if (settings[key] !== undefined) {
            values[key] = settings[key];
            schema[key] = rules;
          }
        }
      }
      if (!validation.validateAll(values, schema)) {
        toast.error('Please fix the validation errors before saving');
        return;
      }
    }

    try {
      setSaving(true);
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      await api.bulkUpdateSettings(settingsArray);
      toast.success(`${category} settings saved`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, `Failed to save ${category.toLowerCase()} settings`));
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
                  error={validation.errors.company_name}
                />
                <Input
                  label="Company Email"
                  type="email"
                  value={company.company_email || ''}
                  onChange={(e) => {
                    setCompany({ ...company, company_email: e.target.value });
                    validation.validateFieldOnChange('company_email', e.target.value, [validators.email('Please enter a valid email')]);
                  }}
                  onBlur={(e) => validation.validateFieldOnBlur('company_email', e.target.value, [validators.email('Please enter a valid email')])}
                  placeholder="billing@acme-isp.com"
                  error={validation.errors.company_email}
                />
                <Input
                  label="Company Phone"
                  value={company.company_phone || ''}
                  onChange={(e) => {
                    setCompany({ ...company, company_phone: e.target.value });
                    validation.validateFieldOnChange('company_phone', e.target.value, [validators.kenyaPhone('Please enter a valid phone number')]);
                  }}
                  onBlur={(e) => validation.validateFieldOnBlur('company_phone', e.target.value, [validators.kenyaPhone('Please enter a valid phone number')])}
                  placeholder="+254700000000"
                  error={validation.errors.company_phone}
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
                      saveSection('Company', company, setSavingCompany, {
                        email: [{ key: 'company_email', rules: [validators.email('Please enter a valid email')] }],
                      })
                    }
                    isLoading={savingCompany}
                    disabled={savingCompany}
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
                    disabled={savingPayment}
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
                  onChange={(e) => {
                    setBilling({ ...billing, tax_rate: e.target.value });
                    validation.validateFieldOnChange('tax_rate', e.target.value, [validators.number('Must be a number')]);
                  }}
                  onBlur={(e) => validation.validateFieldOnBlur('tax_rate', e.target.value, [validators.number('Must be a number')])}
                  placeholder="16"
                  error={validation.errors.tax_rate}
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
                  onChange={(e) => {
                    setBilling({ ...billing, grace_period_days: e.target.value });
                    validation.validateFieldOnChange('grace_period_days', e.target.value, [validators.positiveNumber('Must be a positive number')]);
                  }}
                  onBlur={(e) => validation.validateFieldOnBlur('grace_period_days', e.target.value, [validators.positiveNumber('Must be a positive number')])}
                  placeholder="7"
                  error={validation.errors.grace_period_days}
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
                  disabled={savingBilling}
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
                    disabled={savingBranding}
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
                  onChange={(e) => {
                    setOperations({ ...operations, auto_suspend_grace_days: e.target.value });
                    validation.validateFieldOnChange('auto_suspend_grace_days', e.target.value, [validators.positiveNumber('Must be a positive number')]);
                  }}
                  onBlur={(e) => validation.validateFieldOnBlur('auto_suspend_grace_days', e.target.value, [validators.positiveNumber('Must be a positive number')])}
                  placeholder="3"
                  error={validation.errors.auto_suspend_grace_days}
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
                      onChange={(e) => {
                        setOperations({ ...operations, late_fee_percentage: e.target.value });
                        validation.validateFieldOnChange('late_fee_percentage', e.target.value, [validators.number('Must be a number')]);
                      }}
                      onBlur={(e) => validation.validateFieldOnBlur('late_fee_percentage', e.target.value, [validators.number('Must be a number')])}
                      placeholder="1.5"
                      error={validation.errors.late_fee_percentage}
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
                  onChange={(e) => {
                    setOperations({ ...operations, invoice_due_days: e.target.value });
                    validation.validateFieldOnChange('invoice_due_days', e.target.value, [validators.positiveNumber('Must be a positive number')]);
                  }}
                  onBlur={(e) => validation.validateFieldOnBlur('invoice_due_days', e.target.value, [validators.positiveNumber('Must be a positive number')])}
                  placeholder="30"
                  error={validation.errors.invoice_due_days}
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
                      onChange={(e) => {
                        setOperations({ ...operations, low_balance_alert_threshold: e.target.value });
                        validation.validateFieldOnChange('low_balance_alert_threshold', e.target.value, [validators.positiveNumber('Must be a positive number')]);
                      }}
                      onBlur={(e) => validation.validateFieldOnBlur('low_balance_alert_threshold', e.target.value, [validators.positiveNumber('Must be a positive number')])}
                      placeholder="1000"
                      error={validation.errors.low_balance_alert_threshold}
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() =>
                      saveSection('Operations', operations, setSavingOperations)
                    }
                    isLoading={savingOperations}
                    disabled={savingOperations}
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
                  onChange={(e) => {
                    setApiRadius({ ...apiRadius, radius_nas_ip: e.target.value });
                    if (e.target.value) {
                      validation.validateFieldOnChange('radius_nas_ip', e.target.value, [validators.ipAddress('Please enter a valid IP address')]);
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value) {
                      validation.validateFieldOnBlur('radius_nas_ip', e.target.value, [validators.ipAddress('Please enter a valid IP address')]);
                    }
                  }}
                  placeholder="192.168.1.1"
                  error={validation.errors.radius_nas_ip}
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
                  disabled={savingApiRadius}
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
