import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge, Popover, List, Typography, Button, Spin, Empty, theme, Tabs, Tag, Drawer, Space } from 'antd';
import { BellOutlined, CheckOutlined, ArrowRightOutlined, ClockCircleOutlined, CloseOutlined, UnorderedListOutlined, UserOutlined, RightOutlined, FileTextOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/axios';
import { AuthService } from '@/services/auth.service';
import { InboxService, TodoItem } from '@/services/inbox.service';
import { resolveTodoActionTarget, navigateTodoAction } from '@/lib/todoActionResolver';
import { setupTodoSync } from '@/lib/todoSync';
import { setupNotificationBellSync, resolveNotificationTarget } from '@/lib/notificationSync';
import { extractUnreadNotificationCount } from '@/lib/notificationCount';
import { calculateAttentionCount } from '@/lib/attentionCount';
import { queryClient } from '@/lib/queryClient';
import { useSocket } from '@/context/SocketProvider';
import {
  formatEntityLabel,
  getEntityTagColor,
  formatRoleName,
  formatTaskTitle,
  formatTaskDescription,
  formatNotificationTitle,
  formatNotificationMessage,
  formatContextualCta,
  formatPriorityName,
  extractItemBusinessContext,
  INBOX_TABS,
  INBOX_PAGE_CONFIG,
  INBOX_EMPTY_STATES,
} from '@/lib/inboxPresentation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';
import { PushNotificationToggle } from './PushNotificationToggle';

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
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Authoritative State: To-Do
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoCount, setTodoCount] = useState<number>(0);
  const [loadingTodos, setLoadingTodos] = useState<boolean>(false);

  // Authoritative State: Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  const getAuthToken = useCallback(() => localStorage.getItem('access_token') || '', []);

  // Authoritative To-Do fetch & sync: always loads fresh items from server,
  // updates TanStack Query cache, and sets both todos and todoCount atomically from the same response.
  const fetchAuthoritativeTodos = useCallback(async () => {
    try {
      setLoadingTodos(true);
      const items = await queryClient.fetchQuery<TodoItem[]>({
        queryKey: ['inbox', 'todos'],
        queryFn: () => InboxService.getTodos(),
        staleTime: 0, // Force fresh network fetch, bypass stale cache
      });
      const safeItems = Array.isArray(items) ? items : [];
      setTodos(safeItems.slice(0, 10)); // Top 10 in popover
      setTodoCount(safeItems.length);
      return safeItems;
    } catch (error) {
      console.error('Failed to fetch authoritative todos', error);
      return [];
    } finally {
      setLoadingTodos(false);
    }
  }, []);

  // Fetch actionable To-Dos
  const fetchTodos = useCallback(async () => {
    await fetchAuthoritativeTodos();
  }, [fetchAuthoritativeTodos]);

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

  // Fetch authoritative unread notification count directly
  const fetchUnreadNotificationCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/count/unread');
      const count = extractUnreadNotificationCount(res.data);
      setUnreadNotificationCount(count);
      if (count > 0) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to fetch unread notification count', error);
      setUnreadNotificationCount(0);
    }
  }, [fetchNotifications]);

  // Fetch To-Do summary count for popover tab label (authoritative server call)
  const fetchTodoCount = useCallback(async () => {
    await fetchAuthoritativeTodos();
  }, [fetchAuthoritativeTodos]);

  // Cache isolation: purge previous user's cached queries on account switch
  const lastUserRef = useRef<number | string | null>(null);
  useEffect(() => {
    const currentUser = AuthService.getUser();
    const currentUserId = currentUser?.id ?? null;

    if (lastUserRef.current !== null && lastUserRef.current !== currentUserId) {
      queryClient.removeQueries({ queryKey: ['inbox', 'todos'] });
      setTodos([]);
      setTodoCount(0);
      setNotifications([]);
      setUnreadNotificationCount(0);
      if (currentUserId && getAuthToken()) {
        fetchUnreadNotificationCount();
        fetchAuthoritativeTodos();
      }
    }
    lastUserRef.current = currentUserId;
  }, [fetchUnreadNotificationCount, fetchAuthoritativeTodos, getAuthToken]);

  // Initial mount: fetch unread notification count and todo count
  useEffect(() => {
    if (getAuthToken()) {
      fetchUnreadNotificationCount();
      // Fast hydration if cached todos exist, followed by authoritative fetch
      const cachedTodos = queryClient.getQueryData<TodoItem[]>(['inbox', 'todos']);
      if (Array.isArray(cachedTodos) && cachedTodos.length > 0) {
        setTodos(cachedTodos.slice(0, 10));
        setTodoCount(cachedTodos.length);
      }
      fetchAuthoritativeTodos();
    }
  }, [fetchUnreadNotificationCount, fetchAuthoritativeTodos, getAuthToken]);

  // Subscribe to TanStack Query cache updates for ['inbox', 'todos']
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.query?.queryKey?.[0] === 'inbox' &&
        event?.query?.queryKey?.[1] === 'todos' &&
        event.type === 'updated' &&
        event.query.state.data
      ) {
        const data = event.query.state.data as TodoItem[];
        if (Array.isArray(data)) {
          setTodos(data.slice(0, 10));
          setTodoCount(data.length);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // When popover opens: fetch lists
  useEffect(() => {
    if (open) {
      fetchAuthoritativeTodos();
      fetchNotifications();
    }
  }, [open, fetchAuthoritativeTodos, fetchNotifications]);

  // Realtime Sync for To-Do: Listen to canonical business events & reconnect
  // MUST NOT touch unreadNotificationCount (locked UX rule)
  useEffect(() => {
    return setupTodoSync({
      onRefresh: () => {
        // Authoritative server fetch whether popover is open or closed
        queryClient.invalidateQueries({ queryKey: ['inbox', 'todos'] });
        fetchAuthoritativeTodos();
      },
    });
  }, [fetchAuthoritativeTodos]);

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
    return (
      <Tag color={getEntityTagColor(category)} style={{ marginRight: '4px', fontSize: '10px' }}>
        {formatEntityLabel(category)}
      </Tag>
    );
  };

  const renderPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    const label = formatPriorityName(priority);
    switch (String(priority).toUpperCase()) {
      case 'URGENT':
        return <Tag color="error" style={{ marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>{label}</Tag>;
      case 'HIGH':
        return <Tag color="warning" style={{ marginRight: '4px', fontSize: '10px', fontWeight: 600 }}>{label}</Tag>;
      case 'NORMAL':
        return <Tag color="processing" style={{ marginRight: '4px', fontSize: '10px' }}>{label}</Tag>;
      case 'LOW':
        return <Tag color="default" style={{ marginRight: '4px', fontSize: '10px' }}>{label}</Tag>;
      default:
        return null;
    }
  };

  const renderBellBusinessContextBlock = (item: any) => {
    const ctx = extractItemBusinessContext(item);
    return (
      <div style={{ marginBottom: '4px' }}>
        {ctx.projectName && (
          <Text strong style={{ fontSize: '12px', color: '#1e293b', display: 'block', marginBottom: '1px' }}>
            {ctx.projectName}
          </Text>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {ctx.customerName && (
            <Text type="secondary" style={{ fontSize: '11px', color: '#64748b' }}>
              Pelanggan: <span style={{ fontWeight: 500, color: '#334155' }}>{ctx.customerName}</span>
            </Text>
          )}
          {ctx.contractNumber && (
            <Text type="secondary" style={{ fontSize: '11px', color: '#64748b' }}>
              Kontrak: <span style={{ fontWeight: 500, color: '#334155' }}>{ctx.contractNumber}</span>
            </Text>
          )}
          {ctx.poNumber && (
            <Text type="secondary" style={{ fontSize: '11px', color: '#64748b' }}>
              PO: <span style={{ fontWeight: 500, color: '#334155' }}>{ctx.poNumber}</span>
            </Text>
          )}
          {ctx.vendorName && (
            <Text type="secondary" style={{ fontSize: '11px', color: '#64748b' }}>
              Vendor: <span style={{ fontWeight: 500, color: '#334155' }}>{ctx.vendorName}</span>
            </Text>
          )}
          {ctx.internalId && (
            <Text type="secondary" style={{ fontSize: '10px', color: '#94a3b8' }}>
              ID: {ctx.internalId}
            </Text>
          )}
        </div>
        {item.submittedByName && (
          <Text type="secondary" style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
            Diajukan oleh: {item.submittedByName}
          </Text>
        )}
        {item.returnedByName && (
          <Text type="secondary" style={{ fontSize: '11px', color: '#ef4444', display: 'block' }}>
            Dikembalikan oleh: {item.returnedByName}
          </Text>
        )}
        {item.returnReason && (
          <Text type="secondary" style={{ fontSize: '11px', color: '#b91c1c', display: 'block' }}>
            Alasan: {item.returnReason}
          </Text>
        )}
        {item.description && !item.returnReason && (
          <Text style={{ fontSize: '11px', color: '#64748b', display: 'block', lineHeight: '1.4', marginTop: '2px' }}>
            {item.description}
          </Text>
        )}
      </div>
    );
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
      const isGoNoGoApproval = item.actionType === 'GO_NOGO_APPROVAL';
      const isGoNoGoRevision = item.actionType === 'GO_NOGO_REVISION';
      const isClosureTask =
        item.entityType === 'PROJECT_CLOSURE' ||
        item.entityType === 'PENUTUPAN PROYEK' ||
        item.sourceType === 'DOMAIN_PROJECT_CLOSURE' ||
        String(item.actionType || '').startsWith('PROJECT_CLOSURE');

      return (
        <div
          key={item.todoId}
          onClick={() => {
            if (targetUrl) {
              navigateTodoAction(targetUrl, router);
              setOpen(false);
            }
          }}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 10,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            cursor: isActionAvailable ? 'pointer' : 'default',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (isActionAvailable) {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02)';
          }}
        >
          {/* Document icon in soft red rounded box */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <FileTextOutlined style={{ color: '#ef4444', fontSize: 18 }} />
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              {isGoNoGoApproval ? (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: 4 }}>TENDER</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '1px 6px', borderRadius: 4 }}>Direktur</span>
                </>
              ) : isGoNoGoRevision ? (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: 4 }}>TENDER</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '1px 6px', borderRadius: 4 }}>Marketing</span>
                </>
              ) : isClosureTask ? (
                <>
                  <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>Penutupan Proyek</Tag>
                  {item.assignedRole && (
                    <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>
                      {formatRoleName(item.assignedRole)}
                    </Tag>
                  )}
                </>
              ) : (
                <>
                  <Tag color={getEntityTagColor(item.entityType)} style={{ fontSize: 10, margin: 0 }}>
                    {formatEntityLabel(item.entityType)}
                  </Tag>
                  {item.assignedRole && (
                    <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>
                      {formatRoleName(item.assignedRole)}
                    </Tag>
                  )}
                  {item.dueAt && (
                    <Tag
                      color={isOverdue ? 'error' : 'warning'}
                      icon={<ClockCircleOutlined />}
                      style={{ fontSize: 10, fontWeight: 600, margin: 0 }}
                    >
                      {isOverdue ? 'Terlambat' : dayjs(item.dueAt).fromNow()}
                    </Tag>
                  )}
                </>
              )}
            </div>

            {/* Task title */}
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 13.5, color: '#0f172a', display: 'block', lineHeight: 1.35 }}>
                {formatTaskTitle(item.title, item)}
              </Text>
            </div>

            {/* Business context */}
            {isClosureTask ? (
              <div style={{ marginBottom: 4, fontSize: 12, color: '#334155', lineHeight: '1.4' }}>
                {formatTaskDescription(item)}
              </div>
            ) : (
              renderBellBusinessContextBlock(item)
            )}

            {/* Timestamp & Action Button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 6,
                paddingTop: 6,
                borderTop: '1px dashed #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                <ClockCircleOutlined style={{ fontSize: 11 }} />
                <span>{dayjs(item.createdAt).fromNow()}</span>
              </div>

              <button
                type="button"
                disabled={!isActionAvailable}
                onClick={(e) => {
                  e.stopPropagation();
                  if (targetUrl) {
                    navigateTodoAction(targetUrl, router);
                    setOpen(false);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: isActionAvailable ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                  backgroundColor: isActionAvailable ? '#eff6ff' : '#f8fafc',
                  color: isActionAvailable ? '#2563eb' : '#94a3b8',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: isActionAvailable ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isActionAvailable ? formatContextualCta(item) : 'Aksi Belum Tersedia'}</span>
                {isActionAvailable && <ArrowRightOutlined style={{ fontSize: 10 }} />}
              </button>
            </div>
          </div>
        </div>
      );
    },
    [router]
  );

  const renderNotificationItem = useCallback(
    (item: Notification) => {
      const isWon = item.metaData?.action_type === 'MARKED_WON';
      const category = item.metaData?.category;
      const priority = item.metaData?.priority;
      const targetUrl = resolveNotificationTarget(item);

      return (
        <div
          key={item.id}
          onClick={async () => {
            if (!item.isRead) {
              await markAsRead(item.id);
            }
            if (targetUrl) {
              router.push(targetUrl);
              setOpen(false);
            }
          }}
          style={{
            backgroundColor: '#ffffff',
            border: item.isRead ? '1px solid #f1f5f9' : '1px solid #cbd5e1',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 10,
            boxShadow: item.isRead ? '0 1px 2px rgba(0, 0, 0, 0.02)' : '0 2px 5px rgba(37, 99, 235, 0.06)',
            cursor: targetUrl ? 'pointer' : 'default',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#94a3b8';
            e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = item.isRead ? '#f1f5f9' : '#cbd5e1';
            e.currentTarget.style.boxShadow = item.isRead ? '0 1px 2px rgba(0, 0, 0, 0.02)' : '0 2px 5px rgba(37, 99, 235, 0.06)';
          }}
        >
          {/* Bell icon in rounded box */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: item.isRead ? '#f8fafc' : '#eff6ff',
              border: `1px solid ${item.isRead ? '#e2e8f0' : '#dbeafe'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <BellOutlined style={{ color: item.isRead ? '#94a3b8' : '#2563eb', fontSize: 17 }} />
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              {renderCategoryTag(category)}
              {renderPriorityBadge(priority)}
              {isWon && <Tag color="success" style={{ fontWeight: 'bold', fontSize: 10, margin: 0 }}>WON</Tag>}
            </div>

            {/* Notification Title */}
            {item.title && (
              <div style={{ marginBottom: 3 }}>
                <Text strong style={{ fontSize: 13.5, color: item.isRead ? '#475569' : '#0f172a', display: 'block', lineHeight: 1.35 }}>
                  {formatNotificationTitle(item.title)}
                </Text>
              </div>
            )}

            {/* Business context */}
            {renderBellBusinessContextBlock(item)}

            {/* Message Body */}
            <div style={{ marginBottom: 6 }}>
              <Text style={{ display: 'block', fontSize: 12, color: item.isRead ? '#64748b' : '#334155', lineHeight: 1.45 }}>
                {renderSmartMessage(formatNotificationMessage(item.message), item.isRead)}
              </Text>
            </div>

            {/* Timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
              <ClockCircleOutlined style={{ fontSize: 11 }} />
              <span>{dayjs(item.createdAt).fromNow()}</span>
            </div>
          </div>

          {/* Unread dot or chevron */}
          {!item.isRead ? (
            <div style={{ paddingLeft: 4, paddingTop: 4, flexShrink: 0 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
                }}
              />
            </div>
          ) : (
            <RightOutlined style={{ color: '#cbd5e1', fontSize: 12, flexShrink: 0, marginTop: 4 }} />
          )}
        </div>
      );
    },
    [markAsRead, router]
  );

  const renderMobileTodoCard = useCallback(
    (item: TodoItem) => {
      const targetUrl = resolveTodoActionTarget(item);
      const isActionAvailable = Boolean(targetUrl);
      const dueTime = item.dueAt ? new Date(item.dueAt).getTime() : null;
      const isOverdue = dueTime !== null && dueTime < Date.now();
      const isGoNoGoApproval = item.actionType === 'GO_NOGO_APPROVAL';
      const isGoNoGoRevision = item.actionType === 'GO_NOGO_REVISION';
      const isClosureTask =
        item.entityType === 'PROJECT_CLOSURE' ||
        item.entityType === 'PENUTUPAN PROYEK' ||
        item.sourceType === 'DOMAIN_PROJECT_CLOSURE' ||
        String(item.actionType || '').startsWith('PROJECT_CLOSURE');
      const ctx = extractItemBusinessContext(item);

      return (
        <div
          key={item.todoId}
          onClick={() => {
            if (targetUrl) {
              navigateTodoAction(targetUrl, router);
              setOpen(false);
            }
          }}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '13px 14px',
            marginBottom: 10,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            cursor: isActionAvailable ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            transition: 'background-color 0.15s ease',
          }}
        >
          {/* Red document icon in soft red rounded box */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <FileTextOutlined style={{ color: '#ef4444', fontSize: 19 }} />
          </div>

          {/* Middle details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              {isGoNoGoApproval ? (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: 4 }}>TENDER</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '1px 6px', borderRadius: 4 }}>Direktur</span>
                </>
              ) : isGoNoGoRevision ? (
                <>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: 4 }}>TENDER</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '1px 6px', borderRadius: 4 }}>Marketing</span>
                </>
              ) : isClosureTask ? (
                <>
                  <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>Penutupan Proyek</Tag>
                  {item.assignedRole && (
                    <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>
                      {formatRoleName(item.assignedRole)}
                    </Tag>
                  )}
                </>
              ) : (
                <>
                  <Tag color={getEntityTagColor(item.entityType)} style={{ fontSize: 10, margin: 0 }}>
                    {formatEntityLabel(item.entityType)}
                  </Tag>
                  {item.assignedRole && (
                    <Tag color="gold" style={{ fontSize: 10, margin: 0 }}>
                      {formatRoleName(item.assignedRole)}
                    </Tag>
                  )}
                  {item.dueAt && (
                    <Tag
                      color={isOverdue ? 'error' : 'warning'}
                      icon={<ClockCircleOutlined />}
                      style={{ fontSize: 10, fontWeight: 600, margin: 0 }}
                    >
                      {isOverdue ? 'Terlambat' : dayjs(item.dueAt).fromNow()}
                    </Tag>
                  )}
                </>
              )}
            </div>

            {/* Task title */}
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.35, marginBottom: 4 }}>
              {formatTaskTitle(item.title, item)}
            </div>

            {/* Context details */}
            {ctx.projectName && (
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', marginBottom: 2 }}>
                {ctx.projectName}
              </div>
            )}

            {ctx.customerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <AppstoreOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
                <span>
                  Pelanggan: <strong style={{ fontWeight: 500, color: '#475569' }}>{ctx.customerName}</strong>
                </span>
              </div>
            )}

            {item.submittedByName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <UserOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
                <span>Diajukan oleh: {item.submittedByName}</span>
              </div>
            )}

            {/* Bottom row: timestamp & actionable Tinjau affordance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                <ClockCircleOutlined style={{ fontSize: 11 }} />
                <span>{dayjs(item.createdAt).fromNow()}</span>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: 11.5, fontWeight: 600 }}>
                <span>{isActionAvailable ? formatContextualCta(item) : 'Lihat Detail'}</span>
                <RightOutlined style={{ fontSize: 10, color: '#2563eb' }} />
              </div>
            </div>
          </div>
        </div>
      );
    },
    [router]
  );

  const renderMobileNotificationCard = useCallback(
    (item: Notification) => {
      const isWon = item.metaData?.action_type === 'MARKED_WON';
      const category = item.metaData?.category;
      const priority = item.metaData?.priority;
      const targetUrl = resolveNotificationTarget(item);

      return (
        <div
          key={item.id}
          onClick={async () => {
            if (!item.isRead) {
              await markAsRead(item.id);
            }
            if (targetUrl) {
              router.push(targetUrl);
              setOpen(false);
            }
          }}
          style={{
            backgroundColor: '#ffffff',
            border: item.isRead ? '1px solid #f1f5f9' : '1px solid #cbd5e1',
            borderRadius: 14,
            padding: '13px 14px',
            marginBottom: 10,
            boxShadow: item.isRead ? '0 1px 2px rgba(0, 0, 0, 0.02)' : '0 2px 5px rgba(37, 99, 235, 0.06)',
            cursor: targetUrl ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            transition: 'background-color 0.15s ease',
          }}
        >
          {/* Bell Icon in rounded box */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: item.isRead ? '#f8fafc' : '#eff6ff',
              border: `1px solid ${item.isRead ? '#e2e8f0' : '#dbeafe'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <BellOutlined style={{ color: item.isRead ? '#94a3b8' : '#2563eb', fontSize: 18 }} />
          </div>

          {/* Middle info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              {renderCategoryTag(category)}
              {renderPriorityBadge(priority)}
              {isWon && <Tag color="success" style={{ fontWeight: 'bold', fontSize: 10, margin: 0 }}>WON</Tag>}
            </div>

            {/* Notification Title */}
            {item.title && (
              <div style={{ fontSize: 13.5, fontWeight: 600, color: item.isRead ? '#475569' : '#0f172a', lineHeight: 1.35, marginBottom: 3 }}>
                {formatNotificationTitle(item.title)}
              </div>
            )}

            {/* Business context */}
            {renderBellBusinessContextBlock(item)}

            {/* Message */}
            <div style={{ fontSize: 12, color: item.isRead ? '#64748b' : '#334155', lineHeight: 1.45, marginBottom: 6 }}>
              {renderSmartMessage(formatNotificationMessage(item.message), item.isRead)}
            </div>

            {/* Timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
              <ClockCircleOutlined style={{ fontSize: 11 }} />
              <span>{dayjs(item.createdAt).fromNow()}</span>
            </div>
          </div>

          {/* Unread indicator or chevron */}
          {!item.isRead ? (
            <div style={{ paddingTop: 4, flexShrink: 0 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
                }}
              />
            </div>
          ) : (
            <RightOutlined style={{ color: '#cbd5e1', fontSize: 12, flexShrink: 0, marginTop: 4 }} />
          )}
        </div>
      );
    },
    [markAsRead, router]
  );

  const popoverContent = useMemo(
    () => (
      <div
        style={{
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'min(640px, calc(100vh - 90px))',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px 0 18px', borderBottom: `1px solid #f1f5f9`, backgroundColor: '#ffffff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: 12 }}>
            <Text style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{INBOX_PAGE_CONFIG.TITLE}</Text>
            <PushNotificationToggle compact />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setActiveTab('todo')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'todo' ? '2px solid #2563eb' : '2px solid transparent',
                padding: '6px 12px 8px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: activeTab === 'todo' ? '#2563eb' : '#64748b',
                fontWeight: activeTab === 'todo' ? 600 : 500,
                fontSize: 13.5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{INBOX_TABS.TODO}</span>
              <span
                style={{
                  borderRadius: 12,
                  padding: '1px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: activeTab === 'todo' ? '#2563eb' : '#f1f5f9',
                  color: activeTab === 'todo' ? '#ffffff' : '#64748b',
                }}
              >
                {todoCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'notifications' ? '2px solid #2563eb' : '2px solid transparent',
                padding: '6px 12px 8px 12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: activeTab === 'notifications' ? '#2563eb' : '#64748b',
                fontWeight: activeTab === 'notifications' ? 600 : 500,
                fontSize: 13.5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{INBOX_TABS.NOTIFICATIONS}</span>
              <span
                style={{
                  borderRadius: 12,
                  padding: '1px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: activeTab === 'notifications' ? '#2563eb' : '#f1f5f9',
                  color: activeTab === 'notifications' ? '#ffffff' : '#64748b',
                }}
              >
                {unreadNotificationCount}
              </span>
            </button>
          </div>
        </div>

        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
          }}
        >
          {activeTab === 'todo' ? (
            loadingTodos && todos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : todos.length === 0 ? (
              <Empty description={INBOX_EMPTY_STATES.TODO} style={{ margin: '40px 0' }} />
            ) : (
              todos.map(renderTodoItem)
            )
          ) : (
            loadingNotifications && notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : notifications.length === 0 ? (
              <Empty description={INBOX_EMPTY_STATES.NOTIFICATIONS} style={{ margin: '40px 0' }} />
            ) : (
              notifications.map(renderNotificationItem)
            )
          )}
        </div>

        <div
          style={{
            padding: '11px 16px',
            borderTop: `1px solid #f1f5f9`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                router.push(INBOX_PAGE_CONFIG.ROUTE);
                setOpen(false);
              }}
              style={{ padding: 0, fontSize: 12.5, fontWeight: 600, color: '#2563eb' }}
            >
              Lihat Semua {INBOX_PAGE_CONFIG.TITLE}
            </Button>
            <span style={{ color: '#cbd5e1', fontSize: 12 }}>•</span>
            <Button
              type="link"
              size="small"
              onClick={() => {
                router.push('/profile');
                setOpen(false);
              }}
              style={{ padding: 0, color: '#64748b', fontSize: 12 }}
            >
              Kelola Perangkat
            </Button>
          </div>

          {activeTab === 'notifications' && notifications.length > 0 && (
            <Button
              type="text"
              size="small"
              onClick={markAllAsRead}
              icon={<CheckOutlined />}
              style={{ color: '#2563eb', fontWeight: 500, fontSize: 12, padding: 0 }}
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

  const attentionCount = useMemo(() => {
    return calculateAttentionCount({
      todoCount,
      unreadNotificationCount,
      todos,
      unreadNotifications: notifications,
    });
  }, [todoCount, unreadNotificationCount, todos, notifications]);

  const mobileSheetContent = useMemo(
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '82vh' }}>
        {/* Top drag handle indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2, paddingBottom: 8, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' }} />
        </div>

        {/* Header: Title, PushToggle, and Close button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            flexShrink: 0,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{INBOX_PAGE_CONFIG.TITLE}</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PushNotificationToggle compact />
            <Button
              type="text"
              shape="circle"
              size="small"
              icon={<CloseOutlined style={{ fontSize: 15, color: '#475569' }} />}
              onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
          </div>
        </div>

        {/* Clean Benchmark Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', marginBottom: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setActiveTab('todo')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'todo' ? '2px solid #2563eb' : '2px solid transparent',
              padding: '8px 12px 10px 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: activeTab === 'todo' ? '#2563eb' : '#64748b',
              fontWeight: activeTab === 'todo' ? 600 : 500,
              fontSize: 14,
            }}
          >
            <span>{INBOX_TABS.TODO}</span>
            <span
              style={{
                borderRadius: 12,
                padding: '1px 8px',
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: activeTab === 'todo' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'todo' ? '#ffffff' : '#64748b',
              }}
            >
              {todoCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'notifications' ? '2px solid #2563eb' : '2px solid transparent',
              padding: '8px 12px 10px 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: activeTab === 'notifications' ? '#2563eb' : '#64748b',
              fontWeight: activeTab === 'notifications' ? 600 : 500,
              fontSize: 14,
            }}
          >
            <span>{INBOX_TABS.NOTIFICATIONS}</span>
            <span
              style={{
                borderRadius: 12,
                padding: '1px 8px',
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: activeTab === 'notifications' ? '#2563eb' : '#f1f5f9',
                color: activeTab === 'notifications' ? '#ffffff' : '#64748b',
              }}
            >
              {unreadNotificationCount}
            </span>
          </button>
        </div>

        {/* Scrollable items */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: 2,
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
          }}
        >
          {activeTab === 'todo' ? (
            loadingTodos && todos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : todos.length === 0 ? (
              <Empty description={INBOX_EMPTY_STATES.TODO} style={{ margin: '40px 0' }} />
            ) : (
              todos.map(renderMobileTodoCard)
            )
          ) : (
            loadingNotifications && notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : notifications.length === 0 ? (
              <Empty description={INBOX_EMPTY_STATES.NOTIFICATIONS} style={{ margin: '40px 0' }} />
            ) : (
              <>
                {notifications.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <Button
                      type="text"
                      size="small"
                      onClick={markAllAsRead}
                      icon={<CheckOutlined />}
                      style={{ color: '#2563eb', fontWeight: 500, fontSize: 12, padding: 0 }}
                    >
                      Tandai semua dibaca
                    </Button>
                  </div>
                )}
                {notifications.map(renderMobileNotificationCard)}
              </>
            )
          )}
        </div>

        {/* Full-width benchmark bottom CTA */}
        <div style={{ flexShrink: 0, paddingTop: 10, backgroundColor: '#ffffff' }}>
          <div
            onClick={() => {
              router.push(INBOX_PAGE_CONFIG.ROUTE);
              setOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '11px 16px',
              cursor: 'pointer',
              color: '#2563eb',
              fontWeight: 600,
              fontSize: 13.5,
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)',
            }}
          >
            <UnorderedListOutlined style={{ fontSize: 15 }} />
            <span style={{ flex: 1, textAlign: 'center' }}>Lihat Semua {INBOX_PAGE_CONFIG.TITLE}</span>
            <RightOutlined style={{ fontSize: 12 }} />
          </div>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                router.push('/profile');
                setOpen(false);
              }}
              style={{ color: '#64748b', fontSize: 12, padding: 0 }}
            >
              Pengaturan Notifikasi & Perangkat Mobile
            </Button>
          </div>
        </div>
      </div>
    ),
    [
      activeTab,
      todoCount,
      unreadNotificationCount,
      loadingTodos,
      todos,
      renderMobileTodoCard,
      loadingNotifications,
      notifications,
      renderMobileNotificationCard,
      markAllAsRead,
      router,
    ]
  );

  return (
    <>
      {isMobile ? (
        <>
          <div
            onClick={() => setOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '4px' }}
          >
            <Badge count={attentionCount} overflowCount={99} size="small" style={{ cursor: 'pointer' }}>
              <BellOutlined style={{ fontSize: '20px', cursor: 'pointer', color: token.colorTextSecondary }} />
            </Badge>
          </div>
          <Drawer
            placement="bottom"
            open={open}
            onClose={() => setOpen(false)}
            closable={false}
            height="auto"
            styles={{
              wrapper: {
                maxWidth: 480,
                margin: '0 auto',
                left: 0,
                right: 0,
              },
              content: {
                borderRadius: '24px 24px 0 0',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              },
              body: {
                padding: '12px 16px 20px 16px',
                maxHeight: '82vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
              },
            }}
            contentWrapperStyle={{
              maxWidth: 480,
              margin: '0 auto',
              left: 0,
              right: 0,
              borderRadius: '24px 24px 0 0',
              overflow: 'hidden',
            }}
            bodyStyle={{
              padding: '12px 16px 20px 16px',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
            }}
          >
            {mobileSheetContent}
          </Drawer>
        </>
      ) : (
        <Popover
          content={popoverContent}
          trigger="click"
          placement="bottomRight"
          open={open}
          onOpenChange={setOpen}
          overlayInnerStyle={{
            padding: 0,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
            border: '1px solid #e2e8f0',
          }}
          arrow={false}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '4px' }}>
            <Badge count={attentionCount} overflowCount={99} size="small" style={{ cursor: 'pointer' }}>
              <BellOutlined style={{ fontSize: '20px', cursor: 'pointer', color: token.colorTextSecondary }} />
            </Badge>
          </div>
        </Popover>
      )}
    </>
  );
};
