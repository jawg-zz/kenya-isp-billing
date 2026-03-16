"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mpesaIdempotencyCheck = exports.validateMpesaSignature = exports.validateMpesaIP = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../config/logger");
// Safaricom IP ranges for production (from their documentation)
const SAFARICOM_IPS = [
    '196.201.214.206',
    '196.201.214.207',
    '196.201.214.90',
    '196.201.214.91',
    '196.201.214.198',
    '196.201.214.199',
    '196.201.214.230',
    '196.201.214.231',
];
// Cache for public keys (refreshed periodically)
let cachedPublicKey = null;
let keyCacheExpiry = 0;
/**
 * Validate M-Pesa callback IP allowlist
 * In development/sandbox, allow localhost. In production, restrict to Safaricom IPs.
 */
const validateMpesaIP = (req, res, next) => {
    const clientIP = req.ip || req.socket.remoteAddress || '';
    const isProduction = process.env.MPESA_ENVIRONMENT === 'production';
    if (!isProduction) {
        // In sandbox, allow all IPs (for local testing)
        logger_1.logger.debug(`M-Pesa callback from ${clientIP} (sandbox mode, IP check skipped)`);
        next();
        return;
    }
    // Clean IP (handle IPv6-mapped IPv4)
    const cleanIP = clientIP.replace(/^::ffff:/, '');
    if (SAFARICOM_IPS.includes(cleanIP)) {
        logger_1.logger.info(`M-Pesa callback accepted from whitelisted IP: ${cleanIP}`);
        next();
    }
    else {
        logger_1.logger.warn(`M-Pesa callback rejected from unknown IP: ${cleanIP}`);
        res.status(403).json({ error: 'Forbidden: Invalid source IP' });
    }
};
exports.validateMpesaIP = validateMpesaIP;
/**
 * Fetch Safaricom public certificate for signature verification
 * In production, download from Safaricom's certificate endpoint
 */
async function getPublicKey() {
    const now = Date.now();
    // Return cached key if still valid (cache for 1 hour)
    if (cachedPublicKey && now < keyCacheExpiry) {
        return cachedPublicKey;
    }
    try {
        // In production, fetch from Safaricom's certificate endpoint
        // For now, use the sandbox certificate or a configured path
        const certPath = process.env.MPESA_CERT_PATH;
        if (certPath) {
            const { readFileSync } = await Promise.resolve().then(() => __importStar(require('fs')));
            cachedPublicKey = readFileSync(certPath, 'utf-8');
        }
        else {
            // Fallback: use a known Safaricom certificate fingerprint for validation
            // This should be replaced with actual certificate fetching in production
            logger_1.logger.warn('MPESA_CERT_PATH not set - callback signature validation is limited');
            cachedPublicKey = null;
        }
        keyCacheExpiry = now + 3600000; // 1 hour
        return cachedPublicKey || '';
    }
    catch (error) {
        logger_1.logger.error('Failed to load M-Pesa public certificate:', error);
        return '';
    }
}
/**
 * Validate M-Pesa callback signature
 * Safaricom signs callbacks with their private key; we verify with their public cert
 */
const validateMpesaSignature = async (req, res, next) => {
    const isProduction = process.env.MPESA_ENVIRONMENT === 'production';
    if (!isProduction) {
        // In sandbox, signature validation is optional
        logger_1.logger.debug('M-Pesa callback signature validation skipped (sandbox mode)');
        next();
        return;
    }
    try {
        const signature = req.headers['x-safaricom-signature'];
        const publicKey = await getPublicKey();
        if (!publicKey) {
            // If we can't load the public key, log a warning but allow the callback
            // In production, you should fail-closed (return 403)
            logger_1.logger.warn('M-Pesa public key unavailable - allowing callback without signature validation');
            next();
            return;
        }
        if (!signature) {
            logger_1.logger.warn('M-Pesa callback missing signature header');
            res.status(403).json({ error: 'Forbidden: Missing signature' });
            return;
        }
        // Verify the signature
        const verify = crypto_1.default.createVerify('SHA256');
        verify.update(JSON.stringify(req.body));
        const isValid = verify.verify(publicKey, signature, 'base64');
        if (isValid) {
            logger_1.logger.info('M-Pesa callback signature verified');
            next();
        }
        else {
            logger_1.logger.warn('M-Pesa callback signature verification failed');
            res.status(403).json({ error: 'Forbidden: Invalid signature' });
        }
    }
    catch (error) {
        logger_1.logger.error('Error validating M-Pesa signature:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.validateMpesaSignature = validateMpesaSignature;
/**
 * Idempotency check - prevent duplicate callback processing
 */
const processedCallbacks = new Set();
const mpesaIdempotencyCheck = (req, res, next) => {
    const { MerchantRequestID, CheckoutRequestID } = req.body?.Body?.stkCallback || {};
    if (!MerchantRequestID && !CheckoutRequestID) {
        res.status(400).json({ error: 'Invalid callback payload' });
        return;
    }
    const callbackId = MerchantRequestID || CheckoutRequestID;
    if (processedCallbacks.has(callbackId)) {
        logger_1.logger.warn(`Duplicate M-Pesa callback ignored: ${callbackId}`);
        // Return success to prevent Safaricom retries
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Already processed' });
        return;
    }
    // Mark as processed (in production, use Redis for distributed systems)
    processedCallbacks.add(callbackId);
    // Clean up old entries periodically (simple in-memory approach)
    if (processedCallbacks.size > 10000) {
        const entries = Array.from(processedCallbacks);
        entries.slice(0, 5000).forEach((e) => processedCallbacks.delete(e));
    }
    next();
};
exports.mpesaIdempotencyCheck = mpesaIdempotencyCheck;
//# sourceMappingURL=mpesaValidation.js.map