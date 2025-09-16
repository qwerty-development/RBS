// JMeter Proxy Integration for React Native
// This module configures the app to work with JMeter for request interception

import { DEV_CONFIG, shouldUseProxy, getProxyUrl } from '../config/development';

export interface JMeterRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  requestId: string;
}

export interface JMeterResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  requestId: string;
  duration: number;
}

// In-memory storage for request/response tracking
const requestLog: JMeterRequest[] = [];
const responseLog: JMeterResponse[] = [];

// Custom fetch wrapper for JMeter integration
export function createJMeterFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const headers = { ...init?.headers } as Record<string, string>;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Add JMeter identification headers
    if (shouldUseProxy() && DEV_CONFIG.jmeter.addCustomHeaders) {
      headers['X-JMeter-Source'] = 'plate-app';
      headers['X-Request-ID'] = requestId;
      headers['X-Request-Timestamp'] = timestamp.toString();
      headers['X-App-Version'] = '1.0.0';
      headers['X-Platform'] = 'react-native';
    }

    // Log request if enabled
    if (DEV_CONFIG.jmeter.requestLogging) {
      const jmeterRequest: JMeterRequest = {
        url,
        method,
        headers,
        body: init?.body?.toString(),
        timestamp,
        requestId,
      };
      requestLog.push(jmeterRequest);

      console.log(`🚀 [${requestId}] ${method} ${url}`);
      if (shouldUseProxy()) {
        console.log(`📡 Routing through JMeter proxy: ${getProxyUrl()}`);
      }
    }

    const startTime = Date.now();

    try {
      // Make the actual request
      const response = await fetch(input, {
        ...init,
        headers,
      });

      const duration = Date.now() - startTime;

      // Log response if enabled
      if (DEV_CONFIG.jmeter.requestLogging) {
        const responseBody = await response.clone().text();
        const jmeterResponse: JMeterResponse = {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          requestId,
          duration,
        };
        responseLog.push(jmeterResponse);

        console.log(`✅ [${requestId}] ${response.status} ${response.statusText} (${duration}ms)`);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (DEV_CONFIG.jmeter.requestLogging) {
        console.error(`❌ [${requestId}] Request failed (${duration}ms):`, error);
      }

      throw error;
    }
  };
}

// Global fetch override for development
export function enableJMeterInterception(): void {
  if (!__DEV__) {
    console.warn('⚠️ JMeter interception can only be enabled in development mode');
    return;
  }

  if (!shouldUseProxy()) {
    console.log('🔧 JMeter proxy is disabled in configuration');
    return;
  }

  // Override global fetch with JMeter-enabled version
  const originalFetch = global.fetch;
  global.fetch = createJMeterFetch();

  console.log('🎯 JMeter interception enabled');
  console.log(`📡 Proxy configuration: ${getProxyUrl()}`);
  console.log('📝 All network requests will now be logged and routed through JMeter proxy');

  // Provide restore function
  return () => {
    global.fetch = originalFetch;
    console.log('🔄 JMeter interception disabled, fetch restored');
  };
}

// Helper functions for debugging
export function getRequestLog(): JMeterRequest[] {
  return [...requestLog];
}

export function getResponseLog(): JMeterResponse[] {
  return [...responseLog];
}

export function clearLogs(): void {
  requestLog.length = 0;
  responseLog.length = 0;
  console.log('🧹 Request/Response logs cleared');
}

export function printRequestSummary(): void {
  console.log('\n📊 JMeter Request Summary:');
  console.log(`Total Requests: ${requestLog.length}`);
  console.log(`Total Responses: ${responseLog.length}`);

  if (responseLog.length > 0) {
    const avgDuration = responseLog.reduce((sum, res) => sum + res.duration, 0) / responseLog.length;
    console.log(`Average Response Time: ${avgDuration.toFixed(2)}ms`);

    const statusCounts = responseLog.reduce((acc, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('Status Code Distribution:', statusCounts);
  }
  console.log('');
}

// Auto-enable in development if configured
if (__DEV__ && shouldUseProxy()) {
  console.log('🚀 Auto-enabling JMeter interception in development mode');

  // Small delay to ensure app is initialized
  setTimeout(() => {
    enableJMeterInterception();
  }, 1000);
}