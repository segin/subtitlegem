/**
 * error-utils.test.ts - Tests for error handling utilities
 */

import { 
  createSafeErrorResponse, 
  suggestHttpStatus, 
  isProduction,
  withSafeErrorHandling 
} from './error-utils';

describe('error-utils', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    it('should return false for development', () => {
      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
    });

    it('should return false for test', () => {
      process.env.NODE_ENV = 'test';
      expect(isProduction()).toBe(false);
    });
  });

  describe('createSafeErrorResponse', () => {
    it('should return full details in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Database connection failed at /var/lib/mysql');
      const response = createSafeErrorResponse(error, 'Failed to process request');
      
      expect(response.error).toBe('Failed to process request');
      expect(response.details).toBe('Database connection failed at /var/lib/mysql');
    });

    it('should hide details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('SQL syntax error near SELECT * FROM users');
      const response = createSafeErrorResponse(error, 'Database error');
      
      expect(response.error).toBe('Database error');
      expect(response.details).toBeUndefined();
    });

    it('should handle non-Error objects', () => {
      process.env.NODE_ENV = 'development';
      const response = createSafeErrorResponse('string error', 'Error occurred');
      
      expect(response.error).toBe('Error occurred');
      expect(response.details).toBe('string error');
    });
  });

  describe('suggestHttpStatus', () => {
    it('should return 404 for not found errors', () => {
      expect(suggestHttpStatus(new Error('File not found'))).toBe(404);
      expect(suggestHttpStatus(new Error('User does not exist'))).toBe(404);
    });

    it('should return 403 for auth errors', () => {
      expect(suggestHttpStatus(new Error('Unauthorized access'))).toBe(403);
      expect(suggestHttpStatus(new Error('Access denied'))).toBe(403);
    });

    it('should return 400 for validation errors', () => {
      expect(suggestHttpStatus(new Error('Invalid input'))).toBe(400);
      expect(suggestHttpStatus(new Error('Name must be provided'))).toBe(400);
      expect(suggestHttpStatus(new Error('Field is required'))).toBe(400);
    });

    it('should return 429 for rate limit errors', () => {
      expect(suggestHttpStatus(new Error('Too many requests'))).toBe(429);
      expect(suggestHttpStatus(new Error('Rate limit exceeded'))).toBe(429);
    });

    it('should return 500 for unknown errors', () => {
      expect(suggestHttpStatus(new Error('Something went wrong'))).toBe(500);
      expect(suggestHttpStatus(new Error(''))).toBe(500);
    });
  });

  describe('withSafeErrorHandling', () => {
    it('should return success result for successful handlers', async () => {
      const result = await withSafeErrorHandling(async () => ({ data: 'test' }));
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toEqual({ data: 'test' });
      }
    });

    it('should return safe error for failed handlers', async () => {
      process.env.NODE_ENV = 'production';
      const result = await withSafeErrorHandling(
        async () => { throw new Error('Internal secret leaked'); },
        'Request failed'
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe('Request failed');
        expect(result.error.details).toBeUndefined(); // Hidden in production
        expect(result.status).toBe(500);
      }
    });
  });
});
