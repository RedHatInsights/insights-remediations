'use strict';

const config = require('../../config');

if (config.users.impl === 'mock' || config.env === 'test' || config.env === 'development') {
    module.exports = require('./mock');
}

// FedRAMP has no back office proxy...
else if (config.users.impl === 'noop' || config.user.auth === '') {
    module.exports = require('./noop');
}

else {
    module.exports = require('./impl');
}
