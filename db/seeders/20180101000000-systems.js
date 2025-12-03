'use strict';

const NON_EXISTENT_SYSTEM = '1040856f-b772-44c7-83a9-eeeeeeeeeeee';

const { systems: scalabilitySystems, mixed_systems: mixedSystems } = require('../../src/connectors/inventory/impl.unit.data');

const SPECIAL_SYSTEMS = {
    'fc94beb8-21ee-403d-99b1-949ef7adb762': {},
    '4bb19a8a-0c07-4ee6-a78c-504dab783cc8': {},
    '1040856f-b772-44c7-83a9-eeeeeeeeee01': { hostname: 'foo,bar,example.com' },
    '1040856f-b772-44c7-83a9-eeeeeeeeee02': { hostname: 'foo.example.com"abc' },
    '1040856f-b772-44c7-83a9-eeeeeeeeee03': { hostname: 'foo.example.com\nabc' },
    '1040856f-b772-44c7-83a9-eeeeeeeeee04': { hostname: '  foo.  example.com' },
    '35f36364-6007-4ecc-9666-c4f8d354be9f': { hostname: '35e9b452-e405-499c-9c6e-120010b7b465.example.com' },
    '1040856f-b772-44c7-83a9-eea4813c4be8': { 
        hostname: '1040856f-b772-44c7-83a9-eea4813c4be8.example.com',
        display_name: 'test-system-1'
    }
};

