/**
 * Unit tests for paymentVerification.service.js parsing helpers.
 * No OCR / DB / network needed — pure functions only.
 */
const {
  parseAmount,
  parseTransactionRef,
  parseReceiptUrls,
  compareAmount,
} = require('../services/paymentVerification.service');

describe('parseAmount', () => {
  it('extracts ETB-marked amounts', () => {
    expect(parseAmount('Total Paid: ETB 1,250.50')).toBe(1250.5);
    expect(parseAmount('Amount: 2,000 ETB')).toBe(2000);
    expect(parseAmount('Br 750.00')).toBe(750);
  });

  it('falls back to plain numbers on lines', () => {
    expect(parseAmount('Receipt\n500\nThank you')).toBe(500);
  });

  it('returns null for empty/unreadable text', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount('no numbers here')).toBeNull();
  });
});

describe('parseTransactionRef', () => {
  it('extracts labeled references', () => {
    expect(parseTransactionRef('Transaction ID: TXN-99887766')).toBe('TXN-99887766');
    expect(parseTransactionRef('Ref No: 123456789012')).toBe('123456789012');
    expect(parseTransactionRef('Confirmation Number: ABC123XYZ')).toBe('ABC123XYZ');
  });

  it('extracts long numeric references', () => {
    expect(parseTransactionRef('some text 98765432109876543210 end')).toBe('98765432109876543210');
  });

  it('skips dates and amounts', () => {
    expect(parseTransactionRef('Date: 2026-11-25')).toBeNull();
    expect(parseTransactionRef('Total: 1,250.50')).toBeNull();
  });

  it('returns null when nothing found', () => {
    expect(parseTransactionRef('hello world')).toBeNull();
  });
});

describe('parseReceiptUrls', () => {
  it('finds telebirir/ethio telecom receipt URLs', () => {
    const text = 'Verify at https://transactioninfo.ethiotelecom.et/receipt/abc123 for details';
    expect(parseReceiptUrls(text)).toContain('https://transactioninfo.ethiotelecom.et/receipt/abc123');
  });

  it('returns empty array when none', () => {
    expect(parseReceiptUrls('no links')).toEqual([]);
  });
});

describe('compareAmount', () => {
  it('AMOUNT_MATCHED within tolerance', () => {
    expect(compareAmount(1000, 1000).status).toBe('AMOUNT_MATCHED');
    expect(compareAmount(1000.005, 1000).status).toBe('AMOUNT_MATCHED');
  });

  it('UNDERPAID with shortfall', () => {
    const r = compareAmount(800, 1000);
    expect(r.status).toBe('UNDERPAID');
    expect(r.shortfall).toBeCloseTo(200);
  });

  it('OVERPAID with extra', () => {
    const r = compareAmount(1200, 1000);
    expect(r.status).toBe('OVERPAID');
    expect(r.extra).toBeCloseTo(200);
  });

  it('NEEDS_REVIEW when amount unreadable', () => {
    expect(compareAmount(null, 1000).status).toBe('NEEDS_REVIEW');
    expect(compareAmount(500, null).status).toBe('NEEDS_REVIEW');
  });
});
