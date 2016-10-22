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
var proxyquire = require('proxyquire').noPreserveCache();
var nock = require('nock');
var assert = require('assert');
var path = require('path');

function GoogleAuth() {}
GoogleAuth.prototype.getApplicationDefault = function(cb) {
  return cb(null, 'Awesome Auth Client');
};
GoogleAuth.prototype.fromJSON = function(json, cb) {
  return cb(null, json);
};
GoogleAuth.prototype.fromStream = function(stream, cb) {
  var contents = '';
  stream.on('data', function(data) {
    contents += data;
  });
  stream.on('end', function() {
    return cb(null, JSON.parse(contents));
  });
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

    it('Should callback with ENOTFOUND', function (done) {
      var oldEnv = process.env.GCLOUD_PROJECT;
      process.env.GCLOUD_PROJECT = './this-should-not-exist.json';
      var scope = nock('http://metadata.google.internal')
        .get('/computeMetadata/v1/project/numeric-project-id')
        .once()
        .replyWithError({'message': 'Not Found', code: 'ENOTFOUND'});
      utils.getProjectNumber(function (e, result) {
        assert.ok(e instanceof Error, 'e should be an instance of Error');
        assert.deepEqual(result, null);
        process.env.GCLOUD_PROJECT = oldEnv;
        scope.done();
        done();
      });
    });
  });

  describe('getProjectId', function() {

    it('should be able to get project id from metadata service',
      function(done) {
        var scope = nock('http://metadata.google.internal')
                      .get('/computeMetadata/v1/project/project-id')
                      .reply(200, 'a-stub-project-id');
        utils.getProjectId(function(err, projectId) {
          assert.ok(!err);
          assert.strictEqual(projectId, 'a-stub-project-id');
          scope.done();
          done();
        });
      });
    
    it('should be able handle 500\'s from the service',
      function(done) {
        var scope = nock('http://metadata.google.internal')
                      .get('/computeMetadata/v1/project/project-id')
                      .reply(500, {error: true});
        utils.getProjectId(function(err, projectId) {
          assert.strictEqual(typeof err, 'object');
          assert.ok(err instanceof Error);
          assert.strictEqual(err.message, 'Error discovering project id');
          assert.strictEqual(projectId, null);
          scope.done();
          done();
        });
      });

    it('should accept an optional headers parameter', function(done) {
      var scope =
        nock('http://metadata.google.internal', {
            reqheaders: {'Flux': 'Capacitor'}
          })
          .get('/computeMetadata/v1/project/project-id')
          .reply(200, 'a-stub-project-id');
      utils.getProjectId({'Flux': 'Capacitor'}, function(err, project) {
        assert.ok(!err);
        assert.strictEqual(project, 'a-stub-project-id');
        scope.done();
        done();
      });
    });

    it('Should callback with ENOTFOUND', function (done) {
      var oldEnv = process.env.GCLOUD_PROJECT;
      process.env.GCLOUD_PROJECT = './this-should-not-exist.json';
      var scope = nock('http://metadata.google.internal')
        .get('/computeMetadata/v1/project/project-id')
        .once()
        .replyWithError({'message': 'Not Found', code: 'ENOTFOUND'});
      utils.getProjectId(function (e, result) {
        assert.ok(e instanceof Error, 'e should be an instance of Error');
        assert.deepEqual(result, null);
        process.env.GCLOUD_PROJECT = oldEnv;
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

  describe('getAuthClient', function() {
    // require is relative to this file
    var credentials = require('./fixtures/stub_cert.json');
    var keyFilePath = path.join('test', 'fixtures', 'stub_cert.json');

    it('should work with empty scopes', function(done) {
      utils.getAuthClient([], function(err, client) {
        assert(!err);
        assert(client);
        done();
      });
    });
    it('should call fromJSON when JSON credentials are provided',
      function(done) {
        var config = {
          credentials: credentials
        };
        utils.getAuthClient([], config, function(err, client) {
          assert(!err);
          assert(client);
          assert.equal(client, credentials);
          done();
        });
      });
    it('should call fromStream when JSON credentials path is provided',
        function(done) {
        var config = {
          keyFile: keyFilePath
        };
        utils.getAuthClient([], config, function(err, client) {
          assert(!err);
          assert(client);
          assert.deepEqual(client, credentials);
          done();
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

  describe('getInstanceId - valid cases', function() {
    var STUB_ID = 'a-stub-instance-id';
    it(
      'Should be able to get the instance id without additional headers supplied',
      function (done) {
        var mock = nock('http://metadata.google.internal/computeMetadata/v1')
          .get('/instance/id')
          .once()
          .reply(200, STUB_ID);
        utils.getInstanceId(function (err, id) {
          assert.deepEqual(err, null, 'Error should be null');
          assert.deepEqual(STUB_ID, id, 'The id should be the stub id');
          mock.done();
          done();
        });
      }
    );
    it(
      'Should be able to get the instance id with additional headers supplied',
      function (done) {
        var mock = nock('http://metadata.google.internal/computeMetadata/v1',
          {reqHeaders: {'x-custom-header': 'true'}})
          .get('/instance/id')
          .once()
          .reply(200, STUB_ID);
        utils.getInstanceId({'x-custom-header': 'true'}, function (err, id) {
          assert.deepEqual(err, null, 'Error should be null');
          assert.deepEqual(STUB_ID, id, 'The id should be the stub id');
          mock.done();
          done();
        });
      }
    );
  });

  describe('getHostname - valid cases', function() {
    var STUB_HOSTNAME = 'a-stub-hostname';
    it(
      'Should be able to get the hostname without additional headers supplied',
      function (done) {
        var mock = nock('http://metadata.google.internal/computeMetadata/v1')
          .get('/instance/hostname')
          .once()
          .reply(200, STUB_HOSTNAME);
        utils.getHostname(function (err, id) {
          assert.deepEqual(err, null, 'Error should be null');
          assert.deepEqual(STUB_HOSTNAME, id,
            'The hostname should be the stub hostname');
          mock.done();
          done();
        });
      }
    );
    it(
      'Should be able to get the hostname with additional headers supplied',
      function (done) {
        var mock = nock('http://metadata.google.internal/computeMetadata/v1',
          {reqHeaders: {'x-custom-header': 'true'}})
          .get('/instance/hostname')
          .once()
          .reply(200, STUB_HOSTNAME);
        utils.getHostname({'x-custom-header': 'true'}, function (err, id) {
          assert.deepEqual(err, null, 'Error should be null');
          assert.deepEqual(STUB_HOSTNAME, id,
            'The hostname should be the stub hostname');
          mock.done();
          done();
        });
      }
    );
  });
});
