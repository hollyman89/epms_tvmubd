import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsIn,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanyBankAccountType,
  CompanyBankAccountPurpose,
  CompanyBankAccountStatus,
} from '../../../entities/company-bank-account.entity';

export class CreateCompanyBankAccountDto {
  @ApiProperty({ example: 'UBD', enum: ['UBD', 'TVM'], description: 'Legal entity owner' })
  @IsIn(['UBD', 'TVM'], { message: "companyCode must be either 'UBD' or 'TVM'" })
  @IsNotEmpty({ message: 'companyCode is mandatory' })
  companyCode: 'UBD' | 'TVM';

  @ApiProperty({ example: 'BCA', description: 'Bank Name' })
  @IsString()
  @IsNotEmpty({ message: 'bankName is mandatory' })
  @MaxLength(100)
  bankName: string;

  @ApiPropertyOptional({ example: '014', description: 'Bank Code (clearing/BI/SWIFT)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  bankCode?: string;

  @ApiProperty({ example: '1234567890', description: 'Bank account number' })
  @IsString()
  @IsNotEmpty({ message: 'accountNumber is mandatory' })
  @MaxLength(50)
  accountNumber: string;

  @ApiProperty({ example: 'PT UBD', description: 'Account holder legal name' })
  @IsString()
  @IsNotEmpty({ message: 'accountHolderName is mandatory' })
  @MaxLength(200)
  accountHolderName: string;

  @ApiProperty({
    example: CompanyBankAccountType.GIRO,
    enum: CompanyBankAccountType,
    default: CompanyBankAccountType.GIRO,
  })
  @IsEnum(CompanyBankAccountType, { message: 'Invalid accountType' })
  @IsNotEmpty()
  accountType: CompanyBankAccountType;

  @ApiProperty({
    example: CompanyBankAccountPurpose.OPERATIONAL,
    enum: CompanyBankAccountPurpose,
    default: CompanyBankAccountPurpose.OPERATIONAL,
  })
  @IsEnum(CompanyBankAccountPurpose, { message: 'Invalid accountPurpose' })
  @IsNotEmpty()
  accountPurpose: CompanyBankAccountPurpose;

  @ApiPropertyOptional({ example: 'IDR', default: 'IDR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ example: '2026-01-01', description: 'Effective start date (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'effectiveDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'effectiveDate is mandatory' })
  effectiveDate: string;

  @ApiPropertyOptional({ example: '2030-12-31', description: 'Expiry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'expiryDate must be a valid ISO date string' })
  expiryDate?: string | null;

  @ApiPropertyOptional({ example: 'Finance Treasury Lead', description: 'PIC / Responsible Officer' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  picName?: string;

  @ApiPropertyOptional({ example: 'Rekening operasional utama' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'Pendaftaran rekening operasional baru PT UBD', description: 'Mandatory change reason' })
  @IsString()
  @IsNotEmpty({ message: 'changeReason is mandatory for change control audit' })
  changeReason: string;
}

export class UpdateCompanyBankAccountDto {
  @ApiPropertyOptional({ example: 'BCA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ example: '014' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  bankCode?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'PT UBD' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountHolderName?: string;

  @ApiPropertyOptional({ enum: CompanyBankAccountType })
  @IsOptional()
  @IsEnum(CompanyBankAccountType)
  accountType?: CompanyBankAccountType;

  @ApiPropertyOptional({ enum: CompanyBankAccountPurpose })
  @IsOptional()
  @IsEnum(CompanyBankAccountPurpose)
  accountPurpose?: CompanyBankAccountPurpose;

  @ApiPropertyOptional({ example: 'IDR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: CompanyBankAccountStatus })
  @IsOptional()
  @IsEnum(CompanyBankAccountStatus)
  status?: CompanyBankAccountStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ example: '2030-12-31' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @ApiPropertyOptional({ example: 'Treasury Admin' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  picName?: string;

  @ApiPropertyOptional({ example: 'Catatan pembaruan' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'Pembaruan nomor rekening operasional', description: 'Mandatory change reason' })
  @IsString()
  @IsNotEmpty({ message: 'changeReason is mandatory for change control audit' })
  changeReason: string;
}

export class ChangeCompanyBankAccountStatusDto {
  @ApiProperty({ example: 'Penonaktifan rekening operasional karena rekening baru aktif' })
  @IsString()
  @IsNotEmpty({ message: 'changeReason is mandatory for change control audit' })
  changeReason: string;
}

export class QueryCompanyBankAccountDto {
  @ApiPropertyOptional({ enum: ['UBD', 'TVM'] })
  @IsOptional()
  @IsIn(['UBD', 'TVM'])
  companyCode?: 'UBD' | 'TVM';

  @ApiPropertyOptional({ enum: CompanyBankAccountStatus })
  @IsOptional()
  @IsEnum(CompanyBankAccountStatus)
  status?: CompanyBankAccountStatus;

  @ApiPropertyOptional({ enum: CompanyBankAccountPurpose })
  @IsOptional()
  @IsEnum(CompanyBankAccountPurpose)
  purpose?: CompanyBankAccountPurpose;

  @ApiPropertyOptional({ example: 'BCA' })
  @IsOptional()
  @IsString()
  search?: string;
}
