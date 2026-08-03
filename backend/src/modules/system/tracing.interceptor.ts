import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('DistributedTracing');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const correlationId = req.headers['x-correlation-id'] || `corr-${uuidv4()}`;
    const requestId = req.headers['x-request-id'] || `req-${uuidv4()}`;
    const transactionId = req.headers['x-transaction-id'] || `tx-${uuidv4()}`;

    // Attach tracing metadata to request and response headers
    req.correlationId = correlationId;
    req.requestId = requestId;
    req.transactionId = transactionId;

    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Transaction-ID', transactionId);

    const startTime = Date.now();
    const method = req.method;
    const url = req.url;

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Structured JSON Logging for ELK / Grafana Loki
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
      }),
    );
  }
}
