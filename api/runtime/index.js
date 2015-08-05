var request = require('request');
var Q       = require('q');
var _       = require('lodash');

var apiPrefix = '/api/runtime';

module.exports = function (host, accessToken) {
    var self = this;

    var headers = {};

    if (accessToken) {
        headers['x-access-token'] = accessToken;
    }


    var dropImageGet = function (machineId, imageId, force, deleteCache, imageName) {

        var options = {
            baseUrl: host + apiPrefix,
            url: '/machine/dropImage?',
            qs: {
                id: machineId,
                imageId: imageId,
                force: force,
                deleteCache: deleteCache,
                name: imageName
            },
            headers: _.cloneDeep(headers),
            method: 'GET'
        };

        return Q.nfcall(request, options)
            .then(function(resArr){
                return Q.resolve(resArr[0]);
            });
    };

    self.dropImage = {
        get: dropImageGet
    };
};

