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

    test('generates playbook that does not need reboot', async () => {
        mockDate();
        const {text, headers} = await request
        .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/playbook')
        .expect(200);

        headers['content-disposition'].should.match(/^attachment;filename="unnamed-playbook-[0-9]+\.yml"$/);
        expect(text).toMatchSnapshot();
    });

    test('generates playbook with suppressed reboot', async () => {
        mockDate();
        const {text, headers} = await request
        .get('/v1/remediations/178cf0c8-35dd-42a3-96d5-7b50f9d211f6/playbook')
        .expect(200);

        headers['content-disposition'].should.match(/^attachment;filename="remediation-with-suppressed-reboot-[0-9]+\.yml"$/);
        expect(text).toMatchSnapshot();
    });
});
