'use strict';

const _ = require('lodash');
const UUID = require('uuid');
const { account_number, tenant_org_id, username: created_by } = require('../../src/connectors/users/mock').MOCK_USERS.fifi;
const { systems } = require('../../src/connectors/inventory/impl.unit.data');

exports.up = async q => {
  // add remediation plan with 120 direct systems...
  const remediations = await q.bulkInsert('remediations', [{
    id: 'dd6a0b1b-5331-4e7b-92ec-9a01806fb181',
    name: '120 direct systems',
    auto_reboot: true,
    account_number,
    tenant_org_id,
    created_by,
    created_at: '2019-12-23T08:19:36.641Z',
    updated_by: created_by,
    updated_at: '2019-12-23T08:19:36.641Z'
  }], {returning: true});

  const issues = await q.bulkInsert('remediation_issues', [{
    remediation_id: remediations[0].id,
    issue_id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
  }], {returning: true});

  // add systems to each remediation plan issue
  await q.bulkInsert('remediation_issue_systems', _.flatMap(systems, system_id => issues.map(({ id }) => ({
    system_id,
    remediation_issue_id: id,
    resolved: false
  }))));

  // insert playbook run
  const playbook_runs = await q.bulkInsert('playbook_runs', [{
    id: '11f7f24a-346b-405c-8dcc-c953511fb21c',
    status: 'success',
    remediation_id: remediations[0].id,
    created_by,
    created_at: '2019-12-24T08:19:36.641Z',
    updated_at: '2019-12-24T08:19:36.641Z'
  }]);
};
