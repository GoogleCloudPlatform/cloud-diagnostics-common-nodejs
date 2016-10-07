/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
var proxyquire = require('proxyquire').noPreserveCache();
var nock = require('nock');
var assert = require('assert');

nock.disableNetConnect();
describe('utils.authorizedRequestFactory', function() {
  var authMock;
  after(function() {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  beforeEach(function () {
    authMock = nock('https://accounts.google.com:443')
    .post('/o/oauth2/token')
    .reply(200, {
      access_token: 'stub_token',
      token_type: 'Bearer',
      expires_in: 3600
    });
  });
  afterEach(function () {
    nock.cleanAll();
  });
 
   describe('authorizedRequestFactory', function() {
    it('should return an error on broken configuration', function (done) {
      var oldEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = './not-a-file.json';
      var utils = require('../lib/utils.js');
      var req = utils.authorizedRequestFactory(['https://www.googleapis.com/auth/cloud-platform']);
      req({'X-custom-header': 'true', url: 'http://www.test.com/test'}, 
        function (err, response, body) {
          assert.ok(err instanceof Error, 'Should be an error');
          process.env.GOOGLE_APPLICATION_CREDENTIALS = oldEnv;
          done();
        }
      );
    });
    it('should return a function', function() {
      var utils = require('../lib/utils.js');
      var result = utils.authorizedRequestFactory(['https://www.googleapis.com/auth/cloud-platform']);
      assert(typeof result === 'function');
    });
    it('should be able to make a valid request with options', function (done) {
      var utils = require('../lib/utils.js');
      var req = utils.authorizedRequestFactory(['https://www.googleapis.com/auth/cloud-platform']);
      var mock = nock('http://www.test.com')
        .get('/test')
        .once()
        .reply(200, 'test');
      req({'X-custom-header': 'true', url: 'http://www.test.com/test'}, 
        function (err, response, body) {
          assert.deepEqual(err, null, 'error should be null');
          assert.ok(typeof response === 'object');
          assert.deepEqual(body, 'test');
          mock.done();
          done();
        }
      );
    });
    it('should be able to make a valid request with no options', function (done) {
      var utils = require('../lib/utils.js');
      var req = utils.authorizedRequestFactory(['https://www.googleapis.com/auth/cloud-platform']);
      var mock = nock('http://www.test.com')
        .get('/test')
        .once()
        .reply(200, 'test');
      req('http://www.test.com/test', 
        function (err, response, body) {
          assert.deepEqual(err, null, 'error should be null');
          assert.ok(typeof response === 'object');
          assert.deepEqual(body, 'test');
          mock.done();
          done();
        }
      );
    });
    it('should take config input without throwing', function (done) {
      var utils = require('../lib/utils.js');
      var config = {
        key: require('./fixtures/stub_cert.json')
      };
      var req = utils.authorizedRequestFactory(['https://www.googleapis.com/auth/cloud-platform'],
        config);
      var mock = nock('http://www.test.com')
        .get('/test')
        .once()
        .reply(200, 'test');
      req('http://www.test.com/test',
        function (err, response, body) {
          assert.deepEqual(err, null, 'error should be null');
          assert.ok(typeof response === 'object');
          assert.deepEqual(body, 'test');
          mock.done();
          done();
        }
      );
    });
  });
});
