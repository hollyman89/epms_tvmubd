import { ProjectService } from './project.service';
export declare class ProjectEventListener {
    private readonly projectService;
    private readonly logger;
    constructor(projectService: ProjectService);
    handlePaymentProcessed(payload: {
        invoiceId: number;
        paymentAmount: number;
        poId?: number;
    }): Promise<void>;
}
