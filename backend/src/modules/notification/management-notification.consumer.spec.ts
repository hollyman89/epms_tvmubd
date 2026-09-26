import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ManagementNotificationConsumer } from './management-notification.consumer';
import { Notification } from '../../entities/notification.entity';
import { NotificationGateway } from './notification.gateway';

describe('ManagementNotificationConsumer - Phase N3 Decoupling Verification', () => {
  let consumer: ManagementNotificationConsumer;
  let notificationRepoMock: Partial<Repository<Notification>>;
  let dataSourceMock: Partial<DataSource>;
  let gatewayMock: Partial<NotificationGateway>;

  beforeEach(async () => {
    notificationRepoMock = {
      save: jest.fn().mockImplementation(async (notifs) => notifs),
    };

    dataSourceMock = {
      query: jest.fn(),
    };

    gatewayMock = {
      sendNotificationToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManagementNotificationConsumer,
        { provide: getRepositoryToken(Notification), useValue: notificationRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: NotificationGateway, useValue: gatewayMock },
      ],
    }).compile();

    consumer = module.get<ManagementNotificationConsumer>(ManagementNotificationConsumer);
  });

  it('1. GO_NOGO_SUBMITTED creates ZERO Notification DB rows and ZERO socket emissions', async () => {
    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Lukas Kurniawan (Marketing)',
      updaterId: 7,
      action: 'GO_NOGO_SUBMITTED',
      timestamp: new Date().toISOString(),
    });

    expect(notificationRepoMock.save).not.toHaveBeenCalled();
    expect(gatewayMock.sendNotificationToUser).not.toHaveBeenCalled();
    expect(dataSourceMock.query).not.toHaveBeenCalled();
  });

  it('2. GO_NOGO_RESUBMITTED creates ZERO Notification DB rows and ZERO socket emissions', async () => {
    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Lukas Kurniawan (Marketing)',
      updaterId: 7,
      action: 'GO_NOGO_RESUBMITTED',
      timestamp: new Date().toISOString(),
    });

    expect(notificationRepoMock.save).not.toHaveBeenCalled();
    expect(gatewayMock.sendNotificationToUser).not.toHaveBeenCalled();
  });

  it('3. CREATED and UPDATED actions create ZERO Notification DB rows (generic Info Sistem eliminated)', async () => {
    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Lukas Kurniawan (Marketing)',
      updaterId: 7,
      action: 'CREATED',
      timestamp: new Date().toISOString(),
    });

    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Lukas Kurniawan (Marketing)',
      updaterId: 7,
      action: 'UPDATED',
      timestamp: new Date().toISOString(),
    });

    expect(notificationRepoMock.save).not.toHaveBeenCalled();
    expect(gatewayMock.sendNotificationToUser).not.toHaveBeenCalled();
  });

  it('4. MARKED_WON and MARKED_LOST management_update signals produce ZERO Bell rows', async () => {
    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Lukas Kurniawan (Marketing)',
      updaterId: 7,
      action: 'MARKED_WON',
      timestamp: new Date().toISOString(),
    });

    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Lukas Kurniawan (Marketing)',
      updaterId: 7,
      action: 'MARKED_LOST',
      timestamp: new Date().toISOString(),
    });

    expect(notificationRepoMock.save).not.toHaveBeenCalled();
    expect(gatewayMock.sendNotificationToUser).not.toHaveBeenCalled();
  });

  it('5. STAGE_CHANGED and NEW_ACTIVITY produce ZERO Notification DB rows', async () => {
    await consumer.handleManagementUpdate({
      tenderId: 33,
      title: 'Project Gudang Jakarta Selatan',
      customerName: 'PT UBD',
      estimatedBudget: 500000000,
      updatedBy: 'Sistem',
      updaterId: null,
      action: 'NEW_ACTIVITY',
      timestamp: new Date().toISOString(),
    });

    expect(notificationRepoMock.save).not.toHaveBeenCalled();
    expect(gatewayMock.sendNotificationToUser).not.toHaveBeenCalled();
  });
});
