"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const transform_interceptor_1 = require("./core/interceptors/transform.interceptor");
const redis_io_adapter_1 = require("./modules/notification/redis-io.adapter");
const swagger_1 = require("@nestjs/swagger");
const path_1 = require("path");
const nest_winston_1 = require("nest-winston");
const winston = require("winston");
const path = require("path");
const fs = require("fs");
async function bootstrap() {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: nest_winston_1.WinstonModule.createLogger({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.timestamp(), winston.format.ms(), nest_winston_1.utilities.format.nestLike('EPMS', { colors: true, prettyPrint: true }))
                }),
                new winston.transports.File({
                    filename: 'logs/nest.log',
                    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
                })
            ]
        })
    });
    try {
        const redisIoAdapter = new redis_io_adapter_1.RedisIoAdapter(app);
        await redisIoAdapter.connectToRedis();
        app.useWebSocketAdapter(redisIoAdapter);
    }
    catch (err) {
        console.warn('Redis IoAdapter connection failed, falling back to default in-memory adapter:', err);
    }
    try {
        const cookieParser = require('cookie-parser');
        app.use(cookieParser());
    }
    catch (err) {
    }
    const uploadsDir = fs.existsSync((0, path_1.join)(__dirname, '..', 'uploads'))
        ? (0, path_1.join)(__dirname, '..', 'uploads')
        : (0, path_1.join)(process.cwd(), 'uploads');
    app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
    app.useStaticAssets(uploadsDir, { prefix: '/api/v1/uploads/' });
    console.log('✅ [STATIC] Folder uploads siap dilayani di /uploads/');
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalInterceptors(new transform_interceptor_1.TransformInterceptor());
    app.enableCors();
    const config = new swagger_1.DocumentBuilder()
        .setTitle('EPMS UBD & TVM API')
        .setDescription('Enterprise Project Management System API Documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    await app.listen(4000);
    console.log(`EPMS Backend running on port 4000`);
}
bootstrap();
//# sourceMappingURL=main.js.map