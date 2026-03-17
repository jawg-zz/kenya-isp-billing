'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth';
import { Users, BarChart3, CreditCard, PieChart, TrendingUp, HardDrive, FileBarChart } from 'lucide-react';

const reportLinks = [
  {
    title: 'Customer Reports',
    description: 'Registration trends, churn analysis, geographic distribution, and status breakdown',
    href: '/reports/customers',
    icon: Users,
    color: 'blue',
  },
  {
    title: 'Usage Reports',
    description: 'Bandwidth consumption, top users, peak hours, and usage by plan',
    href: '/reports/usage',
    icon: HardDrive,
    color: 'green',
  },
  {
    title: 'Payment Reports',
    description: 'Collection rates, payment methods, failed payments, and revenue trends',
    href: '/reports/payments',
    icon: CreditCard,
    color: 'purple',
  },
] as const;

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  purple: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
};

export default function ReportsPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <MainLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reports & Analytics</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Generate and export detailed reports on customers, usage, and payments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reportLinks.map((report) => {
            const colors = colorClasses[report.color];
            return (
              <Link key={report.href} href={report.href}>
                <Card hover className="h-full">
                  <div className={`inline-flex p-3 rounded-xl ${colors.bg} mb-4`}>
                    <report.icon className={`h-6 w-6 ${colors.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{report.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
                  <div className="mt-4 flex items-center text-sm font-medium text-primary-600 dark:text-primary-400">
                    View Reports
                    <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
