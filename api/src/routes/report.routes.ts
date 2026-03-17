import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { reportService } from '../services/report.service';
import { customerReportToPDF, usageReportToPDF, paymentReportToPDF } from '../templates/report-pdf';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { logger } from '../config/logger';

const router = Router();

// All report routes require authentication + ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * GET /api/v1/reports/customers/registration-trends
 * Customer registration trends over time
 */
router.get('/customers/registration-trends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getRegistrationTrends({ startDate, endDate, groupBy });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching registration trends:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch registration trends' });
  }
});

/**
 * GET /api/v1/reports/customers/churn-analysis
 * Churn analysis - terminated/suspended customers over time
 */
router.get('/customers/churn-analysis', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getChurnAnalysis({ startDate, endDate, groupBy });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching churn analysis:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch churn analysis' });
  }
});

/**
 * GET /api/v1/reports/customers/geographic
 * Geographic distribution by Kenyan county
 */
router.get('/customers/geographic', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await reportService.getGeographicDistribution();
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching geographic distribution:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch geographic distribution' });
  }
});

/**
 * GET /api/v1/reports/customers/status
 * Customer status breakdown
 */
router.get('/customers/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await reportService.getStatusBreakdown();
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching status breakdown:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status breakdown' });
  }
});

/**
 * GET /api/v1/reports/customers/export
 * Export customer report as CSV
 */
router.get('/customers/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getCustomerReportData({ startDate, endDate, groupBy });

    let csv = 'Customer Report\n\n';
    csv += 'Registration Trends\nDate,Count\n';
    for (const r of data.registrationTrends) {
      csv += `${r.period},${r.count}\n`;
    }
    csv += '\nChurn Analysis\nPeriod,Churned,Suspended,Churn Rate %\n';
    for (const r of data.churnAnalysis) {
      csv += `${r.period},${r.churned},${r.suspended},${r.churnRate}\n`;
    }
    csv += '\nGeographic Distribution\nCounty,Count\n';
    for (const r of data.geographicDistribution) {
      csv += `"${r.county}",${r.count}\n`;
    }
    csv += '\nStatus Breakdown\nStatus,Count,Percentage\n';
    for (const s of data.statusBreakdown.statuses) {
      csv += `${s.status},${s.count},${s.percentage}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customer-report.csv');
    res.send(csv);
  } catch (error) {
    logger.error('[Report] Error exporting customer report:', error);
    res.status(500).json({ success: false, message: 'Failed to export customer report' });
  }
});

/**
 * GET /api/v1/reports/customers/export-pdf
 * Export customer report as PDF
 */
router.get('/customers/export-pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getCustomerReportData({ startDate, endDate, groupBy });
    const pdfBuffer = customerReportToPDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=customer-report.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('[Report] Error exporting customer PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to export customer PDF' });
  }
});

// ===== USAGE REPORTS =====

/**
 * GET /api/v1/reports/usage/bandwidth
 * Total bandwidth consumed over time
 */
router.get('/usage/bandwidth', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getTotalBandwidth({ startDate, endDate, groupBy });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching bandwidth data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bandwidth data' });
  }
});

/**
 * GET /api/v1/reports/usage/top-users
 * Top N users by data consumption
 */
router.get('/usage/top-users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topN, startDate, endDate } = ((req as any).query) as { topN?: string; startDate?: string; endDate?: string };
    const data = await reportService.getTopUsers(parseInt(topN || '10'), { startDate, endDate });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching top users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top users' });
  }
});

/**
 * GET /api/v1/reports/usage/peak-hours
 * Peak usage times (hourly distribution)
 */
router.get('/usage/peak-hours', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = ((req as any).query) as { startDate?: string; endDate?: string };
    const data = await reportService.getPeakUsageTimes({ startDate, endDate });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching peak hours:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch peak hours' });
  }
});

/**
 * GET /api/v1/reports/usage/by-plan
 * Average usage per plan type
 */
router.get('/usage/by-plan', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = ((req as any).query) as { startDate?: string; endDate?: string };
    const data = await reportService.getUsageByPlan({ startDate, endDate });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching usage by plan:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch usage by plan' });
  }
});

/**
 * GET /api/v1/reports/usage/export
 * Export usage report as CSV
 */
router.get('/usage/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getUsageReportData({ startDate, endDate, groupBy });

    let csv = 'Usage Report\n\n';
    csv += 'Bandwidth Over Time\nDate,Total GB,Records\n';
    for (const r of data.totalBandwidth) {
      csv += `${r.period},${r.totalGB},${r.recordCount}\n`;
    }
    csv += '\nTop Users\nRank,Name,Email,Phone,Account,Plan,Data GB,Records\n';
    for (const u of data.topUsers) {
      csv += `${u.rank},"${u.name}","${u.email}","${u.phone}","${u.accountNumber}","${u.planName}",${u.totalGB},${u.recordCount}\n`;
    }
    csv += '\nPeak Usage Hours\nHour,Total GB,Sessions\n';
    for (const h of data.peakHours) {
      csv += `${h.hourLabel},${h.totalGB},${h.sessionCount}\n`;
    }
    csv += '\nUsage By Plan\nPlan,Total GB,Customers\n';
    for (const p of data.usageByPlan) {
      csv += `"${p.planName}",${p.totalGB},${p.customerCount}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=usage-report.csv');
    res.send(csv);
  } catch (error) {
    logger.error('[Report] Error exporting usage report:', error);
    res.status(500).json({ success: false, message: 'Failed to export usage report' });
  }
});

