'use strict';

const { request, auth } = require('../test');
const config = require('../config');
const db = require('../db');
const identityUtils = require('../middleware/identity/utils');
const { MOCK_USERS } = require('../connectors/users/mock');

const TEST_USER = MOCK_USERS.testWriteUser;
const TEST_ORG_ID = TEST_USER.tenant_org_id;
const ADMIN_AUTH = {
    [identityUtils.IDENTITY_HEADER]: identityUtils.createIdentityHeader(
        TEST_USER.username,
        TEST_USER.account_number,
        TEST_USER.tenant_org_id,
        false,
        data => {
            data.identity.user.is_org_admin = true;
            return data;
        }
    )
};

describe('config endpoints', () => {
    beforeEach(async () => {
        await db.org_config.destroy({
            where: {
                org_id: TEST_ORG_ID
            }
        });
    });

    test('GET /config returns defaults when no org config exists', async () => {
        const { body } = await request
            .get('/v1/config')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: config.plan_retention.retentionDays,
                plan_warning_days: config.plan_retention.warningDays
            }
        });
    });

    test('GET /config returns saved organization values', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .get('/v1/config')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: 90,
                plan_warning_days: 14
            }
        });
    });

    test('PATCH /config returns 403 for non-admin users', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(auth.testWrite)
            .send({
                plan_retention_days: 90,
                plan_warning_days: 14
            })
            .expect(403);

        body.errors[0].status.should.equal(403);
        body.errors[0].code.should.equal('FORBIDDEN');
        body.errors[0].title.should.equal('Access forbidden');
        body.errors[0].details.message.should.equal('Organization admin access required');
    });

    test('PATCH /config creates org config for admins', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: 90,
                plan_warning_days: 14
            })
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: 90,
                plan_warning_days: 14
            }
        });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        saved.plan_retention_days.should.equal(90);
        saved.plan_warning_days.should.equal(14);
    });

    test('PATCH /config updates existing org config for admins', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 120,
            plan_warning_days: 30
        });

        await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: 45,
                plan_warning_days: 7
            })
            .expect(200);

        const { body } = await request
            .get('/v1/config')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: 45,
                plan_warning_days: 7
            }
        });
    });

    test('PATCH /config validates retention range', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: 0,
                plan_warning_days: 14
            })
            .expect(400);

        body.errors[0].status.should.equal(400);
        body.errors[0].code.should.equal('minimum.openapi.requestValidation');
    });

    test('PATCH /config can send only plan_retention_days; warning uses system default when no row', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({ plan_retention_days: 55 })
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: 55,
                plan_warning_days: config.plan_retention.warningDays
            }
        });
    });

    test('PATCH /config with empty body persists defaults and creates org row', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({})
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: config.plan_retention.retentionDays,
                plan_warning_days: config.plan_retention.warningDays
            }
        });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        saved.plan_retention_days.should.equal(config.plan_retention.retentionDays);
        saved.plan_warning_days.should.equal(config.plan_retention.warningDays);
    });

    test('PATCH /config can send only one field; other keeps existing org value', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({ plan_warning_days: 21 })
            .expect(200);

        body.should.eql({
            data: {
                plan_retention_days: 90,
                plan_warning_days: 21
            }
        });
    });
});
