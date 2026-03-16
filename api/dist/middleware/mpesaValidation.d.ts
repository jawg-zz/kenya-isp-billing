import { Request, Response, NextFunction } from 'express';
/**
 * Validate M-Pesa callback IP allowlist
 * In development/sandbox, allow localhost. In production, restrict to Safaricom IPs.
 */
export declare const validateMpesaIP: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Validate M-Pesa callback signature
 * Safaricom signs callbacks with their private key; we verify with their public cert
 */
export declare const validateMpesaSignature: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const mpesaIdempotencyCheck: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=mpesaValidation.d.ts.map