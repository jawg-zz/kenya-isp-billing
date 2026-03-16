import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}
export interface TokenPayload extends JwtPayload {
    id: string;
    email: string;
    role: string;
}
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
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    errors?: Record<string, string[]>;
}
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
export interface SMSRequest {
    to: string | string[];
    message: string;
}
export interface SMSResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}
export interface UsageStats {
    totalUsed: number;
    totalRemaining: number;
    percentageUsed: number;
    isFupThresholdReached: boolean;
}
export interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}
export interface SubscriptionActivation {
    userId: string;
    planId: string;
    paymentId: string;
    isPrepaid: boolean;
    validityDays: number;
}
export interface WebhookPayload {
    type: string;
    data: unknown;
    timestamp: string;
    signature?: string;
}
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ValidationError extends AppError {
    errors: Record<string, string[]>;
    constructor(errors: Record<string, string[]>);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class PaymentError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=index.d.ts.map