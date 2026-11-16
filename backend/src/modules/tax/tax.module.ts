import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalEntityTaxProfile } from '../../entities/legal-entity-tax-profile.entity';
import { VendorTaxProfile } from '../../entities/vendor-tax-profile.entity';
import { TaxRegimeRule } from '../../entities/tax-regime-rule.entity';
import { InvoiceTaxDetail } from '../../entities/invoice-tax-detail.entity';
import { InvoiceItemTaxDetail } from '../../entities/invoice-item-tax-detail.entity';
import { PpnMasukanRecord } from '../../entities/ppn-masukan-record.entity';
import { PphWithholdingRecord } from '../../entities/pph-withholding-record.entity';
import { StatutoryTaxLiability } from '../../entities/statutory-tax-liability.entity';
import { TaxRemittanceRecord } from '../../entities/tax-remittance-record.entity';
import { TaxRemittanceAllocation } from '../../entities/tax-remittance-allocation.entity';
import { TaxSupportingDocument } from '../../entities/tax-supporting-document.entity';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { Vendor } from '../../entities/vendor.entity';
import { PoPaymentTerm } from '../../entities/po-payment-term.entity';
import { TaxDeterminationService } from './tax-determination.service';
import { TaxRemittanceService } from './tax-remittance.service';
import { TaxConfigurationService } from './tax-configuration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LegalEntityTaxProfile,
      VendorTaxProfile,
      TaxRegimeRule,
      InvoiceTaxDetail,
      InvoiceItemTaxDetail,
      PpnMasukanRecord,
      PphWithholdingRecord,
      StatutoryTaxLiability,
      TaxRemittanceRecord,
      TaxRemittanceAllocation,
      TaxSupportingDocument,
      Invoice,
      InvoiceItem,
      PurchaseOrder,
      Vendor,
      PoPaymentTerm,
    ]),
  ],
  providers: [
    TaxDeterminationService,
    TaxRemittanceService,
    TaxConfigurationService,
  ],
  exports: [
    TaxDeterminationService,
    TaxRemittanceService,
    TaxConfigurationService,
    TypeOrmModule,
  ],
})
export class TaxModule {}

