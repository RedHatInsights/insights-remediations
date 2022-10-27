'use strict';

const _ = require('lodash');

const { account_number, tenant_org_id, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.testWriteUser;
const { account_number: bulk_account, tenant_org_id: bulk_tenant_org, username: bulk_creator } = require('../../src/connectors/users/mock').MOCK_USERS.bulkDeleteUser;

const opts = {
    returning: true
};

const systems = [
    '1bada2ce-e379-4e17-9569-8a22e09760af',
    '6749b8cf-1955-42c1-9b48-afc6a0374cd6'
];

exports.up = async q => {

    // these remediations have two issues assigned with two systems each (4 actions)
    const remediations = await q.bulkInsert('remediations', [{
        id: '3d34ed5c-a71f-48ee-b7af-b215f27ae68d',
        name: 'to be deleted',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '3274d99f-511d-4b05-9d88-69934f6bb8ec',
        name: 'to have issue deleted',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '869dccf6-19f1-4c2e-9025-e5b8d9e0faef',
        name: 'to have system deleted',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '022e01be-74f1-4893-b48c-df429fe7d09f',
        name: 'to have resolution selected',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '05860f91-4bc4-4bcf-9e5d-a6db6041ae76',
        name: 'to have actions added',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '06c25d1c-b94f-49ce-b5cc-cd6ceaf6431b',
        name: 'to have overlapping stuff added',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '8b427145-ac9f-4727-9543-76eb140222cd',
        name: 'to be renamed',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: 'c11b0d3e-6b0d-4dd6-a531-12121afd3ec0',
        name: 'bulk delete - invalid IDs 1',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '4270c407-12fb-4a69-b4e8-588fdc0bcdf3',
        name: 'bulk delete - invalid IDs 2',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '329a22fe-fc63-4700-9e4d-e9b92d6e2b54',
        name: 'bulk delete - invalid IDs 3',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '1f600784-947d-4883-a364-c59ec9d3ec00',
        name: 'bulk delete - wrong user 1',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: 'a91aedb0-4856-47c7-85d7-4725fb3f9262',
        name: 'bulk delete - wrong user 2',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: 'e96a2346-8e37-441d-963a-c2eed3ee856a',
        name: 'bulk delete - wrong user 3',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '301653a2-4b5f-411c-8cb5-a74a96e2f344',
        name: 'bulk delete - wrong user 4',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '702d0f73-de15-4bfe-897f-125bd339fbb9',
        name: 'bulk delete - wrong user 5',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '091d3d7a-0c58-4d4a-a8e5-d79ac4e9ee58',
        name: 'bulk delete - repeated ids 1',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '85063be8-381e-4d38-aa2d-5400b2a6b0cc',
        name: 'bulk delete - repeated ids 2',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: 'cecf1e86-f1c0-4dd7-81b6-8798b2aa714c',
        name: 'bulk delete 1',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: '32f0c7ed-dc9e-4425-b38d-e80a245dae84',
        name: 'bulk delete 2',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }, {
        id: 'fe3337ca-01cf-4b75-b65e-b14c61ecdaa7',
        name: 'bulk delete 3',
        account_number: bulk_account,
        tenant_org_id: bulk_tenant_org,
        created_by: bulk_creator,
        updated_by: bulk_creator
    }], opts);

    const issues = await q.bulkInsert('remediation_issues', _.flatMap(remediations, remediation => [{
        remediation_id: remediation.id,
        issue_id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074'
    }, {
        remediation_id: remediation.id,
        issue_id: 'vulnerabilities:CVE-2017-5715'
    }]), opts);

    await q.bulkInsert('remediation_issue_systems', _.flatMap(issues, issue => systems.map(system_id => ({
        system_id,
        remediation_issue_id: issue.id,
        resolved: false
    }))));

    // empty remediations
    await q.bulkInsert('remediations', [{
        id: '3c1877a0-bbcd-498a-8349-272129dc0b88',
        name: 'empty remediation to have actions added',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }, {
        id: '466fc274-16fe-4239-a648-2083ed2e05b0',
        name: 'to be used for validation',
        account_number,
        tenant_org_id,
        created_by,
        updated_by: created_by
    }], opts);
};
