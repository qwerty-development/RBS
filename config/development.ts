// Development configuration for JMeter proxy integration
// Only active in development mode (__DEV__ = true)

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  protocol: 'http' | 'https';
}

export interface DevConfig {
  jmeter: {
    proxy: ProxyConfig;
    requestLogging: boolean;
    addCustomHeaders: boolean;
  };
  network: {
    timeout: number;
    retryAttempts: number;
    enableMockResponses: boolean;
  };
}

// Default development configuration
export const DEV_CONFIG: DevConfig = {
  jmeter: {
    proxy: {
      enabled: __DEV__, // Only enable in development
      host: '10.0.2.2', // Android emulator host IP (change to your computer's IP for physical device)
      port: 8888, // Default JMeter proxy port
      protocol: 'http',
    },
    requestLogging: true,
    addCustomHeaders: true,
  },
  network: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    enableMockResponses: false,
  },
};

// Helper function to get proxy URL
export function getProxyUrl(): string | null {
  if (!DEV_CONFIG.jmeter.proxy.enabled) {
    return null;
  }

  const { protocol, host, port } = DEV_CONFIG.jmeter.proxy;
  return `${protocol}://${host}:${port}`;
}

// Helper function to check if proxy should be used
export function shouldUseProxy(): boolean {
  return __DEV__ && DEV_CONFIG.jmeter.proxy.enabled;
}

// Log configuration on load
if (__DEV__) {
  console.log('📋 Development Configuration Loaded:');
  console.log('🔧 JMeter Proxy:', DEV_CONFIG.jmeter.proxy.enabled ? 'ENABLED' : 'DISABLED');

  if (DEV_CONFIG.jmeter.proxy.enabled) {
    console.log(`🌐 Proxy URL: ${getProxyUrl()}`);
    console.log('📝 Note: Make sure JMeter is running on the configured host and port');
    console.log('📱 For physical devices, update the host IP to your computer\'s IP address');
  }
}

export default DEV_CONFIG;