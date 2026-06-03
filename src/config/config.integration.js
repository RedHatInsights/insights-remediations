'use strict';

const { request, auth } = require('../test');
const config = require('../config');
const db = require('../db');
const identityUtils = require('../middleware/identity/utils');
const { MOCK_USERS } = require('../connectors/users/mock');

const TEST_USER = MOCK_USERS.testWriteUser;
const TEST_ORG_ID = TEST_USER.tenant_org_id;

function expectedConfigData(orgConfig) {
    const plan_retention_days = orgConfig?.plan_retention_days ?? null;
    const plan_warning_days = orgConfig?.plan_warning_days ?? null;

    return {
        plan_retention_days: {
            override: plan_retention_days,
            default: config.plan_retention.retentionDays
        },
        plan_warning_days: {
            override: plan_warning_days,
            default: config.plan_retention.warningDays
        }
    };
}
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

    test('GET /config returns null overrides when no org config exists', async () => {
        const { body } = await request
            .get('/v1/config')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql(expectedConfigData(null));
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

        body.should.eql(expectedConfigData({ plan_retention_days: 90, plan_warning_days: 14 }));
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

        body.should.eql(expectedConfigData({ plan_retention_days: 90, plan_warning_days: 14 }));

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

        body.should.eql(expectedConfigData({ plan_retention_days: 45, plan_warning_days: 7 }));
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

    test('PATCH /config can send only plan_retention_days; warning stays null when no row', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({ plan_retention_days: 55 })
            .expect(200);

        body.should.eql(expectedConfigData({ plan_retention_days: 55, plan_warning_days: null }));
    });

    test('PATCH /config with empty body persists nulls and creates org row', async () => {
        const { body } = await request
            .patch('/v1/config')
            .set(ADMIN_AUTH)
            .send({})
            .expect(200);

        body.should.eql(expectedConfigData(null));

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        should(saved.plan_retention_days).equal(null);
        should(saved.plan_warning_days).equal(null);
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

        body.should.eql(expectedConfigData({ plan_retention_days: 90, plan_warning_days: 21 }));
    });

    test('DELETE /config/:field returns 403 for non-admin users', async () => {
        await request
            .delete('/v1/config/plan_retention_days')
            .set(auth.testWrite)
            .expect(403);
    });

    test('DELETE /config/:field resets plan_retention_days to null; warning unchanged', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .delete('/v1/config/plan_retention_days')
            .set(ADMIN_AUTH)
            .expect(200);

        body.should.eql(expectedConfigData({ plan_retention_days: null, plan_warning_days: 14 }));

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        should(saved.plan_retention_days).equal(null);
        saved.plan_warning_days.should.equal(14);
    });

    test('DELETE /config/:field updates row setting field to null', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 120,
            plan_warning_days: 10
        });

        const { body } = await request
            .delete('/v1/config/plan_warning_days')
            .set(ADMIN_AUTH)
            .expect(200);

        body.should.eql(expectedConfigData({ plan_retention_days: 120, plan_warning_days: null }));

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        saved.plan_retention_days.should.equal(120);
        should(saved.plan_warning_days).equal(null);
    });

    test('DELETE /config/:field when no org row returns null overrides', async () => {
        const { body } = await request
            .delete('/v1/config/plan_retention_days')
            .set(ADMIN_AUTH)
            .expect(200);

        body.should.eql(expectedConfigData(null));
    });

    describe('validation: plan_warning_days must be less than plan_retention_days', () => {
        test('PATCH /config rejects when warning >= retention (both explicit)', async () => {
            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 30,
                    plan_warning_days: 30
                })
                .expect(400);

            body.errors[0].status.should.equal(400);
            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].title.should.equal('Data validation error');
        });

        test('PATCH /config rejects when warning > retention', async () => {
            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 10,
                    plan_warning_days: 20
                })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
        });

        test('PATCH /config rejects when retention too low for default warning', async () => {
            // Default warning is 30 days
            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 20,
                    plan_warning_days: null
                })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].details.message.should.match(/30 days.*20 days/);
        });

        test('PATCH /config rejects when warning too high for default retention', async () => {
            // Default retention is 120 days
            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: null,
                    plan_warning_days: 120
                })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].details.message.should.match(/120 days.*120 days/);
        });

        test('PATCH /config rejects when updating one field violates rule with existing value', async () => {
            await db.org_config.upsert({
                org_id: TEST_ORG_ID,
                plan_retention_days: 60,
                plan_warning_days: 10
            });

            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({ plan_retention_days: 5 })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
        });

        test('DELETE /config/:field rejects when reset would violate rule', async () => {
            // Set up: retention=25, warning=20 (valid state)
            // Delete warning -> warning becomes 30 (default), retention stays 25
            // 30 >= 25, invalid!
            await db.org_config.upsert({
                org_id: TEST_ORG_ID,
                plan_retention_days: 25,
                plan_warning_days: 20
            });

            const { body } = await request
                .delete('/v1/config/plan_warning_days')
                .set(ADMIN_AUTH)
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].details.message.should.match(/30 days.*25 days/);
        });

        test('PATCH /config accepts when warning < retention', async () => {
            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 90,
                    plan_warning_days: 14
                })
                .expect(200);

            body.should.eql(expectedConfigData({ plan_retention_days: 90, plan_warning_days: 14 }));
        });

        test('PATCH /config accepts when both null (uses defaults)', async () => {
            // Default: retention=120, warning=30, which satisfies 30 < 120
            const { body } = await request
                .patch('/v1/config')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: null,
                    plan_warning_days: null
                })
                .expect(200);

            body.should.eql(expectedConfigData(null));
        });
    });
});
