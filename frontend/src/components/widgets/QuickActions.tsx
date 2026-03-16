import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
}

export function QuickActions({ title = 'Quick Actions', actions }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <action.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {action.label}
            </span>
            {action.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {action.description}
              </span>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
