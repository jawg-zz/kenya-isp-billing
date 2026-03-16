interface RadiusAuthRequest {
    username: string;
    password: string;
    nasIpAddress: string;
    nasPortId?: string;
    nasPortType?: string;
}
interface RadiusAccountingRequest {
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
declare class RadiusService {
    static generatePassword(): Promise<{
        plaintext: string;
        hashed: string;
    }>;
    createRadiusUser(customerId: string): Promise<any>;
    updatePassword(customerId: string): Promise<string>;
    disableUser(customerId: string): Promise<void>;
    enableUser(customerId: string): Promise<void>;
    handleAccessRequest(request: RadiusAuthRequest): Promise<{
        accept: boolean;
        attributes?: {
            speedLimit?: number;
            dataRemaining?: number;
        };
    }>;
    handleAccountingRequest(request: RadiusAccountingRequest): Promise<void>;
    private updateUsageRecord;
    private updateSubscriptionUsage;
    private checkFUPThreshold;
    private applyFUPLimit;
    disconnectUser(username: string): Promise<void>;
    getActiveSessions(customerId: string): Promise<any[]>;
    private syncUserToRadius;
    disableRadiusUser(customerId: string): Promise<void>;
    enableRadiusUser(customerId: string): Promise<void>;
}
export declare const radiusService: RadiusService;
export default radiusService;
//# sourceMappingURL=radius.service.d.ts.map