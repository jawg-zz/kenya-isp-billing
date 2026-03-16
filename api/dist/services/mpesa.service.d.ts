import { MpesaSTKPushRequest, MpesaCallback } from '../types';
interface STKPushResponse {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage: string;
}
declare class MpesaService {
    private baseUrl;
    private accessToken;
    private tokenExpiry;
    constructor();
    private getAccessToken;
    private generatePassword;
    private getTimestamp;
    private formatPhoneNumber;
    initiateSTKPush(request: MpesaSTKPushRequest): Promise<STKPushResponse>;
    querySTKPushStatus(checkoutRequestId: string): Promise<any>;
    processCallback(callback: MpesaCallback): Promise<void>;
    private handleSuccessfulPayment;
    validateCallback(body: any): boolean;
}
export declare const mpesaService: MpesaService;
export default mpesaService;
//# sourceMappingURL=mpesa.service.d.ts.map