import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWbsDto } from './dto/create-wbs.dto';

describe('WBS DTO Validation Specification', () => {
  it('CASE 1: should pass validation with valid weightPercentage and description', async () => {
    const dto = plainToInstance(CreateWbsDto, {
      projectId: 1,
      code: '1.0',
      name: 'Persiapan, Survey & Perizinan',
      level: 1,
      weightPercentage: 15.5,
      description: 'Site survey, koordinasi perizinan instansi & K3 operasional',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('CASE 2: should pass validation without weightPercentage and description (backward compatibility)', async () => {
    const dto = plainToInstance(CreateWbsDto, {
      projectId: 1,
      code: '2.0',
      name: 'Pengadaan Material & Perangkat',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('CASE 3: should block negative weightPercentage (< 0)', async () => {
    const dto = plainToInstance(CreateWbsDto, {
      projectId: 1,
      code: '1.0',
      name: 'Test Node',
      weightPercentage: -1,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'weightPercentage')).toBe(true);
  });

  it('CASE 4: should block weightPercentage > 100', async () => {
    const dto = plainToInstance(CreateWbsDto, {
      projectId: 1,
      code: '1.0',
      name: 'Test Node',
      weightPercentage: 100.01,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'weightPercentage')).toBe(true);
  });

  it('CASE 5: should block description > 500 characters', async () => {
    const dto = plainToInstance(CreateWbsDto, {
      projectId: 1,
      code: '1.0',
      name: 'Test Node',
      description: 'A'.repeat(501),
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'description')).toBe(true);
  });
});
