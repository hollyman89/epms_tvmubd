import React, { useState, useEffect, useCallback } from 'react';
import { Typography, List, Badge, Button, Empty, Spin, message, theme, Tag, Tabs, Space } from 'antd';
import { CheckOutlined, DeleteOutlined, ArrowRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { InboxService, TodoItem, HistoryItem } from '@/services/inbox.service';
import { resolveTodoActionTarget, navigateTodoAction } from '@/lib/todoActionResolver';
import { setupTodoSync } from '@/lib/todoSync';
import { setupInboxSync, resolveNotificationTarget } from '@/lib/notificationSync';
import { useSocket } from '@/context/SocketProvider';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  formatEntityLabel,
  getEntityTagColor,
  formatRoleName,
  formatTaskTitle,
  formatTaskDescription,
  formatHistoryTitle,
  formatNotificationTitle,
  formatNotificationMessage,
  formatContextualCta,
  formatPriorityName,
  extractItemBusinessContext,
  resolveItemStatusDomain,
  INBOX_TABS,
  INBOX_PAGE_CONFIG,
  INBOX_EMPTY_STATES,
} from '@/lib/inboxPresentation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';

dayjs.extend(relativeTime);
dayjs.locale('id');

const { Title, Text } = Typography;
const { useToken } = theme;

interface Notification {
  id: number;
  title: string;
  message: string;
  notificationType: string;
  actionLink: string | null;
  isRead: boolean;
  metaData: any;
  createdAt: string;
}

