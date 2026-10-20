// Pure unit tests: no database needed.
import { describe, it, expect } from 'vitest';
import { createPasswordHasher } from '../src/security/password.js';

const hasher = createPasswordHasher({ N: 1024, r: 8, p: 1 });

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hasher.hash('correct-horse-battery');
    expect(await hasher.verify('correct-horse-battery', stored)).toBe(true);
    expect(await hasher.verify('correct-horse-batterz', stored)).toBe(false);
  });

  it('never stores the password and uses a fresh salt each time', async () => {
    const a = await hasher.hash('same-password-12345');
    const b = await hasher.hash('same-password-12345');
    expect(a).not.toContain('same-password-12345');
    expect(a.startsWith('scrypt$1024$8$1$')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('rejects malformed or tampered stored values instead of throwing', async () => {
    const stored = await hasher.hash('whatever-password-1');
    expect(await hasher.verify('whatever-password-1', 'plaintext')).toBe(false);
    expect(await hasher.verify('whatever-password-1', '')).toBe(false);
    expect(await hasher.verify('whatever-password-1', stored.replace('scrypt$1024', 'scrypt$1000'))).toBe(false);
    expect(await hasher.verify('whatever-password-1', stored.replace('scrypt$1024$8$1', 'scrypt$1099511627776$8$1'))).toBe(false);
  });

  it('dummyHash is a real hash made with the same cost', async () => {
    const dummy = await hasher.dummyHash();
    expect(dummy.startsWith('scrypt$1024$8$1$')).toBe(true);
    expect(await hasher.verify('anything-at-all-123', dummy)).toBe(false);
  });
});
