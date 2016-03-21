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

var assert = require('assert');
var logger = require('../lib/logger.js');

/* Stub console.log for testing */
var buffer = [];
var orig = console._stdout.write;
console._stdout.write = function() {
  buffer.push(arguments[0]);
  orig.apply(this, arguments);
};


describe('logger', function() {
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
    l.silly('g');
    assert.ok(/SILLY.*: g/.test(buffer.pop()));
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

  it('should correctly log a breakpoint object');
  it('should correctly log an array of breakpoints');
});
