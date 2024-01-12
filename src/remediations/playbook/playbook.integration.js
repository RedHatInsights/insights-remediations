'use strict';
/*eslint-disable max-len*/

const { request, auth, mockDate, normalizePlaybookVersionForSnapshot, getSandbox, buildRbacResponse } = require('../../test');
const generator = require('../../generator/generator.controller.js');
const inventory = require('../../connectors/inventory');
const rbac = require('../../connectors/rbac');
const db = require('../../db');
const P = require('bluebird');

describe('playbooks', function () {
    describe('generate', function () {
        test('stores generated playbooks', async () => {
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            await P.delay(500);

            const entries = await db.PlaybookArchive.findAll({
                raw: true,
                where: {
                    account_number: 'testReadSingle',
                    filename: {
                        [db.Op.like]: 'many-systems-%'
                    }
                }
            });

            entries.should.have.length(1);
            const { id, username, account_number, filename, created_at, definition } = entries [0];
            expect(id).not.toBeNull();
            expect(created_at).not.toBeNull();
            expect(filename).not.toBeNull();
            expect({ username, account_number, definition }).toMatchSnapshot();
        });

        test('playbook with pydata and playbook support', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="remediation-1-[0-9]+\.yml"$/);
            expect(normalizePlaybookVersionForSnapshot(text)).toMatchSnapshot();
        });

        test('playbook that does not need reboot', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/playbook')
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="unnamed-playbook-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('playbook with suppressed reboot', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/178cf0c8-35dd-42a3-96d5-7b50f9d211f6/playbook')
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="remediation-with-suppressed-reboot-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('playbook with many hosts', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with cert-auth enabled', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8')
            .set(auth.cert02)
            .expect(200);

            expect(normalizePlaybookVersionForSnapshot(text)).toMatchSnapshot();
        });

        test('playbook with cert-auth and localhost', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8&localhost')
            .set(auth.cert02)
            .expect(200);

            expect(normalizePlaybookVersionForSnapshot(text)).toMatchSnapshot();
        });

        test('playbook specifying only 1 of its hosts', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook?hosts=84762eb3-0bbb-4bd8-ab11-f420c50e9000')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook specifying 1 host, making some issues in the playbook hostless', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=9dae9304-86a8-4f66-baa3-a1b27dfdd479')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook specifying 2 hosts, 1 included in the remediation and 1 not', async() => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=9dae9304-86a8-4f66-baa3-a1b27dfdd479,non-existent-host')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook specifying 1 host and using localhost flag', async() => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=9dae9304-86a8-4f66-baa3-a1b27dfdd479&localhost')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with localhost flag', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?localhost')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with localhost flag and reboot', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook?localhost')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with cert-auth and no hosts query param', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?localhost')
            .set(auth.cert02)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook for remediation with zero issues does not freak out', async () => {
            const {text} = await request
            .get('/v1/remediations/256ab1d3-58cf-1292-35e6-1a49c8b122d3/playbook')
            .expect(204);

            expect(text).toMatchSnapshot();
        });

        test('playbook contains correct resolution for issue', async () => {
            const { text } = await request
            .get('/v1/remediations/0e1c1018-cb54-4459-945b-f5d946645b7a/playbook')
            .set(auth.fifi)
            .expect(200);

            expect(text).toContain('- name: Update polkit to fix CVE-2021-4034');
        });

        test('204 on generation that creates no playbook', async () => {
            getSandbox().stub(generator, 'normalizeIssues').resolves([]);
            mockDate();
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('204 on remediation with no hosts', async () => {
            mockDate();
            await request
            .get('/v1/remediations/d1b070b5-1db8-4dac-8ecf-891dc1e9225f/playbook')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('204 on remediation with no hosts & localhost', async () => {
            mockDate();
            await request
            .get('/v1/remediations/d1b070b5-1db8-4dac-8ecf-891dc1e9225f/playbook?localhost')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('403 on cert-auth request with non matching owner_ids', async () => {
            getSandbox().stub(inventory, 'getSystemProfileBatch').resolves({
                '4bb19a8a-0c07-4ee6-a78c-504dab783cc8': {
                    id: '4bb19a8a-0c07-4ee6-a78c-504dab783cc8',
                    system_profile: {
                        owner_id: 'non-existent'
                    }
                }
            });
            mockDate();
            await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8&localhost')
            .set(auth.cert02)
            .expect(403);
        });

        test('404 on non-existent remediation', async () => {
            mockDate();
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e57d89/playbook')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('404 on host not associated with remediation', async () => {
            mockDate();
            await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=74862eb3-0bbb-4bd8-ab11-f420c50e9000')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('404 on non-existent host', async () => {
            mockDate();
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook?hosts=non-existent-host')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('404 on non-existent-host with cert auth', async () => {
            mockDate();
            await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=non-existent-host')
            .set(auth.cert02)
            .expect(404);
        });
    });

    describe('caching', function () {
        function testCaching (desc, id, etag) {
            test (desc, async () => {
                const {headers} = await request
                .get(`/v1/remediations/${id}/playbook`)
                .expect(200);

                headers.etag.should.equal(etag);

                await request
                .get(`/v1/remediations/${id}/playbook`)
                .set('if-none-match', etag)
                .expect(304);
            });
        }

        testCaching('pydata playbook', '66eec356-dd06-4c72-a3b6-ef27d1508a02', 'W/"4835-Oz5E/Ja+rTsWcDRDZwoNl3Kmv8A"');
        testCaching('no reboot playbook', 'e809526c-56f5-4cd8-a809-93328436ea23', 'W/"1771-rC4jtT7ig9lQT9CBLpMFkH4Eor8"');
        testCaching('playbook with suppressed reboot', '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
            'W/"1937-gjoSqp1gpVt5Me22Yni745YaNIc"');

        test('pydata playbook caching with stale data', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .set('if-none-match', 'W/"1e4d-hLarcuq+AQP/rL6nnA70UohsnSI"')
            .expect(200);
        });
    });

    describe('missing', function () {
        test('get remediation with missing system', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/82aeb63f-fc25-4eef-9333-4fa7e10f7217/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="missing-system-1-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('get remediation with missing system causing an issue to be empty', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/27e36e14-e1c2-4b5a-9382-ec80ca9a6c1a/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="missing-system-2-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('get remediation with unknown resolution', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/ea5b1507-4cd3-4c87-aa5a-6c755d32a7bd/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get remediation with unknown issues', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/62c95092-ac83-4025-a676-362a67e68579/playbook')
            .set(auth.testReadSingle)
            .expect(204);

            expect(text).toMatchSnapshot();
        });
    });

    test('playbook for remediation with test namespace', async () => {
        mockDate();
        const {text} = await request
        .set(auth.testReadSingle)
        .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook')
        .expect(200);

        expect(text).toMatchSnapshot();
    });

    describe('playbook RBAC', function () {
        test('permission = remediations:*:write does not allow playbook to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:write'));

            mockDate();
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = remediations:resolution:* does not allow playbook to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:resolution:*'));

            mockDate();
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = [] does not allow playbook to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

            mockDate();
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = remediations:*:write ignored on cert-auth', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:write'));

            mockDate();
            await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8&localhost')
            .set(auth.cert02)
            .expect(200);
        });
    });
});
