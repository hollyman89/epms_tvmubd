import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { Logger, INestApplication } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
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
        retryStrategy: (times: number) => {
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

      pubClient.on('error', (err: any) => this.logger.error(`Redis PubClient Error: ${err.message}`));
      subClient.on('error', (err: any) => this.logger.error(`Redis SubClient Error: ${err.message}`));

      this.adapterConstructor = createAdapter(pubClient, subClient);
    } catch (err: any) {
      this.logger.warn(`Redis IoAdapter library loading fallback: ${err.message}`);
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
