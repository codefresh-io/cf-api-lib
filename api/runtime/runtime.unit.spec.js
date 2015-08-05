'use strict';

var chai   = require('chai');
var expect = chai.expect; // jshint ignore:line
var Q = require('q'); // jshint ignore:line
var nock    = require('nock');
var CFError = require('cf-errors'); // jshint ignore:line
var ErrorTypes = CFError.errorTypes; // jshint ignore:line
var Api = require('../../index.js');


describe('Runtime valid http requests', function () {

    var api;

    before(function () {
        return Q()
            .then(function () {
                api = new Api('http://test.com', "accessToken");
            });
    });

    it('should succeed with a valid http request', function () {
        return Q()
            .then(function () {

                nock('http://test.com')
                    .get('/api/runtime/machine/dropImage')
                    .query({
                        id: 1,
                        imageId: 1,
                        force: true,
                        deleteCache: true,
                        name: "imageName"
                    })
                    .reply(200, "response");

                return api.runtime.dropImage.get("1", "1", "true", "true", "imageName")
                    .then(function (res) {
                        expect(res.statusCode).to.equal(200);
                        expect(res.body).to.equal("response");
                    });

            });
    });



});

describe('Runtime non-valid http requests', function () {

    var api;

    before(function () {
        return Q()
            .then(function () {
                api = new Api('non valid http', "accessToken");
            });
    });

    it('should fail with a non valid http request', function () {
        return Q()
            .then(function () {

                return api.runtime.dropImage.get("1", "1", "true", "true", "imageName")
                    .then(function () {
                        return Q.reject(new CFError(ErrorTypes.Error, "should have failed with a non valid http request"));
                    }, function(err){
                        return Q.resolve(err);
                    });

            });
    });

});



