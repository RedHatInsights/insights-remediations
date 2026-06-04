'use strict';

const { request, auth } = require('../test');
const config = require('../config');
const db = require('../db');
const identityUtils = require('../middleware/identity/utils');
const { MOCK_USERS } = require('../connectors/users/mock');

const TEST_USER = MOCK_USERS.testWriteUser;
const TEST_ORG_ID = TEST_USER.tenant_org_id;

function expectedEffective(orgConfig) {
    return {
        plan_retention_days: orgConfig?.plan_retention_days ?? config.plan_retention.retentionDays,
        plan_warning_days: orgConfig?.plan_warning_days ?? config.plan_retention.warningDays
    };
}

function expectedDefaults() {
    return {
        plan_retention_days: config.plan_retention.retentionDays,
        plan_warning_days: config.plan_retention.warningDays
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

    test('GET /config returns defaults when no org config exists', async () => {
        const { body } = await request
            .get('/v1/config')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql(expectedEffective(null));
    });

    test('GET /config returns effective values with overrides applied', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .get('/v1/config')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql(expectedEffective({ plan_retention_days: 90, plan_warning_days: 14 }));
    });

    test('GET /config/defaults returns system defaults', async () => {
        const { body } = await request
            .get('/v1/config/defaults')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql(expectedDefaults());
    });

    test('GET /config/overrides returns empty object when no org config exists', async () => {
        const { body } = await request
            .get('/v1/config/overrides')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql({});
    });

    test('GET /config/overrides returns only customized fields', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: null,
            plan_warning_days: 14
        });

        const { body } = await request
            .get('/v1/config/overrides')
            .set(auth.testWrite)
            .expect(200);

        body.should.eql({ plan_warning_days: 14 });
    });

    test('PUT /config/overrides returns 403 for non-admin users', async () => {
        const { body } = await request
            .put('/v1/config/overrides')
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

    test('PUT /config/overrides creates org config for admins', async () => {
        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: 90,
                plan_warning_days: 14
            })
            .expect(200);

        body.should.eql({ plan_retention_days: 90, plan_warning_days: 14 });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        saved.plan_retention_days.should.equal(90);
        saved.plan_warning_days.should.equal(14);
    });

    test('PUT /config/overrides updates existing org config for admins', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 120,
            plan_warning_days: 30
        });

        await request
            .put('/v1/config/overrides')
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

        body.should.eql(expectedEffective({ plan_retention_days: 45, plan_warning_days: 7 }));
    });

    test('PUT /config/overrides validates retention range', async () => {
        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: 0,
                plan_warning_days: 14
            })
            .expect(400);

        body.errors[0].status.should.equal(400);
        body.errors[0].code.should.equal('minimum.openapi.requestValidation');
    });

    test('PUT /config/overrides with one field clears the other override', async () => {
        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({ plan_retention_days: 55 })
            .expect(200);

        body.should.eql({ plan_retention_days: 55 });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        saved.plan_retention_days.should.equal(55);
        should(saved.plan_warning_days).equal(null);
    });

    test('PUT /config/overrides with empty body clears all overrides', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({})
            .expect(200);

        body.should.eql({});

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        should(saved.plan_retention_days).equal(null);
        should(saved.plan_warning_days).equal(null);
    });

    test('PUT /config/overrides accepts null to clear a field override', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: null,
                plan_warning_days: 14
            })
            .expect(200);

        body.should.eql({ plan_warning_days: 14 });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        should(saved.plan_retention_days).equal(null);
        saved.plan_warning_days.should.equal(14);
    });

    test('PUT /config/overrides replaces prior overrides when sending one field', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({ plan_warning_days: 21 })
            .expect(200);

        body.should.eql({ plan_warning_days: 21 });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        should(saved.plan_retention_days).equal(null);
        saved.plan_warning_days.should.equal(21);
    });

    test('PUT /config/overrides returns all fields included in the request body', async () => {
        await db.org_config.upsert({
            org_id: TEST_ORG_ID,
            plan_retention_days: 90,
            plan_warning_days: 14
        });

        const { body } = await request
            .put('/v1/config/overrides')
            .set(ADMIN_AUTH)
            .send({
                plan_retention_days: 90,
                plan_warning_days: 21
            })
            .expect(200);

        body.should.eql({ plan_retention_days: 90, plan_warning_days: 21 });

        const saved = await db.org_config.findByPk(TEST_ORG_ID);
        saved.plan_retention_days.should.equal(90);
        saved.plan_warning_days.should.equal(21);
    });

    describe('validation: plan_warning_days must be less than plan_retention_days', () => {
        test('PUT /config/overrides rejects when warning >= retention (both explicit)', async () => {
            const { body } = await request
                .put('/v1/config/overrides')
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

        test('PUT /config/overrides rejects when warning > retention', async () => {
            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 10,
                    plan_warning_days: 20
                })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
        });

        test('PUT /config/overrides rejects when retention too low for default warning', async () => {
            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 20
                })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].details.message.should.match(/30 days.*20 days/);
        });

        test('PUT /config/overrides rejects when warning too high for default retention', async () => {
            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({
                    plan_warning_days: 120
                })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].details.message.should.match(/120 days.*120 days/);
        });

        test('PUT /config/overrides rejects when updating one field violates rule with cleared field using default', async () => {
            await db.org_config.upsert({
                org_id: TEST_ORG_ID,
                plan_retention_days: 60,
                plan_warning_days: 10
            });

            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({ plan_retention_days: 5 })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
        });

        test('PUT /config/overrides rejects when clearing warning would violate rule with retention override', async () => {
            await db.org_config.upsert({
                org_id: TEST_ORG_ID,
                plan_retention_days: 25,
                plan_warning_days: 20
            });

            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({ plan_retention_days: 25 })
                .expect(400);

            body.errors[0].code.should.equal('INVALID_CONFIG');
            body.errors[0].details.message.should.match(/30 days.*25 days/);
        });

        test('PUT /config/overrides accepts when warning < retention', async () => {
            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({
                    plan_retention_days: 90,
                    plan_warning_days: 14
                })
                .expect(200);

            body.should.eql({ plan_retention_days: 90, plan_warning_days: 14 });
        });

        test('PUT /config/overrides accepts when all overrides cleared', async () => {
            const { body } = await request
                .put('/v1/config/overrides')
                .set(ADMIN_AUTH)
                .send({})
                .expect(200);

            body.should.eql({});
        });
    });
});
