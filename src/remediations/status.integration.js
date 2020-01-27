'use strict';

const { request, auth, buildRbacResponse, getSandbox } = require('../test');
const rbac = require('../connectors/rbac');

describe('remediations status', function () {
    test('listing of remediations does not blow up', async () => {
        const {body} = await request
        .get('/v1/remediations/bf0af437-2842-44d4-90de-bd83d40f7ea6/status?pretty')
        .set(auth.testStatus)
        .expect(200);

        expect(body).toMatchSnapshot();
    });
});

describe('status RBAC', function () {
    test('permission = remediations:*:write does not allow status to be read', async () => {
        getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:write'));

        const {body} = await request
        .get('/v1/remediations/bf0af437-2842-44d4-90de-bd83d40f7ea6/status?pretty')
        .set(auth.testStatus)
        .expect(403);

        body.errors[0].details.message.should.equal(
            'Permission remediations:remediation:read is required for this operation'
        );
    });

    test('permission = remediations:resolution:* does not allow status to be read', async () => {
        getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:resolution:*'));

        const {body} = await request
        .get('/v1/remediations/bf0af437-2842-44d4-90de-bd83d40f7ea6/status?pretty')
        .set(auth.testStatus)
        .expect(403);

        body.errors[0].details.message.should.equal(
            'Permission remediations:remediation:read is required for this operation'
        );
    });

    test('permission = [] does not allow status to be read', async () => {
        getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

        const {body} = await request
        .get('/v1/remediations/bf0af437-2842-44d4-90de-bd83d40f7ea6/status?pretty')
        .set(auth.testStatus)
        .expect(403);

        body.errors[0].details.message.should.equal(
            'Permission remediations:remediation:read is required for this operation'
        );
    });
});
