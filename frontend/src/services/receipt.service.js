import api from './api';

export const receiptService = {
  /**
   * Uploads a receipt image to the backend OCR scanning endpoint.
   * Does NOT create a transaction.
   * @param {File} file - Receipt image (JPG, PNG, WEBP <= 5MB)
   * @returns {Promise<Object>} Extracted OCR data payload
   */
  async scanReceipt(file) {
    const formData = new FormData();
    formData.append('receipt_image', file);

    const response = await api.post('/expenses/receipts/scan/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },
};

export default receiptService;
