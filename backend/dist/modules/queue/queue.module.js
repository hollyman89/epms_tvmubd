"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const contract_entity_1 = require("../../entities/contract.entity");
const mockQueueProvider = (name) => ({
    provide: (0, bullmq_1.getQueueToken)(name),
    useValue: {
        add: async () => ({ id: 'mock-job-id' }),
        on: () => { },
        process: () => { },
    },
});
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([contract_entity_1.Contract])],
        controllers: [],
        providers: [
            mockQueueProvider('email-send'),
            mockQueueProvider('email-dlq'),
            mockQueueProvider('pdf-generation'),
        ],
        exports: [
            (0, bullmq_1.getQueueToken)('email-send'),
            (0, bullmq_1.getQueueToken)('email-dlq'),
            (0, bullmq_1.getQueueToken)('pdf-generation'),
        ],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map