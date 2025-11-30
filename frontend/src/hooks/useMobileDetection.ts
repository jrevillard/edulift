import { useState, useEffect } from 'react';

export interface MobileDetectionResult {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isTablet: boolean;
  deviceType: 'ios' | 'android' | 'desktop' | 'tablet' | 'unknown';
  deviceInfo: {
    brand?: string;
    model?: string;
    os?: string;
    osVersion?: string;
    isHighEnd?: boolean;
  };
}

/**
 * Enhanced device detection hook with tablet support and modern APIs
 * for optimal mobile redirection and user experience
 */
export const useMobileDetection = (): MobileDetectionResult => {
  const [mobileInfo, setMobileInfo] = useState<MobileDetectionResult>({
    isMobile: false,
    isIOS: false,
    isAndroid: false,
    isTablet: false,
    deviceType: 'unknown',
    deviceInfo: {}
  });

  useEffect(() => {
    const detectDevice = async () => {
      try {
        const userAgent = navigator.userAgent;
        const deviceInfo: MobileDetectionResult['deviceInfo'] = {};

        // Modern API detection with fallback to UserAgent
        let isIOS = false;
        let isAndroid = false;
        let isTablet = false;
        let deviceType: 'ios' | 'android' | 'desktop' | 'tablet' | 'unknown' = 'unknown';

        // Try modern UserAgentData API first (Chrome 89+)
        if ('userAgentData' in navigator && navigator.userAgentData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uaData = navigator.userAgentData as any;
          const platform = uaData.platform || uaData.brands?.[0]?.brand || '';

          // High-end device detection
          if ('hardwareConcurrency' in navigator && 'deviceMemory' in navigator) {
            deviceInfo.isHighEnd =
              (navigator.hardwareConcurrency as number) >= 4 &&
              (navigator.deviceMemory as number) >= 4; // 4GB+ RAM considered high-end
          }

          // Platform detection
          if (platform.toLowerCase().includes('android')) {
            isAndroid = true;
            deviceInfo.os = 'Android';
            // Android tablet detection
            isTablet = /Mobile/.test(userAgent) === false ||
                       userAgent.includes('SM-') || // Samsung tablets
                       userAgent.includes('GT-') ||  // Galaxy Tab
                       userAgent.includes('Pixel C') ||
                       userAgent.includes('Nexus ');
          } else if (platform.toLowerCase().includes('ios') ||
                     platform.toLowerCase().includes('iphone') ||
                     platform.toLowerCase().includes('ipad')) {
            isIOS = true;
            deviceInfo.os = 'iOS';
            // iPad detection in UserAgentData
            isTablet = platform.toLowerCase().includes('ipad') ||
                       (userAgent.includes('Mac') && 'ontouchend' in document);
          }

          // Extract device model from UserAgentData brands if available
          if (uaData.brands) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deviceInfo.brand = uaData.brands.find((b: any) => b.brand !== 'Google Chrome')?.brand;
          }
        } else {
          // Fallback to classic UserAgent detection
          isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
                  (/Macintosh/.test(userAgent) && 'ontouchend' in document);
          isAndroid = /Android/.test(userAgent);

          // Enhanced tablet detection - more conservative approach
          isTablet = /iPad|Tablet/i.test(userAgent) ||
                    (isAndroid && (/SM-T[0-9]+/.test(userAgent) || // Samsung tablets
                                   /GT-/.test(userAgent) || // Galaxy Tab
                                   /Pixel C/.test(userAgent) || // Pixel C tablet
                                   (/Macintosh/.test(userAgent) && 'ontouchend' in document && Math.max(screen.width, screen.height) > 1200))); // iPad via Mac+touch

          // OS detection
          if (isIOS) {
            deviceInfo.os = 'iOS';
            const iOSMatch = /OS (\d+)_(\d+)/.exec(userAgent);
            if (iOSMatch) {
              deviceInfo.osVersion = `${iOSMatch[1]}.${iOSMatch[2]}`;
            }
            deviceInfo.brand = 'Apple';
            deviceInfo.model = /iPad/.test(userAgent) ? 'iPad' :
                              /iPhone/.test(userAgent) ? 'iPhone' : 'iPod';
          } else if (isAndroid) {
            deviceInfo.os = 'Android';
            const androidMatch = /Android (\d+\.\d+)/.exec(userAgent);
            if (androidMatch) {
              deviceInfo.osVersion = androidMatch[1];
            }
            // Brand extraction for Android
            const brandMatch = /; ([^)]+)\)/.exec(userAgent);
            if (brandMatch) {
              const brandInfo = brandMatch[1].split(';')[0];
              deviceInfo.brand = brandInfo.split(' ')[0];
              deviceInfo.model = brandInfo.split(' ')[1] || brandInfo;
            }
          }
        }

        const isMobile = (isIOS || isAndroid) && !isTablet;

        // Device type classification
        if (isTablet) {
          deviceType = 'tablet';
        } else if (isIOS) {
          deviceType = 'ios';
        } else if (isAndroid) {
          deviceType = 'android';
        } else if (!isMobile && userAgent.length > 0) {
          deviceType = 'desktop';
        }

        setMobileInfo({
          isMobile,
          isIOS,
          isAndroid,
          isTablet,
          deviceType,
          deviceInfo
        });
      } catch (error) {
        console.error('Error in enhanced device detection:', error);
        setMobileInfo({
          isMobile: false,
          isIOS: false,
          isAndroid: false,
          isTablet: false,
          deviceType: 'unknown',
          deviceInfo: {}
        });
      }
    };

    detectDevice();

    // Écouter les changements d'orientation et de resize
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const handleResize = () => {
      // Debounce pour éviter les appels excessifs
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = setTimeout(detectDevice, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return mobileInfo;
};