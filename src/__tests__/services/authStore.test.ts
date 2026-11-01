import { authStore } from '../../../stores/authStore';

function createMockJWT(payload: Record<string, any>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}

describe('AuthStore', () => {
  beforeEach(() => {
    authStore.clearSession();
  });

  it('should have null values by default', () => {
    expect(authStore.getAccessToken()).toBeNull();
    expect(authStore.getCsrfToken()).toBeNull();
    expect(authStore.getUser()).toBeNull();
    expect(authStore.getCarrier()).toBeNull();
    expect(authStore.getRoles()).toBeNull();
  });

  // Access Token
  it('should set and get access token', () => {
    authStore.setAccessToken('mock-access-token');
    expect(authStore.getAccessToken()).toBe('mock-access-token');
  });

  it('should set access token to null', () => {
    authStore.setAccessToken('token');
    authStore.setAccessToken(null);
    expect(authStore.getAccessToken()).toBeNull();
  });

  it('should check if token is valid (hasValidToken)', () => {
    // No token
    expect(authStore.hasValidToken()).toBe(false);
    
    // Invalid token format
    authStore.setAccessToken('invalid-token');
    expect(authStore.hasValidToken()).toBe(false);
    
    // Valid token (not expired)
    const validToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
    authStore.setAccessToken(validToken);
    expect(authStore.hasValidToken()).toBe(true);
    
    // Expired token
    const expiredToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) - 3600 });
    authStore.setAccessToken(expiredToken);
    expect(authStore.hasValidToken()).toBe(false);
  });

  // CSRF Token
  it('should set and get CSRF token', () => {
    authStore.setCsrfToken('mock-csrf-token');
    expect(authStore.getCsrfToken()).toBe('mock-csrf-token');
  });

  it('should set CSRF token to null', () => {
    authStore.setCsrfToken('token');
    authStore.setCsrfToken(null);
    expect(authStore.getCsrfToken()).toBeNull();
  });

  // User
  it('should set and get user', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      firstname: 'Test',
      lastname: 'User',
    };
    authStore.setUser(mockUser as any);
    expect(authStore.getUser()).toEqual(mockUser);
  });

  it('should set user to null', () => {
    authStore.setUser({ id: 1 } as any);
    authStore.setUser(null);
    expect(authStore.getUser()).toBeNull();
  });

  // Carrier
  it('should set and get carrier', () => {
    const mockCarrier = {
      id: 1,
      firstname: 'Driver',
      lastname: 'One',
      phone: '809-555-0101',
    };
    authStore.setCarrier(mockCarrier);
    expect(authStore.getCarrier()).toEqual(mockCarrier);
  });

  it('should set carrier to null', () => {
    authStore.setCarrier({ id: 1 } as any);
    authStore.setCarrier(null);
    expect(authStore.getCarrier()).toBeNull();
  });

  // Roles
  it('should set and get roles', () => {
    const mockRoles = [
      { id: 1, title: 'Admin' },
      { id: 2, title: 'Driver' },
    ];
    authStore.setRoles(mockRoles as any);
    expect(authStore.getRoles()).toEqual(mockRoles);
  });

  it('should set roles to null', () => {
    authStore.setRoles([{ id: 1 } as any]);
    authStore.setRoles(null);
    expect(authStore.getRoles()).toBeNull();
  });

  // setSession
  it('should set entire session at once', () => {
    const mockData = {
      accessToken: 'mock-access-token',
      csrfToken: 'mock-csrf-token',
      user: { id: 1, email: 'test@example.com' } as any,
      carrier: { id: 1, firstname: 'Driver' } as any,
      roles: [{ id: 1, title: 'Admin' }] as any,
    };
    authStore.setSession(mockData);
    
    expect(authStore.getAccessToken()).toBe('mock-access-token');
    expect(authStore.getCsrfToken()).toBe('mock-csrf-token');
    expect(authStore.getUser()).toEqual(mockData.user);
    expect(authStore.getCarrier()).toEqual(mockData.carrier);
    expect(authStore.getRoles()).toEqual(mockData.roles);
  });

  it('should set session without optional fields', () => {
    const mockData = {
      accessToken: 'mock-access-token',
      user: { id: 1, email: 'test@example.com' } as any,
    };
    authStore.setSession(mockData);
    
    expect(authStore.getAccessToken()).toBe('mock-access-token');
    expect(authStore.getCsrfToken()).toBeNull();
    expect(authStore.getUser()).toEqual(mockData.user);
    expect(authStore.getCarrier()).toBeNull();
    expect(authStore.getRoles()).toBeNull();
  });

  // clearSession
  it('should clear entire session', () => {
    authStore.setSession({
      accessToken: 'token',
      csrfToken: 'csrf',
      user: { id: 1 } as any,
      carrier: { id: 1 } as any,
      roles: [{ id: 1 }] as any,
    });
    
    authStore.clearSession();
    
    expect(authStore.getAccessToken()).toBeNull();
    expect(authStore.getCsrfToken()).toBeNull();
    expect(authStore.getUser()).toBeNull();
    expect(authStore.getCarrier()).toBeNull();
    expect(authStore.getRoles()).toBeNull();
  });
});
