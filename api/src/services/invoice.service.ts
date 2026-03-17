import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import config from '../config';
import { logger } from '../config/logger';
import { NotFoundError } from '../types';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

class InvoiceService {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'invoices');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Generate unique invoice number
  generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV${year}${month}${random}`;
  }

  // Generate PDF invoice
  async generatePDF(invoiceId: string): Promise<string> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          include: { user: true },
        },
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const filePath = path.join(this.outputDir, `${invoice.invoiceNumber}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      this.drawHeader(doc);

      // Invoice title
      doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, 150);
      doc.moveDown();

      // Invoice details
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-KE')}`);
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-KE')}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown();

      // Bill To section
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, doc.y + 20);
      doc.fontSize(10).font('Helvetica');
      doc.text(`${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`);
      doc.text(`Customer Code: ${invoice.customer.customerCode}`);
      if (invoice.customer.user.email) doc.text(invoice.customer.user.email);
      if (invoice.customer.user.phone) doc.text(invoice.customer.user.phone);
      if (invoice.customer.user.addressLine1) doc.text(invoice.customer.user.addressLine1);
      if (invoice.customer.user.city || invoice.customer.user.county) {
        doc.text(`${invoice.customer.user.city || ''} ${invoice.customer.user.county || ''}`);
      }
      doc.moveDown();

      // If subscription exists, show plan details
      if (invoice.subscription) {
        doc.fontSize(12).font('Helvetica-Bold').text('Subscription Details:');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Plan: ${invoice.subscription.plan.name}`);
        doc.text(`Period: ${new Date(invoice.subscription.startDate).toLocaleDateString('en-KE')} - ${new Date(invoice.subscription.endDate).toLocaleDateString('en-KE')}`);
        doc.moveDown();
      }

      // Items table
      this.drawItemsTable(doc, invoice);

      // Totals
      doc.moveDown();
      const metadata = invoice.metadata as any;
      const items: InvoiceItem[] = metadata?.items || [];

      const totalsY = doc.y + 10;
      
      // Subtotal
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', 400, totalsY, { align: 'left' });
      doc.text(`KES ${Number(invoice.subtotal).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, 450, totalsY, { align: 'right' });

      // Tax
      doc.text(`VAT (${(Number(invoice.taxRate) * 100).toFixed(0)}%):`, 400, totalsY + 20, { align: 'left' });
      doc.text(`KES ${Number(invoice.taxAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, 450, totalsY + 20, { align: 'right' });

      // Total
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Total:', 400, totalsY + 50, { align: 'left' });
      doc.text(`KES ${Number(invoice.totalAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, 450, totalsY + 50, { align: 'right' });

      // Payment information
      doc.moveDown(3);
      doc.fontSize(10).font('Helvetica-Bold').text('Payment Information:');
      doc.font('Helvetica').fontSize(9);
      doc.text('M-Pesa Paybill: 174379');
      doc.text(`Account Number: ${invoice.customer.accountNumber}`);
      doc.moveDown();

      // Notes
      if (invoice.notes) {
        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:');
        doc.font('Helvetica').fontSize(9);
        doc.text(invoice.notes);
      }

      // Footer
      this.drawFooter(doc);

      // Watermark for unpaid invoices
      if (invoice.status !== 'PAID') {
        doc.save();
        doc.opacity(0.3);
        doc.fontSize(60).fillColor('#f0f0f0')
          .rotate(-45, { origin: [300, 400] })
          .text('DRAFT', 200, 350, { align: 'center' });
        doc.restore();
      }

      doc.end();

      stream.on('finish', () => {
        logger.info(`PDF generated: ${filePath}`);
        resolve(filePath);
      });

      stream.on('error', (err) => {
        logger.error('PDF generation error:', err);
        reject(err);
      });
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument): void {
    // Company logo placeholder
    doc.fontSize(20).font('Helvetica-Bold')
      .text(config.invoice.companyName, 50, 50, { align: 'left' });
    
    doc.fontSize(9).font('Helvetica')
      .text(config.invoice.companyAddress, 50, 75)
      .text(`Phone: ${config.invoice.companyPhone}`, 50, 90)
      .text(`Email: ${config.invoice.companyEmail}`, 50, 105)
      .text(`KRA PIN: ${config.invoice.companyKraPin}`, 50, 120);

    // Line separator
    doc.moveTo(50, 140).lineTo(550, 140).stroke();
  }

  private drawFooter(doc: PDFKit.PDFDocument): void {
    const pageHeight = doc.page.height;
    
    // Line separator
    doc.moveTo(50, pageHeight - 80).lineTo(550, pageHeight - 80).stroke();
    
    // Footer text
    doc.fontSize(8).font('Helvetica')
      .text('Thank you for your business!', 50, pageHeight - 70, { align: 'center' })
      .text('For inquiries, please contact our billing department.', 50, pageHeight - 55, { align: 'center' })
      .text(`Generated on ${new Date().toLocaleString('en-KE')}`, 50, pageHeight - 40, { align: 'center' });
  }

  private drawItemsTable(doc: PDFKit.PDFDocument, invoice: any): void {
    const metadata = invoice.metadata as any;
    const items: InvoiceItem[] = metadata?.items || [];

    // Table header
    const tableTop = doc.y + 10;
    const colWidths = [250, 70, 90, 90];
    const startX = 50;

    // Header background
    doc.rect(startX, tableTop, 500, 25).fill('#f5f5f5');

    // Header text
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
    doc.text('Description', startX + 10, tableTop + 8);
    doc.text('Qty', startX + colWidths[0], tableTop + 8);
    doc.text('Unit Price', startX + colWidths[0] + colWidths[1], tableTop + 8);
    doc.text('Amount', startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop + 8);

    // Header line
    doc.moveTo(startX, tableTop + 25).lineTo(550, tableTop + 25).stroke();

    // Items
    doc.font('Helvetica').fillColor('#333333');
    let currentY = tableTop + 35;

    if (items.length === 0) {
      // Default item from invoice
      items.push({
        description: 'Subscription Fee',
        quantity: 1,
        unitPrice: Number(invoice.subtotal),
        amount: Number(invoice.subtotal),
      });
    }

    items.forEach((item, index) => {
      // Alternating row background
      if (index % 2 === 0) {
        doc.rect(startX, currentY - 5, 500, 20).fill('#fafafa');
      }

      doc.fontSize(9);
      doc.text(item.description, startX + 10, currentY, { width: colWidths[0] - 20 });
      doc.text(item.quantity.toString(), startX + colWidths[0], currentY);
      doc.text(`KES ${item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, startX + colWidths[0] + colWidths[1], currentY);
      doc.text(`KES ${item.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY);

      currentY += 20;
    });

    // Bottom line
    doc.moveTo(startX, currentY).lineTo(550, currentY).stroke();
    doc.y = currentY + 10;
  }

  // Get invoice file path
  getInvoiceFilePath(invoiceNumber: string): string {
    return path.join(this.outputDir, `${invoiceNumber}.pdf`);
  }

  // Check if invoice PDF exists
  invoiceExists(invoiceNumber: string): boolean {
    const filePath = this.getInvoiceFilePath(invoiceNumber);
    return fs.existsSync(filePath);
  }

  // Generate invoices for a date range
  async generateBulkInvoices(customerId?: string): Promise<{ generated: number; errors: number }> {
    let generated = 0;
    let errors = 0;

    const where: any = {
      status: { in: ['DRAFT', 'PENDING'] },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    for (const invoice of invoices) {
      try {
        await this.generatePDF(invoice.id);
        generated++;
      } catch (error) {
        logger.error(`Error generating PDF for invoice ${invoice.id}:`, error);
        errors++;
      }
    }

    return { generated, errors };
  }
}

export const invoiceService = new InvoiceService();
export default invoiceService;
