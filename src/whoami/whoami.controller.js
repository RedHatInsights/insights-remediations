'use strict';

exports.get = function (req, res) {
    const {id, username, account_number} = req.identity;
    res.json({ id, username, account_number }).end();
};
