'use strict';

const sinon = require('sinon');
const should = require('should');
const { ValidationError } = require('sequelize');

const controller = require('./config.controller');
const db = require('../db');
const config = require('../config');

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

    describe('get', function () {
        test('returns effective values when configured', async () => {
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

            sinon.assert.calledWithExactly(res.json, expectedEffective({ plan_retention_days: 90, plan_warning_days: 14 }));
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

            sinon.assert.calledWithExactly(res.json, expectedEffective(null));
        });
    });

    describe('getDefaults', function () {
        test('returns system defaults', async () => {
            const res = { json: sandbox.stub() };

            await controller.getDefaults({}, res);

            sinon.assert.calledWithExactly(res.json, expectedDefaults());
        });
    });

    describe('getOverrides', function () {
        test('returns only non-null override fields', async () => {
            db.org_config.findByPk.resolves({
                plan_retention_days: null,
                plan_warning_days: 14
            });
            const req = {
                user: { tenant_org_id: '5318290' }
            };
            const res = { json: sandbox.stub() };

            await controller.getOverrides(req, res);

            sinon.assert.calledWithExactly(res.json, { plan_warning_days: 14 });
        });

        test('returns empty object when org has no config', async () => {
            db.org_config.findByPk.resolves(null);
            const req = {
                user: { tenant_org_id: '5318290' }
            };
            const res = { json: sandbox.stub() };

            await controller.getOverrides(req, res);

            sinon.assert.calledWithExactly(res.json, {});
        });
    });

    describe('putOverrides', function () {
        test('creates or updates org config and returns persisted override values', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: 100,
                plan_warning_days: 20
            }, true]);
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

            await controller.putOverrides(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: 100,
                plan_warning_days: 20
            });
            sinon.assert.notCalled(db.org_config.findByPk);
            sinon.assert.calledWithExactly(res.json, { plan_retention_days: 100, plan_warning_days: 20 });
        });

        test('clears omitted fields to null and omits them from response', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: 50,
                plan_warning_days: null
            }, false]);
            const req = {
                user: { tenant_org_id: '5318290' },
                body: { plan_retention_days: 50 }
            };
            const res = { json: sandbox.stub() };

            await controller.putOverrides(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: 50,
                plan_warning_days: null
            });
            sinon.assert.calledWithExactly(res.json, { plan_retention_days: 50 });
        });

        test('omits null values from response', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: null,
                plan_warning_days: 14
            }, false]);
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: null,
                    plan_warning_days: 14
                }
            };
            const res = { json: sandbox.stub() };

            await controller.putOverrides(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: null,
                plan_warning_days: 14
            });
            sinon.assert.calledWithExactly(res.json, { plan_warning_days: 14 });
        });

        test('empty body clears all overrides', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: null,
                plan_warning_days: null
            }, false]);
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {}
            };
            const res = { json: sandbox.stub() };

            await controller.putOverrides(req, res);

            sinon.assert.calledWithExactly(db.org_config.upsert, {
                org_id: '5318290',
                plan_retention_days: null,
                plan_warning_days: null
            });
            sinon.assert.calledWithExactly(res.json, {});
        });

        test('returns persisted values rather than request body when they differ', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: 51,
                plan_warning_days: 14
            }, false]);
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 50,
                    plan_warning_days: 14
                }
            };
            const res = { json: sandbox.stub() };

            await controller.putOverrides(req, res);

            sinon.assert.calledWithExactly(res.json, { plan_retention_days: 51, plan_warning_days: 14 });
        });

        test('rejects when warning >= retention', async () => {
            const validationError = new ValidationError('Validation error', [
                { message: 'Warning period (30 days) must be less than retention period (30 days)' }
            ]);
            db.org_config.upsert.rejects(validationError);

            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 30,
                    plan_warning_days: 30
                }
            };
            const res = { json: sandbox.stub() };
            const next = sandbox.stub();

            await controller.putOverrides(req, res, next).catch(() => {});

            sinon.assert.calledOnce(next);
            const err = next.firstCall.args[0];
            err.error.code.should.equal('INVALID_CONFIG');
            err.error.status.should.equal(400);
            err.error.title.should.equal('Data validation error');
        });

        test('rejects when retention too low for default warning (30 days)', async () => {
            const validationError = new ValidationError('Validation error', [
                { message: 'Warning period (30 days) must be less than retention period (20 days)' }
            ]);
            db.org_config.upsert.rejects(validationError);

            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 20
                }
            };
            const res = { json: sandbox.stub() };
            const next = sandbox.stub();

            await controller.putOverrides(req, res, next).catch(() => {});

            sinon.assert.calledOnce(next);
            const err = next.firstCall.args[0];
            err.error.code.should.equal('INVALID_CONFIG');
            err.error.details.message.should.match(/30 days.*20 days/);
        });

        test('returns persisted override values', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: 90,
                plan_warning_days: 21
            }, false]);
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 90,
                    plan_warning_days: 21
                }
            };
            const res = { json: sandbox.stub() };

            await controller.putOverrides(req, res);

            sinon.assert.calledWithExactly(res.json, { plan_retention_days: 90, plan_warning_days: 21 });
        });

        test('accepts when warning < retention', async () => {
            db.org_config.upsert.resolves([{
                plan_retention_days: 90,
                plan_warning_days: 14
            }, false]);
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 90,
                    plan_warning_days: 14
                }
            };
            const res = { json: sandbox.stub() };

            await controller.putOverrides(req, res);

            sinon.assert.calledOnce(db.org_config.upsert);
            sinon.assert.calledWithExactly(res.json, { plan_retention_days: 90, plan_warning_days: 14 });
        });
    });
});