export const InboxPage: React.FC = () => {
  const { token } = useToken();
  const router = useRouter();
  const { notificationSocket } = useSocket();

  const [activeTab, setActiveTab] = useState<'todo' | 'history' | 'notifications'>('todo');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingTodos, setLoadingTodos] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(true);

  // 1. Fetch Authoritative Actionable To-Dos
  const fetchTodos = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingTodos(true);
      const items = await InboxService.getTodos();
      setTodos(items);
    } catch (error) {
      console.error('Failed to fetch todos', error);
      if (!silent) message.error('Gagal memuat daftar tugas (To-Do).');
    } finally {
      if (!silent) setLoadingTodos(false);
    }
  }, []);

  // 2. Fetch Historical Workflow Tasks (Read-Only)
  const fetchHistory = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingHistory(true);
      const items = await InboxService.getHistory();
      setHistory(items);
    } catch (error) {
      console.error('Failed to fetch history', error);
      if (!silent) message.error('Gagal memuat riwayat tugas.');
    } finally {
      if (!silent) setLoadingHistory(false);
    }
  }, []);

  // 3. Fetch Informational Notifications
  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingNotifications(true);
      const res = await apiClient.get('/notifications?page=1&limit=50');
      const rawData = res.data?.data?.data || res.data?.data || [];
      const dataArray = Array.isArray(rawData) ? rawData : [];
      setNotifications(dataArray);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      if (!silent) message.error('Gagal memuat pemberitahuan.');
    } finally {
      if (!silent) setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchHistory();
    fetchNotifications();
  }, [fetchTodos, fetchHistory, fetchNotifications]);

  // Realtime Sync for To-Do: Subscribe to canonical business events & reconnect
  useEffect(() => {
    return setupTodoSync({
      onRefresh: () => {
        fetchTodos(true);
        fetchHistory(true);
      },
    });
  }, [fetchTodos, fetchHistory]);

  // Realtime Sync for Notifications: Subscribe to new_notification & reconnect
  useEffect(() => {
    return setupInboxSync({
      socket: notificationSocket,
      onNewNotification: () => {
        fetchNotifications(true);
      },
      onReconnectResync: () => {
        fetchNotifications(true);
      },
    });
  }, [notificationSocket, fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      message.success('Semua notifikasi telah ditandai dibaca.');
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      message.success('Notifikasi berhasil dihapus.');
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const getActionButtonLabel = (action: string) => {
    switch (String(action).toUpperCase()) {
      case 'VIEW_CONTRACT':
        return 'Lihat Kontrak';
      case 'REVIEW_REVISION':
        return 'Tinjau Revisi';
      case 'PROJECT_BOARD':
      case 'VIEW_PROJECT':
        return 'Lihat Proyek';
      case 'REVIEW_CONTRACT':
        return 'Tinjau Kontrak';
      case 'OPERATIONAL_PLAN':
        return 'Buka Rencana';
      case 'VIEW_PAYMENT':
        return 'Lihat Pembayaran';
      case 'VIEW_PO':
        return 'Lihat PO';
      case 'OPEN':
      case 'BUKA':
        return 'Lihat Detail';
      default:
        return action.replace(/_/g, ' ');
    }
  };

  const renderCategoryTag = (category?: string) => {
    if (!category) return null;
    return (
      <Tag color={getEntityTagColor(category)} style={{ fontSize: '11px' }}>
        {formatEntityLabel(category)}
      </Tag>
    );
  };

  const renderPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    const label = formatPriorityName(priority);
    switch (String(priority).toUpperCase()) {
      case 'URGENT':
        return <Tag color="error" style={{ fontSize: '11px', fontWeight: 600 }}>{label}</Tag>;
      case 'HIGH':
        return <Tag color="warning" style={{ fontSize: '11px', fontWeight: 600 }}>{label}</Tag>;
      case 'NORMAL':
        return <Tag color="processing" style={{ fontSize: '11px' }}>{label}</Tag>;
      case 'LOW':
        return <Tag color="default" style={{ fontSize: '11px' }}>{label}</Tag>;
      default:
        return null;
    }
  };

  const renderSmartMessage = (rawMessage: string, isRead: boolean) => {
    if (!rawMessage) return null;
    if (/<[a-z][\s\S]*>/i.test(rawMessage)) {
      return <span dangerouslySetInnerHTML={{ __html: rawMessage }} />;
    }
    const parts = rawMessage.split(/("[^"]+")/g);
    return (
      <span>
        {parts.map((part, index) => {
          if (part.startsWith('"') && part.endsWith('"')) {
            return (
              <strong
                key={index}
                style={{
                  fontWeight: 600,
                  color: isRead ? token.colorTextSecondary : token.colorTextHeading,
                }}
              >
                {part}
              </strong>
            );
          }
          if (part.includes('Catatan:')) {
            const subParts = part.split(/(Catatan:)/g);
            return (
              <span key={index}>
                {subParts.map((sub, sIdx) =>
                  sub === 'Catatan:' ? (
                    <strong
                      key={sIdx}
                      style={{
                        fontWeight: 600,
                        color: isRead ? token.colorTextSecondary : token.colorTextHeading,
                      }}
                    >
                      {sub}
                    </strong>
                  ) : (
                    sub
                  )
                )}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  const renderEntityTypeTag = (entityType: string) => {
    return (
      <Tag color={getEntityTagColor(entityType)}>
        {formatEntityLabel(entityType)}
      </Tag>
    );
  };

  const renderDueBadge = (dueAt?: string) => {
    if (!dueAt) return null;
    const dueTime = new Date(dueAt).getTime();
    const isOverdue = dueTime < Date.now();

    return (
      <Tag
        color={isOverdue ? 'error' : 'warning'}
        icon={<ClockCircleOutlined />}
        style={{ fontWeight: 600 }}
      >
        {isOverdue ? `Terlambat: ${dayjs(dueAt).fromNow()}` : `Batas: ${dayjs(dueAt).fromNow()}`}
      </Tag>
    );
  };

  const renderBusinessContextBlock = (item: any) => {
    const ctx = extractItemBusinessContext(item);
    return (
      <div style={{ marginBottom: 6, fontSize: '13px' }}>
        {ctx.projectName && (
          <div style={{ marginBottom: 2 }}>
            <Text strong style={{ fontSize: '14px', color: token.colorTextHeading }}>
              {ctx.projectName}
            </Text>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {ctx.customerName && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Pelanggan: </Text>
              <Text style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{ctx.customerName}</Text>
            </div>
          )}
          {ctx.contractNumber && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Kontrak: </Text>
              <Text style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{ctx.contractNumber}</Text>
            </div>
          )}
          {ctx.poNumber && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>PO: </Text>
              <Text style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{ctx.poNumber}</Text>
            </div>
          )}
          {ctx.vendorName && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Vendor: </Text>
              <Text style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{ctx.vendorName}</Text>
            </div>
          )}
          {ctx.internalId && (
            <div>
              <Text type="secondary" style={{ fontSize: '11px' }}>ID Internal: </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>{ctx.internalId}</Text>
            </div>
          )}
        </div>
        {item.submittedByName && (
          <div style={{ marginTop: 2 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>Diajukan oleh: </Text>
            <Text style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{item.submittedByName}</Text>
          </div>
        )}
        {item.returnedByName && (
          <div style={{ marginTop: 2 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>Dikembalikan oleh: </Text>
            <Text style={{ fontSize: '12px', fontWeight: 500, color: '#ef4444' }}>{item.returnedByName}</Text>
          </div>
        )}
        {item.returnReason && (
          <div style={{ marginTop: 2 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>Alasan: </Text>
            <Text style={{ fontSize: '12px', color: '#b91c1c' }}>{item.returnReason}</Text>
          </div>
        )}
        {item.description && !item.returnReason && (
          <div style={{ marginTop: 4 }}>
            <Text style={{ fontSize: '13px', color: token.colorTextSecondary, lineHeight: '1.5' }}>
              {item.description}
            </Text>
          </div>
        )}
      </div>
    );
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      style={{
        padding: 24,
        background: '#fff',
        borderRadius: 8,
        minHeight: '80vh',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingBottom: 16,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {INBOX_PAGE_CONFIG.TITLE}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#64748b' }}>
            {INBOX_PAGE_CONFIG.SUBTITLE}
          </Text>
        </div>

        {activeTab === 'notifications' && notifications.length > 0 && unreadNotifCount > 0 && (
          <Button type="primary" icon={<CheckOutlined />} onClick={markAllAsRead}>
            Tandai Semua Dibaca
          </Button>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'todo' | 'history' | 'notifications')}
        items={[
          {
            key: 'todo',
            label: (
              <span style={{ fontWeight: activeTab === 'todo' ? 600 : 400 }}>
                {INBOX_TABS.TODO} {todos.length > 0 && <Badge count={todos.length} overflowCount={999} style={{ marginLeft: 6, backgroundColor: '#1677ff' }} />}
              </span>
            ),
            children: loadingTodos ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : todos.length === 0 ? (
              <Empty
                description={INBOX_EMPTY_STATES.TODO}
                style={{ marginTop: 50 }}
              />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={todos}
                renderItem={(item) => {
                  const targetUrl = resolveTodoActionTarget(item);
                  const isActionAvailable = Boolean(targetUrl);

                  const isGoNoGoApproval = item.actionType === 'GO_NOGO_APPROVAL';
                  const isGoNoGoRevision = item.actionType === 'GO_NOGO_REVISION';
                  const isGoNoGoAny = isGoNoGoApproval || isGoNoGoRevision;

                  const isClosureTask =
                    item.entityType === 'PROJECT_CLOSURE' ||
                    item.entityType === 'PENUTUPAN PROYEK' ||
                    item.sourceType === 'DOMAIN_PROJECT_CLOSURE' ||
                    String(item.actionType || '').startsWith('PROJECT_CLOSURE');

                  return (
                    <List.Item
                      key={item.todoId}
                      actions={[
                        <Button
                          key="open"
                          type="primary"
                          icon={<ArrowRightOutlined />}
                          disabled={!isActionAvailable}
                          onClick={() => {
                            if (targetUrl) navigateTodoAction(targetUrl, router);
                          }}
                        >
                          {isActionAvailable ? formatContextualCta(item) : 'Aksi Belum Tersedia'}
                        </Button>,
                      ]}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '18px 24px',
                        borderRadius: 8,
                        marginBottom: 12,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginBottom: '6px',
                          }}
                        >
                          {isGoNoGoApproval ? (
                            <>
                              <Tag color="green">TENDER</Tag>
                              <Tag color="gold">Direktur</Tag>
                            </>
                          ) : isGoNoGoRevision ? (
                            <>
                              <Tag color="green">TENDER</Tag>
                              <Tag color="gold">Marketing</Tag>
                            </>
                          ) : isClosureTask ? (
                            <>
                              <Tag color="purple">Penutupan Proyek</Tag>
                              {item.assignedRole && (
                                <Tag color="gold">{formatRoleName(item.assignedRole)}</Tag>
                              )}
                            </>
                          ) : (
                            <>
                              {renderEntityTypeTag(item.entityType)}
                              {item.assignedRole && (
                                <Tag color="gold">{formatRoleName(item.assignedRole)}</Tag>
                              )}
                              <StatusBadge domain={resolveItemStatusDomain(item)} status={item.status} />
                              {renderDueBadge(item.dueAt)}
                            </>
                          )}
                        </div>

                        <div style={{ marginBottom: '4px' }}>
                          <Text
                            strong
                            style={{
                              fontSize: '15px',
                              color: token.colorTextHeading,
                              display: 'block',
                            }}
                          >
                            {formatTaskTitle(item.title, item)}
                          </Text>
                        </div>

                        {isClosureTask ? (
                          <div style={{ marginBottom: 8, fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                            {formatTaskDescription(item)}
                          </div>
                        ) : (
                          renderBusinessContextBlock(item)
                        )}

                        <div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {isGoNoGoAny || isClosureTask ? dayjs(item.createdAt).fromNow() : `Dibuat ${dayjs(item.createdAt).fromNow()}`}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            ),
          },
          {
            key: 'history',
            label: (
              <span style={{ fontWeight: activeTab === 'history' ? 600 : 400 }}>
                {INBOX_TABS.HISTORY} {history.length > 0 && (
                  <Badge
                    count={history.length}
                    overflowCount={999}
                    style={{
                      marginLeft: 6,
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                    }}
                  />
                )}
              </span>
            ),
            children: loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : history.length === 0 ? (
              <Empty
                description={INBOX_EMPTY_STATES.HISTORY}
                style={{ marginTop: 50 }}
              />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={history}
                renderItem={(item) => {
                  const renderStatusTag = (status: string) => {
                    return <StatusBadge domain={resolveItemStatusDomain(item)} status={status} />;
                  };

                  const renderActionTag = (action?: string) => {
                    if (!action) return null;
                    switch (action.toUpperCase()) {
                      case 'APPROVE':
                        return <Tag color="blue">DISETUJUI</Tag>;
                      case 'RETURN':
                        return <Tag color="orange">DIKEMBALIKAN</Tag>;
                      case 'REJECT':
                        return <Tag color="red">DITOLAK</Tag>;
                      case 'RESUBMIT':
                        return <Tag color="cyan">DIKIRIM ULANG</Tag>;
                      case 'ASSIGN_PM':
                        return <Tag color="purple">PM DITETAPKAN</Tag>;
                      default:
                        return <Tag>{action}</Tag>;
                    }
                  };

                  return (
                    <List.Item
                      key={item.historyId || item.taskId}
                      style={{
                        backgroundColor: '#fafafa',
                        padding: '16px 24px',
                        borderRadius: 8,
                        marginBottom: 12,
                        border: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginBottom: '6px',
                          }}
                        >
                          {renderEntityTypeTag(item.entityType)}
                          {renderStatusTag(item.status)}
                          {renderActionTag(item.action)}
                        </div>

                        <div style={{ marginBottom: '4px' }}>
                          <Text strong style={{ fontSize: '15px', color: token.colorTextHeading }}>
                            {formatHistoryTitle(item)}
                          </Text>
                        </div>

                        {renderBusinessContextBlock(item)}

                        {item.comments && (
                          <div
                            style={{
                              marginBottom: '8px',
                              backgroundColor: '#f5f5f5',
                              padding: '8px 12px',
                              borderRadius: 6,
                              borderLeft: `3px solid ${token.colorPrimary}`,
                            }}
                          >
                            <Text style={{ fontSize: '13px', color: token.colorTextSecondary }}>
                              <strong>Catatan:</strong> {item.comments}
                            </Text>
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '8px',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div>
                            {item.decidedByName && (
                              <Text type="secondary" style={{ fontSize: '13px' }}>
                                Diputuskan oleh: <strong>{item.decidedByName}</strong>
                              </Text>
                            )}
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {item.completedAt ? `Selesai: ${dayjs(item.completedAt).format('DD MMM YYYY, HH:mm')}` : dayjs(item.createdAt).fromNow()}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            ),
          },
          {
            key: 'notifications',
            label: (
              <span style={{ fontWeight: activeTab === 'notifications' ? 600 : 400 }}>
                {INBOX_TABS.NOTIFICATIONS} {unreadNotifCount > 0 && <Badge count={unreadNotifCount} overflowCount={999} style={{ marginLeft: 6, backgroundColor: '#10b981' }} />}
              </span>
            ),
            children: loadingNotifications ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : notifications.length === 0 ? (
              <Empty
                description={INBOX_EMPTY_STATES.NOTIFICATIONS}
                style={{ marginTop: 50 }}
              />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={notifications}
                renderItem={(item) => {
                  const isWon = item.metaData?.action_type === 'MARKED_WON';
                  const category = item.metaData?.category;
                  const priority = item.metaData?.priority;
                  const actionButtons: string[] = Array.isArray(item.metaData?.action_buttons)
                    ? item.metaData.action_buttons
                    : item.metaData?.action_buttons
                    ? [item.metaData.action_buttons]
                    : [];
                  const targetUrl = resolveNotificationTarget(item);

                  return (
                    <List.Item
                      key={item.id}
                      actions={[
                        <Button
                          key="delete"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => deleteNotification(item.id)}
                        />,
                      ]}
                      style={{
                        backgroundColor: item.isRead ? '#ffffff' : '#f0f5ff',
                        padding: '16px 24px',
                        borderRadius: 8,
                        marginBottom: 12,
                        border: `1px solid ${item.isRead ? token.colorBorderSecondary : '#adc6ff'}`,
                        transition: 'all 0.3s',
                      }}
                    >
                      <div
                        style={{ flex: 1, cursor: targetUrl ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (!item.isRead) markAsRead(item.id);
                          if (targetUrl) router.push(targetUrl);
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginBottom: '6px',
                          }}
                        >
                          {!item.isRead && (
                            <Badge status="processing" style={{ marginRight: 4 }} />
                          )}
                          {renderCategoryTag(category)}
                          {renderPriorityBadge(priority)}
                          {isWon && (
                            <Tag color="success" style={{ fontWeight: 'bold' }}>
                              WON
                            </Tag>
                          )}
                        </div>

                        {item.title && (
                          <div style={{ marginBottom: '4px' }}>
                            <Text
                              strong
                              style={{
                                fontSize: '15px',
                                color: item.isRead
                                  ? token.colorTextSecondary
                                  : token.colorTextHeading,
                                display: 'block',
                              }}
                            >
                              {formatNotificationTitle(item.title)}
                            </Text>
                          </div>
                        )}

                        {renderBusinessContextBlock(item)}

                        <div style={{ marginBottom: '8px' }}>
                          <Text
                            style={{
                              fontSize: '14px',
                              color: item.isRead ? token.colorTextSecondary : token.colorText,
                              lineHeight: '1.6',
                              display: 'block',
                            }}
                          >
                            {renderSmartMessage(formatNotificationMessage(item.message), item.isRead)}
                          </Text>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '8px',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div>
                            {actionButtons.length > 0 &&
                              actionButtons.map((btnKey, idx) => (
                                <Button
                                  key={idx}
                                  type="default"
                                  size="small"
                                  style={{ marginRight: '8px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!item.isRead) markAsRead(item.id);
                                    if (targetUrl) router.push(targetUrl);
                                  }}
                                >
                                  {getActionButtonLabel(btnKey)}
                                </Button>
                              ))}
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {dayjs(item.createdAt).fromNow()}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
};
