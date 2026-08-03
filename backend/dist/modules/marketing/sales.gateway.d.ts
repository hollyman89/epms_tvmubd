import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class SalesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinSalesRoom(client: Socket): {
        status: string;
        room: string;
    };
    handleJoinTenderRoom(data: {
        tenderId: number;
    }, client: Socket): {
        status: string;
        room: string;
    };
    handleLeaveTenderRoom(data: {
        tenderId: number;
    }, client: Socket): {
        status: string;
        room: string;
    };
    handleTenderUpdate(payload: any): void;
    broadcastTenderDelta(tenderId: number, event: string, deltaPayload: any): void;
}
