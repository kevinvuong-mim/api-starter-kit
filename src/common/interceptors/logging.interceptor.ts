import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger, Injectable, CallHandler, NestInterceptor, ExecutionContext } from '@nestjs/common';

import { RequestWithId } from '@/common/middleware/request-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const { method, originalUrl } = request;
    const requestId = request.requestId ?? 'unknown';
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.logger.log(
            JSON.stringify({
              requestId,
              method,
              path: originalUrl,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
            }),
          );
        },
        error: (error: unknown) => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          const statusCode = response.statusCode ?? 500;
          const message = error instanceof Error ? error.message : 'Unknown error';

          this.logger.warn(
            JSON.stringify({
              requestId,
              method,
              path: originalUrl,
              statusCode,
              durationMs: Date.now() - startedAt,
              error: message,
            }),
          );
        },
      }),
    );
  }
}
