import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ISP Billing API',
      description: 'Kenya ISP Billing System API — manage customers, plans, subscriptions, payments (M-Pesa, Airtel Money), invoices, and RADIUS authentication.',
      version: '1.0.0',
      contact: {
        name: 'ISP Billing Team',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // --- User / Auth ---
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string', nullable: true },
            phoneVerified: { type: 'boolean' },
            emailVerified: { type: 'boolean' },
            role: { type: 'string', enum: ['CUSTOMER', 'ADMIN', 'SUPPORT'] },
            accountStatus: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'P@ssw0rd123' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+254712345678' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        Tokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                tokens: { $ref: '#/components/schemas/Tokens' },
              },
            },
          },
        },

        // --- Plan ---
        Plan: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Home Basic' },
            description: { type: 'string' },
            code: { type: 'string', example: 'HOME_BASIC' },
            type: { type: 'string', enum: ['PREPAID', 'POSTPAID'] },
            dataType: { type: 'string', enum: ['LIMITED', 'UNLIMITED', 'FAIR_USAGE'] },
            price: { type: 'number', example: 1500 },
            dataAllowance: { type: 'integer', description: 'Data allowance in bytes', nullable: true },
            speedLimit: { type: 'integer', description: 'Speed limit in kbps', nullable: true },
            billingCycle: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONETIME'] },
            validityDays: { type: 'integer' },
            isActive: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            planPrices: {
              type: 'array',
              items: { $ref: '#/components/schemas/PlanPrice' },
            },
          },
        },
        PlanPrice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            billingCycle: { type: 'string' },
            price: { type: 'number' },
            isActive: { type: 'boolean' },
          },
        },
        CreatePlanRequest: {
          type: 'object',
          required: ['name', 'code', 'type', 'dataType', 'price', 'billingCycle', 'validityDays'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            code: { type: 'string' },
            type: { type: 'string', enum: ['PREPAID', 'POSTPAID'] },
            dataType: { type: 'string', enum: ['LIMITED', 'UNLIMITED', 'FAIR_USAGE'] },
            price: { type: 'number' },
            dataAllowance: { type: 'integer', description: 'MB' },
            voiceMinutes: { type: 'integer' },
            smsAllowance: { type: 'integer' },
            speedLimit: { type: 'integer' },
            billingCycle: { type: 'string' },
            validityDays: { type: 'integer' },
            isFeatured: { type: 'boolean' },
            sortOrder: { type: 'integer' },
          },
        },

        // --- Subscription ---
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            customerId: { type: 'string' },
            planId: { type: 'string' },
            type: { type: 'string', enum: ['PREPAID', 'POSTPAID'] },
            status: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            autoRenew: { type: 'boolean' },
            dataRemaining: { type: 'integer', nullable: true },
            plan: { $ref: '#/components/schemas/Plan' },
          },
        },
        CreateSubscriptionRequest: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string', format: 'uuid' },
            autoRenew: { type: 'boolean', default: true },
          },
        },
        CancelSubscriptionRequest: {
          type: 'object',
          required: ['subscriptionId'],
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
            immediate: { type: 'boolean', default: false },
          },
        },

        // --- Payment ---
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            paymentNumber: { type: 'string' },
            customerId: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string', example: 'KES' },
            method: { type: 'string', enum: ['MPESA', 'AIREL_MONEY', 'CASH', 'BANK'] },
            status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'TIMEOUT'] },
            reference: { type: 'string', nullable: true },
            processedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        MpesaSTKPushRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            phoneNumber: { type: 'string', example: '+254712345678' },
            amount: { type: 'number', example: 1500 },
            accountReference: { type: 'string' },
            transactionDesc: { type: 'string' },
          },
        },
        AirtelPaymentRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            phoneNumber: { type: 'string' },
            amount: { type: 'number' },
            description: { type: 'string' },
          },
        },
        CashPaymentRequest: {
          type: 'object',
          required: ['customerId', 'amount'],
          properties: {
            customerId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            reference: { type: 'string' },
            notes: { type: 'string' },
          },
        },
        PaymentStats: {
          type: 'object',
          properties: {
            totalRevenue: { type: 'number' },
            totalTransactions: { type: 'integer' },
            paymentsByMethod: { type: 'array', items: { type: 'object' } },
            paymentsByDay: { type: 'array', items: { type: 'object' } },
            period: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
              },
            },
          },
        },

        // --- Invoice ---
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string' },
            customerId: { type: 'string' },
            subscriptionId: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] },
            subtotal: { type: 'number' },
            taxAmount: { type: 'number' },
            totalAmount: { type: 'number' },
            currency: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
            paidAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InvoiceStats: {
          type: 'object',
          properties: {
            totalInvoices: { type: 'integer' },
            paidInvoices: { type: 'integer' },
            pendingInvoices: { type: 'integer' },
            overdueInvoices: { type: 'integer' },
            totalAmount: { type: 'number' },
            paidAmount: { type: 'number' },
            pendingAmount: { type: 'number' },
          },
        },

        // --- Pagination ---
        PaginationMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },

        // --- Common ---
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
