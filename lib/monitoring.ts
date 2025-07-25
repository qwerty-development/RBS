import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { InputSanitizer } from './security';

// Monitoring configuration
const MONITORING_CONFIG = {
  enableMetrics: !__DEV__, // Disable in development to avoid noise
  enableDebugLogs: __DEV__,
  metricsSampleRate: 0.1, // 10% sampling for performance
  maxLogEntries: 1000,
  maxMetricEntries: 500,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  component?: string;
  userId?: string;
  sessionId: string;
}

export interface MetricEntry {
  id: string;
  timestamp: number;
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  tags?: Record<string, string>;
  sessionId: string;
}

export interface UserEvent {
  id: string;
  timestamp: number;
  event: string;
  properties?: Record<string, any>;
  userId?: string;
  sessionId: string;
}

export interface AppSession {
  id: string;
  startTime: number;
  endTime?: number;
  userId?: string;
  userAgent: string;
  appVersion: string;
  crashCount: number;
  errorCount: number;
  screenViews: string[];
  customEvents: number;
}

/**
 * Central monitoring and analytics system
 */
export class AppMonitor {
  private static instance: AppMonitor;
  private sessionId: string;
  private userId?: string;
  private logs: LogEntry[] = [];
  private metrics: MetricEntry[] = [];
  private events: UserEvent[] = [];
  private currentSession?: AppSession;
  private logQueue: LogEntry[] = [];
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  static getInstance(): AppMonitor {
    if (!AppMonitor.instance) {
      AppMonitor.instance = new AppMonitor();
    }
    return AppMonitor.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;

    try {
      // Start new session
      await this.startSession();
      
      // Setup app state monitoring
      AppState.addEventListener('change', this.handleAppStateChange);
      
      // Setup error monitoring
      this.setupErrorHandling();
      
      // Load persisted data
      await this.loadPersistedData();
      
      this.isInitialized = true;
      this.log('info', 'App monitor initialized', { sessionId: this.sessionId });
    } catch (error) {
      console.error('Failed to initialize app monitor:', error);
    }
  }

  /**
   * Start a new app session
   */
  private async startSession() {
    this.currentSession = {
      id: this.sessionId,
      startTime: Date.now(),
      userAgent: navigator.userAgent || 'Unknown',
      appVersion: '1.0.0', // Get from app config
      crashCount: 0,
      errorCount: 0,
      screenViews: [],
      customEvents: 0,
    };

    await this.persistData();
  }

  /**
   * Set user context
   */
  setUser(userId: string, userData?: Record<string, any>) {
    this.userId = userId;
    if (this.currentSession) {
      this.currentSession.userId = userId;
    }

    // Update Sentry context
    Sentry.setUser({
      id: userId,
      ...userData,
    });

    this.log('info', 'User context updated', { userId });
  }

  /**
   * Clear user context
   */
  clearUser() {
    this.userId = undefined;
    if (this.currentSession) {
      delete this.currentSession.userId;
    }

    Sentry.configureScope(scope => scope.clear());
    this.log('info', 'User context cleared');
  }

  /**
   * Log message with context
   */
  log(level: LogEntry['level'], message: string, data?: any, component?: string) {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      data: data ? InputSanitizer.sanitizeForLogging(data) : undefined,
      component,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.logs.push(entry);
    this.logQueue.push(entry);

    // Keep only recent logs in memory
    if (this.logs.length > MONITORING_CONFIG.maxLogEntries) {
      this.logs = this.logs.slice(-MONITORING_CONFIG.maxLogEntries);
    }

    // Console output in development
    if (MONITORING_CONFIG.enableDebugLogs) {
      const consoleMethod = console[level] || console.log;
      consoleMethod(`[${component || 'App'}] ${message}`, data);
    }

    // Report errors to Sentry
    if (level === 'error') {
      Sentry.addBreadcrumb({
        message,
        category: component || 'general',
        level: 'error',
        data: entry.data,
      });

      if (this.currentSession) {
        this.currentSession.errorCount++;
      }
    }

    // Batch persist logs
    this.debouncedPersist();
  }

