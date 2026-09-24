import { extractUnreadNotificationCount } from '../notificationCount';

describe('extractUnreadNotificationCount (Notification Bell Hotfix N1.1)', () => {
  it('1. correctly extracts count from double-wrapped TransformInterceptor response', () => {
    const wrappedResponse = {
      meta: {
        code: 200,
        status: 'success',
        message: 'Request successful',
      },
      data: {
        message: 'Unread count retrieved successfully',
        data: {
          count: 42,
        },
      },
    };

    expect(extractUnreadNotificationCount(wrappedResponse)).toBe(42);
  });

  it('2. correctly extracts count from single-wrapped controller response', () => {
    const controllerResponse = {
      message: 'Unread count retrieved successfully',
      data: {
        count: 7,
      },
    };

    expect(extractUnreadNotificationCount(controllerResponse)).toBe(7);
  });

  it('3. correctly extracts count from flat object', () => {
    expect(extractUnreadNotificationCount({ count: 15 })).toBe(15);
  });

  it('4. safely handles zero count without becoming NaN or undefined', () => {
    const zeroResponse = {
      data: {
        data: {
          count: 0,
        },
      },
    };

    expect(extractUnreadNotificationCount(zeroResponse)).toBe(0);
  });

  it('5. safely handles empty, null, and undefined responses', () => {
    expect(extractUnreadNotificationCount(null)).toBe(0);
    expect(extractUnreadNotificationCount(undefined)).toBe(0);
    expect(extractUnreadNotificationCount({})).toBe(0);
    expect(extractUnreadNotificationCount({ data: {} })).toBe(0);
    expect(extractUnreadNotificationCount({ data: { data: {} } })).toBe(0);
  });

  it('6. safely handles string numbers and converts to numeric', () => {
    expect(extractUnreadNotificationCount({ count: '23' })).toBe(23);
  });

  it('7. safely handles invalid or NaN inputs by returning 0', () => {
    expect(extractUnreadNotificationCount({ count: NaN })).toBe(0);
    expect(extractUnreadNotificationCount({ count: 'invalid' })).toBe(0);
    expect(extractUnreadNotificationCount({ count: null })).toBe(0);
    expect(extractUnreadNotificationCount({ count: -5 })).toBe(0);
  });
});
