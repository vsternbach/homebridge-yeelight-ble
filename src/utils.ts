import { PLATFORM_NAME } from './settings';
import { Logger } from 'homebridge/lib/logger';

export function throttle(delay = 500) {
  // A map to store the last invocation timestamp for each function
  const lastInvocation: Map<string, number> = new Map();

  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      // Generate a unique key for the function based on its name and arguments
      const key = `${propertyKey}-${JSON.stringify(args)}`;

      // Get the last invocation timestamp for this function
      const lastTime = lastInvocation.get(key) || 0;

      // Check if the function was invoked within the last 'delay' milliseconds
      if (Date.now() - lastTime >= delay) {
        // If not, invoke the original function and update the timestamp
        lastInvocation.set(key, Date.now());
        return originalMethod.apply(this, args);
      } else {
        Logger.withPrefix(PLATFORM_NAME).debug(`Throttled: ${propertyKey} ${args}`);
      }
    };

    return descriptor;
  };
}
