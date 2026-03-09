'use strict';
/*eslint-disable max-len*/

const { request, auth, mockDate, normalizePlaybookVersionForSnapshot, getSandbox, buildRbacResponse } = require('../../test');
const generator = require('../../generator/generator.controller.js');
const inventory = require('../../connectors/inventory');
const rbac = require('../../connectors/rbac');
const db = require('../../db');
const P = require('bluebird');

describe('playbooks', function () {
    describe('generate', function () {
        test('stores generated playbooks', async () => {
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            await P.delay(500);

            const entries = await db.PlaybookArchive.findAll({
                raw: true,
                where: {
                    account_number: 'testReadSingle',
                    filename: {
                        [db.Op.like]: 'many-systems-%'
                    }
                }
            });

            entries.should.have.length(1);
            const { id, username, account_number, filename, created_at, definition } = entries [0];
            expect(id).not.toBeNull();
            expect(created_at).not.toBeNull();
            expect(filename).not.toBeNull();
            expect({ username, account_number, definition }).toMatchSnapshot();
        });

        test('playbook with pydata and playbook support', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="test1-[0-9]+\.yml"$/);
            expect(normalizePlaybookVersionForSnapshot(text)).toMatchSnapshot();
        });

        test('playbook that does not need reboot', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/playbook')
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="test3-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('playbook with suppressed reboot', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/178cf0c8-35dd-42a3-96d5-7b50f9d211f6/playbook')
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="remediation-with-suppressed-reboot-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('playbook with many hosts', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with cert-auth enabled', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8')
            .set(auth.cert02)
            .expect(200);

            expect(normalizePlaybookVersionForSnapshot(text)).toMatchSnapshot();
        });

        test('playbook with cert-auth and localhost', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8&localhost')
            .set(auth.cert02)
            .expect(200);

            expect(normalizePlaybookVersionForSnapshot(text)).toMatchSnapshot();
        });

        test('POST to fetch playbook with 250 systems (500 in request)', async () => {
            mockDate();
            const result = await request
            .post('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.cert02)
            .send([
                '84762eb3-0bbb-4bd8-ab11-f420c50e9000', '84762eb3-0bbb-4bd8-ab11-f420c50e9001', '84762eb3-0bbb-4bd8-ab11-f420c50e9002', '84762eb3-0bbb-4bd8-ab11-f420c50e9003',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9004', '84762eb3-0bbb-4bd8-ab11-f420c50e9005', '84762eb3-0bbb-4bd8-ab11-f420c50e9006', '84762eb3-0bbb-4bd8-ab11-f420c50e9007',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9008', '84762eb3-0bbb-4bd8-ab11-f420c50e9009', '84762eb3-0bbb-4bd8-ab11-f420c50e9010', '84762eb3-0bbb-4bd8-ab11-f420c50e9011',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9012', '84762eb3-0bbb-4bd8-ab11-f420c50e9013', '84762eb3-0bbb-4bd8-ab11-f420c50e9014', '84762eb3-0bbb-4bd8-ab11-f420c50e9015',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9016', '84762eb3-0bbb-4bd8-ab11-f420c50e9017', '84762eb3-0bbb-4bd8-ab11-f420c50e9018', '84762eb3-0bbb-4bd8-ab11-f420c50e9019',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9020', '84762eb3-0bbb-4bd8-ab11-f420c50e9021', '84762eb3-0bbb-4bd8-ab11-f420c50e9022', '84762eb3-0bbb-4bd8-ab11-f420c50e9023',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9024', '84762eb3-0bbb-4bd8-ab11-f420c50e9025', '84762eb3-0bbb-4bd8-ab11-f420c50e9026', '84762eb3-0bbb-4bd8-ab11-f420c50e9027',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9028', '84762eb3-0bbb-4bd8-ab11-f420c50e9029', '84762eb3-0bbb-4bd8-ab11-f420c50e9030', '84762eb3-0bbb-4bd8-ab11-f420c50e9031',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9032', '84762eb3-0bbb-4bd8-ab11-f420c50e9033', '84762eb3-0bbb-4bd8-ab11-f420c50e9034', '84762eb3-0bbb-4bd8-ab11-f420c50e9035',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9036', '84762eb3-0bbb-4bd8-ab11-f420c50e9037', '84762eb3-0bbb-4bd8-ab11-f420c50e9038', '84762eb3-0bbb-4bd8-ab11-f420c50e9039',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9040', '84762eb3-0bbb-4bd8-ab11-f420c50e9041', '84762eb3-0bbb-4bd8-ab11-f420c50e9042', '84762eb3-0bbb-4bd8-ab11-f420c50e9043',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9044', '84762eb3-0bbb-4bd8-ab11-f420c50e9045', '84762eb3-0bbb-4bd8-ab11-f420c50e9046', '84762eb3-0bbb-4bd8-ab11-f420c50e9047',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9048', '84762eb3-0bbb-4bd8-ab11-f420c50e9049', '84762eb3-0bbb-4bd8-ab11-f420c50e9050', '84762eb3-0bbb-4bd8-ab11-f420c50e9051',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9052', '84762eb3-0bbb-4bd8-ab11-f420c50e9053', '84762eb3-0bbb-4bd8-ab11-f420c50e9054', '84762eb3-0bbb-4bd8-ab11-f420c50e9055',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9056', '84762eb3-0bbb-4bd8-ab11-f420c50e9057', '84762eb3-0bbb-4bd8-ab11-f420c50e9058', '84762eb3-0bbb-4bd8-ab11-f420c50e9059',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9060', '84762eb3-0bbb-4bd8-ab11-f420c50e9061', '84762eb3-0bbb-4bd8-ab11-f420c50e9062', '84762eb3-0bbb-4bd8-ab11-f420c50e9063',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9064', '84762eb3-0bbb-4bd8-ab11-f420c50e9065', '84762eb3-0bbb-4bd8-ab11-f420c50e9066', '84762eb3-0bbb-4bd8-ab11-f420c50e9067',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9068', '84762eb3-0bbb-4bd8-ab11-f420c50e9069', '84762eb3-0bbb-4bd8-ab11-f420c50e9070', '84762eb3-0bbb-4bd8-ab11-f420c50e9071',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9072', '84762eb3-0bbb-4bd8-ab11-f420c50e9073', '84762eb3-0bbb-4bd8-ab11-f420c50e9074', '84762eb3-0bbb-4bd8-ab11-f420c50e9075',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9076', '84762eb3-0bbb-4bd8-ab11-f420c50e9077', '84762eb3-0bbb-4bd8-ab11-f420c50e9078', '84762eb3-0bbb-4bd8-ab11-f420c50e9079',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9080', '84762eb3-0bbb-4bd8-ab11-f420c50e9081', '84762eb3-0bbb-4bd8-ab11-f420c50e9082', '84762eb3-0bbb-4bd8-ab11-f420c50e9083',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9084', '84762eb3-0bbb-4bd8-ab11-f420c50e9085', '84762eb3-0bbb-4bd8-ab11-f420c50e9086', '84762eb3-0bbb-4bd8-ab11-f420c50e9087',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9088', '84762eb3-0bbb-4bd8-ab11-f420c50e9089', '84762eb3-0bbb-4bd8-ab11-f420c50e9090', '84762eb3-0bbb-4bd8-ab11-f420c50e9091',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9092', '84762eb3-0bbb-4bd8-ab11-f420c50e9093', '84762eb3-0bbb-4bd8-ab11-f420c50e9094', '84762eb3-0bbb-4bd8-ab11-f420c50e9095',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9096', '84762eb3-0bbb-4bd8-ab11-f420c50e9097', '84762eb3-0bbb-4bd8-ab11-f420c50e9098', '84762eb3-0bbb-4bd8-ab11-f420c50e9099',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9100', '84762eb3-0bbb-4bd8-ab11-f420c50e9101', '84762eb3-0bbb-4bd8-ab11-f420c50e9102', '84762eb3-0bbb-4bd8-ab11-f420c50e9103',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9104', '84762eb3-0bbb-4bd8-ab11-f420c50e9105', '84762eb3-0bbb-4bd8-ab11-f420c50e9106', '84762eb3-0bbb-4bd8-ab11-f420c50e9107',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9108', '84762eb3-0bbb-4bd8-ab11-f420c50e9109', '84762eb3-0bbb-4bd8-ab11-f420c50e9110', '84762eb3-0bbb-4bd8-ab11-f420c50e9111',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9112', '84762eb3-0bbb-4bd8-ab11-f420c50e9113', '84762eb3-0bbb-4bd8-ab11-f420c50e9114', '84762eb3-0bbb-4bd8-ab11-f420c50e9115',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9116', '84762eb3-0bbb-4bd8-ab11-f420c50e9117', '84762eb3-0bbb-4bd8-ab11-f420c50e9118', '84762eb3-0bbb-4bd8-ab11-f420c50e9119',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9120', '84762eb3-0bbb-4bd8-ab11-f420c50e9121', '84762eb3-0bbb-4bd8-ab11-f420c50e9122', '84762eb3-0bbb-4bd8-ab11-f420c50e9123',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9124', '84762eb3-0bbb-4bd8-ab11-f420c50e9125', '84762eb3-0bbb-4bd8-ab11-f420c50e9126', '84762eb3-0bbb-4bd8-ab11-f420c50e9127',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9128', '84762eb3-0bbb-4bd8-ab11-f420c50e9129', '84762eb3-0bbb-4bd8-ab11-f420c50e9130', '84762eb3-0bbb-4bd8-ab11-f420c50e9131',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9132', '84762eb3-0bbb-4bd8-ab11-f420c50e9133', '84762eb3-0bbb-4bd8-ab11-f420c50e9134', '84762eb3-0bbb-4bd8-ab11-f420c50e9135',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9136', '84762eb3-0bbb-4bd8-ab11-f420c50e9137', '84762eb3-0bbb-4bd8-ab11-f420c50e9138', '84762eb3-0bbb-4bd8-ab11-f420c50e9139',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9140', '84762eb3-0bbb-4bd8-ab11-f420c50e9141', '84762eb3-0bbb-4bd8-ab11-f420c50e9142', '84762eb3-0bbb-4bd8-ab11-f420c50e9143',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9144', '84762eb3-0bbb-4bd8-ab11-f420c50e9145', '84762eb3-0bbb-4bd8-ab11-f420c50e9146', '84762eb3-0bbb-4bd8-ab11-f420c50e9147',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9148', '84762eb3-0bbb-4bd8-ab11-f420c50e9149', '84762eb3-0bbb-4bd8-ab11-f420c50e9150', '84762eb3-0bbb-4bd8-ab11-f420c50e9151',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9152', '84762eb3-0bbb-4bd8-ab11-f420c50e9153', '84762eb3-0bbb-4bd8-ab11-f420c50e9154', '84762eb3-0bbb-4bd8-ab11-f420c50e9155',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9156', '84762eb3-0bbb-4bd8-ab11-f420c50e9157', '84762eb3-0bbb-4bd8-ab11-f420c50e9158', '84762eb3-0bbb-4bd8-ab11-f420c50e9159',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9160', '84762eb3-0bbb-4bd8-ab11-f420c50e9161', '84762eb3-0bbb-4bd8-ab11-f420c50e9162', '84762eb3-0bbb-4bd8-ab11-f420c50e9163',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9164', '84762eb3-0bbb-4bd8-ab11-f420c50e9165', '84762eb3-0bbb-4bd8-ab11-f420c50e9166', '84762eb3-0bbb-4bd8-ab11-f420c50e9167',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9168', '84762eb3-0bbb-4bd8-ab11-f420c50e9169', '84762eb3-0bbb-4bd8-ab11-f420c50e9170', '84762eb3-0bbb-4bd8-ab11-f420c50e9171',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9172', '84762eb3-0bbb-4bd8-ab11-f420c50e9173', '84762eb3-0bbb-4bd8-ab11-f420c50e9174', '84762eb3-0bbb-4bd8-ab11-f420c50e9175',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9176', '84762eb3-0bbb-4bd8-ab11-f420c50e9177', '84762eb3-0bbb-4bd8-ab11-f420c50e9178', '84762eb3-0bbb-4bd8-ab11-f420c50e9179',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9180', '84762eb3-0bbb-4bd8-ab11-f420c50e9181', '84762eb3-0bbb-4bd8-ab11-f420c50e9182', '84762eb3-0bbb-4bd8-ab11-f420c50e9183',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9184', '84762eb3-0bbb-4bd8-ab11-f420c50e9185', '84762eb3-0bbb-4bd8-ab11-f420c50e9186', '84762eb3-0bbb-4bd8-ab11-f420c50e9187',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9188', '84762eb3-0bbb-4bd8-ab11-f420c50e9189', '84762eb3-0bbb-4bd8-ab11-f420c50e9190', '84762eb3-0bbb-4bd8-ab11-f420c50e9191',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9192', '84762eb3-0bbb-4bd8-ab11-f420c50e9193', '84762eb3-0bbb-4bd8-ab11-f420c50e9194', '84762eb3-0bbb-4bd8-ab11-f420c50e9195',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9196', '84762eb3-0bbb-4bd8-ab11-f420c50e9197', '84762eb3-0bbb-4bd8-ab11-f420c50e9198', '84762eb3-0bbb-4bd8-ab11-f420c50e9199',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9200', '84762eb3-0bbb-4bd8-ab11-f420c50e9201', '84762eb3-0bbb-4bd8-ab11-f420c50e9202', '84762eb3-0bbb-4bd8-ab11-f420c50e9203',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9204', '84762eb3-0bbb-4bd8-ab11-f420c50e9205', '84762eb3-0bbb-4bd8-ab11-f420c50e9206', '84762eb3-0bbb-4bd8-ab11-f420c50e9207',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9208', '84762eb3-0bbb-4bd8-ab11-f420c50e9209', '84762eb3-0bbb-4bd8-ab11-f420c50e9210', '84762eb3-0bbb-4bd8-ab11-f420c50e9211',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9212', '84762eb3-0bbb-4bd8-ab11-f420c50e9213', '84762eb3-0bbb-4bd8-ab11-f420c50e9214', '84762eb3-0bbb-4bd8-ab11-f420c50e9215',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9216', '84762eb3-0bbb-4bd8-ab11-f420c50e9217', '84762eb3-0bbb-4bd8-ab11-f420c50e9218', '84762eb3-0bbb-4bd8-ab11-f420c50e9219',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9220', '84762eb3-0bbb-4bd8-ab11-f420c50e9221', '84762eb3-0bbb-4bd8-ab11-f420c50e9222', '84762eb3-0bbb-4bd8-ab11-f420c50e9223',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9224', '84762eb3-0bbb-4bd8-ab11-f420c50e9225', '84762eb3-0bbb-4bd8-ab11-f420c50e9226', '84762eb3-0bbb-4bd8-ab11-f420c50e9227',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9228', '84762eb3-0bbb-4bd8-ab11-f420c50e9229', '84762eb3-0bbb-4bd8-ab11-f420c50e9230', '84762eb3-0bbb-4bd8-ab11-f420c50e9231',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9232', '84762eb3-0bbb-4bd8-ab11-f420c50e9233', '84762eb3-0bbb-4bd8-ab11-f420c50e9234', '84762eb3-0bbb-4bd8-ab11-f420c50e9235',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9236', '84762eb3-0bbb-4bd8-ab11-f420c50e9237', '84762eb3-0bbb-4bd8-ab11-f420c50e9238', '84762eb3-0bbb-4bd8-ab11-f420c50e9239',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9240', '84762eb3-0bbb-4bd8-ab11-f420c50e9241', '84762eb3-0bbb-4bd8-ab11-f420c50e9242', '84762eb3-0bbb-4bd8-ab11-f420c50e9243',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9244', '84762eb3-0bbb-4bd8-ab11-f420c50e9245', '84762eb3-0bbb-4bd8-ab11-f420c50e9246', '84762eb3-0bbb-4bd8-ab11-f420c50e9247',
                '84762eb3-0bbb-4bd8-ab11-f420c50e9248', '84762eb3-0bbb-4bd8-ab11-f420c50e9249',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9000', '94762eb3-0bbb-4bd8-ab11-f420c50e9001', '94762eb3-0bbb-4bd8-ab11-f420c50e9002', '94762eb3-0bbb-4bd8-ab11-f420c50e9003',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9004', '94762eb3-0bbb-4bd8-ab11-f420c50e9005', '94762eb3-0bbb-4bd8-ab11-f420c50e9006', '94762eb3-0bbb-4bd8-ab11-f420c50e9007',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9008', '94762eb3-0bbb-4bd8-ab11-f420c50e9009', '94762eb3-0bbb-4bd8-ab11-f420c50e9010', '94762eb3-0bbb-4bd8-ab11-f420c50e9011',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9012', '94762eb3-0bbb-4bd8-ab11-f420c50e9013', '94762eb3-0bbb-4bd8-ab11-f420c50e9014', '94762eb3-0bbb-4bd8-ab11-f420c50e9015',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9016', '94762eb3-0bbb-4bd8-ab11-f420c50e9017', '94762eb3-0bbb-4bd8-ab11-f420c50e9018', '94762eb3-0bbb-4bd8-ab11-f420c50e9019',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9020', '94762eb3-0bbb-4bd8-ab11-f420c50e9021', '94762eb3-0bbb-4bd8-ab11-f420c50e9022', '94762eb3-0bbb-4bd8-ab11-f420c50e9023',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9024', '94762eb3-0bbb-4bd8-ab11-f420c50e9025', '94762eb3-0bbb-4bd8-ab11-f420c50e9026', '94762eb3-0bbb-4bd8-ab11-f420c50e9027',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9028', '94762eb3-0bbb-4bd8-ab11-f420c50e9029', '94762eb3-0bbb-4bd8-ab11-f420c50e9030', '94762eb3-0bbb-4bd8-ab11-f420c50e9031',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9032', '94762eb3-0bbb-4bd8-ab11-f420c50e9033', '94762eb3-0bbb-4bd8-ab11-f420c50e9034', '94762eb3-0bbb-4bd8-ab11-f420c50e9035',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9036', '94762eb3-0bbb-4bd8-ab11-f420c50e9037', '94762eb3-0bbb-4bd8-ab11-f420c50e9038', '94762eb3-0bbb-4bd8-ab11-f420c50e9039',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9040', '94762eb3-0bbb-4bd8-ab11-f420c50e9041', '94762eb3-0bbb-4bd8-ab11-f420c50e9042', '94762eb3-0bbb-4bd8-ab11-f420c50e9043',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9044', '94762eb3-0bbb-4bd8-ab11-f420c50e9045', '94762eb3-0bbb-4bd8-ab11-f420c50e9046', '94762eb3-0bbb-4bd8-ab11-f420c50e9047',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9048', '94762eb3-0bbb-4bd8-ab11-f420c50e9049', '94762eb3-0bbb-4bd8-ab11-f420c50e9050', '94762eb3-0bbb-4bd8-ab11-f420c50e9051',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9052', '94762eb3-0bbb-4bd8-ab11-f420c50e9053', '94762eb3-0bbb-4bd8-ab11-f420c50e9054', '94762eb3-0bbb-4bd8-ab11-f420c50e9055',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9056', '94762eb3-0bbb-4bd8-ab11-f420c50e9057', '94762eb3-0bbb-4bd8-ab11-f420c50e9058', '94762eb3-0bbb-4bd8-ab11-f420c50e9059',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9060', '94762eb3-0bbb-4bd8-ab11-f420c50e9061', '94762eb3-0bbb-4bd8-ab11-f420c50e9062', '94762eb3-0bbb-4bd8-ab11-f420c50e9063',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9064', '94762eb3-0bbb-4bd8-ab11-f420c50e9065', '94762eb3-0bbb-4bd8-ab11-f420c50e9066', '94762eb3-0bbb-4bd8-ab11-f420c50e9067',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9068', '94762eb3-0bbb-4bd8-ab11-f420c50e9069', '94762eb3-0bbb-4bd8-ab11-f420c50e9070', '94762eb3-0bbb-4bd8-ab11-f420c50e9071',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9072', '94762eb3-0bbb-4bd8-ab11-f420c50e9073', '94762eb3-0bbb-4bd8-ab11-f420c50e9074', '94762eb3-0bbb-4bd8-ab11-f420c50e9075',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9076', '94762eb3-0bbb-4bd8-ab11-f420c50e9077', '94762eb3-0bbb-4bd8-ab11-f420c50e9078', '94762eb3-0bbb-4bd8-ab11-f420c50e9079',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9080', '94762eb3-0bbb-4bd8-ab11-f420c50e9081', '94762eb3-0bbb-4bd8-ab11-f420c50e9082', '94762eb3-0bbb-4bd8-ab11-f420c50e9083',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9084', '94762eb3-0bbb-4bd8-ab11-f420c50e9085', '94762eb3-0bbb-4bd8-ab11-f420c50e9086', '94762eb3-0bbb-4bd8-ab11-f420c50e9087',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9088', '94762eb3-0bbb-4bd8-ab11-f420c50e9089', '94762eb3-0bbb-4bd8-ab11-f420c50e9090', '94762eb3-0bbb-4bd8-ab11-f420c50e9091',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9092', '94762eb3-0bbb-4bd8-ab11-f420c50e9093', '94762eb3-0bbb-4bd8-ab11-f420c50e9094', '94762eb3-0bbb-4bd8-ab11-f420c50e9095',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9096', '94762eb3-0bbb-4bd8-ab11-f420c50e9097', '94762eb3-0bbb-4bd8-ab11-f420c50e9098', '94762eb3-0bbb-4bd8-ab11-f420c50e9099',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9100', '94762eb3-0bbb-4bd8-ab11-f420c50e9101', '94762eb3-0bbb-4bd8-ab11-f420c50e9102', '94762eb3-0bbb-4bd8-ab11-f420c50e9103',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9104', '94762eb3-0bbb-4bd8-ab11-f420c50e9105', '94762eb3-0bbb-4bd8-ab11-f420c50e9106', '94762eb3-0bbb-4bd8-ab11-f420c50e9107',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9108', '94762eb3-0bbb-4bd8-ab11-f420c50e9109', '94762eb3-0bbb-4bd8-ab11-f420c50e9110', '94762eb3-0bbb-4bd8-ab11-f420c50e9111',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9112', '94762eb3-0bbb-4bd8-ab11-f420c50e9113', '94762eb3-0bbb-4bd8-ab11-f420c50e9114', '94762eb3-0bbb-4bd8-ab11-f420c50e9115',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9116', '94762eb3-0bbb-4bd8-ab11-f420c50e9117', '94762eb3-0bbb-4bd8-ab11-f420c50e9118', '94762eb3-0bbb-4bd8-ab11-f420c50e9119',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9120', '94762eb3-0bbb-4bd8-ab11-f420c50e9121', '94762eb3-0bbb-4bd8-ab11-f420c50e9122', '94762eb3-0bbb-4bd8-ab11-f420c50e9123',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9124', '94762eb3-0bbb-4bd8-ab11-f420c50e9125', '94762eb3-0bbb-4bd8-ab11-f420c50e9126', '94762eb3-0bbb-4bd8-ab11-f420c50e9127',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9128', '94762eb3-0bbb-4bd8-ab11-f420c50e9129', '94762eb3-0bbb-4bd8-ab11-f420c50e9130', '94762eb3-0bbb-4bd8-ab11-f420c50e9131',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9132', '94762eb3-0bbb-4bd8-ab11-f420c50e9133', '94762eb3-0bbb-4bd8-ab11-f420c50e9134', '94762eb3-0bbb-4bd8-ab11-f420c50e9135',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9136', '94762eb3-0bbb-4bd8-ab11-f420c50e9137', '94762eb3-0bbb-4bd8-ab11-f420c50e9138', '94762eb3-0bbb-4bd8-ab11-f420c50e9139',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9140', '94762eb3-0bbb-4bd8-ab11-f420c50e9141', '94762eb3-0bbb-4bd8-ab11-f420c50e9142', '94762eb3-0bbb-4bd8-ab11-f420c50e9143',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9144', '94762eb3-0bbb-4bd8-ab11-f420c50e9145', '94762eb3-0bbb-4bd8-ab11-f420c50e9146', '94762eb3-0bbb-4bd8-ab11-f420c50e9147',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9148', '94762eb3-0bbb-4bd8-ab11-f420c50e9149', '94762eb3-0bbb-4bd8-ab11-f420c50e9150', '94762eb3-0bbb-4bd8-ab11-f420c50e9151',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9152', '94762eb3-0bbb-4bd8-ab11-f420c50e9153', '94762eb3-0bbb-4bd8-ab11-f420c50e9154', '94762eb3-0bbb-4bd8-ab11-f420c50e9155',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9156', '94762eb3-0bbb-4bd8-ab11-f420c50e9157', '94762eb3-0bbb-4bd8-ab11-f420c50e9158', '94762eb3-0bbb-4bd8-ab11-f420c50e9159',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9160', '94762eb3-0bbb-4bd8-ab11-f420c50e9161', '94762eb3-0bbb-4bd8-ab11-f420c50e9162', '94762eb3-0bbb-4bd8-ab11-f420c50e9163',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9164', '94762eb3-0bbb-4bd8-ab11-f420c50e9165', '94762eb3-0bbb-4bd8-ab11-f420c50e9166', '94762eb3-0bbb-4bd8-ab11-f420c50e9167',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9168', '94762eb3-0bbb-4bd8-ab11-f420c50e9169', '94762eb3-0bbb-4bd8-ab11-f420c50e9170', '94762eb3-0bbb-4bd8-ab11-f420c50e9171',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9172', '94762eb3-0bbb-4bd8-ab11-f420c50e9173', '94762eb3-0bbb-4bd8-ab11-f420c50e9174', '94762eb3-0bbb-4bd8-ab11-f420c50e9175',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9176', '94762eb3-0bbb-4bd8-ab11-f420c50e9177', '94762eb3-0bbb-4bd8-ab11-f420c50e9178', '94762eb3-0bbb-4bd8-ab11-f420c50e9179',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9180', '94762eb3-0bbb-4bd8-ab11-f420c50e9181', '94762eb3-0bbb-4bd8-ab11-f420c50e9182', '94762eb3-0bbb-4bd8-ab11-f420c50e9183',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9184', '94762eb3-0bbb-4bd8-ab11-f420c50e9185', '94762eb3-0bbb-4bd8-ab11-f420c50e9186', '94762eb3-0bbb-4bd8-ab11-f420c50e9187',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9188', '94762eb3-0bbb-4bd8-ab11-f420c50e9189', '94762eb3-0bbb-4bd8-ab11-f420c50e9190', '94762eb3-0bbb-4bd8-ab11-f420c50e9191',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9192', '94762eb3-0bbb-4bd8-ab11-f420c50e9193', '94762eb3-0bbb-4bd8-ab11-f420c50e9194', '94762eb3-0bbb-4bd8-ab11-f420c50e9195',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9196', '94762eb3-0bbb-4bd8-ab11-f420c50e9197', '94762eb3-0bbb-4bd8-ab11-f420c50e9198', '94762eb3-0bbb-4bd8-ab11-f420c50e9199',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9200', '94762eb3-0bbb-4bd8-ab11-f420c50e9201', '94762eb3-0bbb-4bd8-ab11-f420c50e9202', '94762eb3-0bbb-4bd8-ab11-f420c50e9203',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9204', '94762eb3-0bbb-4bd8-ab11-f420c50e9205', '94762eb3-0bbb-4bd8-ab11-f420c50e9206', '94762eb3-0bbb-4bd8-ab11-f420c50e9207',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9208', '94762eb3-0bbb-4bd8-ab11-f420c50e9209', '94762eb3-0bbb-4bd8-ab11-f420c50e9210', '94762eb3-0bbb-4bd8-ab11-f420c50e9211',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9212', '94762eb3-0bbb-4bd8-ab11-f420c50e9213', '94762eb3-0bbb-4bd8-ab11-f420c50e9214', '94762eb3-0bbb-4bd8-ab11-f420c50e9215',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9216', '94762eb3-0bbb-4bd8-ab11-f420c50e9217', '94762eb3-0bbb-4bd8-ab11-f420c50e9218', '94762eb3-0bbb-4bd8-ab11-f420c50e9219',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9220', '94762eb3-0bbb-4bd8-ab11-f420c50e9221', '94762eb3-0bbb-4bd8-ab11-f420c50e9222', '94762eb3-0bbb-4bd8-ab11-f420c50e9223',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9224', '94762eb3-0bbb-4bd8-ab11-f420c50e9225', '94762eb3-0bbb-4bd8-ab11-f420c50e9226', '94762eb3-0bbb-4bd8-ab11-f420c50e9227',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9228', '94762eb3-0bbb-4bd8-ab11-f420c50e9229', '94762eb3-0bbb-4bd8-ab11-f420c50e9230', '94762eb3-0bbb-4bd8-ab11-f420c50e9231',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9232', '94762eb3-0bbb-4bd8-ab11-f420c50e9233', '94762eb3-0bbb-4bd8-ab11-f420c50e9234', '94762eb3-0bbb-4bd8-ab11-f420c50e9235',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9236', '94762eb3-0bbb-4bd8-ab11-f420c50e9237', '94762eb3-0bbb-4bd8-ab11-f420c50e9238', '94762eb3-0bbb-4bd8-ab11-f420c50e9239',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9240', '94762eb3-0bbb-4bd8-ab11-f420c50e9241', '94762eb3-0bbb-4bd8-ab11-f420c50e9242', '94762eb3-0bbb-4bd8-ab11-f420c50e9243',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9244', '94762eb3-0bbb-4bd8-ab11-f420c50e9245', '94762eb3-0bbb-4bd8-ab11-f420c50e9246', '94762eb3-0bbb-4bd8-ab11-f420c50e9247',
                '94762eb3-0bbb-4bd8-ab11-f420c50e9248', '94762eb3-0bbb-4bd8-ab11-f420c50e9249'
            ])
            .expect(200);

            expect(result.text).toMatchSnapshot();
        });

        test('playbook specifying only 1 of its hosts', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook?hosts=84762eb3-0bbb-4bd8-ab11-f420c50e9000')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook specifying 1 host, making some issues in the playbook hostless', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=9dae9304-86a8-4f66-baa3-a1b27dfdd479')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook specifying 2 hosts, 1 included in the remediation and 1 not', async() => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=9dae9304-86a8-4f66-baa3-a1b27dfdd479,non-existent-host')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook specifying 1 host and using localhost flag', async() => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=9dae9304-86a8-4f66-baa3-a1b27dfdd479&localhost')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with localhost flag', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?localhost')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with localhost flag and reboot', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook?localhost')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook with cert-auth and no hosts query param', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?localhost')
            .set(auth.cert02)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('playbook for remediation with zero issues does not freak out', async () => {
            const {text} = await request
            .get('/v1/remediations/256ab1d3-58cf-1292-35e6-1a49c8b122d3/playbook')
            .expect(204);

            expect(text).toMatchSnapshot();
        });

        test('playbook contains correct resolution for issue', async () => {
            const { text } = await request
            .get('/v1/remediations/0e1c1018-cb54-4459-945b-f5d946645b7a/playbook')
            .set(auth.fifi)
            .expect(200);

            expect(text).toContain('- name: Update polkit to fix CVE-2021-4034');
        });

        test('204 on generation that creates no playbook', async () => {
            getSandbox().stub(generator, 'normalizeIssues').resolves([]);
            mockDate();
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('204 on remediation with no hosts', async () => {
            mockDate();
            await request
            .get('/v1/remediations/d1b070b5-1db8-4dac-8ecf-891dc1e9225f/playbook')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('204 on remediation with no hosts & localhost', async () => {
            mockDate();
            await request
            .get('/v1/remediations/d1b070b5-1db8-4dac-8ecf-891dc1e9225f/playbook?localhost')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('403 on cert-auth request with non matching owner_ids', async () => {
            getSandbox().stub(inventory, 'getSystemProfileBatch').resolves({
                '4bb19a8a-0c07-4ee6-a78c-504dab783cc8': {
                    id: '4bb19a8a-0c07-4ee6-a78c-504dab783cc8',
                    system_profile: {
                        owner_id: 'non-existent'
                    }
                }
            });
            mockDate();
            await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8&localhost')
            .set(auth.cert02)
            .expect(403);
        });

        test('404 on non-existent remediation', async () => {
            mockDate();
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e57d89/playbook')
            .set(auth.testReadSingle)
            .expect(404);
        });

        test('204 on host not associated with remediation', async () => {
            mockDate();
            await request
            .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook?hosts=74862eb3-0bbb-4bd8-ab11-f420c50e9000')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('204 on non-existent host', async () => {
            mockDate();
            await request
            .get('/v1/remediations/c3f9f751-4bcc-4222-9b83-77f5e6e603da/playbook?hosts=non-existent-host')
            .set(auth.testReadSingle)
            .expect(204);
        });

        test('404 on non-existent-host with cert auth', async () => {
            mockDate();
            await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=non-existent-host')
            .set(auth.cert02)
            .expect(404);
        });

        test('returns error when playbook contains unknown issues', async () => {
            // Remediation 62c95092-ac83-4025-a676-362a67e68579 ("unknown issues") has non-existent issues
            const {body} = await request
            .get('/v1/remediations/62c95092-ac83-4025-a676-362a67e68579/playbook')
            .set(auth.testReadSingle)
            .expect(400);

            expect(body.errors[0].code).toBe('UNKNOWN_ISSUE');
        });

    });

    describe('caching', function () {
        function testCaching (desc, id) {
            test (desc, async () => {
                const {headers} = await request
                .get(`/v1/remediations/${id}/playbook`)
                .expect(200);

                const etag = headers.etag;
                etag.should.be.String();

                await request
                .get(`/v1/remediations/${id}/playbook`)
                .set('if-none-match', etag)
                .expect(304);
            });
        }

        testCaching('pydata playbook', '66eec356-dd06-4c72-a3b6-ef27d1508a02');
        testCaching('no reboot playbook', 'e809526c-56f5-4cd8-a809-93328436ea23');
        testCaching('playbook with suppressed reboot', '178cf0c8-35dd-42a3-96d5-7b50f9d211f6');

        test('pydata playbook caching with stale data', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .set('if-none-match', 'W/"1e4d-hLarcuq+AQP/rL6nnA70UohsnSI"')
            .expect(200);
        });
    });

    describe('missing', function () {
        // Issue has some systems that exist in Inventory and some that don't.
        // Missing systems are filtered out, playbook generated with remaining valid systems.
        test('generates playbook when issue has mix of valid and missing Inventory systems', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/82aeb63f-fc25-4eef-9333-4fa7e10f7217/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="missing-system-1-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        // One issue has all systems missing from Inventory (becomes empty, filtered out).
        // Another issue has valid systems, so playbook is still generated.
        test('generates playbook when one issue becomes empty due to missing Inventory systems', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/27e36e14-e1c2-4b5a-9382-ec80ca9a6c1a/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="missing-system-2-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('get remediation with unknown resolution', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/ea5b1507-4cd3-4c87-aa5a-6c755d32a7bd/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

    });

    test('playbook for remediation with test namespace', async () => {
        mockDate();
        const {text} = await request
        .set(auth.testReadSingle)
        .get('/v1/remediations/5e6d136e-ea32-46e4-a350-325ef41790f4/playbook')
        .expect(200);

        expect(text).toMatchSnapshot();
    });

    describe('playbook RBAC', function () {
        test('permission = remediations:*:write does not allow playbook to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:write'));

            mockDate();
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = remediations:resolution:* does not allow playbook to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:resolution:*'));

            mockDate();
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = [] does not allow playbook to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

            mockDate();
            const {body} = await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:read is required for this operation'
            );
        });

        test('permission = remediations:*:write ignored on cert-auth', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:write'));

            mockDate();
            await request
            .get('/v1/remediations/7d727f9c-7d9e-458d-a128-a9ffae1802ab/playbook?hosts=4bb19a8a-0c07-4ee6-a78c-504dab783cc8&localhost')
            .set(auth.cert02)
            .expect(200);
        });
    });
});
