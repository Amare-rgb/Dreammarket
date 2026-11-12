/**
 * Unit tests for lib/sms.js — Africa's Talking SMS helper.
 * The africastalking SDK is mocked; no network calls are made.
 */

const mockSend = jest.fn();
const mockATFactory = jest.fn(() => ({
  SMS: { send: mockSend },
}));

jest.mock('africastalking', () => mockATFactory);

const { normalizePhone, sendSms, sendOrderApprovalSms } = require('../lib/sms');

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
    process.env.AT_API_KEY = 'test-api-key';
    delete process.env.AT_USERNAME;
    delete process.env.AT_SENDER_ID;
    mockSend.mockResolvedValue({ SMSMessageData: { Message: ['Sent'] } });
  });

  it('sends an SMS to a normalized Ethiopian number', async () => {
    await sendSms({ to: '0911234567', message: 'Hello' });

    expect(mockATFactory).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      username: 'sandbox',
    });
    expect(mockSend).toHaveBeenCalledWith({
      to: '+251911234567',
      message: 'Hello',
    });
  });

  it('includes the sender ID when AT_SENDER_ID is set', async () => {
    process.env.AT_SENDER_ID = 'DreamMore';
    await sendSms({ to: '0911234567', message: 'Hi' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'DreamMore' })
    );
  });

  it('uses AT_USERNAME when provided', async () => {
    process.env.AT_USERNAME = 'myapp';
    await sendSms({ to: '0911234567', message: 'Hi' });
    expect(mockATFactory).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      username: 'myapp',
    });
  });

  it('rejects when AT_API_KEY is missing', async () => {
    delete process.env.AT_API_KEY;
    await expect(
      sendSms({ to: '0911234567', message: 'Hi' })
    ).rejects.toThrow('AT_API_KEY');
  });

  it('rejects invalid phone numbers before calling the API', async () => {
    await expect(
      sendSms({ to: 'not-a-phone', message: 'Hi' })
    ).rejects.toThrow('Invalid phone number');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('lib/sms — sendOrderApprovalSms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AT_API_KEY = 'test-api-key';
    mockSend.mockResolvedValue({ SMSMessageData: { Message: ['Sent'] } });
  });

  it('sends an approval message with order details', async () => {
    await sendOrderApprovalSms({
      customerName: 'Abebe',
      customerPhone: '0911234567',
      orderNumber: 'ORD-123',
      total: 1500.5,
    });

    const { message } = mockSend.mock.calls[0][0];
    expect(message).toContain('Abebe');
    expect(message).toContain('ORD-123');
    expect(message).toContain('APPROVED');
    expect(message).toContain('ETB 1500.50');
  });

  it('throws when order is missing', async () => {
    await expect(sendOrderApprovalSms(null)).rejects.toThrow('order is required');
  });
});
