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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200 text-center group"
          >
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
              <action.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
              {action.label}
            </span>
            {action.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                {action.description}
              </span>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
