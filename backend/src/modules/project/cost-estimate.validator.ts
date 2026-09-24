import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SaveCostEstimateDto,
  CostCategoryDto,
  CostItemDto,
  CostCategoryKey,
  CostGroupKey,
} from './dto/save-cost-estimate.dto';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';

export interface ValidatedCostItemResult {
  id?: number;
  itemName: string;
  description?: string;
  quantity: number;
  uom: string;
  rateType?: string;
  unitPrice: number;
  subtotal: number;
  resourceType?: string;
  costSource?: string;
  assignmentScope: 'WBS' | 'PROJECT' | 'UNASSIGNED';
  wbsId?: number | null;
  notes?: string;
}

export interface ValidatedCategoryResult {
  categoryKey: CostCategoryKey;
  categoryLabel?: string;
  groupKey: CostGroupKey;
  mode: 'DIRECT' | 'ITEMIZED';
  directSubtotal: number;
  categoryTotal: number;
  items: ValidatedCostItemResult[];
}

export interface ValidatedCostEstimateCalculation {
  projectId: number;
  pmNotes?: string;
  directTotal: number;
  indirectTotal: number;
  riskTotal: number;
  totalPmEstimate: number;
  categories: ValidatedCategoryResult[];
}

export const CATEGORY_GROUP_MAP: Record<CostCategoryKey, CostGroupKey> = {
  MATERIAL: 'DIRECT',
  LABOR: 'DIRECT',
  SUBCONTRACTOR: 'DIRECT',
  EQUIPMENT: 'INDIRECT',
  PERMIT: 'INDIRECT',
  OPERATIONAL: 'INDIRECT',
  CONTINGENCY: 'RISK',
};

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(qty: number): number {
  return Math.round((Number(qty) + Number.EPSILON) * 10000) / 10000;
}

