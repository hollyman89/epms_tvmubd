import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge, Popover, List, Typography, Button, Spin, Empty, theme, Tabs, Tag } from 'antd';
import { BellOutlined, CheckOutlined, ArrowRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { InboxService, TodoItem } from '@/services/inbox.service';
import { resolveTodoActionTarget } from '@/lib/todoActionResolver';
import { setupTodoSync } from '@/lib/todoSync';
import { setupNotificationBellSync } from '@/lib/notificationSync';
import { extractUnreadNotificationCount } from '@/lib/notificationCount';
import { useSocket } from '@/context/SocketProvider';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';

dayjs.extend(relativeTime);
dayjs.locale('id');

const { Text } = Typography;
const { useToken } = theme;

interface Notification {
  id: number;
  title: string | null;
  message: string;
  notificationType: string;
  actionLink: string | null;
  isRead: boolean;
  metaData: any;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const { token } = useToken();
  const { notificationSocket } = useSocket();
  const router = useRouter();

  const [open, setOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'todo' | 'notifications'>('todo');

  // Authoritative State: To-Do
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoCount, setTodoCount] = useState<number>(0);
  const [loadingTodos, setLoadingTodos] = useState<boolean>(false);

  // Authoritative State: Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  const getAuthToken = useCallback(() => localStorage.getItem('access_token') || '', []);

  // Fetch authoritative unread notification count directly
  const fetchUnreadNotificationCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/count/unread');
      const count = extractUnreadNotificationCount(res.data);
      setUnreadNotificationCount(count);
    } catch (error) {
      console.error('Failed to fetch unread notification count', error);
      setUnreadNotificationCount(0);
    }
  }, []);

  // Fetch To-Do summary count for popover tab label
  const fetchTodoCount = useCallback(async () => {
    try {
      const summary = await InboxService.getSummary();
      const count = Number(summary.todoCount);
      setTodoCount(Number.isFinite(count) && count >= 0 ? count : 0);
    } catch (error) {
      console.error('Failed to fetch todo count', error);
      setTodoCount(0);
    }
  }, []);

  // Fetch actionable To-Dos
  const fetchTodos = useCallback(async () => {
    try {
      setLoadingTodos(true);
      const items = await InboxService.getTodos();
      setTodos(items.slice(0, 10)); // Top 10 in popover
      setTodoCount(items.length);
    } catch (error) {
      console.error('Failed to fetch todos', error);
    } finally {
      setLoadingTodos(false);
    }
  }, []);

  // Fetch informational unread notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await apiClient.get('/notifications?page=1&limit=10&isRead=false');
      const rawData = res.data?.data?.data || res.data?.data || [];
      const dataArray = Array.isArray(rawData) ? rawData : [];
      setNotifications(dataArray);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // Initial mount: fetch unread notification count and todo count
  useEffect(() => {
    if (getAuthToken()) {
      fetchUnreadNotificationCount();
      fetchTodoCount();
    }
  }, [fetchUnreadNotificationCount, fetchTodoCount, getAuthToken]);

  // When popover opens: fetch lists
  useEffect(() => {
    if (open) {
      fetchTodos();
      fetchNotifications();
    }
  }, [open, fetchTodos, fetchNotifications]);

  // Realtime Sync for To-Do: Listen to canonical business events & reconnect
  // MUST NOT touch unreadNotificationCount (locked UX rule)
  useEffect(() => {
    return setupTodoSync({
      onRefresh: () => {
        fetchTodoCount();
        if (open) {
          fetchTodos();
        }
      },
    });
  }, [fetchTodoCount, fetchTodos, open]);

  // Realtime Sync for Notifications: Listen to socket new_notification & reconnect
  useEffect(() => {
    return setupNotificationBellSync({
      socket: notificationSocket,
      onNewNotification: (notif: Notification) => {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
        setUnreadNotificationCount((prev) => prev + 1);
      },
      onReconnectResync: () => {
        fetchUnreadNotificationCount();
        if (open) {
          fetchNotifications();
        }
      },
    });
  }, [notificationSocket, fetchUnreadNotificationCount, fetchNotifications, open]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications([]);
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  }, []);

  const renderCategoryTag = (category?: string) => {
    if (!category) return null;
    switch (String(category).toUpperCase()) {
      case 'LEGAL':
        return <Tag color="purple" style={{ marginRight: '4px', fontSize: '10px' }}>LEGAL</Tag>;
      case 'PMO':
        return <Tag color="cyan" style={{ marginRight: '4px', fontSize: '10px' }}>PMO</Tag>;
      case 'SALES':
        return <Tag color="green" style={{ marginRight: '4px', fontSize: '10px' }}>SALES</Tag>;
      default:
        return <Tag color="blue" style={{ marginRight: '4px', fontSize: '10px' }}>{String(category).toUpperCase()}</Tag>;
    }
  };

  const renderPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    switch (String(priority).toUpperCase()) {
      case 'URGENT':
        return <Tag color="error" style={{ marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>URGENT</Tag>;
      case 'HIGH':
        return <Tag color="warning" style={{ marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>HIGH</Tag>;
      case 'NORMAL':
        return <Tag color="processing" style={{ marginRight: '4px', fontSize: '10px' }}>NORMAL</Tag>;
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
              <strong key={index} style={{ fontWeight: 600, color: isRead ? '#334155' : '#0f172a' }}>
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
                    <strong key={sIdx} style={{ fontWeight: 600, color: isRead ? '#334155' : '#0f172a' }}>
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

  const renderTodoItem = useCallback(
    (item: TodoItem) => {
      const targetUrl = resolveTodoActionTarget(item);
      const isActionAvailable = Boolean(targetUrl);
      const dueTime = item.dueAt ? new Date(item.dueAt).getTime() : null;
      const isOverdue = dueTime !== null && dueTime < Date.now();

      return (
        <List.Item
          key={item.todoId}
          style={{
            backgroundColor: '#ffffff',
            cursor: isActionAvailable ? 'pointer' : 'default',
            padding: '12px 16px',
            marginBottom: '6px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            if (targetUrl) {
              router.push(targetUrl);
              setOpen(false);
            }
          }}
          onMouseEnter={(e) => {
            if (isActionAvailable) {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <Tag color="blue" style={{ fontSize: '10px' }}>{item.entityType}</Tag>
              {item.assignedRole && <Tag color="gold" style={{ fontSize: '10px' }}>{item.assignedRole}</Tag>}
              {item.dueAt && (
                <Tag
                  color={isOverdue ? 'error' : 'warning'}
                  icon={<ClockCircleOutlined />}
                  style={{ fontSize: '10px', fontWeight: 600 }}
                >
                  {isOverdue ? 'Terlambat' : dayjs(item.dueAt).fromNow()}
                </Tag>
              )}
            </div>

            <div style={{ marginBottom: '2px' }}>
              <Text strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                {item.title}
              </Text>
            </div>

            {item.description && (
              <div style={{ marginBottom: '4px' }}>
                <Text style={{ fontSize: '11px', color: '#64748b', display: 'block', lineHeight: '1.4' }}>
                  {item.description}
                </Text>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <Text type="secondary" style={{ fontSize: '10px', color: '#94a3b8' }}>
                {dayjs(item.createdAt).fromNow()}
              </Text>
              <Button
                type="link"
                size="small"
                disabled={!isActionAvailable}
                icon={isActionAvailable ? <ArrowRightOutlined /> : undefined}
                style={{ fontSize: '11px', padding: 0, height: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (targetUrl) {
                    router.push(targetUrl);
                    setOpen(false);
                  }
                }}
              >
                {isActionAvailable ? 'Buka' : 'Aksi Belum Tersedia'}
              </Button>
            </div>
          </div>
        </List.Item>
      );
    },
    [router]
  );

  const renderNotificationItem = useCallback(
    (item: Notification) => {
      const isWon = item.metaData?.action_type === 'MARKED_WON';
      const category = item.metaData?.category;
      const priority = item.metaData?.priority;
      const targetUrl = item.metaData?.lead_id
        ? `/sales/tenders/${item.metaData.lead_id}`
        : item.actionLink;

      return (
        <List.Item
          key={item.id}
          style={{
            backgroundColor: item.isRead ? '#ffffff' : '#f8fafc',
            cursor: 'pointer',
            padding: '12px 16px',
            marginBottom: '6px',
            borderRadius: '8px',
            border: `1px solid ${item.isRead ? 'transparent' : '#e2e8f0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            transition: 'all 0.2s ease',
          }}
          onClick={async () => {
            if (!item.isRead) {
              await markAsRead(item.id);
            }
            if (targetUrl) {
              router.push(targetUrl);
              setOpen(false);
            }
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = item.isRead ? '#ffffff' : '#f8fafc';
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              {renderCategoryTag(category)}
              {renderPriorityBadge(priority)}
              {isWon && <Tag color="success" style={{ fontWeight: 'bold', fontSize: '10px' }}>WON</Tag>}
            </div>

            {item.title && (
              <div style={{ marginBottom: '2px' }}>
                <Text strong style={{ fontSize: '13px', color: item.isRead ? '#475569' : '#0f172a', display: 'block' }}>
                  {item.title}
                </Text>
              </div>
            )}

            <div style={{ marginBottom: '4px' }}>
              <Text style={{ display: 'block', fontSize: '12px', color: item.isRead ? '#64748b' : '#334155', lineHeight: '1.4' }}>
                {renderSmartMessage(item.message, item.isRead)}
              </Text>
            </div>

            <Text type="secondary" style={{ fontSize: '10px', color: '#94a3b8' }}>
              {dayjs(item.createdAt).fromNow()}
            </Text>
          </div>

          {!item.isRead && (
            <div style={{ paddingLeft: '8px', paddingTop: '4px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
                }}
              />
            </div>
          )}
        </List.Item>
      );
    },
    [markAsRead, router]
  );

  const popoverContent = useMemo(
    () => (
      <div
        style={{
          width: 'calc(100vw - 32px)',
          maxWidth: 380,
          maxHeight: 650,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px 0 20px', borderBottom: `1px solid #f1f5f9`, backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <Text style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Inbox</Text>
            {unreadNotificationCount > 0 && (
              <Badge
                count={unreadNotificationCount}
                style={{ backgroundColor: '#10b981', color: '#fff', fontWeight: 600, boxShadow: '0 0 0 1px #fff' }}
              />
            )}
          </div>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'todo' | 'notifications')}
            size="small"
            tabBarStyle={{ marginBottom: 0, borderBottom: 'none' }}
            items={[
              {
                key: 'todo',
                label: (
                  <span style={{ fontWeight: activeTab === 'todo' ? 600 : 400 }}>
                    To-Do ({todoCount})
                  </span>
                ),
              },
              {
                key: 'notifications',
                label: (
                  <span style={{ fontWeight: activeTab === 'notifications' ? 600 : 400 }}>
                    Notifications ({unreadNotificationCount})
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 200, padding: '12px 16px', backgroundColor: '#ffffff' }}>
          {activeTab === 'todo' ? (
            loadingTodos && todos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : todos.length === 0 ? (
              <Empty description="Tidak ada tugas tertunda" style={{ margin: '40px 0' }} />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={todos}
                renderItem={renderTodoItem}
                split={false}
              />
            )
          ) : (
            loadingNotifications && notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : notifications.length === 0 ? (
              <Empty description="Belum ada notifikasi baru" style={{ margin: '40px 0' }} />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={notifications}
                renderItem={renderNotificationItem}
                split={false}
              />
            )
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: `1px solid #f1f5f9`, display: 'flex', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              router.push('/inbox');
              setOpen(false);
            }}
            style={{ padding: 0 }}
          >
            Lihat Semua Inbox
          </Button>

          {activeTab === 'notifications' && notifications.length > 0 && (
            <Button
              type="text"
              size="small"
              onClick={markAllAsRead}
              icon={<CheckOutlined />}
              style={{ color: '#3b82f6', fontWeight: 500, padding: 0 }}
            >
              Tandai semua dibaca
            </Button>
          )}
        </div>
      </div>
    ),
    [
      activeTab,
      todoCount,
      unreadNotificationCount,
      loadingTodos,
      todos,
      renderTodoItem,
      loadingNotifications,
      notifications,
      renderNotificationItem,
      router,
      markAllAsRead,
    ]
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      overlayInnerStyle={{
        padding: 0,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
      arrow={false}
    >
      <Badge count={unreadNotificationCount} overflowCount={99} size="small" style={{ cursor: 'pointer' }}>
        <BellOutlined style={{ fontSize: '20px', cursor: 'pointer', color: token.colorTextSecondary }} />
      </Badge>
    </Popover>
  );
};
