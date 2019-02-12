'use strict';

const { request, auth } = require('../test');

describe('remediations status', function () {
    test('listing of remediations does not blow up', async () => {
        const {body} = await request
        .get('/v1/remediations/bf0af437-2842-44d4-90de-bd83d40f7ea6/status?pretty')
        .set(auth.testStatus)
        .expect(200);

        expect(body).toMatchSnapshot();
    });
});
