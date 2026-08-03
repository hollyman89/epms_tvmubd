import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseRequest) private prRepo: Repository<PurchaseRequest>
  ) {}

  async getSummary() {
    this.logger.log('Fetching dashboard summary from DB...');
    
    // 1. Total Projects (Active/Running)
    const totalProjects = await this.projectRepo.count({
      where: { status: 'ACTIVE' }
    });

    // 2. Total Revenue (Sum of all payments) - Assuming Payments = Revenue
    const revenueResult = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount_paid)', 'total')
      .getRawOne();
    const totalRevenue = revenueResult?.total ? parseFloat(revenueResult.total) : 0;

    // 3. Average Profit Margin
    // Average Profit Margin Mock
    // Since project_budgets doesn't exist and project doesn't have a budget column, 
    // we'll mock the total budget to 5,000,000,000 to demonstrate the calculation properly.
    const totalBudget = 5000000000;
    
    const poResult = await this.poRepo
      .createQueryBuilder('po')
      .select('SUM(po.total_amount)', 'totalExpense')
      .getRawOne();
      
    const totalExpense = poResult?.totalExpense ? parseFloat(poResult.totalExpense) : 0;
    
    let avgProfitMargin = 0;
    if (totalBudget > 0) {
      avgProfitMargin = ((totalBudget - totalExpense) / totalBudget) * 100;
      // Cap at 100 for display sanity if expense is negative somehow
      avgProfitMargin = Math.min(100, Math.max(0, avgProfitMargin)); 
    } else {
      // Mock for display if no data
      avgProfitMargin = 25.5; 
    }

    // 4. Pending Approvals (Substituting workflow_tasks with PRs and POs waiting for action)
    const pendingPRs = await this.prRepo.count({ where: { status: 'DRAFT' } });
    const pendingPOs = await this.poRepo.count({ where: { status: 'DRAFT' } });
    const pendingApprovals = pendingPRs + pendingPOs;

    // Mock On Time Rate for demo
    const onTimeRate = 92.4; 

    return {
      totalProjects,
      totalRevenue,
      avgProfitMargin: parseFloat(avgProfitMargin.toFixed(2)),
      pendingApprovals,
      onTimeRate
    };
  }

  async getProjectTrend() {
    // Generate trend data for the last 30 days based on projects table
    // For demo purposes and since we might not have 30 days of data, we'll mock a realistic trend
    const trend = [];
    const today = new Date();
    
    for (let i = 30; i >= 0; i -= 3) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      
      // Mocking progressive data
      const completed = Math.floor(Math.random() * 5) + Math.floor((30 - i) / 2);
      const onHold = Math.floor(Math.random() * 3);
      
      trend.push({
        date: d.toISOString().split('T')[0],
        type: 'Selesai',
        value: completed
      });
      trend.push({
        date: d.toISOString().split('T')[0],
        type: 'Tertahan',
        value: onHold
      });
    }

    return trend;
  }

  async getProcurementPending() {
    // Fetch PRs that are DRAFT
    const prs = await this.prRepo.find({
      where: { status: 'DRAFT' },
      order: { createdAt: 'ASC' },
      take: 10
    });

    const pos = await this.poRepo.find({
      where: { status: 'DRAFT' },
      order: { createdAt: 'ASC' },
      take: 10
    });

    const pendingList = [
      ...prs.map(pr => ({
        id: `PR-${pr.id}`,
        type: 'Purchase Request',
        number: pr.prNumber,
        date: pr.createdAt,
        status: 'Menunggu Persetujuan'
      })),
      ...pos.map(po => ({
        id: `PO-${po.id}`,
        type: 'Purchase Order',
        number: po.poNumber,
        date: po.createdAt,
        status: 'Menunggu Persetujuan Manajer'
      }))
    ];

    // Sort by oldest first
    return pendingList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
  }
}
