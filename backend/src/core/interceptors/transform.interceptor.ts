import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  meta: {
    code: number;
    status: string;
    message: string;
  };
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T> | StreamableFile> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T> | StreamableFile> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    
    return next.handle().pipe(
      map((data) => {
        if (
          data instanceof StreamableFile ||
          (data && typeof (data as any).getStream === 'function')
        ) {
          return data;
        }

        return {
          meta: {
            code: response.statusCode,
            status: 'success',
            message: 'Request successful',
          },
          data: data || null,
        };
      }),
    );
  }
}
