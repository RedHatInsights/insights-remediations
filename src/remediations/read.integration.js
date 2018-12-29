'use strict';

const _ = require('lodash');
const { request, auth } = require('../test');

describe('remediations', function () {
    describe('list', function () {
        test('list remediations', async () => {
            const {body, text} = await request
            .get('/v1/remediations?pretty')
            .expect(200);

            body.should.have.property('remediations');
            body.remediations.should.not.be.empty();
            _.map(body.remediations, 'id').should.eql([
                '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
                'e809526c-56f5-4cd8-a809-93328436ea23',
                'cbc782e4-e8ae-4807-82ab-505387981d2e',
                '66eec356-dd06-4c72-a3b6-ef27d1508a02'
            ]);

            expect(text).toMatchSnapshot();
        });

        test('does not leak data outside of the account', async () => {
            const {body} = await request
            .get('/v1/remediations?username=99999')
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

        describe('sorting', function () {
            const [r1, r2, r3, r4] = [
                '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
                'e809526c-56f5-4cd8-a809-93328436ea23',
                'cbc782e4-e8ae-4807-82ab-505387981d2e',
                '66eec356-dd06-4c72-a3b6-ef27d1508a02'
            ];

            test('default', async () => {
                const {body} = await request
                .get('/v1/remediations?pretty')
                .expect(200);
                _.map(body.remediations, 'id').should.eql([r1, r2, r3, r4]);
            });

            function testSorting (column, asc, ...expected) {
                test(`${column} ${asc ? 'ASC' : 'DESC'}`, async () => {
                    const {body} = await request
                    .get(`/v1/remediations?pretty&sort=${asc ? '' : '-'}${column}`)
                    .expect(200);
                    _.map(body.remediations, 'id').should.eql(expected);
                });
            }

            testSorting('updated_at', true, r4, r3, r2, r1);
            testSorting('updated_at', false, r1, r2, r3, r4);
            testSorting('name', true, r4, r3, r1, r2);
            testSorting('name', false, r2, r1, r3, r4);
            testSorting('issue_count', true, r1, r2, r3, r4);
            testSorting('issue_count', false, r4, r3, r1, r2);
            testSorting('system_count', true, r1, r3, r2, r4);
            testSorting('system_count', false, r2, r4, r1, r3);
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
                name: 'Unnamed remediation',
                needs_reboot: false,
                auto_reboot: false,
                created_by: 'tuser@redhat.com',
                created_at: '2018-12-04T08:19:36.641Z',
                updated_by: 'tuser@redhat.com',
                updated_at: '2018-12-04T08:19:36.641Z',
                issues: [{
                    id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
                    description: 'Bonding will not fail over to the backup link when bonding options are partially read',
                    resolution: {
                        id: 'fix',
                        description: 'Correct Bonding Config Items',
                        resolution_risk: 3,
                        needs_reboot: false
                    },
                    systems: [{
                        id: '1f12bdfc-8267-492d-a930-92f498fe65b9',
                        hostname: '1f12bdfc-8267-492d-a930-92f498fe65b9.example.com',
                        display_name: 'null'
                    }, {
                        id: 'fc94beb8-21ee-403d-99b1-949ef7adb762',
                        hostname: 'fc94beb8-21ee-403d-99b1-949ef7adb762',
                        display_name: 'null'
                    }]
                }]
            });
        });
    });
});
