"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TracingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const uuid_1 = require("uuid");
let TracingInterceptor = class TracingInterceptor {
    constructor() {
        this.logger = new common_1.Logger('DistributedTracing');
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const correlationId = req.headers['x-correlation-id'] || `corr-${(0, uuid_1.v4)()}`;
        const requestId = req.headers['x-request-id'] || `req-${(0, uuid_1.v4)()}`;
        const transactionId = req.headers['x-transaction-id'] || `tx-${(0, uuid_1.v4)()}`;
        req.correlationId = correlationId;
        req.requestId = requestId;
        req.transactionId = transactionId;
        res.setHeader('X-Correlation-ID', correlationId);
        res.setHeader('X-Request-ID', requestId);
        res.setHeader('X-Transaction-ID', transactionId);
        const startTime = Date.now();
        const method = req.method;
        const url = req.url;
        return next.handle().pipe((0, operators_1.tap)(() => {
            const durationMs = Date.now() - startTime;
            const statusCode = res.statusCode;
            const structuredLog = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                service: 'epms-backend',
                module: context.getClass().name,
                userId: req.user?.id || req.user?.sub || null,
                correlationId,
                requestId,
                transactionId,
                method,
                url,
                statusCode,
                durationMs,
            };
            this.logger.log(JSON.stringify(structuredLog));
        }));
    }
};
exports.TracingInterceptor = TracingInterceptor;
exports.TracingInterceptor = TracingInterceptor = __decorate([
    (0, common_1.Injectable)()
], TracingInterceptor);
//# sourceMappingURL=tracing.interceptor.js.map