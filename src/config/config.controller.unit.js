'use strict';

const sinon = require('sinon');
const should = require('should');

const controller = require('./config.controller');
const db = require('../db');
const config = require('../config');

function expectedConfigData(plan_retention_days, plan_warning_days) {
    return {
        plan_retention_days,
        plan_warning_days,
        default_plan_retention_days: config.plan_retention.retentionDays,
        default_plan_warning_days: config.plan_retention.warningDays
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

            sinon.assert.calledWithExactly(res.json, {
                data: expectedConfigData(90, 14)
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
                data: expectedConfigData(
                    config.plan_retention.retentionDays,
                    config.plan_retention.warningDays
                )
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
                data: expectedConfigData(100, 20)
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
                data: expectedConfigData(
                    config.plan_retention.retentionDays,
                    config.plan_retention.warningDays
                )
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
                data: expectedConfigData(88, 9)
            });
        });
    });

    describe('deleteConfig', function () {
        test('returns deployment defaults when org has no config row', async () => {
            db.org_config.findByPk.resolves(null);
            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_retention_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledWithExactly(res.json, {
                data: expectedConfigData(
                    config.plan_retention.retentionDays,
                    config.plan_retention.warningDays
                )
            });
        });

        test('resets one field to default and updates row when other stays customized', async () => {
            const fakeRow = {
                plan_retention_days: 90,
                plan_warning_days: 14
            };
            fakeRow.update = sandbox.stub().resolves();
            fakeRow.destroy = sandbox.stub().resolves();
            db.org_config.findByPk.resolves(fakeRow);

            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_retention_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledOnce(fakeRow.update);
            should(fakeRow.update.firstCall.args[0]).eql({
                plan_retention_days: config.plan_retention.retentionDays,
                plan_warning_days: 14
            });
            sinon.assert.notCalled(fakeRow.destroy);
            sinon.assert.calledWithExactly(res.json, {
                data: expectedConfigData(config.plan_retention.retentionDays, 14)
            });
        });

        test('updates row when both fields are at defaults after reset', async () => {
            const fakeRow = {
                plan_retention_days: config.plan_retention.retentionDays,
                plan_warning_days: 10
            };
            fakeRow.update = sandbox.stub().resolves();
            fakeRow.destroy = sandbox.stub().resolves();
            db.org_config.findByPk.resolves(fakeRow);

            const req = {
                user: { tenant_org_id: '5318290' },
                params: { field: 'plan_warning_days' }
            };
            const res = { json: sandbox.stub() };

            await controller.deleteConfig(req, res, sandbox.stub());

            sinon.assert.calledOnce(fakeRow.update);
            should(fakeRow.update.firstCall.args[0]).eql({
                plan_retention_days: config.plan_retention.retentionDays,
                plan_warning_days: config.plan_retention.warningDays
            });
            sinon.assert.notCalled(fakeRow.destroy);
            sinon.assert.calledWithExactly(res.json, {
                data: expectedConfigData(
                    config.plan_retention.retentionDays,
                    config.plan_retention.warningDays
                )
            });
        });

    });
});
