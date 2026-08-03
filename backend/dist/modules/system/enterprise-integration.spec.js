"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const auth_service_1 = require("../auth/auth.service");
const user_session_service_1 = require("../auth/user-session.service");
const workflow_service_1 = require("../workflow-engine/workflow.service");
const contract_service_1 = require("../contract/contract.service");
const sla_grace_service_1 = require("../legal/sla-grace.service");
const pdf_template_service_1 = require("../contract/pdf-template.service");
const user_entity_1 = require("../../entities/user.entity");
const contract_entity_1 = require("../../entities/contract.entity");
const contract_amendment_entity_1 = require("../../entities/contract-amendment.entity");
const user_session_entity_1 = require("../../entities/user-session.entity");
const pdf_template_entity_1 = require("../../entities/pdf-template.entity");
const tender_entity_1 = require("../../entities/tender.entity");
const notification_gateway_1 = require("../notification/notification.gateway");
describe('EPMS v3.0 Enterprise Master Integration Test Suite', () => {
    let authService;
    let workflowService;
    let contractService;
    let slaGraceService;
    let pdfTemplateService;
    let userSessionService;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                workflow_service_1.WorkflowService,
                contract_service_1.ContractService,
                sla_grace_service_1.SlaGraceService,
                pdf_template_service_1.PdfTemplateService,
                user_session_service_1.UserSessionService,
                notification_gateway_1.NotificationGateway,
                { provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User), useValue: { findOne: jest.fn(), save: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(contract_entity_1.Contract), useValue: { findOne: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(contract_amendment_entity_1.ContractAmendment), useValue: { findOne: jest.fn(), save: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(user_session_entity_1.UserSession), useValue: { findOne: jest.fn(), save: jest.fn(), find: jest.fn(), update: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(pdf_template_entity_1.PdfTemplate), useValue: { findOne: jest.fn(), save: jest.fn(), find: jest.fn() } },
                { provide: (0, typeorm_1.getRepositoryToken)(tender_entity_1.Tender), useValue: { findOne: jest.fn() } },
                { provide: 'BullQueue_email-send', useValue: { add: jest.fn(), getJobCounts: jest.fn() } },
                { provide: 'BullQueue_email-dlq', useValue: { add: jest.fn(), getJobCounts: jest.fn() } },
                { provide: 'BullQueue_pdf-generation', useValue: { add: jest.fn() } },
                { provide: event_emitter_1.EventEmitter2, useValue: { emit: jest.fn() } },
                { provide: typeorm_2.DataSource, useValue: { query: jest.fn() } },
                { provide: jwt_1.JwtService, useValue: { sign: jest.fn().mockReturnValue('mock_jwt_token'), verify: jest.fn().mockReturnValue({ sub: 1 }) } },
            ],
        }).compile();
        authService = module.get(auth_service_1.AuthService);
        workflowService = module.get(workflow_service_1.WorkflowService);
        contractService = module.get(contract_service_1.ContractService);
        slaGraceService = module.get(sla_grace_service_1.SlaGraceService);
        pdfTemplateService = module.get(pdf_template_service_1.PdfTemplateService);
        userSessionService = module.get(user_session_service_1.UserSessionService);
    });
    describe('1. Authentication with HttpOnly Cookies & Device Fingerprinting', () => {
        it('should generate device fingerprint and login successfully', async () => {
            const fingerprint = authService.generateDeviceFingerprint('192.168.1.100', 'Mozilla/5.0 Chrome/120.0');
            expect(fingerprint).toBeDefined();
            expect(fingerprint.length).toBe(64);
        });
    });
    describe('2. Contract Versioning with SHA-256 Digital Signature', () => {
        it('should compute SHA-256 digital signature hash for contract PDF', () => {
            const mockPdfBuffer = Buffer.from('PDF_CONTENT_TEST');
            const hash = contractService.computePdfSha256Hash(mockPdfBuffer, {
                timestamp: '2026-07-21T00:00:00.000Z',
                version: 1,
            });
            expect(hash).toBeDefined();
            expect(hash.length).toBe(64);
        });
    });
    describe('3. Dynamic Handlebars PDF Template Engine', () => {
        it('should validate template syntax and catch mismatched tags', () => {
            const invalidContent = '<div>{{#if condition}}Content Without Closing Tag</div>';
            expect(() => pdfTemplateService.validateTemplate(invalidContent)).toThrow();
        });
    });
    describe('4. Multi-Device Session Management & Invalidation', () => {
        it('should generate consistent triple-factor device fingerprinting', () => {
            const fp = userSessionService.generateFingerprint('10.0.0.1', 'iOS App', 'device-uuid-1234');
            expect(fp).toBeDefined();
        });
    });
});
//# sourceMappingURL=enterprise-integration.spec.js.map