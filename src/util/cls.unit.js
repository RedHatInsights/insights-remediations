'use strict';

const cls = require('./cls');

describe('AsyncLocalStorage context isolation', function () {
    test('maintains separate context for concurrent requests', async () => {
        const results = [];

        // Simulate 3 concurrent requests with different identities
        const request1 = new Promise(resolve => {
            const mockReq1 = { id: 'request-1', identity: { user: 'alice' } };
            cls.middleware(mockReq1, {}, async () => {
                // Simulate async work
                await new Promise(r => setTimeout(r, 50));
                results.push({ expected: 'request-1', actual: cls.getReq().id });
                resolve();
            });
        });

        const request2 = new Promise(resolve => {
            const mockReq2 = { id: 'request-2', identity: { user: 'bob' } };
            cls.middleware(mockReq2, {}, async () => {
                // Simulate async work (shorter delay)
                await new Promise(r => setTimeout(r, 20));
                results.push({ expected: 'request-2', actual: cls.getReq().id });
                resolve();
            });
        });

        const request3 = new Promise(resolve => {
            const mockReq3 = { id: 'request-3', identity: { user: 'charlie' } };
            cls.middleware(mockReq3, {}, async () => {
                // Simulate async work (longest delay)
                await new Promise(r => setTimeout(r, 80));
                results.push({ expected: 'request-3', actual: cls.getReq().id });
                resolve();
            });
        });

        await Promise.all([request1, request2, request3]);

        // Each request should have received its own context, not another's
        results.forEach(result => {
            expect(result.actual).toBe(result.expected);
        });
    });

    test('context is undefined outside middleware', () => {
        expect(cls.getReq()).toBeUndefined();
    });

    test('nested async operations preserve context', async () => {
        const mockReq = { id: 'nested-test', data: 'test-value' };

        await new Promise(resolve => {
            cls.middleware(mockReq, {}, async () => {
                // Level 1
                expect(cls.getReq().id).toBe('nested-test');

                await Promise.all([
                    // Level 2 - parallel promises
                    (async () => {
                        await new Promise(r => setTimeout(r, 10));
                        expect(cls.getReq().id).toBe('nested-test');
                    })(),
                    (async () => {
                        await new Promise(r => setTimeout(r, 20));
                        expect(cls.getReq().id).toBe('nested-test');
                    })()
                ]);

                // After parallel work
                expect(cls.getReq().id).toBe('nested-test');
                resolve();
            });
        });
    });
});
