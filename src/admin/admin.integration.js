'use strict';

const { request, auth } = require('../test');

describe('admin', function () {
    describe('500', function () {
        test('internal', async () => {
            await request
            .get('/v1/admin/500')
            .set(auth.emptyInternal)
            .expect(500);
        });

        test('not internal', async () => {
            await request
            .get('/v1/admin/500')
            .set(auth.emptyCustomer)
            .expect(404);
        });
    });
});
