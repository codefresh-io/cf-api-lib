/*global describe, it */
'use strict';
var assert    = require('should'),
    api       = require('../');

describe('cf-api-lib node module', function () {
  it('must have at least one test', function () {
    var x = api.user.login();
    x.should.equal("ok");
  });
});
