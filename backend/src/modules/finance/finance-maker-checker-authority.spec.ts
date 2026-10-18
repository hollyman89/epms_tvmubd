import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentRequestStatus } from '../../entities/payment-request.entity';
import { DirectorDecisionAction } from './dto/decide-payment-request.dto';

describe('Finance Maker / Checker / Executor Canonical Authority Matrix (Phase 7)', () => {
  // Canonical Actors
  const FINANCE_MAKER_ID = 3;
  const FINANCE_EXECUTOR_ID = 3; // Single canonical finance account handles maker + executor
  const DIRECTOR_CHECKER_ID = 2;
  const ADMIN_ID = 10;
  const SUPER_ADMIN_ID = 1;

  // Domain authority boundary functions modeling canonical EPMS Finance rules
  class CanonicalFinanceWorkflowEngine {
    private paymentRequests: Map<number, any> = new Map();
    private invoices: Map<number, any> = new Map();
    private payments: Map<number, any> = new Map();

    createInvoice(dto: { poId: number; paymentTermId?: number; totalAmount: number }, actor: { id: number; role: string }) {
      if (actor.role !== 'FINANCE' && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
        throw new ForbiddenException('Hanya FINANCE yang dapat membuat invoice.');
      }
      const id = this.invoices.size + 1;
      const invoice = {
        id,
        poId: dto.poId,
        paymentTermId: dto.paymentTermId,
        totalAmount: dto.totalAmount,
        createdBy: actor.id,
        matchStatus: 'PENDING',
        paymentStatus: 'UNPAID',
      };
      this.invoices.set(id, invoice);
      return invoice;
    }

    verifyInvoice(
      invoiceId: number,
      dto: { approved: boolean; goodsReceiptId?: number; evidenceRef?: string; poItems?: any[]; grItems?: any[]; invoiceItems?: any[] },
      actor: { id: number; role: string }
    ) {
      if (actor.role !== 'FINANCE' && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
        throw new ForbiddenException('Hanya FINANCE yang dapat memverifikasi invoice.');
      }
      const invoice = this.invoices.get(invoiceId);
      if (!invoice) throw new BadRequestException('Invoice tidak ditemukan.');

      // Canonical EPMS rule: Finance creator == Finance invoice verifier is ALLOWED
      // (NO self-verification block)

      // 3-Way Match integrity validation
      if (dto.invoiceItems && dto.grItems) {
        for (const invItem of dto.invoiceItems) {
          const grItem = dto.grItems.find((g: any) => g.poItemId === invItem.poItemId);
          if (!grItem) {
            throw new BadRequestException('Item invoice tidak ditemukan pada Goods Receipt (GR).');
          }
          if (invItem.quantity > grItem.receivedQuantity) {
            throw new BadRequestException('Kuantitas invoice melebihi kuantitas penerimaan barang fisik (GR).');
          }
          if (invItem.unitPrice !== invItem.poUnitPrice) {
            throw new BadRequestException('Harga satuan invoice tidak sesuai dengan Purchase Order.');
          }
        }
      }

      if (!dto.approved) {
        invoice.matchStatus = 'REJECTED';
        return invoice;
      }

      invoice.matchStatus = 'VERIFIED';
      invoice.updatedBy = actor.id;
      return invoice;
    }

    submitPaymentRequest(
      dto: { invoiceId: number; paymentTermId?: number; requestedAmount: number; bankName?: string },
      actor: { id: number; role: string }
    ) {
      if (actor.role !== 'FINANCE') {
        throw new ForbiddenException('Hanya peran FINANCE yang berhak mengajukan persetujuan pembayaran.');
      }
      const invoice = this.invoices.get(dto.invoiceId);
      if (!invoice) throw new BadRequestException('Invoice tidak ditemukan.');
      if (invoice.matchStatus !== 'VERIFIED' && invoice.matchStatus !== 'MATCHED') {
        throw new BadRequestException('Invoice belum terverifikasi / lolos 3-way match.');
      }

      const id = this.paymentRequests.size + 1;
      const request = {
        id,
        requestNumber: `PRQ-20261015-00${id}`,
        invoiceId: dto.invoiceId,
        paymentTermId: dto.paymentTermId,
        requestedAmount: dto.requestedAmount,
        status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL,
        requestedBy: actor.id,
      };
      this.paymentRequests.set(id, request);
      return request;
    }

    decidePaymentRequest(
      requestId: number,
      dto: { action: DirectorDecisionAction; revisionNotes?: string; rejectionReason?: string; approvedAmount?: number },
      actor: { id: number; role: string }
    ) {
      // Rule: ONLY DIRECTOR can business-approve / decide Payment Request
      if (actor.role !== 'DIRECTOR') {
        throw new ForbiddenException(
          `Prinsip Segregation of Duties: Peran ${actor.role} tidak berhak memutuskan Payment Request. Keputusan pembayaran merupakan wewenang mutlak DIREKTUR.`
        );
      }

      const request = this.paymentRequests.get(requestId);
      if (!request) throw new BadRequestException('Payment Request tidak ditemukan.');

      if (dto.action === DirectorDecisionAction.APPROVE) {
        request.status = PaymentRequestStatus.APPROVED_FOR_PAYMENT;
        request.approvedBy = actor.id;
        request.approvedAmount = dto.approvedAmount || request.requestedAmount;
      } else if (dto.action === DirectorDecisionAction.RETURN) {
        if (!dto.revisionNotes) throw new BadRequestException('Catatan revisi wajib diisi saat meminta revisi.');
        request.status = PaymentRequestStatus.NEEDS_REVISION;
        request.revisionNotes = dto.revisionNotes;
      } else if (dto.action === DirectorDecisionAction.REJECT) {
        if (!dto.rejectionReason) throw new BadRequestException('Alasan penolakan wajib diisi saat menolak pembayaran.');
        request.status = PaymentRequestStatus.REJECTED;
        request.rejectionReason = dto.rejectionReason;
      }
      return request;
    }

    executePayment(
      dto: { invoiceId: number; paymentRequestId?: number; paymentAmount: number; paymentMethod: string; referenceNumber: string },
      actor: { id: number; role: string }
    ) {
      // Rule: DIRECTOR cannot execute operational payment
      if (actor.role === 'DIRECTOR') {
        throw new ForbiddenException('Prinsip SoD: Direktur (Approver) dilarang mengeksekusi pembayaran operasional.');
      }
      if (actor.role !== 'FINANCE') {
        throw new ForbiddenException('Hanya FINANCE yang berhak mengeksekusi pembayaran.');
      }

      const invoice = this.invoices.get(dto.invoiceId);
      if (!invoice) throw new BadRequestException('Invoice tidak ditemukan.');

      // Check Payment Request status gating
      if (dto.paymentRequestId) {
        const prq = this.paymentRequests.get(dto.paymentRequestId);
        if (!prq || prq.status !== PaymentRequestStatus.APPROVED_FOR_PAYMENT) {
          throw new BadRequestException('Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).');
        }
      } else {
        // Direct invoice gating
        if (invoice.matchStatus !== 'VERIFIED' && invoice.matchStatus !== 'MATCHED') {
          throw new BadRequestException('Invoice belum disetujui untuk pembayaran');
        }
      }

      const paymentId = this.payments.size + 1;
      const payment = {
        id: paymentId,
        invoiceId: dto.invoiceId,
        amount: dto.paymentAmount,
        status: 'PAID',
        executedBy: actor.id,
      };
      this.payments.set(paymentId, payment);
      invoice.paymentStatus = 'PAID';
      invoice.status = 'PAID';
      return payment;
    }
  }

  let engine: CanonicalFinanceWorkflowEngine;

  beforeEach(() => {
    engine = new CanonicalFinanceWorkflowEngine();
  });

  // 1. Finance can create invoice
  it('1. Finance can create invoice: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    expect(invoice).toBeDefined();
    expect(invoice.createdBy).toBe(FINANCE_MAKER_ID);
    expect(invoice.matchStatus).toBe('PENDING');
  });

  // 2. Same Finance user can verify own created invoice
  it('2. Same Finance user can verify own created invoice: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    const verified = engine.verifyInvoice(
      invoice.id,
      { approved: true, goodsReceiptId: 1, evidenceRef: 'GR-20261015-001' },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' } // Exact same Finance user
    );
    expect(verified.matchStatus).toBe('VERIFIED');
    expect(verified.updatedBy).toBe(FINANCE_MAKER_ID);
  });

  // 3. 3-Way Match integrity remains enforced
  it('3. 3-Way Match integrity remains enforced: DENY mismatch', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    // Quantity mismatch: invoice 1514 > GR received 1513
    expect(() =>
      engine.verifyInvoice(
        invoice.id,
        {
          approved: true,
          invoiceItems: [{ poItemId: 1, quantity: 1514, unitPrice: 70000, poUnitPrice: 70000 }],
          grItems: [{ poItemId: 1, receivedQuantity: 1513 }],
        },
        { id: FINANCE_MAKER_ID, role: 'FINANCE' }
      )
    ).toThrow('Kuantitas invoice melebihi kuantitas penerimaan barang fisik (GR).');

    // Price mismatch: invoice price 75000 != PO price 70000
    expect(() =>
      engine.verifyInvoice(
        invoice.id,
        {
          approved: true,
          invoiceItems: [{ poItemId: 1, quantity: 1513, unitPrice: 75000, poUnitPrice: 70000 }],
          grItems: [{ poItemId: 1, receivedQuantity: 1513 }],
        },
        { id: FINANCE_MAKER_ID, role: 'FINANCE' }
      )
    ).toThrow('Harga satuan invoice tidak sesuai dengan Purchase Order.');
  });

  // 4. Finance can submit Payment Request
  it('4. Finance can submit Payment Request: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });

    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000, bankName: 'Bank Mandiri' },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    expect(prq).toBeDefined();
    expect(prq.status).toBe(PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL);
    expect(prq.requestedBy).toBe(FINANCE_MAKER_ID);
  });

  // 5. Finance cannot approve Payment Request
  it('5. Finance cannot approve Payment Request: DENY (SoD boundary)', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    expect(() =>
      engine.decidePaymentRequest(
        prq.id,
        { action: DirectorDecisionAction.APPROVE },
        { id: FINANCE_MAKER_ID, role: 'FINANCE' }
      )
    ).toThrow(ForbiddenException);
  });

  // 6. Director can approve Payment Request
  it('6. Director can approve Payment Request: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    const approved = engine.decidePaymentRequest(
      prq.id,
      { action: DirectorDecisionAction.APPROVE },
      { id: DIRECTOR_CHECKER_ID, role: 'DIRECTOR' }
    );
    expect(approved.status).toBe(PaymentRequestStatus.APPROVED_FOR_PAYMENT);
    expect(approved.approvedBy).toBe(DIRECTOR_CHECKER_ID);
  });

  // 7. Director can return Payment Request
  it('7. Director can return Payment Request: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    const returned = engine.decidePaymentRequest(
      prq.id,
      { action: DirectorDecisionAction.RETURN, revisionNotes: 'Mohon konfirmasi rekening vendor' },
      { id: DIRECTOR_CHECKER_ID, role: 'DIRECTOR' }
    );
    expect(returned.status).toBe(PaymentRequestStatus.NEEDS_REVISION);
    expect(returned.revisionNotes).toBe('Mohon konfirmasi rekening vendor');
  });

  // 8. Director can reject Payment Request
  it('8. Director can reject Payment Request: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    const rejected = engine.decidePaymentRequest(
      prq.id,
      { action: DirectorDecisionAction.REJECT, rejectionReason: 'Kontrak dibatalkan' },
      { id: DIRECTOR_CHECKER_ID, role: 'DIRECTOR' }
    );
    expect(rejected.status).toBe(PaymentRequestStatus.REJECTED);
    expect(rejected.rejectionReason).toBe('Kontrak dibatalkan');
  });

  // 9. Finance cannot execute payment before Director approval
  it('9. Finance cannot execute payment before Director approval: DENY', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    // prq is still PENDING_DIRECTOR_APPROVAL
    expect(() =>
      engine.executePayment(
        {
          invoiceId: invoice.id,
          paymentRequestId: prq.id,
          paymentAmount: 117500000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRX-001',
        },
        { id: FINANCE_EXECUTOR_ID, role: 'FINANCE' }
      )
    ).toThrow('Pembayaran ditolak: Payment Request belum disetujui oleh Direktur (APPROVED_FOR_PAYMENT).');
  });

  // 10. Finance can execute after APPROVED_FOR_PAYMENT
  it('10. Finance can execute after APPROVED_FOR_PAYMENT: ALLOW', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.decidePaymentRequest(
      prq.id,
      { action: DirectorDecisionAction.APPROVE },
      { id: DIRECTOR_CHECKER_ID, role: 'DIRECTOR' }
    );

    const payment = engine.executePayment(
      {
        invoiceId: invoice.id,
        paymentRequestId: prq.id,
        paymentAmount: 117500000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'TRX-001',
      },
      { id: FINANCE_EXECUTOR_ID, role: 'FINANCE' }
    );
    expect(payment.status).toBe('PAID');
    expect(payment.amount).toBe(117500000);
  });

  // 11. Director cannot execute Finance payment
  it('11. Director cannot execute Finance payment: DENY', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.decidePaymentRequest(
      prq.id,
      { action: DirectorDecisionAction.APPROVE },
      { id: DIRECTOR_CHECKER_ID, role: 'DIRECTOR' }
    );

    expect(() =>
      engine.executePayment(
        {
          invoiceId: invoice.id,
          paymentRequestId: prq.id,
          paymentAmount: 117500000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRX-001',
        },
        { id: DIRECTOR_CHECKER_ID, role: 'DIRECTOR' }
      )
    ).toThrow(ForbiddenException);
  });

  // 12. ADMIN cannot business-approve
  it('12. ADMIN cannot business-approve Payment Request: DENY', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    expect(() =>
      engine.decidePaymentRequest(
        prq.id,
        { action: DirectorDecisionAction.APPROVE },
        { id: ADMIN_ID, role: 'ADMIN' }
      )
    ).toThrow(ForbiddenException);
  });

  // 13. SUPER_ADMIN cannot business-approve
  it('13. SUPER_ADMIN cannot business-approve Payment Request: DENY', () => {
    const invoice = engine.createInvoice(
      { poId: 1, paymentTermId: 1, totalAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );
    engine.verifyInvoice(invoice.id, { approved: true }, { id: FINANCE_MAKER_ID, role: 'FINANCE' });
    const prq = engine.submitPaymentRequest(
      { invoiceId: invoice.id, paymentTermId: 1, requestedAmount: 117500000 },
      { id: FINANCE_MAKER_ID, role: 'FINANCE' }
    );

    expect(() =>
      engine.decidePaymentRequest(
        prq.id,
        { action: DirectorDecisionAction.APPROVE },
        { id: SUPER_ADMIN_ID, role: 'SUPER_ADMIN' }
      )
    ).toThrow(ForbiddenException);
  });
});
