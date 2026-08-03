declare const JwtStrategy_base: new (...args: any[]) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor();
    validate(payload: any): Promise<{
        userId: any;
        id: any;
        sub: any;
        email: any;
        roles: any;
        permissions: any;
        companyId: any;
        branchId: any;
        tenantId: any;
    }>;
}
export {};
