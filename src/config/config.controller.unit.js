'use strict';

const sinon = require('sinon');
const should = require('should');

const controller = require('./config.controller');
const db = require('../db');
const config = require('../config');
const errors = require('../errors');

describe('config controller unit tests', function () {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        db.org_config = {
            findByPk: sandbox.stub(),
            upsert: sandbox.stub()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('requireOrgAdmin', function () {
        test('allows org admins', () => {
            const req = {
                identity: {
                    user: {
                        is_org_admin: true
                    }
                }
            };
            const next = sandbox.stub();

            controller.requireOrgAdmin(req, {}, next);

            sinon.assert.calledWithExactly(next);
        });

        test('returns forbidden for non-admin users', () => {
            const req = {
                identity: {
                    user: {
                        is_org_admin: false
                    }
                }
            };
            const next = sandbox.stub();

            controller.requireOrgAdmin(req, {}, next);

            sinon.assert.calledOnce(next);
            should(next.firstCall.args[0]).be.instanceOf(errors.Forbidden);
            should(next.firstCall.args[0].error.details.message).eql('Organization admin access required');
        });
    });

    describe('get', function () {
        test('returns organization values when configured', async () => {
            db.org_config.findByPk.resolves({
                plan_retention_days: 90,
                plan_warning_days: 14
            });
            const req = {
                user: {
                    tenant_org_id: '5318290'
                }
            };
            const res = {
                json: sandbox.stub()
            };

            await controller.get(req, res);

            sinon.assert.calledWithExactly(res.json, {
                data: {
                    plan_retention_days: 90,
                    plan_warning_days: 14
                }
            });
        });

        test('returns defaults when org has no config', async () => {
            db.org_config.findByPk.resolves(null);
            const req = {
                user: {
                    tenant_org_id: '5318290'
                }
            };
            const res = {
                json: sandbox.stub()
            };

            await controller.get(req, res);

            sinon.assert.calledWithExactly(res.json, {
                data: {
                    plan_retention_days: config.plan_retention.retentionDays,
                    plan_warning_days: config.plan_retention.warningDays
                }
            });
        });
    });

    describe('patch', function () {
        test('creates or updates org config and returns payload', async () => {
            db.org_config.findByPk.resolves(null);
            db.org_config.upsert.resolves();
            const req = {
                user: {
                    tenant_org_id: '5318290'
                },
                body: {
                    plan_retention_days: 100,
                    plan_warning_days: 20
                }
            };
            const res = {
                json: sandbox.stub()
            };

            await controller.patch(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: 100,
                plan_warning_days: 20
            });
            sinon.assert.calledWithExactly(res.json, {
                data: {
                    plan_retention_days: 100,
                    plan_warning_days: 20
                }
            });
        });

        test('fills omitted field from existing org row', async () => {
            db.org_config.findByPk.resolves({
                plan_retention_days: 90,
                plan_warning_days: 14
            });
            db.org_config.upsert.resolves();
            const req = {
                user: { tenant_org_id: '5318290' },
                body: { plan_retention_days: 60 }
            };
            const res = { json: sandbox.stub() };

            await controller.patch(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: 60,
                plan_warning_days: 14
            });
        });

        test('fills omitted field from system defaults when no org row', async () => {
            db.org_config.findByPk.resolves(null);
            db.org_config.upsert.resolves();
            const req = {
                user: { tenant_org_id: '5318290' },
                body: { plan_retention_days: 50 }
            };
            const res = { json: sandbox.stub() };

            await controller.patch(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: 50,
                plan_warning_days: config.plan_retention.warningDays
            });
        });

        test('when body omits both fields and no org row, upserts defaults and returns them', async () => {
            db.org_config.findByPk.resolves(null);
            db.org_config.upsert.resolves();
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {}
            };
            const res = { json: sandbox.stub() };

            await controller.patch(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: config.plan_retention.retentionDays,
                plan_warning_days: config.plan_retention.warningDays
            });
            sinon.assert.calledWithExactly(res.json, {
                data: {
                    plan_retention_days: config.plan_retention.retentionDays,
                    plan_warning_days: config.plan_retention.warningDays
                }
            });
        });

        test('when body omits both fields and org row exists, upserts same values and returns them', async () => {
            db.org_config.findByPk.resolves({
                plan_retention_days: 88,
                plan_warning_days: 9
            });
            db.org_config.upsert.resolves();
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {}
            };
            const res = { json: sandbox.stub() };

            await controller.patch(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: 88,
                plan_warning_days: 9
            });
            sinon.assert.calledWithExactly(res.json, {
                data: {
                    plan_retention_days: 88,
                    plan_warning_days: 9
                }
            });
        });
    });
});
