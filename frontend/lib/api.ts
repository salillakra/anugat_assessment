const API_BASE_URL = "http://localhost:3001/api";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

class ApiClient {
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Determine headers
    const headers = this.getHeaders();
    if (options.body instanceof FormData) {
      // Fetch will automatically set correct content-type with boundary for FormData
      delete headers["Content-Type"];
    }

    const config: RequestInit = {
      ...options,
      credentials: "include",
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 204) {
        return { success: true };
      }

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401 && typeof window !== "undefined") {
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
        return {
          success: false,
          error: result?.error ?? `Request failed with status ${response.status}`,
        };
      }

      return result as ApiResponse<T>;
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network request failed",
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  async put<T>(
    endpoint: string,
    body: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient();
export { API_BASE_URL };