/**
 * GET /api/v1/reports/usage/export-pdf
 * Export usage report as PDF
 */
router.get('/usage/export-pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getUsageReportData({ startDate, endDate, groupBy });
    const pdfBuffer = usageReportToPDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=usage-report.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('[Report] Error exporting usage PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to export usage PDF' });
  }
});

// ===== PAYMENT REPORTS =====

/**
 * GET /api/v1/reports/payments/collection-rate
 * Collection rate over time
 */
router.get('/payments/collection-rate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getCollectionRate({ startDate, endDate, groupBy });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching collection rate:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch collection rate' });
  }
});

/**
 * GET /api/v1/reports/payments/avg-days-to-payment
 * Average days from invoice to payment
 */
router.get('/payments/avg-days-to-payment', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = ((req as any).query) as { startDate?: string; endDate?: string };
    const data = await reportService.getAverageDaysToPayment({ startDate, endDate });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching average days to payment:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch average days to payment' });
  }
});

/**
 * GET /api/v1/reports/payments/method-breakdown
 * Payment method breakdown (M-Pesa vs Airtel vs Cash vs Bank)
 */
router.get('/payments/method-breakdown', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = ((req as any).query) as { startDate?: string; endDate?: string };
    const data = await reportService.getPaymentMethodBreakdown({ startDate, endDate });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching payment method breakdown:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment method breakdown' });
  }
});

/**
 * GET /api/v1/reports/payments/failed-rate
 * Failed payment rate and common failure reasons
 */
router.get('/payments/failed-rate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = ((req as any).query) as { startDate?: string; endDate?: string };
    const data = await reportService.getFailedPaymentRate({ startDate, endDate });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching failed payment rate:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch failed payment rate' });
  }
});

/**
 * GET /api/v1/reports/payments/revenue-vs-outstanding
 * Revenue vs outstanding trend
 */
router.get('/payments/revenue-vs-outstanding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getRevenueVsOutstanding({ startDate, endDate, groupBy });
    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    logger.error('[Report] Error fetching revenue vs outstanding:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch revenue vs outstanding' });
  }
});

/**
 * GET /api/v1/reports/payments/export
 * Export payment report as CSV
 */
router.get('/payments/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getPaymentReportData({ startDate, endDate, groupBy });

    let csv = 'Payment Report\n\n';
    csv += 'Collection Rate\nPeriod,Total,Paid,Outstanding,Collection Rate %\n';
    for (const r of data.collectionRate) {
      csv += `${r.period},${r.total},${r.paid},${r.outstanding},${r.collectionRate}\n`;
    }
    csv += `\nAverage Days to Payment,${data.avgDaysToPayment.averageDays}\n`;
    csv += '\nPayment Method Breakdown\nMethod,Count,Total Amount,Completed Count,Completed Amount\n';
    for (const m of data.paymentMethodBreakdown) {
      csv += `"${m.methodLabel}",${m.count},${m.totalAmount},${m.completedCount},${m.completedAmount}\n`;
    }
    csv += `\nFailed Payment Rate,${data.failedPaymentRate.failureRate}%\n`;
    csv += `Total Payments,${data.failedPaymentRate.totalPayments}\n`;
    csv += `Failed Payments,${data.failedPaymentRate.failedPayments}\n`;
    csv += '\nTop Failure Reasons\nReason,Count\n';
    for (const f of data.failedPaymentRate.topFailureReasons) {
      csv += `"${f.reason}",${f.count}\n`;
    }
    csv += '\nRevenue vs Outstanding\nPeriod,Collected,Outstanding\n';
    for (const r of data.revenueVsOutstanding) {
      csv += `${r.period},${r.collected},${r.outstanding}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payment-report.csv');
    res.send(csv);
  } catch (error) {
    logger.error('[Report] Error exporting payment report:', error);
    res.status(500).json({ success: false, message: 'Failed to export payment report' });
  }
});

/**
 * GET /api/v1/reports/payments/export-pdf
 * Export payment report as PDF
 */
router.get('/payments/export-pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = ((req as any).query) as { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' };
    const data = await reportService.getPaymentReportData({ startDate, endDate, groupBy });
    const pdfBuffer = paymentReportToPDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=payment-report.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('[Report] Error exporting payment PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to export payment PDF' });
  }
});

export default router;
