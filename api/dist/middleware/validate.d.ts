import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
export declare const validate: (schema: ZodSchema, source?: "body" | "query" | "params") => (req: Request, _res: Response, next: NextFunction) => void;
export declare const sanitize: (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate.d.ts.map