import axios from 'axios';
import { CONFIG } from '../constants/config';
import { storage } from './storage';

const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await storage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (expired token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.clearTokens();
    }
    return Promise.reject(error);
  }
);

export default api;