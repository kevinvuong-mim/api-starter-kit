import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from '@/app.module';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from '@/common/filters';
import { ResponseInterceptor } from '@/common/interceptors';
import { Logger, HttpException, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Helmet - Security headers middleware
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  app.enableCors({
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global validation pipe với whitelist để tránh mass assignment
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Auto transform types
      whitelist: true, // Strip properties không có decorator
      forbidNonWhitelisted: true, // Throw error nếu có property không mong muốn
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const formattedErrors = errors.flatMap((error) => {
          if (!error.constraints) return [];

          return Object.entries(error.constraints).map(([key, message]) => ({
            constraint: key,
            message: message,
            value: error.value,
            field: error.property,
          }));
        });

        const exception = new HttpException(
          {
            statusCode: 400,
            error: 'Bad Request',
            message: formattedErrors,
          },
          400,
        );

        return exception;
      },
    }),
  );

  // Global exception filter - Format all error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor - Format all success responses
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Compression - Enable response compression
  app.use(
    compression({
      level: 6, // Compression level (0-9)
      threshold: 1024, // Only compress response > 1KB
    }),
  );

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', err);
  process.exit(1);
});
