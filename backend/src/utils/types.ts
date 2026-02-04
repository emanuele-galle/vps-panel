/**
 * JWT token payload type
 */
export interface JwtPayload {
  userId: string;
  sessionId: string;
  role: 'ADMIN' | 'STAFF';
}
