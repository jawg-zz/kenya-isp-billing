import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// JWT token payload
export interface TokenPayload extends JwtPayload {
  id: string;
  email: string;
  role: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// M-Pesa types
export interface MpesaSTKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface MpesaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

// Airtel Money types
export interface AirtelPaymentRequest {
  phoneNumber: string;
  amount: number;
  reference: string;
  description: string;
}

export interface AirtelCallback {
  transaction: {
    id: string;
    reference: string;
    status: string;
    amount: {
      value: number;
      currency: string;
    };
    subscriber: {
      country: string;
      msisdn: string;
    };
  };
}

// RADIUS types
export interface RadiusAccessRequest {
  username: string;
  password: string;
  nasIpAddress: string;
  nasPortId?: string;
  nasPortType?: string;
}

export interface RadiusAccountingRequest {
  sessionId: string;
  username: string;
  nasIpAddress: string;
  nasPortId?: string;
  framedIpAddress?: string;
  inputOctets: number;
  outputOctets: number;
  inputPackets: number;
  outputPackets: number;
  sessionTime: number;
  terminateCause?: string;
}

// SMS types
export interface SMSRequest {
  to: string | string[];
  message: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Usage types
export interface UsageStats {
  totalUsed: number;
  totalRemaining: number;
  percentageUsed: number;
  isFupThresholdReached: boolean;
}

// Invoice types
export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Subscription activation
export interface SubscriptionActivation {
  userId: string;
  planId: string;
  paymentId: string;
  isPrepaid: boolean;
  validityDays: number;
}

// Webhook payload
export interface WebhookPayload {
  type: string;
  data: unknown;
  timestamp: string;
  signature?: string;
}

// Error types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  public errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]> | string) {
    super('Validation failed', 400);
    this.errors = typeof errors === 'string' ? { _errors: [errors] } : errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export class PaymentError extends AppError {
  constructor(message: string = 'Payment failed') {
    super(message, 422);
  }
}
