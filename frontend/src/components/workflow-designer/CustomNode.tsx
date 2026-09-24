import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_TYPES } from './Sidebar';

export const CustomNode = ({ data, type }: any) => {
  const actualType = data?.type || type || 'TASK';
  const nodeDef = NODE_TYPES.find(n => n.type === actualType) || NODE_TYPES[1]; // fallback to TASK

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 4,
      background: '#fff',
      border: '1px solid #d9d9d9',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      minWidth: 120,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Target handle (Input) */}
      {actualType !== 'START' && (
        <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {nodeDef.icon}
        <span style={{ fontSize: 10, fontWeight: 600, color: '#595959', textTransform: 'uppercase' }}>
          {actualType}
        </span>
      </div>
      
      <div style={{ fontSize: 13, textAlign: 'center', fontWeight: 500, color: '#262626' }}>
        {data?.label || nodeDef.label}
      </div>

      {(data?.assignedRole || data?.role) && (
        <div style={{ fontSize: 9, color: '#8c8c8c', marginTop: 4, textAlign: 'center' }}>
          {(data.assignedRole || data.role).replace(/_/g, ' ')}
        </div>
      )}

      {/* Source handle (Output) */}
      {actualType !== 'END' && (
        <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
      )}
    </div>
  );
};
