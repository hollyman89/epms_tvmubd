import { apiClient } from './axios';

// Wrapper for backward compatibility (using SSOT apiClient)
export const api = apiClient;


// Finance Helpers
export const getInvoices = () => apiClient.get('/finance/invoices');
export const createPayment = (data: any) => apiClient.post('/finance/payments', data);

export default apiClient;
