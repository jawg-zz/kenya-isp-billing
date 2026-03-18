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
  Router,
  Users,
  Monitor,
  Layers,
  ExternalLink,
  Activity,
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

// ── Inline Tabs components (matches project styling) ──────────────────

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}

const TabsContext = (() => {
  let ctx: TabsContextValue | null = null;
  return {
    Provider({ value, children }: { value: TabsContextValue; children: React.ReactNode }) {
      ctx = value;
      return <>{children}</>;
    },
    use() {
      if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
      return ctx;
    },
  };
})();

function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 ${className ?? ''}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  icon: Icon,
}: {
  value: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const { active, setActive } = TabsContext.use();
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none ${
        isActive
          ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { active } = TabsContext.use();
  if (active !== value) return null;
  return <div role="tabpanel" className={className}>{children}</div>;
}

// ── Settings page ─────────────────────────────────────────────────────

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

  // Network status
  const [radiusStatus, setRadiusStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [connectedNasCount, setConnectedNasCount] = useState<number>(0);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);
  const [networkStatusLoading, setNetworkStatusLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    loadNetworkStatus();
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
        // Only keep valid global RADIUS fields
        const rawRadius = toMap(settingsGroup.api_radius);
        setApiRadius({
          session_timeout_default: rawRadius.session_timeout_default || '',
          api_rate_limit_per_minute: rawRadius.api_rate_limit_per_minute || '',
        });
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function loadNetworkStatus() {
    try {
      setNetworkStatusLoading(true);
      const nasRes = await api.getRadiusNas();
      if (nasRes.success && nasRes.data) {
        const nasData = nasRes.data as any;
        setConnectedNasCount(nasData.nas?.length ?? nasData.total ?? 0);
        setRadiusStatus('online');
      }
    } catch {
      setRadiusStatus('offline');
    }
    try {
      const sessionsRes = await api.getRadiusSessions({ status: 'active', limit: 1 });
      if (sessionsRes.success && sessionsRes.data) {
        const sessionsData = sessionsRes.data as any;
        setActiveSessionsCount(sessionsData.meta?.total ?? 0);
      }
    } catch {
      // keep default
    } finally {
      setNetworkStatusLoading(false);
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

  function QuickLinkCard({
    icon: Icon,
    title,
    description,
    href,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    href: string;
  }) {
    return (
      <a
        href={href}
        className="group flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {title}
            </span>
            <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-primary-500" />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </a>
    );
  }

  function StatusBadge({ status }: { status: 'online' | 'offline' | 'unknown' }) {
    const config = {
      online: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
      offline: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
      unknown: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
    }[status];
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
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
          <Tabs defaultValue="general">
            <TabsList className="mb-6">
              <TabsTrigger value="general" icon={({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>}>
                General
              </TabsTrigger>
              <TabsTrigger value="billing" icon={({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}>
                Billing
              </TabsTrigger>
              <TabsTrigger value="payments" icon={({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}>
                Payments
              </TabsTrigger>
              <TabsTrigger value="network" icon={({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>}>
                Network / RADIUS
              </TabsTrigger>
            </TabsList>

            {/* ═══════════ Tab 1: General ═══════════ */}
            <TabsContent value="general">
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
              </div>
            </TabsContent>

            {/* ═══════════ Tab 2: Billing ═══════════ */}
            <TabsContent value="billing">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Billing Settings */}
                <Card>
                  <CardHeader
                    title="Billing Settings"
                    description="Configure tax, grace period, and fair usage"
                  />
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="pt-2">
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
              </div>
            </TabsContent>

            {/* ═══════════ Tab 3: Payments ═══════════ */}
            <TabsContent value="payments">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              </div>
            </TabsContent>

            {/* ═══════════ Tab 4: Network / RADIUS ═══════════ */}
            <TabsContent value="network">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* RADIUS Server Config */}
                <Card>
                  <CardHeader
                    title="RADIUS Server Config"
                    description="Global RADIUS and API settings"
                  />
                  <div className="space-y-4">
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
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        RADIUS secret, NAS IP, and port configuration are managed per-device in the{' '}
                        <a href="/admin/radius/nas" className="font-medium underline hover:no-underline">
                          NAS Devices
                        </a>{' '}
                        page or via environment variables.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={() =>
                          saveSection('API/RADIUS', apiRadius, setSavingApiRadius)
                        }
                        isLoading={savingApiRadius}
                        disabled={savingApiRadius}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Network Settings
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Quick Links */}
                <Card>
                  <CardHeader
                    title="Quick Links"
                    description="Manage RADIUS infrastructure"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <QuickLinkCard
                      icon={Router}
                      title="NAS Devices"
                      description="Manage RADIUS NAS clients"
                      href="/admin/radius/nas"
                    />
                    <QuickLinkCard
                      icon={Users}
                      title="RADIUS Users"
                      description="View and manage RADIUS accounts"
                      href="/admin/radius/users"
                    />
                    <QuickLinkCard
                      icon={Monitor}
                      title="Sessions Monitor"
                      description="Live session tracking"
                      href="/admin/radius/sessions"
                    />
                    <QuickLinkCard
                      icon={Layers}
                      title="Plan Sync"
                      description="Sync service plans to RADIUS"
                      href="/admin/radius/plans"
                    />
                  </div>
                </Card>

                {/* Network Status */}
                <Card className="lg:col-span-2">
                  <CardHeader
                    title="Network Status"
                    description="Current RADIUS infrastructure overview"
                  />
                  {networkStatusLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            RADIUS Server
                          </span>
                          <StatusBadge status={radiusStatus} />
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Connected NAS
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {connectedNasCount}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Monitor className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Active Sessions
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {activeSessionsCount}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
