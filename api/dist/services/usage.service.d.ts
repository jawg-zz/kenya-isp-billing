import { UsageStats } from '../types';
interface UsageSummary {
    daily: {
        date: string;
        inputOctets: number;
        outputOctets: number;
        totalOctets: number;
    }[];
    total: {
        inputOctets: number;
        outputOctets: number;
        totalOctets: number;
    };
    percentageUsed: number;
    isFupThresholdReached: boolean;
    daysRemaining: number;
}
declare class UsageService {
    getCustomerUsage(customerId: string): Promise<UsageSummary>;
    getRealtimeUsage(customerId: string): Promise<UsageStats>;
    trackUsage(data: {
        customerId: string;
        userId: string;
        subscriptionId: string;
        sessionId: string;
        nasIpAddress: string;
        inputOctets: number;
        outputOctets: number;
        inputPackets: number;
        outputPackets: number;
    }): Promise<void>;
    private checkFUPThreshold;
    getUsageAnalytics(startDate?: Date, endDate?: Date): Promise<any>;
    private formatBytes;
    resetUsageForNewPeriod(customerId: string): Promise<void>;
}
export declare const usageService: UsageService;
export default usageService;
//# sourceMappingURL=usage.service.d.ts.map