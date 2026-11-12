/**
 * Unit tests for lib/auth.js — JWT token generation and verification.
 * No database or network required: prisma is mocked.
 */

// JWT_SECRET must be set BEFORE lib/auth.js is required (it validates at load time)
process.env.JWT_SECRET =
  'test-secret-key-that-is-long-enough-32chars!!';

jest.mock('../lib/prisma', () => ({
  user: { findUnique: jest.fn() },
}));

const jwt = require('jsonwebtoken');
const auth = require('../lib/auth');

describe('lib/auth — generateToken', () => {
  it('returns a verifiable JWT containing id, userId, email and role', () => {
    const token = auth.generateToken('user-1', 'a@b.com', 'user', 'Alice');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.id).toBe('user-1');
    expect(decoded.userId).toBe('user-1');
    expect(decoded.user_id).toBe('user-1');
    expect(decoded.email).toBe('a@b.com');
    expect(decoded.role).toBe('USER');
    expect(decoded.name).toBe('Alice');
  });

  it('uppercases the role', () => {
    const token = auth.generateToken('u', 'e@x.com', 'admin');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.role).toBe('ADMIN');
  });
});

describe('lib/auth — email verification tokens', () => {
  it('round-trips a valid verification token', () => {
    const token = auth.generateVerificationToken('user@example.com');
    const decoded = auth.verifyVerificationToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.purpose).toBe('email-verification');
  });

  it('rejects a token with the wrong purpose', () => {
    const token = jwt.sign(
      { email: 'user@example.com', purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    expect(auth.verifyVerificationToken(token)).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = auth.generateVerificationToken('user@example.com');
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(auth.verifyVerificationToken(tampered)).toBeNull();
  });
});

describe('lib/auth — password reset tokens', () => {
  const passwordHash = '$2a$10$fakehashvalue';

  it('verifies a reset token when the password hash matches', () => {
    const token = auth.generateResetToken('user@example.com', passwordHash);
    const decoded = auth.verifyResetToken(token, passwordHash);

    expect(decoded).not.toBeNull();
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.purpose).toBe('password-reset');
  });

  it('rejects a reset token when the password has changed', () => {
    const token = auth.generateResetToken('user@example.com', passwordHash);
    expect(
      auth.verifyResetToken(token, '$2a$10$differenthash')
    ).toBeNull();
  });

  it('rejects a verification token used as a reset token', () => {
    const token = auth.generateVerificationToken('user@example.com');
    expect(auth.verifyResetToken(token, passwordHash)).toBeNull();
  });
});
