import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface CompanySettings {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyKraPin?: string;
  mpesaPaybill?: string;
  tagline?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  status: string;
  subtotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  createdAt: string | Date;
  dueDate: string | Date;
  notes?: string | null;
  metadata?: { items?: InvoiceItem[] } | null;
}

interface CustomerData {
  customerCode?: string;
  accountNumber?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    county?: string;
    postalCode?: string;
  };
}

const COLORS = {
  primary: '#1a56db',
  primaryDark: '#1e3a5f',
  text: '#333333',
  textLight: '#666666',
  muted: '#999999',
  border: '#e0e0e0',
  headerBg: '#f8f9fa',
  rowAlt: '#fafafa',
  white: '#ffffff',
  draft: '#999999',
};

export function generateInvoicePDF(
  invoice: InvoiceData,
  customer: CustomerData,
  settings: CompanySettings
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(process.cwd(), 'uploads', 'invoices');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, `${invoice.invoiceNumber}.pdf`);
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: settings.companyName || 'ISP Billing',
        Subject: 'Invoice',
      },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const companyName = settings.companyName || 'ISP Billing System';
    const companyAddress = settings.companyAddress || '';
    const companyPhone = settings.companyPhone || '';
    const companyEmail = settings.companyEmail || '';
    const companyKraPin = settings.companyKraPin || '';
    const mpesaPaybill = settings.mpesaPaybill || '174379';
    const tagline = settings.tagline || 'Thank you for your business!';

    // === HEADER ===
    // Company name
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(companyName, 50, 45, { align: 'left' });

    // Company details
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight);
    let headerY = 72;
    if (companyAddress) {
      doc.text(companyAddress, 50, headerY);
      headerY += 12;
    }
    if (companyPhone) {
      doc.text(`Phone: ${companyPhone}`, 50, headerY);
      headerY += 12;
    }
    if (companyEmail) {
      doc.text(`Email: ${companyEmail}`, 50, headerY);
      headerY += 12;
    }
    if (companyKraPin) {
      doc.text(`KRA PIN: ${companyKraPin}`, 50, headerY);
    }

    // Invoice label (right side)
    doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.primaryDark)
      .text('INVOICE', 350, 45, { align: 'right' });

    // Separator line
    doc.moveTo(50, 130).lineTo(550, 130).lineWidth(1.5).stroke(COLORS.primary);

    // === INVOICE INFO + CUSTOMER INFO ===
    let infoY = 145;

    // Left: Invoice details
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight).text('INVOICE NUMBER', 50, infoY);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(invoice.invoiceNumber, 50, infoY + 12);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight).text('INVOICE DATE', 50, infoY + 30);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
      .text(formatDate(invoice.createdAt), 50, infoY + 42);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight).text('DUE DATE', 50, infoY + 60);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.text)
      .text(formatDate(invoice.dueDate), 50, infoY + 72);

    // Status badge
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight).text('STATUS', 50, infoY + 90);
    const statusColor = invoice.status === 'PAID' ? '#16a34a' : invoice.status === 'OVERDUE' ? '#dc2626' : '#f59e0b';
    doc.fontSize(10).font('Helvetica-Bold').fillColor(statusColor as string)
      .text(invoice.status, 50, infoY + 102);

    // Right: Bill To
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.primary).text('Bill To:', 330, infoY);

    const u = customer.user || {};
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text);
    doc.text(`${u.firstName || ''} ${u.lastName || ''}`.trim(), 330, infoY + 18);

    doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight);
    if (customer.customerCode) doc.text(`Customer Code: ${customer.customerCode}`, 330, infoY + 34);
    if (customer.accountNumber) doc.text(`Account: ${customer.accountNumber}`, 330, infoY + 46);
    if (u.email) doc.text(u.email, 330, infoY + 58);
    if (u.phone) doc.text(u.phone, 330, infoY + 70);
    if (u.addressLine1) doc.text(u.addressLine1, 330, infoY + 82);
    const cityParts = [u.city, u.county].filter(Boolean);
    if (cityParts.length) doc.text(cityParts.join(', '), 330, infoY + 94);
    if (u.postalCode) doc.text(u.postalCode, 330, infoY + 106);

    // === LINE ITEMS TABLE ===
    const tableTop = infoY + 140;
    const colWidths = [240, 60, 100, 100];
    const colX = [50, 290, 350, 450];
    const startX = 50;

    // Table header background
    doc.rect(startX, tableTop, 500, 24).fill(COLORS.headerBg);

    // Table header text
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.textLight);
    doc.text('Description', colX[0] + 8, tableTop + 8);
    doc.text('Qty', colX[1] + 8, tableTop + 8);
    doc.text('Unit Price', colX[2] + 8, tableTop + 8);
    doc.text('Amount', colX[3] + 8, tableTop + 8);

    // Header line
    doc.moveTo(startX, tableTop + 24).lineTo(550, tableTop + 24)
      .lineWidth(0.5).stroke(COLORS.border);

    // Items
    const metadata = invoice.metadata as { items?: InvoiceItem[] } | undefined;
    const items: InvoiceItem[] = metadata?.items || [];

    // Default item if none
    if (items.length === 0) {
      items.push({
        description: 'Subscription Fee',
        quantity: 1,
        unitPrice: Number(invoice.subtotal),
        amount: Number(invoice.subtotal),
      });
    }

    doc.font('Helvetica').fontSize(9);
    let currentY = tableTop + 32;

    items.forEach((item, index) => {
      // Alternating row background
      if (index % 2 === 1) {
        doc.rect(startX, currentY - 6, 500, 22).fill(COLORS.rowAlt);
      }

      doc.fillColor(COLORS.text);
      doc.text(item.description, colX[0] + 8, currentY - 2, { width: colWidths[0] - 16, ellipsis: true });
      doc.text(String(item.quantity), colX[1] + 8, currentY - 2);
      doc.text(formatCurrency(item.unitPrice), colX[2] + 8, currentY - 2);
      doc.font('Helvetica-Bold').text(formatCurrency(item.amount), colX[3] + 8, currentY - 2);
      doc.font('Helvetica');

      currentY += 22;
    });

    // Bottom line
    doc.moveTo(startX, currentY).lineTo(550, currentY)
      .lineWidth(0.5).stroke(COLORS.border);

    // === TOTALS ===
    const totalsY = currentY + 20;
    const totalsX = 380;
    const totalsLabelX = 400;
    const totalsValueX = 460;

    // Subtotal
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight);
    doc.text('Subtotal:', totalsLabelX, totalsY, { width: 70, align: 'left' });
    doc.fillColor(COLORS.text);
    doc.text(formatCurrency(Number(invoice.subtotal)), totalsValueX, totalsY, { width: 90, align: 'right' });

    // Tax
    const taxRate = Number(invoice.taxRate) * 100;
    doc.fillColor(COLORS.textLight);
    doc.text(`VAT (${taxRate.toFixed(0)}%):`, totalsLabelX, totalsY + 18, { width: 70, align: 'left' });
    doc.fillColor(COLORS.text);
    doc.text(formatCurrency(Number(invoice.taxAmount)), totalsValueX, totalsY + 18, { width: 90, align: 'right' });

    // Divider above total
    doc.moveTo(totalsLabelX - 5, totalsY + 40).lineTo(550, totalsY + 40)
      .lineWidth(0.8).stroke(COLORS.border);

    // Total
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primaryDark);
    doc.text('Total:', totalsLabelX, totalsY + 50, { width: 70, align: 'left' });
    doc.fontSize(13).text(formatCurrency(Number(invoice.totalAmount)), totalsValueX, totalsY + 48, { width: 90, align: 'right' });

    // === PAYMENT INSTRUCTIONS ===
    const paymentY = totalsY + 90;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text('Payment Instructions', 50, paymentY);

    doc.moveTo(50, paymentY + 14).lineTo(220, paymentY + 14)
      .lineWidth(0.5).stroke(COLORS.primary);

    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text);
    doc.text(`M-Pesa Paybill: ${mpesaPaybill}`, 50, paymentY + 22);
    if (customer.accountNumber) {
      doc.text(`Account Number: ${customer.accountNumber}`, 50, paymentY + 35);
    }
    doc.text(`Amount: ${formatCurrency(Number(invoice.totalAmount))}`, 50, paymentY + 48);

    // === NOTES ===
    if (invoice.notes) {
      const notesY = paymentY + 75;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight)
        .text('Notes', 50, notesY);
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight)
        .text(invoice.notes, 50, notesY + 14, { width: 450 });
    }

    // === WATERMARK for unpaid ===
    if (invoice.status !== 'PAID') {
      doc.save();
      doc.opacity(0.08);
      doc.fontSize(80).font('Helvetica-Bold').fillColor(COLORS.draft)
        .rotate(-25, { origin: [300, 400] })
        .text('UNPAID', 160, 350, { align: 'center' });
      doc.restore();
    }

    // === FOOTER ===
    const pageH = doc.page.height;
    doc.moveTo(50, pageH - 65).lineTo(550, pageH - 65)
      .lineWidth(0.5).stroke(COLORS.border);

    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
      .text(tagline, 50, pageH - 55, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-KE')}`, 50, pageH - 42, { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', (err) => reject(err));
  });
}

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
