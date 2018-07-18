'use strict';

exports.generate = async function (req, res) {
    const body = req.swagger.params.body.value;

    return res.json(body);
};
