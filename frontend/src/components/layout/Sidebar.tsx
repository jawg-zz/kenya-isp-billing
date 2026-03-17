import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  BarChart3,
  User,
  Settings,
  LogOut,
  Bell,
  Users,
  Package,
  Receipt,
  Network,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/lib/auth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const customerNav: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Usage', href: '/usage', icon: BarChart3 },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Profile', href: '/profile', icon: User },
];

const adminNav: NavItem[] = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Plans', href: '/plans', icon: Package },
  { name: 'Invoices', href: '/invoices/management', icon: FileText },
  { name: 'Revenue', href: '/revenue', icon: Receipt },
  { name: 'Network', href: '/network', icon: Network },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    customer?: {
      accountNumber: string;
    };
  };
  notifications?: number;
}

export function Sidebar({ user, notifications = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPPORT';
  const nav = isAdmin ? adminNav : customerNav;
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 px-4 lg:hidden">
        <button
          type="button"
          className="p-2 text-gray-600 dark:text-gray-300"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">ISP Billing</span>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-900/80" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800">
            <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-lg dark:text-white">ISP Billing</span>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-6 w-6 dark:text-gray-300" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4">
              <NavItems items={nav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center border-b border-gray-200 dark:border-gray-700 px-6">
          <span className="text-xl font-bold text-primary-600">ISP Billing</span>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <nav className="flex-1 px-3 py-4">
            <NavItems items={nav} pathname={pathname} />
          </nav>
        </div>
      </div>
    </>
  );
}

function NavItems({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              )}
            >
              <item.icon className={clsx('h-5 w-5', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500')} />
              {item.name}
              {item.badge ? (
                <span className="ml-auto rounded-full bg-primary-600 px-2 py-0.5 text-xs text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface TopBarProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  notifications?: number;
}

export function TopBar({ user, notifications = 0 }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 lg:px-8">
      <div className="flex-1 lg:flex-none" />
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          className="p-2 text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-100"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <Link href="/notifications" className="relative p-2 text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-100">
          <Bell className="h-5 w-5" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              {notifications}
            </span>
          )}
        </Link>
        <div className="relative">
          <button
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-gray-700">
              <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                <User className="h-4 w-4" /> Profile
              </Link>
              <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Settings className="h-4 w-4" /> Settings
              </Link>
              <hr className="my-1 border-gray-200 dark:border-gray-700" />
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={async () => {
                  await logout();
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MainLayoutProps {
  children: ReactNode;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    customer?: {
      accountNumber: string;
    };
  };
  notifications?: number;
}

export function MainLayout({ children, user, notifications = 0 }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar user={user} notifications={notifications} />
      <div className="lg:pl-64">
        <TopBar user={user} notifications={notifications} />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
