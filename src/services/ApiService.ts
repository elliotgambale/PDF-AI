// src/services/ApiService.ts
import { 
  PDF, 
  ChatMessage, 
  DatabaseStatusResponse, 
  UploadPDFResponse, 
  ChatResponse, 
  PDFListResponse, 
  ChatHistoryResponse, 
  DeletePDFResponse,
  ClearChatResponse,
  API_ENDPOINTS 
} from '../types';

class ApiServiceClass {
  private baseUrl = API_ENDPOINTS.BASE_URL;

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.makeRequest(API_ENDPOINTS.HEALTH, {
      method: 'GET',
    });
  }

  async getDatabaseStatus(): Promise<DatabaseStatusResponse> {
    return this.makeRequest(API_ENDPOINTS.DATABASE_STATUS, {
      method: 'GET',
    });
  }

  async initializeDatabase(): Promise<{ success: boolean; message: string; error?: string }> {
    return this.makeRequest(API_ENDPOINTS.INIT_DB, {
      method: 'POST',
    });
  }

  async clearDatabase(): Promise<{ success: boolean; message: string; error?: string }> {
    return this.makeRequest(API_ENDPOINTS.CLEAR_DB, {
      method: 'POST',
    });
  }

  async uploadPDF(
    fileUri: string,
    fileName: string,
    startPage: string,
    endPage: string
  ): Promise<UploadPDFResponse> {
    const formData = new FormData();
    
    // Create file object for upload
    formData.append('file', {
      uri: fileUri,
      type: 'application/pdf',
      name: fileName,
    } as any);
    
    if (startPage) {
      formData.append('startPage', startPage);
    }
    
    if (endPage) {
      formData.append('endPage', endPage);
    }

    return this.makeRequest(API_ENDPOINTS.UPLOAD_PDF, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
  }

  async getPDFs(): Promise<PDFListResponse> {
    return this.makeRequest(API_ENDPOINTS.PDFS, {
      method: 'GET',
    });
  }

  async deletePDF(pdfId: number): Promise<DeletePDFResponse> {
    return this.makeRequest(`${API_ENDPOINTS.PDFS}/${pdfId}`, {
      method: 'DELETE',
    });
  }

  async chatWithPDF(pdfId: number, message: string): Promise<ChatResponse> {
    return this.makeRequest(`${API_ENDPOINTS.CHAT}/${pdfId}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getChatHistory(pdfId: number): Promise<ChatHistoryResponse> {
    return this.makeRequest(`${API_ENDPOINTS.MESSAGES}/${pdfId}/messages`, {
      method: 'GET',
    });
  }

  async clearChatHistory(pdfId: number): Promise<ClearChatResponse> {
    return this.makeRequest(`${API_ENDPOINTS.MESSAGES}/${pdfId}/clear-chat`, {
      method: 'POST',
    });
  }

  // Debug endpoints
  async debugTables(): Promise<any> {
    return this.makeRequest('/api/debug/tables', {
      method: 'GET',
    });
  }

  async debugPDFContent(pdfId: number): Promise<any> {
    return this.makeRequest(`/api/debug/pdf/${pdfId}/content`, {
      method: 'GET',
    });
  }

  // Update base URL if needed (for development vs production)
  setBaseUrl(url: string): void {
    this.baseUrl = url as typeof this.baseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

export const ApiService = new ApiServiceClass();