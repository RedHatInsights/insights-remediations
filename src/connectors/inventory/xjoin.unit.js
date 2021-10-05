'use strict';

const _ = require('lodash');
const xjoin = require('./xjoin');
const base = require('../../test');
const queries = require('./xjoin.queries');
const { mockRequest } = require('../testUtils');
const RequestError = require('request-promise-core/errors').RequestError;

describe('inventory xjoin', function () {
    beforeEach(mockRequest);

    test('does not make a call for empty list', async function () {
        const spy = base.getSandbox().spy(queries, 'runQuery');
        const result = await xjoin.getSystemDetailsBatch([]);

        result.should.be.empty();
        spy.called.should.be.false();
    });

    test('forwards request headers', async function () {
        const spy = base.getSandbox().stub(queries, 'runQuery').resolves({
            status: 200,
            headers: {},
            data: {
                hosts: {
                    data: [
                        {
                            id: '22cd8e39-13bb-4d02-8316-84b850dc5136',
                            account: 'test',
                            display_name: 'test02.rhel7.local',
                            facts: null,
                            canonical_facts: {
                                fqdn: 'fqdn.test02.rhel7.local'
                            }
                        }
                    ]
                }
            }
        });

        await xjoin.getSystemDetailsBatch(['22cd8e39-13bb-4d02-8316-84b850dc5136']);
        const headers = spy.args[0][2];
        headers.should.have.size(2);
        headers.should.have.property('x-rh-identity', 'identity');
        headers.should.have.property('x-rh-insights-request-id', 'request-id');
    });

    test('obtains system details', async function () {
        const http = base.getSandbox().stub(queries, 'runQuery').resolves({
            status: 200,
            headers: {},
            data: {
                hosts: {
                    data: [
                        {
                            id: '22cd8e39-13bb-4d02-8316-84b850dc5136',
                            account: 'test',
                            display_name: 'test02.rhel7.local',
                            facts: null,
                            canonical_facts: {
                                fqdn: 'fqdn.test02.rhel7.local'
                            }
                        }
                    ]
                }
            }
        });

        const results = await xjoin.getSystemDetailsBatch(['22cd8e39-13bb-4d02-8316-84b850dc5136']);
        results.should.have.size(1);
        results.should.have.property('22cd8e39-13bb-4d02-8316-84b850dc5136');
        const result = results['22cd8e39-13bb-4d02-8316-84b850dc5136'];
        result.should.have.property('id', '22cd8e39-13bb-4d02-8316-84b850dc5136');
        result.should.have.property('hostname', 'fqdn.test02.rhel7.local');
        result.should.have.property('display_name', 'test02.rhel7.local');
        result.should.have.property('facts', null);

        http.callCount.should.equal(1);
    });

    test('retries on failure', async function () {
        const http = base.getSandbox().stub(queries, 'runQuery');

        http.onFirstCall().rejects(new RequestError('Error: socket hang up'));
        http.onSecondCall().rejects(new RequestError('Error: socket hang up'));
        http.resolves({
            status: 200,
            headers: {},
            data: {
                hosts: {
                    data: [
                        {
                            id: '22cd8e39-13bb-4d02-8316-84b850dc5136',
                            account: 'test',
                            display_name: 'test02.rhel7.local',
                            facts: null,
                            canonical_facts: {
                                fqdn: 'fqdn.test02.rhel7.local'
                            }
                        }
                    ]
                }
            }
        });

        const results = await xjoin.getSystemDetailsBatch(['22cd8e39-13bb-4d02-8316-84b850dc5136']);
        results.should.have.size(1);
        results.should.have.property('22cd8e39-13bb-4d02-8316-84b850dc5136');
        const result = results['22cd8e39-13bb-4d02-8316-84b850dc5136'];
        result.should.have.property('id', '22cd8e39-13bb-4d02-8316-84b850dc5136');
        result.should.have.property('hostname', 'fqdn.test02.rhel7.local');
        result.should.have.property('display_name', 'test02.rhel7.local');
        result.should.have.property('facts', null);

        http.callCount.should.equal(3);
    });

    test('returns empty object unknown systems', async function () {
        const http = base.getSandbox().stub(queries, 'runQuery').resolves({
            status: 200,
            headers: {},
            data: {
                hosts: {
                    data: []
                }
            }
        });

        await expect(xjoin.getSystemDetailsBatch(['22cd8e39-13bb-4d02-8316-84b850dc5136'])).resolves.toEqual({});
        http.callCount.should.equal(1);
    });

    test('handles many systems', async function () {
        const mocks = Array(250).fill(0).map((value, key) => ({
            id: `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`,
            account: 'test',
            display_name: null,
            facts: null,
            canonical_facts: {
                fqdn: `${String(key).padStart(3, '0')}.example.com`
            }
        }));

        base.getSandbox().stub(queries, 'runQuery').resolves({
            status: 200,
            headers: {},
            data: {
                hosts: {
                    data: mocks
                }
            }
        });

        const ids = Array(250).fill(0).map((value, key) => `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`);

        const result = await xjoin.getSystemDetailsBatch(ids);
        result.should.have.size(250);
        ids.forEach(id => _.has(result, id).should.be.true());
    });

    describe('getSystemProfileBatch', function () {
        test('does not make a call for empty list', async function () {
            const spy = base.getSandbox().spy(queries, 'runQuery');
            const result = await xjoin.getSystemProfileBatch([]);

            result.should.be.empty();
            spy.called.should.be.false();
        });

        test('forwards request headers', async function () {
            const spy = base.getSandbox().stub(queries, 'runQuery').resolves({
                status: 200,
                headers: {},
                data: {
                    hosts: {
                        data: [
                            {
                                id: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                                system_profile_facts: {
                                    owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                                    rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                                    is_marketplace: true
                                }
                            }
                        ]
                    }
                }
            });

            await xjoin.getSystemProfileBatch(['9dae9304-86a8-4f66-baa3-a1b27dfdd479']);
            const headers = spy.args[0][2];
            headers.should.have.size(2);
            headers.should.have.property('x-rh-identity', 'identity');
            headers.should.have.property('x-rh-insights-request-id', 'request-id');
        });

        test('obtains system profile details', async function () {
            const http = base.getSandbox().stub(queries, 'runQuery').resolves({
                status: 200,
                headers: {},
                data: {
                    hosts: {
                        data: [
                            {
                                id: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                                system_profile_facts: {
                                    owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                                    rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                                    is_marketplace: true
                                }
                            }
                        ]
                    }
                }
            });

            const results = await xjoin.getSystemProfileBatch(['9dae9304-86a8-4f66-baa3-a1b27dfdd479']);
            results.should.have.size(1);
            results.should.have.property('9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            const result = results['9dae9304-86a8-4f66-baa3-a1b27dfdd479'];
            result.should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            result.system_profile.should.have.property('owner_id', '81390ad6-ce49-4c8f-aa64-729d374ee65c');
            result.system_profile.should.have.property('rhc_client_id', 'f415fc2d-9700-4e30-9621-6a410ccc92c8');
            result.system_profile.should.have.property('is_marketplace', true);

            http.callCount.should.equal(1);
        });

        test('retries on failure', async function () {
            const http = base.getSandbox().stub(queries, 'runQuery');

            http.onFirstCall().rejects(new RequestError('Error: socket hang up'));
            http.onSecondCall().rejects(new RequestError('Error: socket hang up'));
            http.resolves({
                status: 200,
                headers: {},
                data: {
                    hosts: {
                        data: [
                            {
                                id: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                                system_profile_facts: {
                                    owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                                    rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                                    is_marketplace: true
                                }
                            }
                        ]
                    }
                }
            });

            const results = await xjoin.getSystemProfileBatch(['9dae9304-86a8-4f66-baa3-a1b27dfdd479']);
            results.should.have.size(1);
            results.should.have.property('9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            const result = results['9dae9304-86a8-4f66-baa3-a1b27dfdd479'];
            result.should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            result.system_profile.should.have.property('owner_id', '81390ad6-ce49-4c8f-aa64-729d374ee65c');
            result.system_profile.should.have.property('rhc_client_id', 'f415fc2d-9700-4e30-9621-6a410ccc92c8');
            result.system_profile.should.have.property('is_marketplace', true);

            http.callCount.should.equal(3);
        });

        test('returns empty object unknown systems', async function () {
            const http = base.getSandbox().stub(queries, 'runQuery').resolves({
                status: 200,
                headers: {},
                data: {
                    hosts: {
                        data: []
                    }
                }
            });

            await expect(xjoin.getSystemProfileBatch(['9dae9304-86a8-4f66-baa3-a1b27dfdd479'])).resolves.toEqual({});
            http.callCount.should.equal(1);
        });
    });

    describe('getSystemsByInsightsId', function () {
        test('new', async function () {
            base.getSandbox().stub(queries, 'runQuery').resolves({
                status: 200,
                headers: {},
                data: {
                    hosts: {
                        data: [
                            {
                                id: '22cd8e39-13bb-4d02-8316-84b850dc5136',
                                account: 'test',
                                display_name: 'test02.rhel7.local',
                                canonical_facts: {
                                    fqdn: 'fqdn.test02.rhel7.local',
                                    insights_id: 'd46c20e5-8f10-43ed-94e4-6c467a581ec7'
                                }
                            },
                            {
                                id: '146e1d6b-1013-430b-a29f-aaab6c0c2ec5',
                                account: 'test',
                                display_name: 'test03.rhel7.local',
                                canonical_facts: {
                                    fqdn: 'fqdn.test03.rhel7.local',
                                    insights_id: 'd46c20e5-8f10-43ed-94e4-6c467a581ec7'
                                }
                            }
                        ]
                    }
                }
            });

            const result = await xjoin.getSystemsByInsightsId('d46c20e5-8f10-43ed-94e4-6c467a581ec7');
            result.should.has.size(2);
            result[0].should.have.property('id', '22cd8e39-13bb-4d02-8316-84b850dc5136');
            result[0].should.have.property('account', 'test');
            result[0].should.have.property('hostname', 'fqdn.test02.rhel7.local');
            result[0].should.have.property('display_name', 'test02.rhel7.local');
            result[0].should.have.property('insights_id', 'd46c20e5-8f10-43ed-94e4-6c467a581ec7');

            result[1].should.have.property('id', '146e1d6b-1013-430b-a29f-aaab6c0c2ec5');
            result[1].should.have.property('account', 'test');
            result[1].should.have.property('hostname', 'fqdn.test03.rhel7.local');
            result[1].should.have.property('display_name', 'test03.rhel7.local');
            result[1].should.have.property('insights_id', 'd46c20e5-8f10-43ed-94e4-6c467a581ec7');
        });
    });

    describe('getSystemsByOwnerId', function () {
        test('new', async function () {
            base.getSandbox().stub(queries, 'runQuery').resolves({
                status: 200,
                headers: {},
                data: {
                    hosts: {
                        data: [
                            {
                                id: '22cd8e39-13bb-4d02-8316-84b850dc5136',
                                account: 'test',
                                display_name: 'test02.rhel7.local',
                                canonical_facts: {
                                    fqdn: 'fqdn.test02.rhel7.local',
                                    insights_id: 'd46c20e5-8f10-43ed-94e4-6c467a581ec7'
                                }
                            },
                            {
                                id: '146e1d6b-1013-430b-a29f-aaab6c0c2ec5',
                                account: 'test',
                                display_name: 'test03.rhel7.local',
                                canonical_facts: {
                                    fqdn: 'fqdn.test03.rhel7.local',
                                    insights_id: 'd46c20e5-8f10-43ed-94e4-6c467a581ec7'
                                }
                            }
                        ]
                    }
                }
            });

            const result = await xjoin.getSystemsByOwnerId('d46c20e5-8f10-43ed-94e4-6c467a581ec7');
            result.should.has.size(2);
            result[0].should.have.property('id', '22cd8e39-13bb-4d02-8316-84b850dc5136');
            result[0].should.have.property('account', 'test');
            result[0].should.have.property('hostname', 'fqdn.test02.rhel7.local');
            result[0].should.have.property('display_name', 'test02.rhel7.local');
            result[0].should.have.property('insights_id', 'd46c20e5-8f10-43ed-94e4-6c467a581ec7');

            result[1].should.have.property('id', '146e1d6b-1013-430b-a29f-aaab6c0c2ec5');
            result[1].should.have.property('account', 'test');
            result[1].should.have.property('hostname', 'fqdn.test03.rhel7.local');
            result[1].should.have.property('display_name', 'test03.rhel7.local');
            result[1].should.have.property('insights_id', 'd46c20e5-8f10-43ed-94e4-6c467a581ec7');
        });
    });
});
