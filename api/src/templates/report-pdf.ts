import PDFDocument from 'pdfkit';

interface ReportPDFData {
  title: string;
  subtitle?: string;
  sections: {
    title: string;
    data: Array<Record<string, string | number>>;
    columns: { key: string; label: string }[];
  }[];
  summary?: { label: string; value: string | number }[];
}

export function generateReportPDF(data: ReportPDFData): Buffer {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(data.title, { align: 'center' });
  if (data.subtitle) {
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').fillColor('#666666').text(data.subtitle, { align: 'center' });
  }
  doc.moveDown(1);
  doc.fillColor('#000000');

  // Summary section
  if (data.summary && data.summary.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    const summaryStartX = 50;
    let y = doc.y;
    for (const item of data.summary) {
      doc.fontSize(10).font('Helvetica-Bold').text(`${item.label}:`, summaryStartX, y, { continued: true });
      doc.font('Helvetica').text(` ${item.value}`);
      y = doc.y + 4;
    }
    doc.moveDown(1);
  }

  // Data sections
  for (const section of data.sections) {
    // Check if we need a new page
    if (doc.y > 700) {
      doc.addPage();
    }

    doc.fontSize(14).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.5);

    if (section.data.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#999999').text('No data available');
      doc.fillColor('#000000');
      doc.moveDown(1);
      continue;
    }

    const colWidth = (500 - 50) / section.columns.length;
    const startX = 50;
    let y = doc.y;
    const rowHeight = 20;

    // Header row
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
    doc.rect(startX, y, 500 - 50, rowHeight).fill('#3b82f6');
    let x = startX + 5;
    for (const col of section.columns) {
      doc.text(col.label, x, y + 5, { width: colWidth - 10 });
      x += colWidth;
    }
    y += rowHeight;
    doc.fillColor('#000000');

    // Data rows
    for (let i = 0; i < section.data.length; i++) {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      const row = section.data[i];
      const bgColor = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(startX, y, 500 - 50, rowHeight).fill(bgColor);
      doc.fillColor('#000000');

      x = startX + 5;
      doc.fontSize(8).font('Helvetica');
      for (const col of section.columns) {
        const val = row[col.key];
        doc.text(String(val ?? ''), x, y + 5, { width: colWidth - 10 });
        x += colWidth;
      }
      y += rowHeight;
    }

    doc.moveDown(1);
  }

  // Footer
  doc.fontSize(8).font('Helvetica').fillColor('#999999');
  doc.text(`Generated on ${new Date().toLocaleString()}`, 50, 800, { align: 'center' });

  doc.end();

  return Buffer.concat(chunks);
}

export function customerReportToPDF(data: {
  registrationTrends: Array<{ period: string; count: number }>;
  churnAnalysis: Array<{ period: string; churned: number; suspended: number; churnRate: number }>;
  geographicDistribution: Array<{ county: string; count: number }>;
  statusBreakdown: { total: number; statuses: Array<{ status: string; count: number; percentage: number }> };
}): Buffer {
  return generateReportPDF({
    title: 'Customer Report',
    subtitle: `ISP Billing System - ${new Date().toLocaleDateString()}`,
    summary: [
      { label: 'Total Customers', value: data.statusBreakdown.total },
      { label: 'Active', value: data.statusBreakdown.statuses.find((s) => s.status === 'ACTIVE')?.count || 0 },
      { label: 'Suspended', value: data.statusBreakdown.statuses.find((s) => s.status === 'SUSPENDED')?.count || 0 },
    ],
    sections: [
      {
        title: 'Status Breakdown',
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'count', label: 'Count' },
          { key: 'percentage', label: 'Percentage (%)' },
        ],
        data: data.statusBreakdown.statuses.map((s) => ({ status: s.status, count: s.count, percentage: s.percentage })),
      },
      {
        title: 'Registration Trends',
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'count', label: 'New Customers' },
        ],
        data: data.registrationTrends,
      },
      {
        title: 'Churn Analysis',
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'churned', label: 'Churned' },
          { key: 'suspended', label: 'Suspended' },
          { key: 'churnRate', label: 'Churn Rate (%)' },
        ],
        data: data.churnAnalysis,
      },
      {
        title: 'Geographic Distribution',
        columns: [
          { key: 'county', label: 'County' },
          { key: 'count', label: 'Customers' },
        ],
        data: data.geographicDistribution.slice(0, 20),
      },
    ],
  });
}

