import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Convert snake_case keys to camelCase recursively
 * Handles nested objects and arrays
 */
function toCamelCase(obj: any): any {
  // Return null/undefined as-is
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays - transform each element
  if (Array.isArray(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return obj.map((item) => toCamelCase(item));
  }

  // Handle Date objects - return as-is
  if (obj instanceof Date) {
    return obj;
  }

  // Handle plain objects - transform keys
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (typeof obj === 'object' && obj.constructor === Object) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return Object.keys(obj).reduce((result, key) => {
      // Convert snake_case to camelCase
      // e.g., project_id -> projectId, created_at -> createdAt
      const camelKey = key.replace(/_([a-z])/g, (_, letter: string) =>
        letter.toUpperCase(),
      );

      // Recursively transform nested objects/arrays
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {});
  }

  // Return primitive types (string, number, boolean) as-is
  return obj;
}

/**
 * Global interceptor to transform all API responses to camelCase
 * This ensures frontend receives consistent camelCase format
 * while keeping database in snake_case convention
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Skip transformation if response is empty
        if (!data) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return data;
        }

        // Transform response to camelCase
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return toCamelCase(data);
      }),
    );
  }
}
