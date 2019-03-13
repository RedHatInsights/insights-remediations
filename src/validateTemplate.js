'use strict';

const fs = require('fs');
const program = require('commander');
const resolver = new(require('./resolutions/resolvers/SSGResolver'))();

program
.usage('<path-to-playbook>')
.parse(process.argv);

if (program.args.length === 0) {
    return program.help();
}

let code = 0;

function run (filepath) {
    const file = fs.readFileSync(filepath, 'utf-8');

    try {
        resolver.parseResolution(file);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`Template validation failed: ${e.message}: ${filepath}`);
        code = 1;
    }
}

program.args.forEach(path => run(path));
process.exit(code); // eslint-disable-line no-process-exit
