// __tests__/match.test.js
// Test the Match Engine API POST handler using CommonJS

// Mock the pg Pool
jest.mock('pg', () => {
  const mPool = { query: jest.fn() };
  return { Pool: jest.fn(() => mPool) };
});

const { POST: matchHandler } = require('../src/app/api/match/make/route.js');
const { createRequest } = require('node-mocks-http');

describe('Match Engine API', () => {
  const mockRows = [{ id: 1, name: 'Player1', skill: 5 }];
  const mockCountRow = [{ count: '1' }];

  beforeAll(() => {
    const { Pool } = require('pg');
    const poolInstance = new Pool();
    // First call returns match rows, second call returns count rows
    poolInstance.query
      .mockResolvedValueOnce({ rows: mockRows })
      .mockResolvedValueOnce({ rows: mockCountRow });
  });

  it('returns matches with total count on valid POST', async () => {
    const req = createRequest({
      method: 'POST',
      body: {
        latitude: 17.385,
        longitude: 78.4867,
        skill: 5,
        availability: '{"type":"tstzrange","bounds":["2023-01-01T00:00:00Z","2023-01-01T23:59:59Z"]}'
      }
    });
    const res = await matchHandler(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.matches).toEqual(mockRows);
    expect(json.total).toBe(1);
  });
});
