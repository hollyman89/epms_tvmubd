import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplication } from '@nestjs/common';
export declare class RedisIoAdapter extends IoAdapter {
    private adapterConstructor;
    private readonly logger;
    constructor(app: INestApplication);
    connectToRedis(): Promise<void>;
    createIOServer(port: number, options?: ServerOptions): any;
}
