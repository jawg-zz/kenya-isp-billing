import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        variants[variant],
        sizes[size]
      )}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusMap: Record<string, BadgeProps['variant']> = {
    ACTIVE: 'success',
    COMPLETED: 'success',
    PAID: 'success',
    PENDING: 'warning',
    PROCESSING: 'info',
    SUSPENDED: 'danger',
    TERMINATED: 'danger',
    FAILED: 'danger',
    CANCELLED: 'danger',
    OVERDUE: 'danger',
    DRAFT: 'default',
  };

  return (
    <Badge variant={statusMap[status] || 'default'}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
