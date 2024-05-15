'use strict';

exports.up = async (q) => {
    // manually update the following non-compliant remediation plan names:
    const updates = {
        "133bd18f-7134-4a83-8034-77ba15ca8327": "A newer version of kernel is installed: but not used. Bug fixes issued by this new kernel version are not applied",
        "ac8ce7b1-f77a-4329-a02c-f2d5d9e86cb1": "RHSA-2023:6795 - 1",
        "ed1f8f43-d2aa-4f55-85f5-26157ab80058": "CVE-2023-3776 - 1",
        "e4658b49-c85d-4aab-a48e-c9e2ca23e1e5": "FEDORA-EPEL-2020-3681ce7474-libssh2",
        "6b5dca6e-732c-4a0b-bce4-1480dc4a639c": "avm-elkprod05-shserv.sca-shared-pro.az.internal",
        "f5b7b144-a225-4a4c-bbc5-610fe686dac9": "RHSA-2023:1405",
        "217e8e0d-fcc4-4858-b058-7b62107b84a7": "RHSA-2022:8554 - 1",
        "59db9ded-5516-45e5-ae90-9e7099156cf1": "RHSA-2022:8554 - 2",
        "658de824-ca45-4ec2-a87a-328fab0a239a": "RHSA-2022:8554 - 3",
        "a5dc45dd-a576-417e-8a27-07df854fbe0d": "CVE-2018-3639",
        "9a938d08-08d8-43b3-b9b4-5061c92eac93": "kshadow2-CVE-2018-3639",
        "8d438c78-9796-4750-b138-d59276f0199e": "RHSA-2023:4382",
        "2be5c377-b630-4fa8-94a9-9bef06bcf70c": "RHSA-2022.5162.yml",
        "e5a1a980-c01a-4329-bb64-0b729d223309": "CVE-2021-33909 - 1",
        "3edbd943-559c-4c3f-adc0-aa54c887f101": "RHSA-2022:0332",
        "46b39103-1077-4f2a-abbc-545b2e280104": "RHSA-2022:0825",
        "b856979b-7e72-4f55-8811-901e13c60e72": "RHSA-2021:4123",
        "1b53f361-5e2b-45ea-87bc-ef587238ebed": "RHBA-2022:8785 - tzdata",
        "381e7be9-69ad-4c0a-9c25-7edb293c1596": "RHSA-2022:8554 - firefox",
        "fa1aa6e8-ad07-4abf-bf1f-d1f75521f3e7": "CVE-2018-12126",
        "cb282267-b2b3-4bb9-9b42-566f7d029d3f": "ult-ldw-vm-015",
        "e165cb14-adb7-462f-9ab6-b0e834c77420": "CVE-2019-3696",
        "d658830c-88be-415c-9f37-3221ff84c5f9": "RHSA-2023:4076",
        "989c374e-5070-45dc-87cc-18f79c9738b3": "RHSA-2023:4202"
    };

    for (const id in updates) {
        const query = `UPDATE remediations SET name = '${updates[id]}' WHERE id = '${id}';`;
        await q.sequelize.query(query);
    }
};

exports.down = async (q) => {};
