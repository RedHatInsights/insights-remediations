'use strict';

const _ = require('lodash');
const URI = require('urijs');
const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const RequestError = require('request-promise-core/errors').RequestError;


describe('inventory impl', () => {
    beforeEach(mockRequest);

    describe('Tenant org_id to EBS account number translations', () => {

        test('single org_id', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({"1979710": "540155"});

            const result = await impl.getEBSAccounts(1979710);

            stub.getCall(0).args[0].body.should.be.array;
            stub.getCall(0).args[0].body[0].should.be.String;
        });

        test('Array of org_ids', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({"1979710": "540155", "38393949": "3098430"});

            const result = await impl.getEBSAccounts([1979710, 38393949]);

            stub.getCall(0).args[0].body.should.be.array;
            for (const account of stub.getCall(0).args[0].body) {
                account.should.be.String;
            }
        });

        test('Array of mixed strings and numbers', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({
                "29393933": "2828282",
                "1979710": "540155",
                "38393949": "3098430"
            });

            const result = await impl.getEBSAccounts([1979710, "38393949", 29393933]);

            stub.getCall(0).args[0].body.should.be.array;
            for (const account of stub.getCall(0).args[0].body) {
                account.should.be.String;
            }
        });

        test('anemic tenant', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({});

            const result = await impl.getEBSAccounts(1979710);

            stub.getCall(0).args[0].body.should.be.array;
            stub.getCall(0).args[0].body[0].should.be.String;
        });

        test('does not make a call for empty list', async () => {
            const spy = base.getSandbox().spy(http, 'request');
            const result = await impl.getEBSAccounts([]);

            result.should.be.empty();
            spy.called.should.be.false();
        });
    });

    describe('EBS account number to tenant org_id translations', () => {

        test('single EBS account number', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({"540155": "1979710"});

            const result = await impl.getTenantOrgIds(540155);

            stub.getCall(0).args[0].body.should.be.array;
            stub.getCall(0).args[0].body[0].should.be.String;
        });

        test('Array of EBS account numbers', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({"540155": "1979710", "3098430": "38393949"});

            const result = await impl.getTenantOrgIds([540155, 3098430]);

            stub.getCall(0).args[0].body.should.be.array;
            for (const account of stub.getCall(0).args[0].body) {
                account.should.be.String;
            }
        });

        test('Array of mixed strings and numbers', async () => {
            const stub = base.getSandbox().stub(http, 'request');
            stub.returns({
                "2828282": "29393933",
                "540155": "1979710",
                "3098430": "38393949"
            });

            const result = await impl.getTenantOrgIds([540155, "3098430", 2828282]);

            stub.getCall(0).args[0].body.should.be.array;
            for (const account of stub.getCall(0).args[0].body) {
                account.should.be.String;
            }
        });

        test('does not make a call for empty list', async () => {
            const spy = base.getSandbox().spy(http, 'request');
            const result = await impl.getTenantOrgIds([]);

            result.should.be.empty();
            spy.called.should.be.false();
        });
    });
});