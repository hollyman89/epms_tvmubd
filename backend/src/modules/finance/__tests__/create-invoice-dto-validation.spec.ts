import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';

describe('CreateInvoiceDto ValidationPipe Contract Hardening', () => {
  let pipe: ValidationPipe;
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateInvoiceDto,
    data: '',
  };

  beforeAll(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  const baseValidPayload = {
    purchaseOrderId: 10,
    paymentTermId: 201,
    invoiceDate: '2026-11-13T08:00:00.000Z',
    items: [
      {
        poItemId: 101,
        quantity: 1,
        unitPrice: 30000000,
        totalPrice: 30000000,
      },
    ],
  };

  it('1. accepts invoice without tax data', async () => {
    const payload = { ...baseValidPayload };
    const transformed = await pipe.transform(payload, metadata);
    expect(transformed).toBeDefined();
    expect(transformed.purchaseOrderId).toBe(10);
    expect(transformed.tax).toBeUndefined();
  });

  it('2. accepts invoice with PPN only', async () => {
    const payload = {
      ...baseValidPayload,
      tax: {
        ppn: {
          fakturPajakNumber: '010.000-26.12345678',
          fakturPajakDate: '2026-11-13',
          dppAmount: 30000000,
          ppnRate: 11,
          ppnAmount: 3300000,
        },
      },
    };
    const transformed = await pipe.transform(payload, metadata);
    expect(transformed.tax).toBeDefined();
    expect(transformed.tax.ppn?.fakturPajakNumber).toBe('010.000-26.12345678');
    expect(transformed.tax.pph).toBeUndefined();
  });

  it('3. accepts invoice with PPh only', async () => {
    const payload = {
      ...baseValidPayload,
      tax: {
        pph: {
          pphType: 'PPH_23',
          rate: 2,
          taxableBase: 30000000,
          withheldAmount: 600000,
          buktiPotongNumber: 'BP-2026-001',
          buktiPotongDate: '2026-11-13',
        },
      },
    };
    const transformed = await pipe.transform(payload, metadata);
    expect(transformed.tax).toBeDefined();
    expect(transformed.tax.pph?.pphType).toBe('PPH_23');
    expect(transformed.tax.ppn).toBeUndefined();
  });

  it('4. accepts invoice with both PPN and PPh (Exact Frontend Issuance Payload)', async () => {
    const exactFrontendPayload = {
      purchaseOrderId: 10,
      paymentTermId: 201,
      invoiceDate: '2026-11-13T08:00:00.000Z',
      items: [
        {
          poItemId: 101,
          quantity: 1,
          unitPrice: 30000000,
          totalPrice: 30000000,
        },
      ],
      tax: {
        ppn: {
          fakturPajakNumber: '010.000-26.12345678',
          fakturPajakDate: '2026-11-13',
          dppAmount: 30000000,
          ppnRate: 11,
          ppnAmount: 3300000,
        },
        pph: {
          pphType: 'PPH_23',
          rate: 2,
          taxableBase: 30000000,
          withheldAmount: 600000,
          buktiPotongNumber: 'BP-2026-001',
          buktiPotongDate: '2026-11-13',
        },
      },
    };
    const transformed = await pipe.transform(exactFrontendPayload, metadata);
    expect(transformed.tax).toBeDefined();
    expect(transformed.tax.ppn?.fakturPajakNumber).toBe('010.000-26.12345678');
    expect(transformed.tax.pph?.withheldAmount).toBe(600000);
  });

  it('5. strictly rejects non-whitelisted properties in body or nested objects', async () => {
    const payloadWithInvalidProp = {
      ...baseValidPayload,
      unknownProp: 'malicious',
    };
    await expect(pipe.transform(payloadWithInvalidProp, metadata)).rejects.toThrow(BadRequestException);

    const payloadWithInvalidNested = {
      ...baseValidPayload,
      tax: {
        unknownTaxProp: 123,
      },
    };
    await expect(pipe.transform(payloadWithInvalidNested, metadata)).rejects.toThrow(BadRequestException);
  });

  it('6. strictly validates NSFP via DTO Match decorator', async () => {
    const invalidNsfpPayload = {
      ...baseValidPayload,
      tax: {
        ppn: {
          fakturPajakNumber: '1234', // invalid NSFP (< 16 digits)
        },
      },
    };
    await expect(pipe.transform(invalidNsfpPayload, metadata)).rejects.toThrow(BadRequestException);
  });

  it('7. accepts valid formatted NSFP (010.000-26.12345678) and raw 16-digit string', async () => {
    const formattedPayload = {
      ...baseValidPayload,
      tax: {
        ppn: {
          fakturPajakNumber: '010.000-26.12345678',
        },
      },
    };
    const resFormatted = await pipe.transform(formattedPayload, metadata);
    expect(resFormatted.tax?.ppn?.fakturPajakNumber).toBe('010.000-26.12345678');

    const rawPayload = {
      ...baseValidPayload,
      tax: {
        ppn: {
          fakturPajakNumber: '0100002612345678',
        },
      },
    };
    const resRaw = await pipe.transform(rawPayload, metadata);
    expect(resRaw.tax?.ppn?.fakturPajakNumber).toBe('0100002612345678');
  });
});