const ALL_SYSTEM_IDS = [
    'fc94beb8-21ee-403d-99b1-949ef7adb762',
    '1f12bdfc-8267-492d-a930-92f498fe65b9',
    '1bada2ce-e379-4e17-9569-8a22e09760af',
    '6749b8cf-1955-42c1-9b48-afc6a0374cd6',
    '1040856f-b772-44c7-83a9-eea4813c4be8',
    '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
    '4bb19a8a-0c07-4ee6-a78c-504dab783cc8',
    '8dadd8d7-5f1d-49c3-a560-af3cada7ce83',
    'fc84c991-a029-4882-bc9c-7e351a73b59f',
    '58b2837a-5df5-4466-9033-c4b46248d4b4',
    '29dafba0-c190-4acd-998d-074ba0aee477',
    '784ba855-922c-4dbf-bb93-d2e5d9e54a81',
    '4f02195c-a3e4-4dcf-aeca-65db4ca25632',
    '5afdc03f-4560-4ca9-a373-9724401df154',
    '8fa9e16e-eed5-4597-8072-b102b7c35f11',
    '9da41b6e-f77e-430a-9022-4ac1ffab288a',
    '9ed58c88-a98d-407f-9384-a76bdab82e7f',
    '20a7486c-11bc-4558-a398-f97faf47cdbb',
    '2317adf3-911e-4db3-84fd-27fad9724196',
    '286f602a-157f-4095-8bf2-ad4849ab6c43',
    'c8aea8e7-cce7-4d2c-b45c-97408158fa44',
    'bd0f6a65-d43a-4d45-88da-ede32b9787e5',
    'c5249a49-8ed1-4c3c-acd9-f540806829fd',
    '41202783-c2dc-4bc3-b93c-1bace78b9d3a',
    '1a87d019-e0b4-4ed2-9364-10cc9824e755',
    'c751a80e-0fa8-4967-9c2a-fae9da4411fa',
    'f1f6dbe3-249c-490b-922f-120689059927',
    '720e5c42-d57e-4e51-8177-7fcd1e70415b',
    '39735eef-5e47-42d5-bbde-46d8d75cadfd',
    '4ee9151c-ec74-49c4-80d4-c9d99b69e6b0',
    'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0',
    '355986a3-5f37-40f7-8f36-c3ac928ce190',
    'd5174274-4307-4fac-84fd-da2c3497657c',
    'a9b3af62-8404-4b2a-9084-9ed37da6baf1',
    '36828b63-38f3-4b9a-ad08-0b7812e5df57',
    'baaad5ad-1b8e-457e-ad43-39d1aea40d4d',
    'e4a0a6ff-0f01-4659-ad9d-44150ade51dd',
    '88d0ba73-0015-4e7d-a6d6-4b530cbfb4ad',
    '8728dbf3-6500-44bb-a55c-4909a48673ed',
    'bd91d212-91ae-4813-a406-d2af96fbeb52',
    '881256d7-8f99-4073-be6d-67ee42ba9af8',
    '64ee45db-6f2b-4862-bc9a-40aea8f5ecbe',
    '34360dba-a2e7-4788-b9a2-44246a865c7e',
    '3fec343b-ecc0-4049-9e30-e4dc2bae9f62',
    '95c5ee0d-9599-475f-a8ef-c838545b9a73',
    '6f6a889d-6bac-4d53-9bc1-ef75bc1a55ff',
    '938c5ce7-481f-4b82-815c-2973ca76a0ef',
    '2a708189-4b48-4642-9443-64bda5f38e5f',
    '9574cba7-b9ce-4725-b392-e959afd3e69a',
    '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
    '0341e468-fbae-416c-b16f-5abb64d99834',
    '35e9b452-e405-499c-9c6e-120010b7b465',
    '35f36364-6007-4ecc-9666-c4f8d354be9f',
    '7b136dd2-4824-43cf-af6c-ad0ee42f9f97',
    '3590ba1a-e0df-4092-9c23-bca863b28573',
    '6d08f590-dff9-473b-88d4-45316cbf5545',
    '5969570e-3185-4070-92be-7b4c49974da6',
    '4da7a4ac-2945-4e41-911a-c1f25d8137af',
    '3abc1295-6326-46bb-9b6c-c8ac1bc1cbd9',
    'a68f36f4-b9b1-4eae-b0ad-dc528bf6b16f',
    '29f94400-012e-4222-90d3-f6a040c5b89e',
    '3f39215e-a463-464e-a987-aaab0e50349a',
    'd6306be7-57eb-4734-8f27-9faf0186bc06',
    'f33a7ff9-bbad-4660-90c2-d0964c581bfe',
    'a68f36f4-b9b1-4eae-b0ad-dc528bf6b17f',
    '6e64bc58-09be-4f49-b717-c1d469d1ae9c',
    'a68f36f4-b9b1-4eae-b0ad-dc528bf6b18f',
    'a68f36f4-b9b1-4eae-b0ad-dc528bf6b19f',
    'a68f36f4-b9b1-4eae-b0ad-dc528bf6b12f',
    '371c8b75-6d07-478e-873f-ed5291da7b9d',
    '381c8b75-6d07-478e-873f-ed5291da7b9d',
    '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
    'f5ce853a-c922-46f7-bd82-50286b7d8459',
    '07adc41a-a6c6-426a-a0d5-c7ba08954153',
    '17adc41a-a6c6-426a-a0d5-c7ba08954154',
    ...scalabilitySystems,
    ...mixedSystems
];

function generateSystemData(id) {
    if (id === NON_EXISTENT_SYSTEM) {
        return null;
    }

    if (SPECIAL_SYSTEMS.hasOwnProperty(id)) {
        return {
            id,
            hostname: SPECIAL_SYSTEMS[id].hostname || null,
            display_name: SPECIAL_SYSTEMS[id].display_name || null,
            ansible_hostname: SPECIAL_SYSTEMS[id].ansible_host || null
        };
    }

    return {
        id,
        hostname: /^[0-8]/.test(id) ? `${id}.example.com` : id,
        display_name: id.startsWith('9') ? `${id}-system` : null,
        ansible_hostname: (id.startsWith('9') || id.startsWith('1')) ? `${id}.ansible.example.com` : null
    };
}

exports.up = async q => {
    const uniqueIds = [...new Set(ALL_SYSTEM_IDS)];
    const systemsData = uniqueIds
        .map(generateSystemData)
        .filter(s => s !== null);

    if (systemsData.length > 0) {
        await q.bulkInsert('systems', systemsData);
    }
};

exports.down = async q => {
    const uniqueIds = [...new Set(ALL_SYSTEM_IDS)];
    await q.bulkDelete('systems', { id: uniqueIds });
};
