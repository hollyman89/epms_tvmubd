import React from 'react';
import { Space, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface ProjectedUserIdentity {
  id?: number | string | null;
  fullName?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface UserIdentityDisplayProps {
  /** Projected user object with fullName / email */
  user?: ProjectedUserIdentity | null;
  /** Raw userId fallback when user object is unavailable */
  userId?: number | string | null;
  /** Optional fallback role name (e.g. 'Petugas Gudang', 'Finance Team') */
  fallbackRole?: string | null;
  /** Optional generic fallback text */
  fallbackText?: string | null;
  /** Whether to render email as secondary text */
  showEmail?: boolean;
  /** Whether to render user icon */
  showIcon?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
  /** Custom text style */
  textStyle?: React.CSSProperties;
}

/**
 * Core functional resolver for User Identity Presentation hierarchy.
 * Fully deterministic and testable independently of DOM rendering.
 */
export function resolveUserIdentity(props: {
  user?: ProjectedUserIdentity | null;
  userId?: number | string | null;
  fallbackRole?: string | null;
  fallbackText?: string | null;
  showEmail?: boolean;
}): {
  displayName: string;
  email: string | null;
  isTechnicalFallback: boolean;
  isRoleFallback: boolean;
} {
  const { user, userId, fallbackRole, fallbackText, showEmail = false } = props;

  // 1. Resolve candidate primary name
  let candidateName =
    user?.fullName?.trim() ||
    user?.full_name?.trim() ||
    user?.name?.trim() ||
    '';

  // 2. Resolve candidate email
  const candidateEmail = user?.email?.trim() || '';

  // 3. Evaluate presentation hierarchy:
  // (1) fullName
  // (2) fallbackRole / fallbackText
  // (3) email (if no name or role fallback)
  // (4) User #<id> technical fallback
  // (5) '—'
  let displayName = '';
  let isTechnicalFallback = false;
  let isRoleFallback = false;

  if (candidateName) {
    displayName = candidateName;
  } else if (fallbackRole?.trim()) {
    displayName = fallbackRole.trim();
    isRoleFallback = true;
  } else if (fallbackText?.trim()) {
    displayName = fallbackText.trim();
    isRoleFallback = true;
  } else if (candidateEmail) {
    displayName = candidateEmail;
  } else if (
    userId !== undefined &&
    userId !== null &&
    String(userId).trim() !== '' &&
    !isNaN(Number(userId)) &&
    Number(userId) > 0
  ) {
    displayName = `User #${userId}`;
    isTechnicalFallback = true;
  } else if (
    user?.id !== undefined &&
    user?.id !== null &&
    String(user.id).trim() !== '' &&
    !isNaN(Number(user.id)) &&
    Number(user.id) > 0
  ) {
    displayName = `User #${user.id}`;
    isTechnicalFallback = true;
  } else {
    displayName = '—';
  }

  // Guard against stringified bad values
  if (
    displayName === 'undefined' ||
    displayName === 'null' ||
    displayName === '[object Object]' ||
    !displayName
  ) {
    displayName = '—';
  }

  return {
    displayName,
    email: showEmail && candidateEmail && candidateEmail !== displayName ? candidateEmail : null,
    isTechnicalFallback,
    isRoleFallback,
  };
}

/**
 * Canonical Presentation Component for User Identity (UIUX-ROOT-01)
 *
 * Presentation hierarchy:
 * 1. fullName (or full_name / name)
 * 2. email if showEmail is true
 * 3. fallbackRole / fallbackText only if identity genuinely unavailable
 * 4. User #<id> technical final fallback only
 *
 * Guaranteed safe: Never renders undefined, null, or [object Object].
 */
export const UserIdentityDisplay: React.FC<UserIdentityDisplayProps> = (props) => {
  const {
    showIcon = false,
    className,
    style,
    textStyle,
  } = props;

  const { displayName, email, isTechnicalFallback } = resolveUserIdentity(props);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <Space size={4} align="center">
        {showIcon && <UserOutlined style={{ color: '#64748b', fontSize: 12 }} />}
        <Text
          style={{
            fontWeight: 600,
            fontSize: 'inherit',
            color: isTechnicalFallback ? '#64748b' : '#0f172a',
            ...textStyle,
          }}
        >
          {displayName}
        </Text>
      </Space>
      {email && (
        <span
          style={{
            fontSize: '0.85em',
            color: '#64748b',
            lineHeight: 1.2,
            marginTop: 1,
          }}
        >
          {email}
        </span>
      )}
    </span>
  );
};

export default UserIdentityDisplay;
