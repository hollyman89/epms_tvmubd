import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface DebugPanelProps {
  reactQueryData: any[];
  fallbackData: any[];
}

export const DebugCachePanel: React.FC<DebugPanelProps> = ({ 
  reactQueryData, 
  fallbackData 
}) => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getTenderName = (item: any): string => {
    if (!item) return 'Tidak Diketahui';
    return item.nama_proyek || item.projectName || item.title || item.name || item.project_name || `ID #${item.id || 'N/A'}`;
  };

  const getTenderInfo = (item: any): string => {
    if (!item) return 'KOSONG';
    const idStr = item.id ? `#${item.id}` : 'No-ID';
    const stageStr = item.stage || item.status || 'NO-STAGE';
    const nameStr = getTenderName(item);
    return `[${idStr} - ${stageStr}] "${nameStr}"`;
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['tenders'] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epms:refetch_all'));
      }
    } catch (e) {
      console.error('Error invalidating query cache:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  try {
    const hasRQ = Array.isArray(reactQueryData) && reactQueryData.length > 0;
    const hasFallback = Array.isArray(fallbackData) && fallbackData.length > 0;
    
    const rqItemInfo = hasRQ ? getTenderInfo(reactQueryData[0]) : 'KOSONG';
    const fallbackItemInfo = hasFallback ? getTenderInfo(fallbackData[0]) : 'KOSONG';
    const usingRQ = hasRQ;

    return (
      <div style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 99999,
        background: '#0f172a',
        color: '#f8fafc',
        padding: '16px 20px',
        borderRadius: '12px',
        fontFamily: 'monospace',
        fontSize: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        border: '2px solid #3b82f6',
        maxWidth: '360px',
        opacity: 0.95,
        pointerEvents: 'none' // Root container ignores clicks so underlying buttons work
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
          <span style={{ fontWeight: 'bold' }}>🛠️ DEBUG CACHE STATUS</span>
          <button 
            onClick={handleManualRefresh}
            style={{
              pointerEvents: 'auto', // Button accepts clicks
              background: isRefreshing ? '#64748b' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
          >
            {isRefreshing ? '🔄 Refetching...' : '⚡ Refresh Cache'}
          </button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>📦 React Query:</span>
          <span style={{ color: hasRQ ? '#4ade80' : '#f87171', fontWeight: 600 }}>
            {hasRQ ? `✅ ${reactQueryData.length} items` : '❌ KOSONG'}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>📂 Fallback (useState):</span>
          <span style={{ color: hasFallback ? '#facc15' : '#f87171', fontWeight: 600 }}>
            {hasFallback ? `📁 ${fallbackData.length} items` : '❌ KOSONG'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
          <span>🎯 UI Memakai:</span>
          <span style={{ color: usingRQ ? '#4ade80' : '#facc15', fontWeight: 'bold' }}>
            {usingRQ ? 'REACT QUERY ✅' : 'FALLBACK ⚠️'}
          </span>
        </div>

        <div style={{ fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '8px' }}>
          <div>🔹 Item #1 (RQ): <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{rqItemInfo}</span></div>
          <div style={{ marginTop: 4 }}>🔸 Item #1 (Fallback): <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{fallbackItemInfo}</span></div>
          <div style={{ marginTop: '8px', color: '#38bdf8', fontSize: '10px', lineHeight: 1.3 }}>
            💡 Geser/Edit kartu untuk menguji responsivitas cache secara real-time.
          </div>
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 99999,
        background: '#7f1d1d',
        color: '#fecdd3',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        ⚠️ Debug Panel Error: {err.message}
      </div>
    );
  }
};
