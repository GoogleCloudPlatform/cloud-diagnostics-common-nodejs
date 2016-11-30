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
var os = require('os');
var fs = require('fs');
var fsMock = require('mock-fs');
var proxyquire = require('proxyquire').noPreserveCache();
var assert = require('assert');
var PREFIX = 'mock_fd_logger';
var MOCK_FILE = [PREFIX, 'log.txt'].join('_');
var MOCK_PATH = os.tmpdir()+'/'+MOCK_FILE; // mock-fs always uses forward slashes
var SECONDS = 1471332553; // Some date value measured in seconds from epoch.

/* Stub console.log for testing */
var buffer = [];
var orig = console._stdout.write;
console._stdout.write = function() {
  buffer.push(arguments[0]);
  orig.apply(this, arguments);
};

describe('mocking fd logger with config', function () {
  it('should write an entry to the fs mock when log is called', function () {
    var logger = require('../lib/logger.js');
    var l = logger.create(logger.SILLY, PREFIX, 9);
    for (var i = 0; i < 15; i += 1) {
      l.info('info_');
    }
    var s = fs.readFileSync(MOCK_PATH).toString();
    assert.deepEqual(s.split('\n').length, 10, 'There should be 10 entries in the logs')
  });
  before(function () {
    var mockTree = {};
    mockTree[os.tmpdir()] = {};
    mockTree[os.tmpdir()][MOCK_FILE] = '';
    fsMock(mockTree, {createTmp: false});
  });
  after(function () {
    fsMock.restore();
  });
});

describe('mocking fd logger without config', function () {
  it('should not write an entry to the fs mock when log is called', function () {
    var logger = require('../lib/logger.js');
    var l = logger.create();
    for (var i = 0; i < 5; i += 1) {
      l.info('info_');
    }
    var s = fs.readFileSync(os.tmpdir()+'/_log.txt').toString();
    assert.deepEqual(s, '', 'The log file should be empty');
  });
  before(function () {
    var mockTree = {};
    mockTree[os.tmpdir()] = {};
    mockTree[os.tmpdir()]['_log.txt'] = '';
    fsMock(mockTree, {createTmp: false});
  });
  after(function () {
    fsMock.restore();
  });
});

