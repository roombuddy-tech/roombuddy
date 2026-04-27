import axios from 'axios';
import { CONFIG } from '../constants/config';
import { ENDPOINTS } from '../constants/endpoints';
import { storage } from './storage';

const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Registered by AuthProvider so the interceptor can force-logout the user
let _onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  _onAuthFailure = handler;
}

async function forceLogout() {
  await storage.clearTokens();
  _onAuthFailure?.();
}

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await storage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Flag to prevent multiple refresh calls at once
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // If the refresh endpoint itself fails → force logout immediately
    if (originalRequest.url === ENDPOINTS.AUTH.REFRESH_TOKEN) {
      await forceLogout();
      return Promise.reject(error);
    }

    // 403 with no token in storage means tokens were already cleared → force logout
    if (status === 403 && !originalRequest._retry) {
      const token = await storage.getAccessToken();
      if (!token) {
        await forceLogout();
        return Promise.reject(error);
      }
    }

    // Only attempt refresh on 401
    if (status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) {
        processQueue(new Error('No refresh token'), null);
        await forceLogout();
        return Promise.reject(error);
      }

      const { data } = await api.post(ENDPOINTS.AUTH.REFRESH_TOKEN, {
        refresh_token: refreshToken,
      });

      const newAccessToken = data.access;
      await storage.saveTokens(newAccessToken, refreshToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;