import { LucideIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardHeader } from '../ui/Card';
import { clsx } from 'clsx';

interface ActivityItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  timestamp: string | Date;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
}

interface ActivityFeedProps {
  title?: string;
  items: ActivityItem[];
  emptyMessage?: string;
  viewAllHref?: string;
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

export function ActivityFeed({
  title = 'Recent Activity',
  items,
  emptyMessage = 'No recent activity',
  viewAllHref,
}: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          viewAllHref ? (
            <a
              href={viewAllHref}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              View all
            </a>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const timestamp = typeof item.timestamp === 'string'
              ? new Date(item.timestamp)
              : item.timestamp;

            return (
              <div key={item.id} className="flex gap-3">
                <div
                  className={clsx(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    colorClasses[item.color || 'gray']
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {item.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDistanceToNow(timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
