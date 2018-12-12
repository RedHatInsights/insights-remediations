'use strict';

exports.get = function (req, res) {
    const {username, account_number} = req.identity;
    res.json({ username, account_number, request_id: req.id }).end();
};