export function usageReportToPDF(data: {
  totalBandwidth: Array<{ period: string; totalGB: number; recordCount: number }>;
  topUsers: Array<{ rank: number; name: string; planName: string; totalGB: number }>;
  peakHours: Array<{ hourLabel: string; totalGB: number; sessionCount: number }>;
  usageByPlan: Array<{ planName: string; totalGB: number; customerCount: number }>;
}): Buffer {
  return generateReportPDF({
    title: 'Usage Report',
    subtitle: `ISP Billing System - ${new Date().toLocaleDateString()}`,
    summary: [
      { label: 'Total Bandwidth', value: `${data.totalBandwidth.reduce((sum, r) => sum + r.totalGB, 0).toFixed(2)} GB` },
      { label: 'Total Records', value: data.totalBandwidth.reduce((sum, r) => sum + r.recordCount, 0) },
    ],
    sections: [
      {
        title: 'Bandwidth Over Time',
        columns: [
          { key: 'period', label: 'Date' },
          { key: 'totalGB', label: 'GB' },
          { key: 'recordCount', label: 'Records' },
        ],
        data: data.totalBandwidth,
      },
      {
        title: 'Top 10 Users',
        columns: [
          { key: 'rank', label: '#' },
          { key: 'name', label: 'Name' },
          { key: 'planName', label: 'Plan' },
          { key: 'totalGB', label: 'GB Used' },
        ],
        data: data.topUsers,
      },
      {
        title: 'Usage by Plan',
        columns: [
          { key: 'planName', label: 'Plan' },
          { key: 'totalGB', label: 'GB' },
          { key: 'customerCount', label: 'Customers' },
        ],
        data: data.usageByPlan,
      },
    ],
  });
}

export function paymentReportToPDF(data: {
  collectionRate: Array<{ period: string; collectionRate: number; paid: number; total: number }>;
  avgDaysToPayment: { averageDays: number };
  paymentMethodBreakdown: Array<{ methodLabel: string; count: number; totalAmount: number }>;
  failedPaymentRate: { failureRate: number; totalPayments: number; failedPayments: number };
  revenueVsOutstanding: Array<{ period: string; collected: number; outstanding: number }>;
}): Buffer {
  return generateReportPDF({
    title: 'Payment Report',
    subtitle: `ISP Billing System - ${new Date().toLocaleDateString()}`,
    summary: [
      { label: 'Avg Days to Payment', value: `${data.avgDaysToPayment.averageDays} days` },
      { label: 'Failed Payment Rate', value: `${data.failedPaymentRate.failureRate}%` },
    ],
    sections: [
      {
        title: 'Collection Rate',
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'paid', label: 'Paid' },
          { key: 'total', label: 'Total' },
          { key: 'collectionRate', label: 'Rate (%)' },
        ],
        data: data.collectionRate,
      },
      {
        title: 'Payment Methods',
        columns: [
          { key: 'methodLabel', label: 'Method' },
          { key: 'count', label: 'Count' },
          { key: 'totalAmount', label: 'Amount (KES)' },
        ],
        data: data.paymentMethodBreakdown,
      },
      {
        title: 'Revenue vs Outstanding',
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'collected', label: 'Collected (KES)' },
          { key: 'outstanding', label: 'Outstanding (KES)' },
        ],
        data: data.revenueVsOutstanding,
      },
    ],
  });
}
