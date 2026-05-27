'use strict';

const sinon = require('sinon');
const should = require('should');
const { ValidationError } = require('sequelize');

const controller = require('./config.controller');
const db = require('../db');
const config = require('../config');

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

            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: 90, plan_warning_days: 14 }));
        });

        test('returns null overrides when org has no config', async () => {
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

            sinon.assert.calledWithExactly(res.json, expectedConfigData(null));
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
            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: 100, plan_warning_days: 20 }));
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

        test('fills omitted field with null when no org row', async () => {
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
                plan_warning_days: null
            });
        });

        test('when body omits both fields and no org row, upserts nulls and returns them', async () => {
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
                plan_retention_days: null,
                plan_warning_days: null
            });
            sinon.assert.calledWithExactly(res.json, expectedConfigData(null));
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
            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: 88, plan_warning_days: 9 }));
        });

        test('rejects when warning >= retention', async () => {
            db.org_config.findByPk.resolves(null);
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

            // Don't await - let errors.async catch and call next
            await controller.patch(req, res, next).catch(() => {});

            sinon.assert.calledOnce(next);
            const err = next.firstCall.args[0];
            err.error.code.should.equal('INVALID_CONFIG');
            err.error.status.should.equal(400);
            err.error.title.should.equal('Data validation error');
        });

        test('rejects when warning > retention', async () => {
            db.org_config.findByPk.resolves(null);
            const validationError = new ValidationError('Validation error', [
                { message: 'Warning period (20 days) must be less than retention period (10 days)' }
            ]);
            db.org_config.upsert.rejects(validationError);

            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 10,
                    plan_warning_days: 20
                }
            };
            const res = { json: sandbox.stub() };
            const next = sandbox.stub();

            await controller.patch(req, res, next).catch(() => {});

            sinon.assert.calledOnce(next);
            const err = next.firstCall.args[0];
            err.error.code.should.equal('INVALID_CONFIG');
        });

        test('rejects when retention too low for default warning (30 days)', async () => {
            db.org_config.findByPk.resolves(null);
            const validationError = new ValidationError('Validation error', [
                { message: 'Warning period (30 days) must be less than retention period (20 days)' }
            ]);
            db.org_config.upsert.rejects(validationError);

            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 20,
                    plan_warning_days: null
                }
            };
            const res = { json: sandbox.stub() };
            const next = sandbox.stub();

            await controller.patch(req, res, next).catch(() => {});

            sinon.assert.calledOnce(next);
            const err = next.firstCall.args[0];
            err.error.code.should.equal('INVALID_CONFIG');
            err.error.details.message.should.match(/30 days.*20 days/);
        });

        test('accepts when warning < retention', async () => {
            db.org_config.findByPk.resolves(null);
            db.org_config.upsert.resolves();
            const req = {
                user: { tenant_org_id: '5318290' },
                body: {
                    plan_retention_days: 90,
                    plan_warning_days: 14
                }
            };
            const res = { json: sandbox.stub() };

            await controller.patch(req, res);

            sinon.assert.calledOnce(db.org_config.upsert);
            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: 90, plan_warning_days: 14 }));
        });
    });

    describe('deleteConfig', function () {
        test('returns null overrides when org has no config row', async () => {
            db.org_config.findByPk.resolves(null);
            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_retention_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledWithExactly(res.json, expectedConfigData(null));
        });

        test('resets one field to null and updates row when other stays customized', async () => {
            const fakeRow = {
                plan_retention_days: 90,
                plan_warning_days: 14
            };
            fakeRow.update = sandbox.stub().callsFake(function(updates) {
                Object.assign(fakeRow, updates);
                return Promise.resolve();
            });
            fakeRow.destroy = sandbox.stub().resolves();
            db.org_config.findByPk.resolves(fakeRow);

            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_retention_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledOnce(fakeRow.update);
            sinon.assert.calledWithExactly(fakeRow.update, { plan_retention_days: null });
            sinon.assert.notCalled(fakeRow.destroy);
            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: null, plan_warning_days: 14 }));
        });

        test('updates row setting both fields to null after reset', async () => {
            const fakeRow = {
                plan_retention_days: 120,
                plan_warning_days: 10
            };
            fakeRow.update = sandbox.stub().callsFake(function(updates) {
                Object.assign(fakeRow, updates);
                return Promise.resolve();
            });
            fakeRow.destroy = sandbox.stub().resolves();
            db.org_config.findByPk.resolves(fakeRow);

            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_warning_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledOnce(fakeRow.update);
            sinon.assert.calledWithExactly(fakeRow.update, { plan_warning_days: null });
            sinon.assert.notCalled(fakeRow.destroy);
            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: 120, plan_warning_days: null }));
        });

        test('rejects when resetting warning to default would violate rule', async () => {
            // retention=25, warning=20 -> delete warning -> warning becomes 30
            // 30 >= 25, so should fail
            const validationError = new ValidationError('Validation error', [
                { message: 'Warning period (30 days) must be less than retention period (25 days)' }
            ]);

            const fakeRow = {
                plan_retention_days: 25,
                plan_warning_days: 20
            };
            fakeRow.update = sandbox.stub().rejects(validationError);
            fakeRow.destroy = sandbox.stub().resolves();
            db.org_config.findByPk.resolves(fakeRow);

            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_warning_days' }
            };
            const res = { json: sandbox.stub() };
            const next = sandbox.stub();

            await controller.deleteConfig(req, res, next).catch(() => {});

            sinon.assert.calledOnce(next);
            const err = next.firstCall.args[0];
            err.error.code.should.equal('INVALID_CONFIG');
            err.error.details.message.should.match(/30 days.*25 days/);
        });

        test('accepts when resetting to default still satisfies rule', async () => {
            // retention=150, warning=50 -> delete warning -> warning becomes 30
            // 30 < 150, valid
            const fakeRow = {
                plan_retention_days: 150,
                plan_warning_days: 50
            };
            fakeRow.update = sandbox.stub().callsFake(function(updates) {
                Object.assign(fakeRow, updates);
                return Promise.resolve();
            });
            fakeRow.destroy = sandbox.stub().resolves();
            db.org_config.findByPk.resolves(fakeRow);

            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_warning_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledOnce(fakeRow.update);
            sinon.assert.calledWithExactly(res.json, expectedConfigData({ plan_retention_days: 150, plan_warning_days: null }));
        });
    });
});
