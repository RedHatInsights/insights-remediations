'use strict';

const { request, mockDate } = require('../test');

describe('playbooks', function () {
    test('generates playbook with pydata and playbook support', async () => {
        mockDate();
        const {text, headers} = await request
        .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
        .expect(200);

        headers['content-disposition'].should.match(/^attachment;filename="remediation-1-[0-9]+\.yml"$/);
        expect(text).toMatchSnapshot();
    });
});
