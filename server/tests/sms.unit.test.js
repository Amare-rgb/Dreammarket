const mockPost = jest.fn();
jest.mock('axios', () => ({ post: mockPost }));

const { normalizePhone, sendSms, sendOrderApprovalSms } = require('../lib/sms');
const TEST_KEY = 'header.payload.signature';

describe('lib/sms — normalizePhone', () => {
  it('converts local 0-prefixed numbers to international format', () => {
    expect(normalizePhone('0911234567')).toBe('251911234567');
    expect(normalizePhone('0111234567')).toBe('251111234567');
  });

  it('keeps already-international numbers', () => {
    expect(normalizePhone('251911234567')).toBe('251911234567');
    expect(normalizePhone('+251 91 123 4567')).toBe('251911234567');
  });

  it('prefixes bare 9-digit subscriber numbers', () => {
    expect(normalizePhone('911234567')).toBe('251911234567');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('+251-91-123-4567')).toBe('251911234567');
  });

  it('returns null for invalid input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('123456789012345')).toBeNull();
  });
});

describe('lib/sms — sendSms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AFROMESSAGE_API_KEY = TEST_KEY;
    delete process.env.AFROMESSAGE_IDENTIFIER_ID;
    delete process.env.AFROMESSAGE_SENDER_NAME;
    delete process.env.AFROMESSAGE_SENDER_ID;
    mockPost.mockResolvedValue({ data: { acknowledge: 'success', response: 'Queued' } });
  });

  it('sends an SMS to a normalized Ethiopian number via AfroMessage', async () => {
    await sendSms({ to: '0911234567', message: 'Hello' });

    expect(mockPost).toHaveBeenCalledWith(
      'https://api.afromessage.com/api/send',
      expect.objectContaining({
        to: '251911234567',
        message: 'Hello',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_KEY}`,
        }),
      })
    );
  });

  it('includes identifier id and sender id when configured', async () => {
    process.env.AFROMESSAGE_IDENTIFIER_ID = 'id-123';
    process.env.AFROMESSAGE_SENDER_NAME = 'DreamMar';
    await sendSms({ to: '0911234567', message: 'Hi' });
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ from: 'id-123', sender_id: 'DreamMar' }),
      expect.any(Object)
    );
  });

  it('rejects when AFROMESSAGE_API_KEY is missing', async () => {
    delete process.env.AFROMESSAGE_API_KEY;
    await expect(
      sendSms({ to: '0911234567', message: 'Hi' })
    ).rejects.toThrow('AFROMESSAGE_API_KEY');
  });

  it('rejects a malformed API key without exactly 2 dots', async () => {
    process.env.AFROMESSAGE_API_KEY = 'not-a-jwt';
    await expect(
      sendSms({ to: '0911234567', message: 'Hi' })
    ).rejects.toThrow('malformed');
  });

  it('rejects invalid phone numbers before calling the API', async () => {
    await expect(
      sendSms({ to: 'not-a-phone', message: 'Hi' })
    ).rejects.toThrow('Invalid phone number');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('throws when AfroMessage returns a failure', async () => {
    mockPost.mockResolvedValue({ data: { acknowledge: 'error', message: 'Temporary gateway failure' } });
    await expect(
      sendSms({ to: '0911234567', message: 'Hi' })
    ).rejects.toThrow('Temporary gateway failure');
  });
});

describe('lib/sms — sendOrderApprovalSms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AFROMESSAGE_API_KEY = TEST_KEY;
    mockPost.mockResolvedValue({ data: { acknowledge: 'success' } });
  });

  it('sends an approval message with order details', async () => {
    await sendOrderApprovalSms({
      customerName: 'Abebe',
      customerPhone: '0911234567',
      orderNumber: 'ORD-123',
      total: 1500.5,
    });

    const body = mockPost.mock.calls[0][1];
    expect(body.to).toBe('251911234567');
    expect(body.message).toContain('Abebe');
    expect(body.message).toContain('ORD-123');
    expect(body.message).toContain('confirmed');
    expect(body.message).toContain('ETB 1500.50');
  });

  it('throws when order is missing', async () => {
    await expect(sendOrderApprovalSms(null)).rejects.toThrow('order is required');
  });
});
