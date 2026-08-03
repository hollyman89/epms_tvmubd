import axios from 'axios';
import { Modal } from 'antd';
import { ENV, STORAGE_KEYS } from '@/config';

export const apiClient = axios.create({
  baseURL: ENV.API_URL,
});

// Request Interceptor: Inject Bearer Token from Storage SSOT
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token =
        localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
        localStorage.getItem(STORAGE_KEYS.LEGACY_ACCESS_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Consolidated 401 & 409 Global Handlers
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 409) {
      console.warn('⚠️ [409 CONFLICT INTERCEPTOR] Optimistic Lock Version Mismatch detected:', error.response.data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('epms:optimistic_lock_conflict', {
            detail: error.response.data,
          })
        );
      }

      Modal.confirm({
        title: '⚠️ Data Telah Diubah Pengguna Lain',
        content:
          'Data yang Anda edit telah diperbarui oleh pengguna lain di server. Halaman telah memuat data versi terbaru secara otomatis agar tidak timpa-menimpa.',
        okText: 'Pahami & Lanjutkan',
        cancelButtonProps: { style: { display: 'none' } },
        onOk() {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('epms:refetch_all'));
          }
        },
      });
    }

    if (status === 401) {
      console.warn('⚠️ [401 UNAUTHORIZED INTERCEPTOR] Session expired or invalid token');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epms:unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
