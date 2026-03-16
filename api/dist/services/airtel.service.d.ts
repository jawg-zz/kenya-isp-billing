import { AirtelPaymentRequest, AirtelCallback } from '../types';
interface AirtelPaymentResponse {
    data: {
        transaction: {
            id: string;
            reference: string;
            status: string;
            subscriber: {
                country: string;
                msisdn: string;
            };
        };
    };
}
interface AirtelTransactionStatus {
    data: {
        transaction: {
            id: string;
            reference: string;
            status: string;
            amount: {
                value: number;
                currency: string;
            };
            result_code: string;
            result_description: string;
        };
    };
}
declare class AirtelService {
    private baseUrl;
    private accessToken;
    private tokenExpiry;
    constructor();
    private getAccessToken;
    private formatPhoneNumber;
    private generateReference;
    initiatePayment(request: AirtelPaymentRequest): Promise<AirtelPaymentResponse>;
    checkTransactionStatus(transactionId: string): Promise<AirtelTransactionStatus>;
    processCallback(callback: AirtelCallback): Promise<void>;
    private handleSuccessfulPayment;
}
export declare const airtelService: AirtelService;
export default airtelService;
//# sourceMappingURL=airtel.service.d.ts.map