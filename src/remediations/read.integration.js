'use strict';

const { request, auth } = require('../test');

describe('remediations', function () {
    describe('list', function () {
        test('list remediations', async () => {
            const {body, text} = await request
            .get('/v1/remediations?pretty')
            .expect(200);

            body.should.have.property('remediations');
            body.remediations.should.not.be.empty();
            body.remediations.map(r => r.id).should.containDeep([
                '66eec356-dd06-4c72-a3b6-ef27d1508a02',
                'cbc782e4-e8ae-4807-82ab-505387981d2e',
                'e809526c-56f5-4cd8-a809-93328436ea23'
            ]);

            expect(text).toMatchSnapshot();
        });

        test('does not leak data outside of the account', async () => {
            const {body} = await request
            .get('/v1/remediations?user_id=99999')
            .expect(200);

            body.should.have.property('remediations');
            body.remediations.should.be.empty();
        });

        test('does not leak data outside of the account (2)', async () => {
            const {body} = await request
            .get('/v1/remediations?user_id=99999')
            .set(auth.emptyInternal)
            .expect(200);

            body.should.have.property('remediations');
            body.remediations.should.be.empty();
        });
    });

    describe('get', function () {
        test('get remediation', async () => {
            const {text} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02?pretty')
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get remediation (2)', async () => {
            const {body} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23')
            .expect(200);

            body.should.eql({
                id: 'e809526c-56f5-4cd8-a809-93328436ea23',
                name: '',
                updated_at: '2018-10-04T08:19:36.641Z',
                owner: 100,
                issues: []
            });
        });
    });
});
