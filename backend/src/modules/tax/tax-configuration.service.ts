import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalEntityTaxProfile, PkpStatus } from '../../entities/legal-entity-tax-profile.entity';
import { VendorTaxProfile } from '../../entities/vendor-tax-profile.entity';
import { TaxRegimeRule, TaxCategory, TaxRuleVerificationStatus } from '../../entities/tax-regime-rule.entity';

@Injectable()
export class TaxConfigurationService {
  constructor(
    @InjectRepository(LegalEntityTaxProfile)
    private readonly legalEntityRepo: Repository<LegalEntityTaxProfile>,
    @InjectRepository(VendorTaxProfile)
    private readonly vendorTaxRepo: Repository<VendorTaxProfile>,
    @InjectRepository(TaxRegimeRule)
    private readonly taxRegimeRuleRepo: Repository<TaxRegimeRule>,
  ) {}

  async seedDefaultLegalProfiles(): Promise<LegalEntityTaxProfile[]> {
    const defaultProfiles = [
      {
        companyCode: 'UBD',
        legalEntityName: 'PT Urus Bangun Digital',
        npwp16: '0123456789012345',
        nitku: '000000',
        kppPratamaName: 'KPP Pratama Bandung Cibeunying',
        pkpStatus: PkpStatus.UNVERIFIED,
        isWapu: false,
        defaultTaxCurrency: 'IDR',
        isActive: true,
      },
      {
        companyCode: 'TVM',
        legalEntityName: 'PT Trans Visi Media',
        npwp16: '9876543210987654',
        nitku: '000000',
        kppPratamaName: 'KPP Pratama Jakarta Selatan',
        pkpStatus: PkpStatus.UNVERIFIED,
        isWapu: false,
        defaultTaxCurrency: 'IDR',
        isActive: true,
      },
    ];

    const results: LegalEntityTaxProfile[] = [];
    for (const p of defaultProfiles) {
      let existing = await this.legalEntityRepo.findOne({ where: { companyCode: p.companyCode } });
      if (!existing) {
        existing = this.legalEntityRepo.create(p);
        existing = await this.legalEntityRepo.save(existing);
      }
      results.push(existing);
    }
    return results;
  }

  async seedDefaultTaxRules(verifiedByUserId: number): Promise<TaxRegimeRule[]> {
    const rules = [
      {
        regimeCode: 'PPN_11',
        taxCategory: TaxCategory.PPN,
        articleReference: 'UU HPP Pasal 7 ayat (1) huruf a',
        statutoryRate: 0.11,
        effectiveRateMultiplier: 1.0,
        governingRegulation: 'UU No. 7 Tahun 2021 (Harmonisasi Peraturan Perpajakan)',
        effectiveFrom: '2022-04-01',
        version: 1,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
      {
        regimeCode: 'PPN_12',
        taxCategory: TaxCategory.PPN,
        articleReference: 'UU HPP Pasal 7 ayat (1) huruf b',
        statutoryRate: 0.12,
        effectiveRateMultiplier: 1.0,
        governingRegulation: 'UU No. 7 Tahun 2021 (Harmonisasi Peraturan Perpajakan)',
        effectiveFrom: '2025-01-01',
        version: 1,
        isActive: false, // inactive until statutory effective date
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
      {
        regimeCode: 'PPH_23_SERVICE',
        taxCategory: TaxCategory.PPH,
        articleReference: 'UU PPh Pasal 23 ayat (1) huruf c stdtd UU HPP & PMK 141/2015',
        statutoryRate: 0.02,
        effectiveRateMultiplier: 1.0,
        governingRegulation: 'PMK No. 141/PMK.03/2015',
        effectiveFrom: '2020-01-01',
        version: 1,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
      {
        regimeCode: 'PPH_FINAL_KONSTRUKSI_KECIL',
        taxCategory: TaxCategory.PPH,
        articleReference: 'PP 9/2022 Pasal 3 ayat (1) huruf a',
        statutoryRate: 0.0175,
        effectiveRateMultiplier: 1.0,
        governingRegulation: 'PP No. 9 Tahun 2022 Pelaksanaan Jasa Konstruksi',
        effectiveFrom: '2022-02-21',
        version: 1,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
      {
        regimeCode: 'PPH_FINAL_KONSTRUKSI_MENENGAH_BESAR',
        taxCategory: TaxCategory.PPH,
        articleReference: 'PP 9/2022 Pasal 3 ayat (1) huruf b',
        statutoryRate: 0.0265,
        effectiveRateMultiplier: 1.0,
        governingRegulation: 'PP No. 9 Tahun 2022 Pelaksanaan Jasa Konstruksi',
        effectiveFrom: '2022-02-21',
        version: 1,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
      {
        regimeCode: 'PPH_FINAL_KONSTRUKSI_NON_KUALIFIKASI',
        taxCategory: TaxCategory.PPH,
        articleReference: 'PP 9/2022 Pasal 3 ayat (1) huruf c',
        statutoryRate: 0.04,
        effectiveRateMultiplier: 1.0,
        governingRegulation: 'PP No. 9 Tahun 2022 Pelaksanaan Jasa Konstruksi',
        effectiveFrom: '2022-02-21',
        version: 1,
        isActive: true,
        verificationStatus: TaxRuleVerificationStatus.VERIFIED,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
    ];

    const results: TaxRegimeRule[] = [];
    for (const r of rules) {
      let existing = await this.taxRegimeRuleRepo.findOne({
        where: { regimeCode: r.regimeCode, version: r.version },
      });
      if (!existing) {
        existing = this.taxRegimeRuleRepo.create(r);
        existing = await this.taxRegimeRuleRepo.save(existing);
      }
      results.push(existing);
    }
    return results;
  }
}

