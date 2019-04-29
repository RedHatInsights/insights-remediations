'use strict';

const errors = require('../errors');
const { request, mockVmaas, getSandbox, reqId } = require('../test');
const { NON_EXISTENT_SYSTEM } = require('../connectors/inventory/mock');

test('generates a simple playbook', () => {
    const data = {
        issues: [{
            id: 'test:ping',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('generates a simple playbook with reboot', () => {
    const data = {
        issues: [{
            id: 'test:reboot',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459', '936ef48c-8f05-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('generates a simple playbook with suppressed reboot', async () => {
    const data = {
        issues: [{
            id: 'test:reboot',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459', '936ef48c-8f05-11e8-9eb6-529269fb1459']
        }],
        auto_reboot: false
    };

    const {text} = await request
    .post('/v1/playbook')
    .send(data)
    .expect(200);

    expect(text).toMatchSnapshot();
});

test('generates an erratum-based playbook', () => {
    mockVmaas();

    const data = {
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('sorts the hosts line', () => {
    mockVmaas();

    const data = {
        issues: [{
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['d2c8db4e-bd6a-11e8-a355-529269fb1459', '68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('adds diagnosis play', () => {
    mockVmaas();

    const data = {
        issues: [{
            id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459'],
            resolution: 'selinux_mitigate'
        }, {
            id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
            systems: ['4109fa1a-9a3f-11e8-9eb6-529269fb1459']
        }, {
            id: 'vulnerabilities:RHSA-2018:0502',
            systems: ['11931d66-9a3f-11e8-9eb6-529269fb1459']
        }]
    };

    return request
    .post('/v1/playbook')
    .send(data)
    .expect(200)
    .then(res => expect(res.text).toMatchSnapshot());
});

test('400s on invalid body parameters', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({})
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'required.openapi.validation',
            title: 'should have required property \'issues\' (location: body, path: issues)'
        }]);
    });
});

test('400s on no body', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .set({'content-type': 'application/json'})
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'required.openapi.validation',
            title: 'should have required property \'issues\' (location: body, path: issues)'
        }]);
    });
});

test('400s on empty issue list', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: []
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'minItems.openapi.validation',
            title: 'should NOT have fewer than 1 items (location: body, path: issues)'
        }]);
    });
});

test('400s on empty system list', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'vulnerabilities:CVE_2017_5461_nss|CVE_2017_5461_NSS_2',
            systems: []
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'minItems.openapi.validation',
            title: 'should NOT have fewer than 1 items (location: body, path: issues[0].systems)'
        }]);
    });
});

test('400s on additional property', async () => {
    const {id, header} = reqId();

    const data = {
        foo: 5,
        issues: [{
            id: 'test:ping',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    };

    const {body} = await request
    .post('/v1/playbook')
    .set(header)
    .send(data)
    .expect(400);

    body.errors.should.eql([{
        id,
        status: 400,
        code: 'additionalProperties.openapi.validation',
        title: 'should NOT have additional properties (location: body, path: undefined)'
    }]);
});

test('400s on unknown issue id', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'test:nonExistentId',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNSUPPORTED_ISSUE',
            title: 'Issue "test:nonExistentId" does not have Ansible support'
        }]);
    });
});

test('400s on unknown system id', () => {
    const {id, header} = reqId();

    return request
    .post('/v1/playbook')
    .set(header)
    .send({
        issues: [{
            id: 'vulnerabilities:CVE_2017_5461_nss|CVE_2017_5461_NSS_2',
            systems: [NON_EXISTENT_SYSTEM]
        }]
    })
    .expect(400)
    .then(({ body }) => {
        body.errors.should.eql([{
            id,
            status: 400,
            code: 'UNKNOWN_SYSTEM',
            title: `Unknown system identifier "${NON_EXISTENT_SYSTEM}"`
        }]);
    });
});

test('detects missing variable in template', async () => {
    const spy = getSandbox().spy(errors.internal, 'invalidTemplate');

    await request
    .post('/v1/playbook')
    .send({
        issues: [{
            id: 'test:missingVariable',
            systems: ['68799a02-8be9-11e8-9eb6-529269fb1459']
        }]
    })
    .expect(500);

    spy.callCount.should.equal(1);
});

describe('host sanitation', function () {

    async function getPlaybook (system) {
        return request
        .post('/v1/playbook')
        .send({
            issues: [{
                id: 'test:reboot',
                systems: [system]
            }]
        });
    }

    test('handles commas', async () => {
        const {text} = await getPlaybook('1040856f-b772-44c7-83a9-eeeeeeeeee01');
        expect(text).toMatchSnapshot();
    });

    test('handles quotes', async () => {
        const {text} = await getPlaybook('1040856f-b772-44c7-83a9-eeeeeeeeee02');
        expect(text).toMatchSnapshot();
    });

    test('handles newline', async () => {
        const {text} = await getPlaybook('1040856f-b772-44c7-83a9-eeeeeeeeee03');
        expect(text).toMatchSnapshot();
    });

    test('handles whitespace', async () => {
        const {text} = await getPlaybook('1040856f-b772-44c7-83a9-eeeeeeeeee04');
        expect(text).toMatchSnapshot();
    });
});