describe('logging a breakpoint object', function () {
  var checkTime = /createdTime/;
  var checkCondition = /condition/;
  var checkExpression = /expressions/;
  it('should log a breakpoint object correctly', function () {
    var logger = require('../lib/logger.js');
    var correctOutput = [
      'ERROR:mock_fd_logger: breakpoint id: 0,\n\tlocation: { line: 3, path:',
      ' \'/my/project/root/test/fixtures/a/hello.js\' }\n\tcreatedTime: ',
      new Date(SECONDS * 1000).toString(),
      '\n\tcondition: \'if n == 3 then true else false\'\n\texpressions: ',
      '[ \'if n == 3 then Math.PI * n else n\' ]\n'
    ].join('');
    var bp = {
      id: 0,
      location: {
        line: 3,
        path: '/my/project/root/test/fixtures/a/hello.js'
      },
      createdTime: {seconds: SECONDS},
      condition: 'if n == 3 then true else false',
      expressions: ['if n == 3 then Math.PI * n else n']
    };
    var l = logger.create(logger.SILLY, PREFIX, 10);
    l.breakpoint(logger.ERROR, '', bp);
    var s = fs.readFileSync(MOCK_PATH).toString();
    assert.deepEqual(s, correctOutput, 'The log break point should be properly formatted');
  });
  it('should log a breakpoint without time correctly', function () {
    var log, writer;
    var logger = require('../lib/logger.js');
    var bp = {
      id: 0,
      location: {
        line: 3,
        path: '/my/project/root/test/fixtures/a/hello.js'
      },
      condition: 'if n == 3 then true else false',
      expressions: ['if n == 3 then Math.PI * n else n']
    };
    writer = logger.create(logger.SILLY, PREFIX, 10);
    writer.breakpoint(logger.ERROR, '', bp);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.ok(!checkTime.test(log));
    assert.ok(checkCondition.test(log));
    assert.ok(checkExpression.test(log));
  });
  it('should log a breakpoint without condition correctly', function () {
    var log, writer;
    var logger = require('../lib/logger.js');
    var bp = {
      id: 0,
      location: {
        line: 3,
        path: '/my/project/root/test/fixtures/a/hello.js'
      },
      createdTime: {seconds: SECONDS},
      expressions: ['if n == 3 then Math.PI * n else n']
    };
    writer = logger.create(logger.SILLY, PREFIX, 10);
    writer.breakpoint(logger.ERROR, '', bp);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.ok(checkTime.test(log));
    assert.ok(!checkCondition.test(log));
    assert.ok(checkExpression.test(log));
  });
  it('should log a breakpoint without expressions correctly', function () {
    var log, writer;
    var logger = require('../lib/logger.js');
    var bp = {
      id: 0,
      location: {
        line: 3,
        path: '/my/project/root/test/fixtures/a/hello.js'
      },
      createdTime: {seconds: SECONDS},
      condition: 'if n == 3 then true else false'
    };
    writer = logger.create(logger.SILLY, PREFIX, 10);
    writer.breakpoint(logger.ERROR, '', bp);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.ok(checkTime.test(log));
    assert.ok(checkCondition.test(log));
    assert.ok(!checkExpression.test(log));
  });
  it('should not log a breakpoint if the logging level is set lower', function () {
    var log, writer;
    var logger = require('../lib/logger.js');
    var bp = {
      id: 0,
      location: {
        line: 3,
        path: '/my/project/root/test/fixtures/a/hello.js'
      },
      createdTime: {seconds: SECONDS},
      condition: 'if n == 3 then true else false'
    };
    writer = logger.create(logger.ERROR, PREFIX, 10);
    writer.breakpoint(logger.DEBUG, '', bp);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.deepEqual('', log, 'The log should be empty');
  });
  it('should log an array of break points', function () {
    var correctOutput = [
      'ERROR:mock_fd_logger: \nERROR:mock_fd_logger: breakpoint id: 0,',
      '\n\tlocation: { line: 3, path: \'/my/project/root/test/fixtures/',
      'a/hello.js\' }\n\tcreatedTime: ',
      new Date(SECONDS*1000).toString(),
      '\n\tcondition: \'',
      'if n == 3 then true else false\'\nERROR:mock_fd_logger: breakpoint ',
      'id: 1,\n\tlocation: { line: 10,\n  path: ',
      '\'/my/project/root/test/fixtures/a/goodbye.js\' }\n\tcreatedTime: ',
      new Date(SECONDS*1000).toString(),
      '\n\tcondition: \'if n == 4 then true else false\'\n'
    ].join('');
    var log, writer;
    var logger = require('../lib/logger.js');
    var bps = [
      {
        id: 0,
        location: {
          line: 3,
          path: '/my/project/root/test/fixtures/a/hello.js'
        },
        createdTime: {seconds: SECONDS},
        condition: 'if n == 3 then true else false'
      },
      {
        id: 1,
        location: {
          line: 10,
          path: '/my/project/root/test/fixtures/a/goodbye.js'
        },
        createdTime: {seconds: SECONDS},
        condition: 'if n == 4 then true else false'
      }
    ];
    writer = logger.create(logger.DEBUG, PREFIX, 10);
    writer.breakpoints(logger.SILLY, '', bps);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.deepEqual('', log, 'The log should be empty');
    writer.breakpoints(logger.ERROR, '', bps);
    // cristiancavalli added the \r\n replace with \n since it looks
    // like utils.inspect is changing behavior in node v6.4.0 and
    // newlining with \r\n instead of just \n
    // @TODO figure out if this is intended and why - the rest of the
    // ouput uses /n and other versions pass without this
    log = fs.readFileSync(MOCK_PATH).toString().replace(/\r\n/g, '\n');
    assert.deepEqual(correctOutput, log, 'The log should be properly formatted');
  });
  it('should log an interval', function () {
    var log, writer;
    var correctOutput = 'ERROR:mock_fd_logger: test 100000.0002ms\n';
    var logger = require('../lib/logger.js');
    writer = logger.create(logger.ERROR, PREFIX, 10);
    writer.interval(logger.DEBUG, 'test', 1000);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.deepEqual('', log, 'The log should be empty');
    writer.interval(logger.ERROR, 'test', [100, 200]);
    log = fs.readFileSync(MOCK_PATH).toString();
    assert.deepEqual(correctOutput, log, 'The log should be properly formatted');
  });
  beforeEach(function () {
    var mockTree = {};
    mockTree[os.tmpdir()] = {};
    mockTree[os.tmpdir()][MOCK_FILE] = '';
    fsMock(mockTree, {createTmp: false});
  });
  afterEach(function () {
    fsMock.restore();
  });
});

describe('logger base-functionality', function() {
  var logger = require('../lib/logger.js');
  it('should return a logger through the create function', function() {
    var l = logger.create(logger.DEBUG, __filename);
    assert.ok(l);
    assert.ok(l.error);
    assert.ok(typeof l.error === 'function');
  });

  it('should generate log messages successfully', function() {
    var l = logger.create(logger.SILLY, 'foobar');
    l.error('a');
    assert.ok(/ERROR.*: a/.test(buffer.pop()));
    l.warn('b', 'c');
    assert.ok(/WARN.*: b c/.test(buffer.pop()));
    l.info('d', 'e', 'f');
    assert.ok(/INFO.*: d e f/.test(buffer.pop()));
    l.debug('g');
    assert.ok(/DEBUG.*: g/.test(buffer.pop()));
    l.silly('h');
    assert.ok(/SILLY.*: h/.test(buffer.pop()));
  });

  it('should not log when the default level is lower', function() {
    buffer = [];

    var l = logger.create(logger.WARN, 'foobar');

    l.error('a');
    assert.ok(buffer.length === 1);
    buffer.pop();

    l.warn('b');
    assert.ok(buffer.length === 1);
    buffer.pop();

    l.info('c');
    assert.ok(buffer.length === 0);

    l.debug('d');
    assert.ok(buffer.length === 0);
  });
});
