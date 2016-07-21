/**
 * Copyright 2015 Google Inc. All Rights Reserved.
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

var nock = require('nock');
var assert = require('assert');
var proxyquire = require('proxyquire');

function GoogleAuth() {}
GoogleAuth.prototype.getApplicationDefault = function(cb) {
  return cb(null, 'Awesome Auth Client');
};

var utils = proxyquire('../lib/utils.js', {
  'google-auth-library': GoogleAuth
});

nock.disableNetConnect();

describe('utils', function() {
  after(function() {
    nock.enableNetConnect();
  });

  describe('getProjectNumber', function() {

    it('should be able to get project number from metadata service',
      function(done) {
        var scope = nock('http://metadata.google.internal')
                      .get('/computeMetadata/v1/project/numeric-project-id')
                      .reply(200, '567');
        utils.getProjectNumber(function(err, project) {
          assert.ok(!err);
          assert.strictEqual(project, '567');
          scope.done();
          done();
        });
      });
    
    it('should be able to handle 500\'s from the metadata service',
      function(done) {
        var scope = nock('http://metadata.google.internal')
                      .get('/computeMetadata/v1/project/numeric-project-id')
                      .reply(500, {error: true});
        utils.getProjectNumber(function(err, project) {
          assert.strictEqual(typeof err, 'object');
          assert.ok(err instanceof Error);
          assert.strictEqual(err.message, 'Error discovering project num');
          assert.strictEqual(project, undefined);
          scope.done();
          done();
        });
      });

    it('should accept an optional headers parameter', function(done) {
      var scope =
        nock('http://metadata.google.internal', {
            reqheaders: {'Flux': 'Capacitor'}
          })
          .get('/computeMetadata/v1/project/numeric-project-id')
          .reply(200, '789');
      utils.getProjectNumber({'Flux': 'Capacitor'}, function(err, project) {
        assert.ok(!err);
        assert.strictEqual(project, '789');
        scope.done();
        done();
      });
    });
  });

  describe('authorizedRequestFactory', function() {

    it('should return a function', function() {
      var result = utils.authorizedRequestFactory(['fake-scope']);
      assert(typeof result === 'function');
    });

  });

  describe('getApplicationDefaultAuth', function() {
    it('should work with empty scopes', function(done) {
      utils.getApplicationDefaultAuth([], function(err, client) {
        assert(!err);
        assert(client);
        done();
      });
    });

    it('should work with out of order scopes', function(done) {
      var scopes1 = ['https://www.googleapis.com/auth/trace.append',
                     'https://www.googleapis.com/auth/trace.readonly'];
      var scopes2 = ['https://www.googleapis.com/auth/trace.readonly',
                     'https://www.googleapis.com/auth/trace.append'];
      utils.getApplicationDefaultAuth(scopes1, function(err, client1) {
        assert(!err);
        utils.getApplicationDefaultAuth(scopes2, function(err, client2) {
          assert(!err);
          assert.equal(client1, client2);
          done();
        });
      });
    });
  });

  describe('requestWithRetry', function() {

    it('should not retry on successful request', function(done) {
      var attempt = 0;
      // a request that always succeeds
      var request = function(options, callback) {
        attempt += 1;
        callback(null, 'response', 'body');
      };
      utils.requestWithRetry(request, {},
        function(err, response, body) {
          assert.strictEqual(attempt, 1);
          done();
        });
      });

    it('should not retry on non-transient errors', function(done){
      var attempt = 0;
      // a request that always fails with HTTP 404
      var request = function(options, callback) {
        attempt += 1;
        callback({code: 404});
      };
      utils.requestWithRetry(request, {}, function(err, response, body) {
        assert.strictEqual(attempt, 1);
        assert.equal(err.code, 404);
        done();
      });
    });

    it('should retry atleast 4 times on unsuccessful requests', function(done){
      this.timeout(30000); // this test takes a long time
      var attempt = 0;
      // a request that always fails
      var request = function(options, callback) {
        attempt += 1;
        callback({code: 429});
      };
      utils.requestWithRetry(request, {}, function(err, response, body) {
        assert.ok(attempt >= 4);
        done();
      });
    });

    it('should retry on errors 429, 500, 503', function(done) {
      this.timeout(30000); // this test takes a long time
      var attempt = 0;
      var request = function(options, callback) {
        attempt += 1;
        switch (attempt) {
          case 1:
            callback({code: 429});
            return;
          case 2:
            callback({code: 500});
            return;
          case 3:
            callback({code: 503});
            return;
          case 4:
            callback(null, 'response', 'body');
            return;
          default:
            assert.fail();
        }
      };

      utils.requestWithRetry(request, {}, function(err, response, body) {
        assert.ok(!err);
        assert.strictEqual(attempt, 4); // should have passed on 4th attempt
        done();
      });
    });
  });
});
