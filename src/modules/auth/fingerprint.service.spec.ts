import { Test, TestingModule } from '@nestjs/testing';
import { FingerprintService } from './fingerprint.service';
import { Request } from 'express';

// Helper tạo mock request
function mockRequest(overrides: Partial<Request['headers']> = {}): Partial<Request> {
  return {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      'accept-language': 'vi-VN,vi;q=0.9,en;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'accept': 'text/html,application/xhtml+xml',
      'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-platform': '"Windows"',
      'sec-ch-ua-mobile': '?0',
      ...overrides,
    },
    ip: '192.168.1.100',
    socket: { remoteAddress: '192.168.1.100' } as any,
  };
}

describe('FingerprintService', () => {
  let service: FingerprintService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FingerprintService],
    }).compile();

    service = module.get<FingerprintService>(FingerprintService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('cùng headers → cùng fingerprint', () => {
    const req = mockRequest();
    const fp1 = service.compute(req as Request);
    const fp2 = service.compute(req as Request);
    expect(fp1).toBe(fp2);
  });

  it('khác user-agent → khác fingerprint', () => {
    const req1 = mockRequest({ 'user-agent': 'Chrome/120' });
    const req2 = mockRequest({ 'user-agent': 'Firefox/121' });
    const fp1 = service.compute(req1 as Request);
    const fp2 = service.compute(req2 as Request);
    expect(fp1).not.toBe(fp2);
  });

  it('khác IP → khác fingerprint', () => {
    const req1 = { ...mockRequest(), ip: '1.2.3.4' } as unknown as Request;
    const req2 = { ...mockRequest(), ip: '5.6.7.8' } as unknown as Request;
    const fp1 = service.compute(req1);
    const fp2 = service.compute(req2);
    expect(fp1).not.toBe(fp2);
  });

  it('IPv6 loopback ::1 và 127.0.0.1 cho cùng fingerprint', () => {
    const req1 = { ...mockRequest(), ip: '::1' } as unknown as Request;
    const req2 = { ...mockRequest(), ip: '127.0.0.1' } as unknown as Request;
    const fp1 = service.compute(req1);
    const fp2 = service.compute(req2);
    expect(fp1).toBe(fp2);
  });

  it('IPv4-mapped IPv6 ::ffff:1.2.3.4 normalize đúng', () => {
    const req1 = { ...mockRequest(), ip: '::ffff:1.2.3.4' } as unknown as Request;
    const req2 = { ...mockRequest(), ip: '1.2.3.4' } as unknown as Request;
    const fp1 = service.compute(req1);
    const fp2 = service.compute(req2);
    expect(fp1).toBe(fp2);
  });

  it('trả về SHA-256 hex string (64 ký tự)', () => {
    const fp = service.compute(mockRequest() as Request);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('headers undefined không throw lỗi', () => {
    const req = { headers: {}, ip: '127.0.0.1', socket: {} } as unknown as Request;
    expect(() => service.compute(req)).not.toThrow();
  });
});
