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

describe('users', function () {
    describe('list users', function () {
        test('internal', async () => {
            const {body} = await request
            .get('/v1/admin/users')
            .set(auth.default)
            .expect(200);

            body.should.eql([{
                username: 'tuser@redhat.com',
                playbook_count: '5',
                account_number: 'test'
            }]);
        });

        test('customer', async () => {
            await request
            .get('/v1/admin/users')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('wildcard', async () => {
            const {body} = await request
            .get('/v1/admin/users?account=*')
            .set(auth.default)
            .expect(200);

            body.map(user => user.username).should.eql([
                'demoUser',
                'fifi',
                'testReadSingleUser',
                'testStatus',
                'testWriteUser',
                'tuser@redhat.com'
            ]);
        });
    });
});
