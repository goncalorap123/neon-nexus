import { ApiKeyGuard } from '../src/auth/api-key.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    guard = new ApiKeyGuard();
  });

  function createMockContext(apiKey?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: apiKey ? { 'x-api-key': apiKey } : {},
        }),
      }),
    } as ExecutionContext;
  }

  it('should allow all requests when API_SECRET_KEY is not set', () => {
    delete process.env.API_SECRET_KEY;
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow requests with valid API key', () => {
    process.env.API_SECRET_KEY = 'test-secret';
    const context = createMockContext('test-secret');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject requests with invalid API key', () => {
    process.env.API_SECRET_KEY = 'test-secret';
    const context = createMockContext('wrong-key');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject requests with no API key when secret is configured', () => {
    process.env.API_SECRET_KEY = 'test-secret';
    const context = createMockContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  afterEach(() => {
    delete process.env.API_SECRET_KEY;
  });
});