  /**
   * Record performance metric
   */
  recordMetric(
    name: string, 
    value: number, 
    unit: MetricEntry['unit'] = 'ms',
    tags?: Record<string, string>
  ) {
    if (!MONITORING_CONFIG.enableMetrics) return;

    const entry: MetricEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      name,
      value,
      unit,
      tags,
      sessionId: this.sessionId,
    };

    this.metrics.push(entry);

    // Keep only recent metrics
    if (this.metrics.length > MONITORING_CONFIG.maxMetricEntries) {
      this.metrics = this.metrics.slice(-MONITORING_CONFIG.maxMetricEntries);
    }

    // Report to monitoring service
    this.reportMetricToSentry(entry);

    this.debouncedPersist();
  }

  /**
   * Track user event
   */
  trackEvent(event: string, properties?: Record<string, any>) {
    const entry: UserEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      event,
      properties: properties ? InputSanitizer.sanitizeForLogging(properties) : undefined,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.events.push(entry);

    if (this.currentSession) {
      this.currentSession.customEvents++;
    }

    // Report to analytics
    Sentry.addBreadcrumb({
      message: `Event: ${event}`,
      category: 'user_action',
      level: 'info',
      data: entry.properties,
    });

    this.log('info', `Event tracked: ${event}`, properties, 'Analytics');
    this.debouncedPersist();
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, properties?: Record<string, any>) {
    if (this.currentSession) {
      this.currentSession.screenViews.push(screenName);
    }

    this.trackEvent('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Track app crash
   */
  trackCrash(error: Error, context?: Record<string, any>) {
    if (this.currentSession) {
      this.currentSession.crashCount++;
    }

    this.log('error', 'App crash detected', {
      error: error.message,
      stack: error.stack,
      ...context,
    }, 'CrashHandler');

    Sentry.withScope(scope => {
      scope.setTag('crash', true);
      scope.setLevel('fatal');
      scope.setContext('crash_context', context || {});
      Sentry.captureException(error);
    });
  }

  /**
   * Get current session data
   */
  getCurrentSession(): AppSession | undefined {
    return this.currentSession;
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 50): MetricEntry[] {
    return this.metrics.slice(-count);
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    const exportData = {
      session: this.currentSession,
      logs: this.logs,
      metrics: this.metrics,
      events: this.events,
      exportTime: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear all stored data
   */
  async clearData() {
    this.logs = [];
    this.metrics = [];
    this.events = [];
    await AsyncStorage.multiRemove([
      'app_monitor_logs',
      'app_monitor_metrics',
      'app_monitor_events',
      'app_monitor_session',
    ]);
    this.log('info', 'Monitor data cleared');
  }

  // Private methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'background') {
      this.endSession();
    } else if (nextAppState === 'active') {
      // Start new session if needed
      if (!this.currentSession || 
          Date.now() - this.currentSession.startTime > MONITORING_CONFIG.sessionTimeout) {
        this.sessionId = this.generateSessionId();
        this.startSession();
      }
    }
  };

  private endSession() {
    if (this.currentSession && !this.currentSession.endTime) {
      this.currentSession.endTime = Date.now();
      this.log('info', 'Session ended', { 
        duration: this.currentSession.endTime - this.currentSession.startTime,
        sessionId: this.sessionId,
      });
      this.persistData();
    }
  }

  private setupErrorHandling() {
    // Global error handler - only available in React Native
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        this.trackCrash(error, { isFatal });
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    // Unhandled promise rejections
    if (typeof window === 'undefined') { // React Native only
      try {
        const ExceptionsManager = require('react-native/Libraries/Core/ExceptionsManager');
        if (ExceptionsManager && ExceptionsManager.unstable_setGlobalHandler) {
          ExceptionsManager.unstable_setGlobalHandler((error: any, isFatal: boolean) => {
            this.trackCrash(new Error(error), { isFatal, type: 'unhandled_promise' });
          });
        }
      } catch (e) {
        // ExceptionsManager not available, skip
        console.warn('ExceptionsManager not available for error handling setup');
      }
    }
  }

  private reportMetricToSentry(metric: MetricEntry) {
    Sentry.addBreadcrumb({
      message: `Metric: ${metric.name} = ${metric.value}${metric.unit}`,
      category: 'performance',
      level: 'info',
      data: {
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        tags: metric.tags,
      },
    });
  }

  private debouncedPersist = this.debounce(() => {
    this.persistData();
  }, 5000);

  private debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  private async persistData() {
    try {
      await AsyncStorage.multiSet([
        ['app_monitor_logs', JSON.stringify(this.logs.slice(-100))],
        ['app_monitor_metrics', JSON.stringify(this.metrics.slice(-50))],
        ['app_monitor_events', JSON.stringify(this.events.slice(-100))],
        ['app_monitor_session', JSON.stringify(this.currentSession)],
      ]);
    } catch (error) {
      console.error('Failed to persist monitor data:', error);
    }
  }

  private async loadPersistedData() {
    try {
      const data = await AsyncStorage.multiGet([
        'app_monitor_logs',
        'app_monitor_metrics',
        'app_monitor_events',
        'app_monitor_session',
      ]);

      const [logs, metrics, events, session] = data.map(([_, value]) => 
        value ? JSON.parse(value) : null
      );

      if (logs) this.logs = logs;
      if (metrics) this.metrics = metrics;
      if (events) this.events = events;
      if (session) this.currentSession = session;
    } catch (error) {
      console.error('Failed to load persisted monitor data:', error);
    }
  }
}

/**
 * Hook for component-level monitoring
 */
export function useMonitoring(componentName: string) {
  const monitor = AppMonitor.getInstance();
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    monitor.log('debug', `Component ${componentName} mounted`);
    
    return () => {
      const mountDuration = Date.now() - mountTimeRef.current;
      monitor.recordMetric(
        'component_mount_duration',
        mountDuration,
        'ms',
        { component: componentName }
      );
      monitor.log('debug', `Component ${componentName} unmounted`);
    };
  }, [componentName]);

  const log = useCallback((level: LogEntry['level'], message: string, data?: any) => {
    monitor.log(level, message, data, componentName);
  }, [componentName]);

  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    monitor.trackEvent(event, { component: componentName, ...properties });
  }, [componentName]);

  const recordMetric = useCallback((
    name: string,
    value: number,
    unit: MetricEntry['unit'] = 'ms',
    tags?: Record<string, string>
  ) => {
    monitor.recordMetric(name, value, unit, { component: componentName, ...tags });
  }, [componentName]);

  return {
    log,
    trackEvent,
    recordMetric,
    monitor,
  };
}

/**
 * Hook for debugging in development
 */
export function useDebugInfo() {
  const [debugVisible, setDebugVisible] = useState(false);
  const monitor = AppMonitor.getInstance();

  const toggleDebug = useCallback(() => {
    setDebugVisible(prev => !prev);
  }, []);

  const getDebugInfo = useCallback(() => {
    const session = monitor.getCurrentSession();
    const recentLogs = monitor.getRecentLogs(20);
    const recentMetrics = monitor.getRecentMetrics(10);

    return {
      session,
      recentLogs,
      recentMetrics,
      appInfo: {
        isDebug: __DEV__,
        timestamp: new Date().toISOString(),
      },
    };
  }, []);

  const exportDebugData = useCallback(() => {
    return monitor.exportLogs();
  }, []);

  return {
    debugVisible,
    toggleDebug,
    getDebugInfo,
    exportDebugData,
    clearData: () => monitor.clearData(),
  };
}

/**
 * Global monitor instance
 */
export const appMonitor = AppMonitor.getInstance(); 