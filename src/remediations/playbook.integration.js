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

    test('playbook for remediation with zero issues does not freak out', async () => {
        const {text} = await request
        .get('/v1/remediations/256ab1d3-58cf-1292-35e6-1a49c8b122d3/playbook')
        .expect(204);

        expect(text).toMatchSnapshot();
    });

    describe('caching', function () {
        test('pydata playbook caching', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .set('if-none-match', 'W/"1e4d-hLarcuq+AQP/rL5nnA70UohsnSI"')
            .expect(304);
        });

        test('pydata playbook caching with stale data', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .set('if-none-match', 'W/"1e4d-hLarcuq+AQP/rL6nnA70UohsnSI"')
            .expect(200);
        });

        test('no reboot playbook caching', async () => {
            await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/playbook')
            .set('if-none-match', 'W/"944-iFtx+BHAhy9qJeTGQguEagp6NOw"')
            .expect(304);
        });

        test('generates playbook with suppressed reboot', async () => {
            await request
            .get('/v1/remediations/178cf0c8-35dd-42a3-96d5-7b50f9d211f6/playbook')
            .set('if-none-match', 'W/"be1-rUthu0Xdr4iix21vbFDjKM4qIeQ"')
            .expect(304);
        });
    });
});