@Injectable()
export class CostEstimateValidator {
  /**
   * Authoritatively validates the SaveCostEstimateDto, verifies WBS ownership and leaf-node rules,
   * ignores any client-sent subtotals/totals, and computes canonical server totals.
   *
   * @param projectId - Canonical Project ID from route/service context
   * @param dto - SaveCostEstimateDto from request body
   * @param activeWbsNodes - Active (non-deleted) WBS records for this project
   */
  public validateAndCompute(
    projectId: number,
    dto: SaveCostEstimateDto,
    activeWbsNodes: WorkBreakdownStructure[] = [],
  ): ValidatedCostEstimateCalculation {
    if (!projectId || projectId <= 0) {
      throw new BadRequestException('Project ID tidak valid');
    }

    if (!dto.categories || !Array.isArray(dto.categories) || dto.categories.length === 0) {
      throw new BadRequestException('Categories tidak boleh kosong. Minimal memiliki 1 kategori biaya.');
    }

    // Index active WBS nodes for this specific project and identify parents (non-leaves)
    const wbsMap = new Map<number, WorkBreakdownStructure>();
    const parentWbsIds = new Set<number>();

    for (const wbs of activeWbsNodes) {
      if (Number(wbs.projectId) === Number(projectId)) {
        wbsMap.set(Number(wbs.id), wbs);
        if (wbs.parentWbsId) {
          parentWbsIds.add(Number(wbs.parentWbsId));
        }
      }
    }

    const validatedCategories: ValidatedCategoryResult[] = [];
    let directTotal = 0;
    let indirectTotal = 0;
    let riskTotal = 0;

    for (const cat of dto.categories) {
      const groupKey = CATEGORY_GROUP_MAP[cat.categoryKey] || cat.groupKey || 'DIRECT';

      if (cat.mode === 'DIRECT') {
        const directSub = cat.directSubtotal !== undefined ? Number(cat.directSubtotal) : 0;
        if (!Number.isFinite(directSub) || Number.isNaN(directSub)) {
          throw new BadRequestException(`Kategori '${cat.categoryKey}': directSubtotal harus berupa angka yang valid.`);
        }
        if (directSub < 0) {
          throw new BadRequestException(`Kategori '${cat.categoryKey}': directSubtotal tidak boleh negatif.`);
        }

        const canonicalCategoryTotal = roundMoney(directSub);

        validatedCategories.push({
          categoryKey: cat.categoryKey,
          categoryLabel: cat.categoryLabel,
          groupKey,
          mode: 'DIRECT',
          directSubtotal: canonicalCategoryTotal,
          categoryTotal: canonicalCategoryTotal,
          items: [],
        });

        if (groupKey === 'DIRECT') directTotal += canonicalCategoryTotal;
        else if (groupKey === 'INDIRECT') indirectTotal += canonicalCategoryTotal;
        else if (groupKey === 'RISK') riskTotal += canonicalCategoryTotal;
      } else if (cat.mode === 'ITEMIZED') {
        const items = cat.items || [];
        const validatedItems: ValidatedCostItemResult[] = [];
        let runningCategoryTotal = 0;

        for (const item of items) {
          const itemName = (item.itemName || '').trim();
          if (!itemName) {
            throw new BadRequestException(`Kategori '${cat.categoryKey}': Nama item biaya tidak boleh kosong.`);
          }

          const qty = Number(item.quantity);
          if (!Number.isFinite(qty) || Number.isNaN(qty)) {
            throw new BadRequestException(`Cost item '${itemName}': quantity harus berupa angka yang valid.`);
          }
          if (qty < 0) {
            throw new BadRequestException(`Cost item '${itemName}': quantity tidak boleh negatif.`);
          }

          const price = Number(item.unitPrice);
          if (!Number.isFinite(price) || Number.isNaN(price)) {
            throw new BadRequestException(`Cost item '${itemName}': unitPrice harus berupa angka yang valid.`);
          }
          if (price < 0) {
            throw new BadRequestException(`Cost item '${itemName}': unitPrice tidak boleh negatif.`);
          }

          // Canonical server-side subtotal computation (client subtotal is explicitly ignored)
          const canonicalSubtotal = roundMoney(qty * price);
          runningCategoryTotal += canonicalSubtotal;

          // Validate Assignment Scope Matrix
          if (item.assignmentScope === 'WBS') {
            if (item.wbsId === undefined || item.wbsId === null) {
              throw new BadRequestException(`Cost item '${itemName}': assignmentScope WBS membutuhkan wbsId.`);
            }

            const targetWbsId = Number(item.wbsId);
            const targetWbs = wbsMap.get(targetWbsId);

            if (!targetWbs) {
              throw new BadRequestException(
                `Cost item '${itemName}': WBS #${targetWbsId} tidak ditemukan, bukan milik project #${projectId}, atau sudah tidak aktif.`,
              );
            }

            if (parentWbsIds.has(targetWbsId)) {
              throw new BadRequestException(
                `Cost item '${itemName}': WBS #${targetWbsId} ('${targetWbs.code} - ${targetWbs.name}') bukan leaf node. Biaya hanya boleh dialokasikan ke WBS deliverable tingkat akhir.`,
              );
            }

            validatedItems.push({
              id: item.id ? Number(item.id) : undefined,
              itemName,
              description: item.description,
              quantity: roundQuantity(qty),
              uom: item.uom || 'Unit',
              rateType: item.rateType || 'UNIT_RATE',
              unitPrice: roundMoney(price),
              subtotal: canonicalSubtotal,
              resourceType: item.resourceType,
              costSource: item.costSource || 'PM_ESTIMATE',
              assignmentScope: 'WBS',
              wbsId: targetWbsId,
              notes: item.notes,
            });
          } else if (item.assignmentScope === 'PROJECT') {
            if (item.wbsId !== undefined && item.wbsId !== null) {
              throw new BadRequestException(
                `Cost item '${itemName}': assignmentScope PROJECT tidak boleh memiliki wbsId.`,
              );
            }

            validatedItems.push({
              id: item.id ? Number(item.id) : undefined,
              itemName,
              description: item.description,
              quantity: roundQuantity(qty),
              uom: item.uom || 'Unit',
              rateType: item.rateType || 'UNIT_RATE',
              unitPrice: roundMoney(price),
              subtotal: canonicalSubtotal,
              resourceType: item.resourceType,
              costSource: item.costSource || 'PM_ESTIMATE',
              assignmentScope: 'PROJECT',
              wbsId: null,
              notes: item.notes,
            });
          } else if (item.assignmentScope === 'UNASSIGNED') {
            if (item.wbsId !== undefined && item.wbsId !== null) {
              throw new BadRequestException(
                `Cost item '${itemName}': assignmentScope UNASSIGNED tidak boleh memiliki wbsId.`,
              );
            }

            validatedItems.push({
              id: item.id ? Number(item.id) : undefined,
              itemName,
              description: item.description,
              quantity: roundQuantity(qty),
              uom: item.uom || 'Unit',
              rateType: item.rateType || 'UNIT_RATE',
              unitPrice: roundMoney(price),
              subtotal: canonicalSubtotal,
              resourceType: item.resourceType,
              costSource: item.costSource || 'PM_ESTIMATE',
              assignmentScope: 'UNASSIGNED',
              wbsId: null,
              notes: item.notes,
            });
          } else {
            throw new BadRequestException(
              `Cost item '${itemName}': assignmentScope '${item.assignmentScope}' tidak valid. Harus salah satu dari: WBS, PROJECT, UNASSIGNED.`,
            );
          }
        }

        const canonicalCategoryTotal = roundMoney(runningCategoryTotal);

        validatedCategories.push({
          categoryKey: cat.categoryKey,
          categoryLabel: cat.categoryLabel,
          groupKey,
          mode: 'ITEMIZED',
          directSubtotal: 0,
          categoryTotal: canonicalCategoryTotal,
          items: validatedItems,
        });

        if (groupKey === 'DIRECT') directTotal += canonicalCategoryTotal;
        else if (groupKey === 'INDIRECT') indirectTotal += canonicalCategoryTotal;
        else if (groupKey === 'RISK') riskTotal += canonicalCategoryTotal;
      }
    }

    directTotal = roundMoney(directTotal);
    indirectTotal = roundMoney(indirectTotal);
    riskTotal = roundMoney(riskTotal);
    const totalPmEstimate = roundMoney(directTotal + indirectTotal + riskTotal);

    return {
      projectId: Number(projectId),
      pmNotes: dto.pmNotes,
      directTotal,
      indirectTotal,
      riskTotal,
      totalPmEstimate,
      categories: validatedCategories,
    };
  }
}
