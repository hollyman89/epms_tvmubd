import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { RedisIoAdapter } from './modules/notification/redis-io.adapter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { WinstonModule, utilities } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            utilities.format.nestLike('EPMS', { colors: true, prettyPrint: true })
          )
        }),
        new winston.transports.File({
          filename: 'logs/nest.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ]
    })
  });
  
  // Register Redis IoAdapter for Socket.io Horizontal Scaling across Pods
  try {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  } catch (err) {
    console.warn('Redis IoAdapter connection failed, falling back to default in-memory adapter:', err);
  }

  // Register Cookie Parser Middleware
  try {
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
  } catch (err) {
    // Cookie parser fallback
  }

  // Melayani file statis dari folder uploads (untuk akses PDF)
  const uploadsDir = fs.existsSync(join(__dirname, '..', 'uploads'))
    ? join(__dirname, '..', 'uploads')
    : join(process.cwd(), 'uploads');

  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  app.useStaticAssets(uploadsDir, { prefix: '/api/v1/uploads/' });
  console.log('✅ [STATIC] Folder uploads siap dilayani di /uploads/');


  // Set Global Prefix API v1
  app.setGlobalPrefix('api/v1');

  // Input Validation (class-validator)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global Response Format
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS for frontend
  app.enableCors();

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('EPMS UBD & TVM API')
    .setDescription('Enterprise Project Management System API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // RabbitMQ Consumer Configuration (Komentar agar tidak crash karena tidak ada RabbitMQ lokal)
  /*
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'notification_queue',
      queueOptions: {
        durable: true
      },
    },
  });
  await app.startAllMicroservices();
  */

  await app.listen(4000);
  console.log(`EPMS Backend running on port 4000`);
}
bootstrap();
