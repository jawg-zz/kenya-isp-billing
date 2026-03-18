import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface ReportPeriod {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

function getDateFilter(startDate?: string, endDate?: string) {
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function getGroupByFormat(groupBy: string): string {
  switch (groupBy) {
    case 'week':
      return 'YYYY-"W"WW';
    case 'month':
      return 'YYYY-MM';
    default:
      return 'YYYY-MM-DD';
  }
}

class ReportService {
  // ===== CUSTOMER REPORTS =====

  async getRegistrationTrends(params: ReportPeriod) {
    const { startDate, endDate, groupBy = 'month' } = params;
    const format = getGroupByFormat(groupBy);

    const dateFilter = getDateFilter(startDate, endDate);
    const where: any = {};
    if (dateFilter) where.createdAt = dateFilter;

    // Use raw query for date truncation
    const truncate = groupBy === 'month'
      ? `DATE_TRUNC('month', "createdAt")`
      : groupBy === 'week'
        ? `DATE_TRUNC('week', "createdAt")`
        : `DATE_TRUNC('day', "createdAt")`;

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`"createdAt" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`"createdAt" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE role = 'CUSTOMER' AND ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql`WHERE role = 'CUSTOMER'`;

    const results = await prisma.$queryRaw<Array<{ period: Date; count: bigint }>>`
      SELECT ${truncate} as period, COUNT(*)::bigint as count
      FROM users
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `;

    return results.map((r) => ({
      period: r.period.toISOString().split('T')[0],
      count: Number(r.count),
    }));
  }

  async getChurnAnalysis(params: ReportPeriod) {
    const { startDate, endDate, groupBy = 'month' } = params;

    const dateFilter = getDateFilter(startDate, endDate);
    const truncate = groupBy === 'month'
      ? `DATE_TRUNC('month', "updatedAt")`
      : groupBy === 'week'
        ? `DATE_TRUNC('week', "updatedAt")`
        : `DATE_TRUNC('day', "updatedAt")`;

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`"updatedAt" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`"updatedAt" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE role = 'CUSTOMER' AND "accountStatus" IN ('TERMINATED', 'SUSPENDED') AND ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql`WHERE role = 'CUSTOMER' AND "accountStatus" IN ('TERMINATED', 'SUSPENDED')`;

    const results = await prisma.$queryRaw<Array<{ period: Date; churned: bigint; suspended: bigint }>>`
      SELECT ${truncate} as period,
        COUNT(*) FILTER (WHERE "accountStatus" = 'TERMINATED')::bigint as churned,
        COUNT(*) FILTER (WHERE "accountStatus" = 'SUSPENDED')::bigint as suspended
      FROM users
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `;

    const totalCustomers = await prisma.user.count({ where: { role: 'CUSTOMER' } });

    return results.map((r) => ({
      period: r.period.toISOString().split('T')[0],
      churned: Number(r.churned),
      suspended: Number(r.suspended),
      churnRate: totalCustomers > 0 ? Number(((Number(r.churned) / totalCustomers) * 100).toFixed(2)) : 0,
    }));
  }

  async getGeographicDistribution() {
    const results = await prisma.user.groupBy({
      by: ['county'],
      _count: true,
      where: {
        role: 'CUSTOMER',
        county: { not: null },
      },
      orderBy: {
        _count: { county: 'desc' },
      },
    });

    return results.map((r) => ({
      county: r.county || 'Unknown',
      count: r._count,
    }));
  }

  async getStatusBreakdown() {
    const results = await prisma.user.groupBy({
      by: ['accountStatus'],
      _count: true,
      where: {
        role: 'CUSTOMER',
      },
    });

    const total = results.reduce((sum, r) => sum + r._count, 0);

    return {
      total,
      statuses: results.map((r) => ({
        status: r.accountStatus,
        count: r._count,
        percentage: total > 0 ? Number(((r._count / total) * 100).toFixed(1)) : 0,
      })),
    };
  }

  // ===== USAGE REPORTS =====

  async getTotalBandwidth(params: ReportPeriod) {
    const { startDate, endDate, groupBy = 'day' } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const truncate = groupBy === 'month'
      ? `DATE_TRUNC('month', "timestamp")`
      : groupBy === 'week'
        ? `DATE_TRUNC('week', "timestamp")`
        : `DATE_TRUNC('day', "timestamp")`;

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`"timestamp" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`"timestamp" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{ period: Date; total_octets: bigint; record_count: bigint }>>`
      SELECT ${truncate} as period,
        COALESCE(SUM("totalOctets"), 0)::bigint as total_octets,
        COUNT(*)::bigint as record_count
      FROM usage_records
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `;

    return results.map((r) => ({
      period: r.period.toISOString().split('T')[0],
      totalBytes: Number(r.total_octets),
      totalGB: Number((Number(r.total_octets) / (1024 * 1024 * 1024)).toFixed(2)),
      recordCount: Number(r.record_count),
    }));
  }

  async getTopUsers(topN: number = 10, params: ReportPeriod) {
    const { startDate, endDate } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`ur."timestamp" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`ur."timestamp" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{
      user_id: string;
      total_octets: bigint;
      record_count: bigint;
    }>>`
      SELECT ur."userId" as user_id,
        COALESCE(SUM(ur."totalOctets"), 0)::bigint as total_octets,
        COUNT(*)::bigint as record_count
      FROM usage_records ur
      ${whereClause}
      GROUP BY ur."userId"
      ORDER BY total_octets DESC
      LIMIT ${topN}
    `;

    // Fetch user details
    const userIds = results.map((r) => r.user_id);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        accountStatus: true,
        customer: {
          select: {
            accountNumber: true,
            customerCode: true,
          },
        },
      },
    });

    // Get customers for these users and their active subscriptions
    const customers = await prisma.customer.findMany({
      where: {
        userId: { in: userIds },
      },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: { select: { name: true } } },
          take: 1,
        },
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const custMap = new Map(customers.map((c) => [c.userId, c.subscriptions[0]?.plan.name || '']));

    return results.map((r, i) => {
      const user = userMap.get(r.user_id);
      return {
        rank: i + 1,
        userId: r.user_id,
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        email: user?.email || '',
        phone: user?.phone || '',
        accountNumber: user?.customer?.accountNumber || '',
        status: user?.accountStatus || '',
        planName: custMap.get(r.user_id) || 'No active plan',
        totalBytes: Number(r.total_octets),
        totalGB: Number((Number(r.total_octets) / (1024 * 1024 * 1024)).toFixed(2)),
        recordCount: Number(r.record_count),
      };
    });
  }

  async getPeakUsageTimes(params: ReportPeriod) {
    const { startDate, endDate } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`"timestamp" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`"timestamp" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{ hour: number; total_octets: bigint; session_count: bigint }>>`
      SELECT EXTRACT(HOUR FROM "timestamp")::int as hour,
        COALESCE(SUM("totalOctets"), 0)::bigint as total_octets,
        COUNT(*)::bigint as session_count
      FROM usage_records
      ${whereClause}
      GROUP BY hour
      ORDER BY hour ASC
    `;

    // Fill in missing hours
    const resultMap = new Map(results.map((r) => [r.hour, r]));
    const allHours = [];
    for (let h = 0; h < 24; h++) {
      const r = resultMap.get(h);
      allHours.push({
        hour: h,
        hourLabel: `${h.toString().padStart(2, '0')}:00`,
        totalBytes: r ? Number(r.total_octets) : 0,
        totalGB: r ? Number((Number(r.total_octets) / (1024 * 1024 * 1024)).toFixed(2)) : 0,
        sessionCount: r ? Number(r.session_count) : 0,
      });
    }

    return allHours;
  }

  async getUsageByPlan(params: ReportPeriod) {
    const { startDate, endDate } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`ur."timestamp" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`ur."timestamp" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{
      plan_name: string;
      plan_id: string;
      total_octets: bigint;
      customer_count: bigint;
    }>>`
      SELECT p.name as plan_name, p.id as plan_id,
        COALESCE(SUM(ur."totalOctets"), 0)::bigint as total_octets,
        COUNT(DISTINCT ur."customerId")::bigint as customer_count
      FROM usage_records ur
      JOIN subscriptions s ON ur."subscriptionId" = s.id
      JOIN plans p ON s."planId" = p.id
      ${whereClause}
      GROUP BY p.name, p.id
      ORDER BY total_octets DESC
    `;

    return results.map((r) => ({
      planId: r.plan_id,
      planName: r.plan_name,
      totalBytes: Number(r.total_octets),
      totalGB: Number((Number(r.total_octets) / (1024 * 1024 * 1024)).toFixed(2)),
      customerCount: Number(r.customer_count),
    }));
  }

  // ===== PAYMENT REPORTS =====

  async getCollectionRate(params: ReportPeriod) {
    const { startDate, endDate, groupBy = 'month' } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const truncate = groupBy === 'month'
      ? `DATE_TRUNC('month', "createdAt")`
      : groupBy === 'week'
        ? `DATE_TRUNC('week', "createdAt")`
        : `DATE_TRUNC('day', "createdAt")`;

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`"createdAt" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`"createdAt" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{
      period: Date;
      total: bigint;
      paid: bigint;
      outstanding: bigint;
    }>>`
      SELECT ${truncate} as period,
        COUNT(*)::bigint as total,
        COUNT(*) FILTER (WHERE status = 'PAID')::bigint as paid,
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'OVERDUE'))::bigint as outstanding
      FROM invoices
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `;

    return results.map((r) => ({
      period: r.period.toISOString().split('T')[0],
      total: Number(r.total),
      paid: Number(r.paid),
      outstanding: Number(r.outstanding),
      collectionRate: Number(r.total) > 0 ? Number(((Number(r.paid) / Number(r.total)) * 100).toFixed(1)) : 0,
    }));
  }

  async getAverageDaysToPayment(params: ReportPeriod) {
    const { startDate, endDate } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`i."createdAt" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`i."createdAt" <= ${dateFilter.lte}`);
    const dateWhereClause = dateConditions.length > 0
      ? Prisma.sql` AND ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{ avg_days: number }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (i."paidAt" - i."createdAt")) / 86400)::float as avg_days
      FROM invoices i
      WHERE i."paidAt" IS NOT NULL
      AND i.status = 'PAID'
      ${dateWhereClause}
    `;

    return {
      averageDays: Number((results[0]?.avg_days || 0).toFixed(1)),
    };
  }

  async getPaymentMethodBreakdown(params: ReportPeriod) {
    const { startDate, endDate } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const results = await prisma.payment.groupBy({
      by: ['method', 'status'],
      _count: true,
      _sum: { amount: true },
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Aggregate by method
    const methodMap = new Map<string, { count: number; totalAmount: number; completedAmount: number; completedCount: number }>();

    for (const r of results) {
      const existing = methodMap.get(r.method) || { count: 0, totalAmount: 0, completedAmount: 0, completedCount: 0 };
      existing.count += r._count;
      existing.totalAmount += Number(r._sum.amount || 0);
      if (r.status === 'COMPLETED') {
        existing.completedCount += r._count;
        existing.completedAmount += Number(r._sum.amount || 0);
      }
      methodMap.set(r.method, existing);
    }

    return Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      methodLabel: method.replace('_', ' '),
      ...data,
    }));
  }

  async getFailedPaymentRate(params: ReportPeriod) {
    const { startDate, endDate } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const results = await prisma.payment.groupBy({
      by: ['status', 'resultDesc'],
      _count: true,
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        status: { in: ['FAILED', 'CANCELLED', 'TIMEOUT'] },
      },
    });

    const totalPayments = await prisma.payment.count({
      where: dateFilter ? { createdAt: dateFilter } : {},
    });

    const failedPayments = results.reduce((sum, r) => sum + r._count, 0);

    // Group failure reasons
    const reasonMap = new Map<string, number>();
    for (const r of results) {
      const reason = r.resultDesc || r.status;
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + r._count);
    }

    return {
      totalPayments,
      failedPayments,
      failureRate: totalPayments > 0 ? Number(((failedPayments / totalPayments) * 100).toFixed(1)) : 0,
      topFailureReasons: Array.from(reasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  async getRevenueVsOutstanding(params: ReportPeriod) {
    const { startDate, endDate, groupBy = 'month' } = params;
    const dateFilter = getDateFilter(startDate, endDate);

    const truncate = groupBy === 'month'
      ? `DATE_TRUNC('month', "createdAt")`
      : groupBy === 'week'
        ? `DATE_TRUNC('week', "createdAt")`
        : `DATE_TRUNC('day', "createdAt")`;

    const dateConditions: Prisma.Sql[] = [];
    if (dateFilter?.gte) dateConditions.push(Prisma.sql`"createdAt" >= ${dateFilter.gte}`);
    if (dateFilter?.lte) dateConditions.push(Prisma.sql`"createdAt" <= ${dateFilter.lte}`);
    const whereClause = dateConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(dateConditions, ' AND ')}`
      : Prisma.sql``;

    const results = await prisma.$queryRaw<Array<{
      period: Date;
      collected: bigint;
      outstanding: bigint;
    }>>`
      SELECT ${truncate} as period,
        COALESCE(SUM("totalAmount") FILTER (WHERE status = 'PAID'), 0)::bigint as collected,
        COALESCE(SUM("totalAmount") FILTER (WHERE status IN ('PENDING', 'OVERDUE')), 0)::bigint as outstanding
      FROM invoices
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `;

    return results.map((r) => ({
      period: r.period.toISOString().split('T')[0],
      collected: Number(r.collected),
      outstanding: Number(r.outstanding),
    }));
  }

  // ===== EXPORT HELPERS =====

  async getCustomerReportData(params: ReportPeriod) {
    const [registrationTrends, churnAnalysis, geographicDistribution, statusBreakdown] = await Promise.all([
      this.getRegistrationTrends(params),
      this.getChurnAnalysis(params),
      this.getGeographicDistribution(),
      this.getStatusBreakdown(),
    ]);

    return { registrationTrends, churnAnalysis, geographicDistribution, statusBreakdown };
  }

  async getUsageReportData(params: ReportPeriod) {
    const [totalBandwidth, topUsers, peakHours, usageByPlan] = await Promise.all([
      this.getTotalBandwidth(params),
      this.getTopUsers(10, params),
      this.getPeakUsageTimes(params),
      this.getUsageByPlan(params),
    ]);

    return { totalBandwidth, topUsers, peakHours, usageByPlan };
  }

  async getPaymentReportData(params: ReportPeriod) {
    const [collectionRate, avgDaysToPayment, paymentMethodBreakdown, failedPaymentRate, revenueVsOutstanding] = await Promise.all([
      this.getCollectionRate(params),
      this.getAverageDaysToPayment(params),
      this.getPaymentMethodBreakdown(params),
      this.getFailedPaymentRate(params),
      this.getRevenueVsOutstanding(params),
    ]);

    return { collectionRate, avgDaysToPayment, paymentMethodBreakdown, failedPaymentRate, revenueVsOutstanding };
  }
}

export const reportService = new ReportService();
export default reportService;
