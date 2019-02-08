'use strict';

const _ = require('lodash');
const { request, auth, reqId } = require('../test');

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

            test('invalid column', async () => {
                const {id, header} = reqId();
                const { body } = await request
                .get('/v1/remediations?pretty&sort=foo')
                .set(header)
                .expect(400);

                body.errors.should.eql([{
                    id,
                    status: 400,
                    code: 'enum.openapi.validation',
                    title: 'should be equal to one of the allowed values (location: query, path: sort)'
                }]);
            });
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
                created_by: {
                    username: 'tuser@redhat.com',
                    first_name: 'Test',
                    last_name: 'User'
                },
                created_at: '2018-12-04T08:19:36.641Z',
                updated_by: {
                    username: 'tuser@redhat.com',
                    first_name: 'Test',
                    last_name: 'User'
                },
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
                    resolutions_available: 1,
                    systems: [{
                        id: '1f12bdfc-8267-492d-a930-92f498fe65b9',
                        hostname: '1f12bdfc-8267-492d-a930-92f498fe65b9.example.com',
                        display_name: 'null'
                    }, {
                        id: 'fc94beb8-21ee-403d-99b1-949ef7adb762',
                        hostname: 'null',
                        display_name: 'null'
                    }]
                }]
            });
        });
    });

    describe('missing', function () {
        test('get remediation with missing system', async () => {
            const {body} = await request
            .get('/v1/remediations/82aeb63f-fc25-4eef-9333-4fa7e10f7217?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues[0].systems.should.have.length(1);
            body.issues[0].systems[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
        });

        test('get remediation with missing system causing an issue to be empty', async () => {
            const {body} = await request
            .get('/v1/remediations/27e36e14-e1c2-4b5a-9382-ec80ca9a6c1a?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(1);
            body.issues[0].should.have.property('id', 'vulnerabilities:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
            body.issues[0].systems.should.have.length(1);
            body.issues[0].systems[0].should.have.property('id', '1040856f-b772-44c7-83a9-eea4813c4be8');
        });

        test('get remediation with unknown resolution', async () => {
            const {body} = await request
            .get('/v1/remediations/ea5b1507-4cd3-4c87-aa5a-6c755d32a7bd?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(1);
            body.issues[0].resolution.should.have.property('id', 'fix');
        });

        test('get remediation with unknown issues', async () => {
            const {body} = await request
            .get('/v1/remediations/62c95092-ac83-4025-a676-362a67e68579?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            body.issues.should.have.length(0);
        });

        test('listing of remediations does not blow up', async () => {
            const {body} = await request
            .get('/v1/remediations?pretty')
            .set(auth.testReadSingle)
            .expect(200);

            expect(body).toMatchSnapshot();
        });
    });
});
