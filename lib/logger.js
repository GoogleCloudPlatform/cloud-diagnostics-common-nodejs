/**
 * Copyright 2014, 2015 Google Inc. All Rights Reserved.
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

var util = require('util');
var moment = require('moment');
var slice = Array.prototype.slice;

module.exports = {
  /** @const {number} */ ERROR: 1,
  /** @const {number} */ WARN: 2,
  /** @const {number} */ INFO: 3,
  /** @const {number} */ DEBUG: 4,

  /** @const {Array.<?string>} */
  LEVEL_NAMES: [null, 'ERROR', 'WARN ', 'INFO ', 'DEBUG'],

  /**
   * Factor method that returns a new logger.
   * @param {number=} level Default log level.
   * @param {?string=} prefix to use in log messages.
   */
  create: function(level, prefix) {
    var level_ = level || 0;
    var prefix_ = prefix || '';

    /**
     * Logs any passed in arguments.
     * @private
     */
    var log = function(level, args) {
      if (level_ < level) {
        return;
      }
      args.unshift(module.exports.LEVEL_NAMES[level] + ':' + prefix_ + ':');
      console.log.apply(console, args);
    };

    /**
     * @param {debuglet.Breakpoint} breakpoint
     * @return {string}
     * @private
     */
    var formatBreakpointForLog = function(msg, breakpoint) {
      var text = msg + util.format('breakpoint id: %s,\n\tlocation: %s',
        breakpoint.id, util.inspect(breakpoint.location));
      if (breakpoint.createdTime) {
        text += '\n\tcreatedTime: ' +
          moment.unix(parseInt(breakpoint.createdTime.seconds, 10)).calendar();
      }
      if (breakpoint.condition) {
        text += '\n\tcondition: ' + util.inspect(breakpoint.condition);
      }
      if (breakpoint.expressions) {
        text += '\n\texpressions: ' + util.inspect(breakpoint.expressions);
      }
      return text;
    };

    return {
      error: function() { log(module.exports.ERROR, slice.call(arguments)); },
      warn: function()  { log(module.exports.WARN, slice.call(arguments));  },
      info: function()  { log(module.exports.INFO, slice.call(arguments));  },
      debug: function() { log(module.exports.DEBUG, slice.call(arguments)); },

      /**
       * Logs a breakpoint.
       * @param {number} level log level
       * @param {string} msg
       * @param {debuglet.Breakpoint} breakpoint
       */
      breakpoint: function(level, msg, breakpoint) {
        if (level_ < level) {
          return;
        }
        log(level, [formatBreakpointForLog(msg, breakpoint)]);
      },

      /**
       * Logs an associative array (map) of breakpoints
       *
       * @param {number} level log level
       * @param {string} msg
       * @param {Object.<string, Breakpoint>} map
       */
      breakpoints: function(level, msg, map) {
        if (level_ < level) {
          return;
        }
        var that = this;
        log(level, [msg]);
        Object.keys(map).forEach(function(key) {
          that.breakpoint(level, '', this[key]);
        }, map);
      },

      /**
       * Logs the provided message and interval in millis.
       *
       * @param {number} level log level
       * @param {string} msg
       * @param {Array<number>} interval A time interval of the format
       *    [seconds, nanoseconds]
       */
      interval: function(level, msg, interval) {
        if (level_ < level) {
          return;
        }
        log(level, [msg + ' ' + (interval[0] * 1000 + interval[1] / 1000000) +
                    'ms']);
      }
    };
  } /* create */

}; /* module.exports */


