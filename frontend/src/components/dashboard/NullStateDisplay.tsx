import React from 'react';

export type NullSemanticState =
  | 'REAL_ZERO'
  | 'NO_DATA'
  | 'NOT_CALCULABLE'
  | 'NOT_IMPLEMENTED'
  | 'INSUFFICIENT_HISTORY'
  | 'UNVERIFIED_SNAPSHOT';

export interface NullStateDisplayProps {
  state: NullSemanticState;
  zeroDisplay?: string; // Default: '0'
  className?: string;
  style?: React.CSSProperties;
}

export const STATE_TEXT_MAP: Record<NullSemanticState, string> = {
  REAL_ZERO: '0',
  NO_DATA: 'N/A',
  NOT_CALCULABLE: 'Belum dapat dihitung',
  NOT_IMPLEMENTED: 'Belum tersedia',
  INSUFFICIENT_HISTORY: 'Data historis belum cukup',
  UNVERIFIED_SNAPSHOT: 'Data belum tervalidasi',
};

export const NullStateDisplay: React.FC<NullStateDisplayProps> = ({
  state,
  zeroDisplay = '0',
  className = '',
  style,
}) => {
  if (state === 'REAL_ZERO') {
    return (
      <span
        className={className}
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
          color: '#0f172a',
          ...style,
        }}
      >
        {zeroDisplay}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        fontSize: '13px',
        fontWeight: 500,
        color: '#94a3b8',
        fontStyle: 'normal',
        ...style,
      }}
    >
      {STATE_TEXT_MAP[state]}
    </span>
  );
};
