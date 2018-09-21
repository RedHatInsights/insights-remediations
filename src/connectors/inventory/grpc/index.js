'use strict';

const _ = require('lodash');
const path = require('path');
const P = require('bluebird');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const config = require('../../../config');

const PROTO_PATH = path.join(__dirname, 'hbi.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const hostinventory = grpc.loadPackageDefinition(packageDefinition).hostinventory;
const HostInventory = P.promisifyAll(new hostinventory.HostInventory(
    `${config.inventory.host}:${config.inventory.port}`,
    grpc.credentials.createInsecure())
);

// TODO: start/stop?

exports.getSystemDetailsBatch = async function (ids) {
    const filter = {
        filters: [{ ids }]
    };

    const result = await HostInventory.getAsync(filter);
    return _.keyBy(result.hosts, 'id');
};

exports.ping = async function () {};
