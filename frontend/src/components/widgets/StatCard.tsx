import { clsx } from 'clsx';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  yellow: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const trendColors = {
  up: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  down: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  loading = false,
  onClick,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-20 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800',
        'transition-all duration-200 ease-in-out',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start gap-4">
        <div className={clsx('p-3 rounded-xl', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {trend && (
          <div
            className={clsx(
              'flex items-center gap-0.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0',
              trendColors[trend.direction]
            )}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
}
