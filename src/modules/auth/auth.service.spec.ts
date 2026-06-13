import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AnonymousUser } from './schemas/anonymous-user.schema';
import { FingerprintService } from './fingerprint.service';

function createQuery<T>(value: T): Promise<T> & { exec: () => Promise<T> } {
  return Object.assign(Promise.resolve(value), {
    exec: () => Promise.resolve(value),
  });
}

function makeUser(overrides: Record<string, any> = {}) {
  return {
    _id: 'user-id',
    displayId: 'Anonymous12345678',
    anonymousIdHash: 'hash',
    deviceFingerprint: 'fingerprint-a',
    passwordHash: '',
    isBanned: false,
    banReason: null,
    bannedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastSeenAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AuthService anonymous sessions', () => {
  let service: AuthService;
  let userModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    exists: jest.Mock;
    updateOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let fingerprintService: { compute: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(() => {
    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      updateOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    fingerprintService = { compute: jest.fn().mockReturnValue('fingerprint-a') };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      verify: jest.fn(),
    };

    service = new AuthService(
      userModel as any,
      fingerprintService as unknown as FingerprintService,
      jwtService as unknown as JwtService,
    );
  });

  it('requires password when a device already has an anonymous key', async () => {
    const user = makeUser({ passwordHash: (service as any).hashPassword('correct-password') });
    userModel.findOne.mockReturnValue(createQuery(user));

    await expect(service.getOrCreateSession({} as Request)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong password for an existing device anonymous key', async () => {
    const user = makeUser({ passwordHash: (service as any).hashPassword('correct-password') });
    userModel.findOne.mockReturnValue(createQuery(user));

    await expect(
      service.getOrCreateSession({} as Request, 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the existing anonymous key when the existing device password is correct', async () => {
    const user = makeUser({ passwordHash: (service as any).hashPassword('correct-password') });
    userModel.findOne.mockReturnValue(createQuery(user));

    const result = await service.getOrCreateSession({} as Request, 'correct-password');

    expect(result).toMatchObject({
      anonymousId: 'Anonymous12345678',
      token: 'jwt-token',
      isNew: false,
    });
    expect(user.save).toHaveBeenCalled();
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('allows the same anonymous key to log in from another device with its password', async () => {
    const user = makeUser({ passwordHash: (service as any).hashPassword('correct-password') });
    userModel.findOne.mockReturnValueOnce(createQuery(user));

    const result = await service.login('Anonymous12345678', 'correct-password');

    expect(result).toMatchObject({
      anonymousId: 'Anonymous12345678',
      token: 'jwt-token',
      isNew: false,
    });
    expect(user.save).toHaveBeenCalled();
  });
});
