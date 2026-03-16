'use client';

import { format } from 'date-fns';
import { BarChart3, TrendingUp, CreditCard, Smartphone, Banknote } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#4cb050', '#ed1c24', '#3b82f6', '#f59e0b', '#8b5cf6'];

function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

interface PaymentByDay {
  date: string;
  totalAmount: string;
  count: string;
}

interface PaymentByMethod {
  method: string;
  _sum: { amount: string };
  _count: number;
}

export function getMethodIcon(method: string) {
  switch (method) {
    case 'MPESA':
      return <Smartphone className="h-4 w-4 text-green-600" />;
    case 'AIRTEL_MONEY':
      return <CreditCard className="h-4 w-4 text-red-600" />;
    case 'CASH':
      return <Banknote className="h-4 w-4 text-yellow-600" />;
    default:
      return <CreditCard className="h-4 w-4" />;
  }
}

export function RevenueBarChart({ data }: { data: PaymentByDay[] }) {
  const chartData = data.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    amount: parseFloat(d.totalAmount),
    count: parseInt(d.count),
  }));

  if (chartData.length === 0) {
    return <p className="text-center text-gray-500 py-8">No data for this period</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [formatKES(value), 'Amount']} />
          <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentMethodPieChart({ data }: { data: PaymentByMethod[] }) {
  const pieData = data.map((m) => ({
    name: m.method,
    value: parseFloat(m._sum.amount),
  }));

  if (pieData.length === 0) {
    return <p className="text-center text-gray-500 py-8">No data</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          >
            {pieData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatKES(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
