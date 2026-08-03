import React, { useState, useRef, useEffect } from 'react';

export interface SpkItem {
  id: string | number;
  title: string;
  clientName: string;
  picName: string;
  picAvatarUrl?: string;
  price: number;
  deadline: string;
  spkStatusText: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SpkCardProps {
  item: SpkItem;
  onViewDetail?: (item: SpkItem) => void;
  onEdit?: (item: SpkItem) => void;
  onDelete?: (item: SpkItem) => void;
}

export const SpkCard: React.FC<SpkCardProps> = ({ item, onViewDetail, onEdit, onDelete }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-close dropdown saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Utility Format Rupiah (Tanpa Angka Desimal Tambahan)
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    })
      .format(val)
      .replace(',00', '');
  };

  // Utility Skema Warna Badge Priority
  const getPriorityClass = (priority: SpkItem['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'MEDIUM':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'LOW':
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 transition-all hover:shadow-md">
      {/* HEADER (Baris Atas) */}
      <div className="flex justify-between items-start gap-4">
        {/* KIRI ATAS: Judul Proyek & Nama Klien (Micro-text) */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-semibold text-slate-900 leading-snug break-words" title={item.title}>
            {item.title}
          </h3>
          <p className="text-[11px] font-medium tracking-wider text-slate-400 uppercase mt-1">{item.clientName}</p>
        </div>

        {/* KANAN ATAS: Priority Badge & Menu 3 Dots (Sangat Bersih) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* PRIORITY Badge (Rose / Orange Pill) */}
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide whitespace-nowrap ${getPriorityClass(
              item.priority
            )}`}
          >
            {item.priority}
          </span>

          {/* Menu 3 Dots (⋮) */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
              aria-label="Menu Opsi"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {/* Dropdown Menu Modal */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-20 text-sm animate-in fade-in duration-150">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onViewDetail?.(item);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Lihat Detail
                </button>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onEdit?.(item);
                  }}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onDelete?.(item);
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 font-medium transition-colors"
                >
                  Hapus
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER (Baris Bawah dengan Hairline Separator) */}
      <div className="flex justify-between items-center gap-4 pt-3 mt-3 border-t border-slate-100">
        {/* KIRI BAWAH: Avatar PIC + Nama PIC dengan Status Dot */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {item.picAvatarUrl ? (
              <img
                src={item.picAvatarUrl}
                alt={item.picName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                {item.picName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white"></span>
          </div>
          <span className="text-[13px] font-semibold text-slate-700 truncate">{item.picName}</span>
        </div>

        {/* KANAN BAWAH: Harga Proyek & Temporal Metadata (Timer + Tanggal) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Harga Proyek (Tabular Nums & Slate 900) */}
          <span className="text-[15px] font-semibold text-slate-900 tabular-nums">
            {formatCurrency(item.price)}
          </span>

          {/* Temporal Data: SPK Timer & Deadline Date dikelompokkan */}
          <div className="flex items-center gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md px-2 py-1">
            {/* SPK Timer */}
            <span className="flex items-center gap-1 font-medium text-amber-700">
              <span>⏳</span>
              <span>{item.spkStatusText.replace('SPK: ', '')}</span>
            </span>
            <span className="text-slate-300">|</span>
            {/* Tanggal Deadline */}
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{item.deadline}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Demo List Component
export const SpkCardListDemo: React.FC = () => {
  const mockData: SpkItem[] = [
    {
      id: 1,
      title: 'Pembuatan Outlet Tomoro Jelambar',
      clientName: 'Tomoro Coffe',
      picName: 'Lukas Kurniawan',
      price: 475000000,
      deadline: '24 Jul 2026',
      spkStatusText: 'SPK: Sisa 32 jam',
      priority: 'MEDIUM',
    },
    {
      id: 2,
      title: 'Pembuatan Outlet Tomoro Slipi',
      clientName: 'Tomoro Coffe',
      picName: 'Lukas Kurniawan',
      price: 450000000,
      deadline: '24 Jul 2026',
      spkStatusText: 'SPK: Sisa 32 jam',
      priority: 'HIGH',
    },
    {
      id: 3,
      title: 'Renovasi Lahan Parkir Outlet Tomoro Dipatiukur Bandung',
      clientName: 'Tomoro Coffe',
      picName: 'Lukas Kurniawan',
      price: 245000000,
      deadline: '25 Jul 2026',
      spkStatusText: 'SPK: Sisa 32 jam',
      priority: 'HIGH',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 min-h-screen">
      {mockData.map((item) => (
        <SpkCard
          key={item.id}
          item={item}
          onViewDetail={(i) => alert(`Detail: ${i.title}`)}
          onEdit={(i) => alert(`Edit: ${i.title}`)}
          onDelete={(i) => alert(`Hapus: ${i.title}`)}
        />
      ))}
    </div>
  );
};

export default SpkCardListDemo;
