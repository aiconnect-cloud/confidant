import fetch, { RequestInit } from 'node-fetch';
import { t } from './i18n.js';

export interface SecretCreateResponse {
  id: string;
  expiresAt: string;
  maxAccessCount: number;
}

export interface SecretGetResponse {
  secret: string;
}

export interface SecretStatusResponse {
  id: string;
  expiresAt: string;
  accessCount: number;
  maxAccessCount: number;
}

export interface ErrorResponse {
  error: string;
}

export interface CreateSecretRequestResponse {
  id: string;
  hash: string;
  url: string;
  expiresAt: string;
  status: string;
  label?: string;
}

export interface PollSecretRequestResponse {
  id: string;
  status: string;
  secret: string | null;
  label?: string;
}

export interface SubmitSecretResponse {
  message: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.validateUrl(baseUrl);
  }

  get apiUrl(): string {
    return this.baseUrl;
  }

  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch (error) {
      throw new Error(t('invalidApiEndpoint'));
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        // Network errors
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error(t('connectionFailed'));
        }
        if (error.message.includes('ETIMEDOUT')) {
          throw new Error(t('requestTimedOut'));
        }
        // Re-throw API errors
        throw error;
      }
      throw new Error(t('networkError'));
    }
  }

  async createSecret(
    secret: string,
    ttl?: number,
    maxAccessCount?: number
  ): Promise<SecretCreateResponse> {
    const body: Record<string, unknown> = { secret };

    if (ttl !== undefined) {
      body.ttl = ttl;
    }
    if (maxAccessCount !== undefined) {
      body.maxAccessCount = maxAccessCount;
    }

    return this.request<SecretCreateResponse>('/secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async getSecret(id: string): Promise<SecretGetResponse> {
    return this.request<SecretGetResponse>(`/secrets/${id}`);
  }

  async deleteSecret(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/secrets/${id}`, {
      method: 'DELETE',
    });
  }

  async getSecretStatus(id: string): Promise<SecretStatusResponse> {
    return this.request<SecretStatusResponse>(`/secrets/${id}/status`);
  }

  // ==================== Secret Request Methods ====================

  /**
   * Create a new secret request
   * @param expiresIn Time to live in seconds (default: 86400)
   * @param label Optional label to describe what secret is being requested
   * @returns Secret request details
   */
  async createSecretRequest(
    expiresIn: number = 86400,
    label?: string
  ): Promise<CreateSecretRequestResponse> {
    const body: Record<string, unknown> = { expiresIn };

    if (label !== undefined) {
      body.label = label;
    }

    return this.request<CreateSecretRequestResponse>('/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Poll for secret availability and retrieve if available
   * @param id The request ID
   * @returns Poll result with status and optional secret
   */
  async pollSecretRequest(id: string): Promise<PollSecretRequestResponse> {
    return this.request<PollSecretRequestResponse>(`/requests/${id}/poll`);
  }

  /**
   * Submit a secret to an existing request (agent-to-agent)
   * @param hash The request hash (64 hex characters)
   * @param secret The secret value to submit
   * @returns Success response
   * @throws Error with message for various failure cases (404, 409, 410)
   */
  async submitSecret(hash: string, secret: string): Promise<SubmitSecretResponse> {
    return this.request<SubmitSecretResponse>(`/requests/${hash}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ secret }),
    });
  }
}
