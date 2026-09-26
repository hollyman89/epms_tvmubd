import React, { useState, useEffect, useCallback } from 'react';
import { Typography, List, Badge, Button, Empty, Spin, message, theme, Tag, Tabs, Space } from 'antd';
import { CheckOutlined, DeleteOutlined, ArrowRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { InboxService, TodoItem } from '@/services/inbox.service';
import { resolveTodoActionTarget, navigateTodoAction } from '@/lib/todoActionResolver';
import { setupTodoSync } from '@/lib/todoSync';
import { setupInboxSync } from '@/lib/notificationSync';
import { useSocket } from '@/context/SocketProvider';
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

  const [activeTab, setActiveTab] = useState<'todo' | 'notifications'>('todo');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingTodos, setLoadingTodos] = useState<boolean>(true);
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

  // 2. Fetch Informational Notifications
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
    fetchNotifications();
  }, [fetchTodos, fetchNotifications]);

  // Realtime Sync for To-Do: Subscribe to canonical business events & reconnect
  useEffect(() => {
    return setupTodoSync({
      onRefresh: () => {
        fetchTodos(true);
      },
    });
  }, [fetchTodos]);

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
        return 'Review Revisi';
      case 'PROJECT_BOARD':
        return 'Lihat Project';
      case 'REVIEW_CONTRACT':
        return 'Review Kontrak';
      default:
        return action;
    }
  };

  const renderCategoryTag = (category?: string) => {
    if (!category) return null;
    switch (String(category).toUpperCase()) {
      case 'LEGAL':
        return <Tag color="purple" style={{ fontSize: '11px' }}>LEGAL</Tag>;
      case 'PMO':
        return <Tag color="cyan" style={{ fontSize: '11px' }}>PMO</Tag>;
      case 'SALES':
        return <Tag color="green" style={{ fontSize: '11px' }}>SALES</Tag>;
      default:
        return <Tag color="blue" style={{ fontSize: '11px' }}>{String(category).toUpperCase()}</Tag>;
    }
  };

  const renderPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    switch (String(priority).toUpperCase()) {
      case 'URGENT':
        return <Tag color="error" style={{ fontSize: '11px', fontWeight: 600 }}>URGENT</Tag>;
      case 'HIGH':
        return <Tag color="warning" style={{ fontSize: '11px', fontWeight: 600 }}>HIGH</Tag>;
      case 'NORMAL':
        return <Tag color="processing" style={{ fontSize: '11px' }}>NORMAL</Tag>;
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
    switch (String(entityType).toUpperCase()) {
      case 'PROJECT':
        return <Tag color="cyan">PROYEK</Tag>;
      case 'PURCHASE_REQUEST':
        return <Tag color="orange">PURCHASE REQUEST</Tag>;
      case 'CONTRACT':
        return <Tag color="purple">KONTRAK LEGAL</Tag>;
      case 'TENDER':
        return <Tag color="green">TENDER</Tag>;
      default:
        return <Tag color="blue">{entityType}</Tag>;
    }
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
            Unified Inbox
          </Title>
          <Text type="secondary">Pusat tugas yang harus dilakukan dan pemberitahuan sistem</Text>
        </div>

        {activeTab === 'notifications' && notifications.length > 0 && unreadNotifCount > 0 && (
          <Button type="primary" icon={<CheckOutlined />} onClick={markAllAsRead}>
            Tandai Semua Dibaca
          </Button>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'todo' | 'notifications')}
        items={[
          {
            key: 'todo',
            label: (
              <span style={{ fontWeight: activeTab === 'todo' ? 600 : 400 }}>
                To-Do {todos.length > 0 && <Badge count={todos.length} style={{ marginLeft: 6, backgroundColor: '#1677ff' }} />}
              </span>
            ),
            children: loadingTodos ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : todos.length === 0 ? (
              <Empty
                description="Tidak ada tugas tertunda yang memerlukan tindakan Anda"
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
                          {isActionAvailable ? 'Buka' : 'Aksi Belum Tersedia'}
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
                        {isGoNoGoApproval ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '6px',
                              marginBottom: '6px',
                            }}
                          >
                            <Tag color="green">Tender</Tag>
                            <Tag color="gold">Director</Tag>
                          </div>
                        ) : isGoNoGoRevision ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '6px',
                              marginBottom: '6px',
                            }}
                          >
                            <Tag color="green">Tender</Tag>
                            <Tag color="gold">Marketing</Tag>
                          </div>
                        ) : (
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
                            {item.assignedRole && (
                              <Tag color="gold">{item.assignedRole}</Tag>
                            )}
                            <Tag color="processing">{item.status}</Tag>
                            {renderDueBadge(item.dueAt)}
                          </div>
                        )}

                        <div style={{ marginBottom: '4px' }}>
                          <Text
                            strong
                            style={{
                              fontSize: '15px',
                              color: token.colorTextHeading,
                              display: 'block',
                            }}
                          >
                            {isGoNoGoApproval
                              ? 'Persetujuan GO / NO-GO'
                              : isGoNoGoRevision
                              ? 'Revisi GO / NO-GO'
                              : item.title}
                          </Text>
                        </div>

                        {isGoNoGoApproval ? (
                          <div style={{ marginBottom: '8px' }}>
                            {item.projectName && (
                              <Text
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: token.colorTextHeading,
                                  display: 'block',
                                  marginBottom: '2px',
                                }}
                              >
                                {item.projectName}
                              </Text>
                            )}
                            {item.customerName && (
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: '13px',
                                  color: token.colorTextSecondary,
                                  display: 'block',
                                  lineHeight: '1.4',
                                }}
                              >
                                Customer: {item.customerName}
                              </Text>
                            )}
                            {item.submittedByName && (
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: '13px',
                                  color: token.colorTextSecondary,
                                  display: 'block',
                                  lineHeight: '1.4',
                                }}
                              >
                                Diajukan oleh: {item.submittedByName}
                              </Text>
                            )}
                          </div>
                        ) : isGoNoGoRevision ? (
                          <div style={{ marginBottom: '8px' }}>
                            {item.projectName && (
                              <Text
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: token.colorTextHeading,
                                  display: 'block',
                                  marginBottom: '2px',
                                }}
                              >
                                {item.projectName}
                              </Text>
                            )}
                            {item.customerName && (
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: '13px',
                                  color: token.colorTextSecondary,
                                  display: 'block',
                                  lineHeight: '1.4',
                                }}
                              >
                                Customer: {item.customerName}
                              </Text>
                            )}
                            {item.returnedByName && (
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: '13px',
                                  color: token.colorTextSecondary,
                                  display: 'block',
                                  lineHeight: '1.4',
                                }}
                              >
                                Dikembalikan oleh: {item.returnedByName}
                              </Text>
                            )}
                            {item.returnReason && (
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: '13px',
                                  color: token.colorTextSecondary,
                                  display: 'block',
                                  lineHeight: '1.4',
                                }}
                              >
                                Alasan: {item.returnReason}
                              </Text>
                            )}
                          </div>
                        ) : (
                          item.description && (
                            <div style={{ marginBottom: '6px' }}>
                              <Text
                                style={{
                                  fontSize: '13px',
                                  color: token.colorTextSecondary,
                                  lineHeight: '1.5',
                                  display: 'block',
                                }}
                              >
                                {item.description}
                              </Text>
                            </div>
                          )
                        )}

                        <div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {isGoNoGoAny ? dayjs(item.createdAt).fromNow() : `Dibuat ${dayjs(item.createdAt).fromNow()}`}
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
                Notifications {unreadNotifCount > 0 && <Badge count={unreadNotifCount} style={{ marginLeft: 6, backgroundColor: '#10b981' }} />}
              </span>
            ),
            children: loadingNotifications ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : notifications.length === 0 ? (
              <Empty
                description="Tidak ada pemberitahuan di kotak masuk Anda"
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
                  const targetUrl = item.metaData?.lead_id
                    ? `/sales/tenders/${item.metaData.lead_id}`
                    : item.actionLink;

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
                              {item.title}
                            </Text>
                          </div>
                        )}

                        <div style={{ marginBottom: '8px' }}>
                          <Text
                            style={{
                              fontSize: '14px',
                              color: item.isRead ? token.colorTextSecondary : token.colorText,
                              lineHeight: '1.6',
                              display: 'block',
                            }}
                          >
                            {renderSmartMessage(item.message, item.isRead)}
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
