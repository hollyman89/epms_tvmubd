"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const common_1 = require("@nestjs/common");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    constructor(app) {
        super(app);
        this.logger = new common_1.Logger(RedisIoAdapter.name);
    }
    async connectToRedis() {
        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = Number(process.env.REDIS_PORT || 6379);
        const password = process.env.REDIS_PASSWORD || undefined;
        try {
            const Redis = require('ioredis');
            const { createAdapter } = require('@socket.io/redis-adapter');
            const redisOptions = {
                host,
                port,
                password,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 100, 3000);
                    this.logger.warn(`Redis IoAdapter reconnecting in ${delay}ms (attempt #${times})...`);
                    return delay;
                },
                maxRetriesPerRequest: null,
            };
            const pubClient = new Redis(redisOptions);
            const subClient = pubClient.duplicate();
            pubClient.on('connect', () => this.logger.log(`Redis PubClient connected to ${host}:${port}`));
            subClient.on('connect', () => this.logger.log(`Redis SubClient connected to ${host}:${port}`));
            pubClient.on('error', (err) => this.logger.error(`Redis PubClient Error: ${err.message}`));
            subClient.on('error', (err) => this.logger.error(`Redis SubClient Error: ${err.message}`));
            this.adapterConstructor = createAdapter(pubClient, subClient);
        }
        catch (err) {
            this.logger.warn(`Redis IoAdapter library loading fallback: ${err.message}`);
        }
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map