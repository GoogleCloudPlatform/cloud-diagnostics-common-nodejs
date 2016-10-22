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

var fs = require('fs');
var GoogleAuth = require('google-auth-library');
var request = require('request');
// we only need a single instance
var googleAuth = new GoogleAuth();

/** @const {number} */ var MAX_RETRY_ATTEMPTS = 5;
/** @const {number} */ var MIN_RETRY_TIMEOUT = 1000; // milliseconds

var METADATA_URL = 'http://metadata.google.internal/computeMetadata/v1';

/**
 * Returns true if `err` is a transient error code.
 * @param {?number} err The error code.
 * @return {boolean} Whether `err` is a transient error.
 */
function isTransientError(err) {
  // 429 - Too many requests.
  // 500 - Internal server error.
  // 503 - Service Unavailable.
  return (err && [429, 500, 503].indexOf(err.code) !== -1);
}

/**
 * Returns a backoff delay using an exponential backoff algorithm.
 * @param {number} attempt 1-indexed attempt number. The first retry would
 *    be attempt number 2.
 * @return {number} backoff delay in milliseconds.
 */
function retryDelay(attempt) {
  return MIN_RETRY_TIMEOUT * Math.pow(2, (attempt-1));
}

/**
 * Returns a google auth client for the current application with provided
 * scopes and configuration .
 */
function getAuthClient(scopes, config, callback) {
  if (typeof(config) === 'function') {
    callback = config;
    config = null;
  }

  if (config && config.keyFile) {
    googleAuth.fromStream(fs.createReadStream(config.keyFile), addScope);
  } else if (config && config.credentials) {
    googleAuth.fromJSON(config.credentials, addScope);
  } else {
    googleAuth.getApplicationDefault(addScope);
  }

  function addScope(err, authClient) {
    if (err) {
      callback(err);
      return;
    }
    if (authClient.createScopedRequired && authClient.createScopedRequired()) {
      authClient = authClient.createScoped(scopes);
    }
    callback(null, authClient);
  }
}

/**
 * Performs the provided request fn using the options and callback. If the
 * request fails with a server error, it automatically retries using exponential
 * backoff. This will retry atleast 4 times.
 *
 * TODO(ofrobots): maybe accept a config object instead of the request function?
 *     Perhaps we can allow the caller to specify retry count, etc.
 *
 * @param {function(Object, function(=?,=?,=?):?} request style function
 *     accepting (options, callback).
 * @param {Object} options options to pass to request function
 * @param {Function} callback for request
 */
function requestWithRetry(request, options, callback) {
  function tryRequest(attempt) {
    request(options, function(err, response, body) {
      if (isTransientError(err) && attempt < MAX_RETRY_ATTEMPTS) {
        var delay = retryDelay(attempt);
        setTimeout(function() {
          tryRequest(attempt + 1);
        }, delay);
        return;
      }
      // not a (server) error, or retried too many times already.
      callback(err, response, body);
    });
  }

  tryRequest(1);
}

/**
 * Returns a request style function that can make authorized requests to a
 * Google API using Google Application Default credentials. This hides the
 * the details of working with auth in the client code.
 *
 * @param {Array<string>} scopes list of scopes to request as part of auth
 * @param {Object} config an object with extra configuration parameters (such
 *     as keyFile or key)
 * @return {function(Object, function(=?,=?,=?):?)} request style function
 *     accepting (options, callback)
 */
function authorizedRequestFactory(scopes, config) {
  // The AuthClient instance associated with each instantiation
  var authClient;
  function makeRequest(options, callback) {
    // authClient expects options to be an object rather than a bare url.
    // Coerce into an object here
    if (typeof options === 'string') {
      options = {url: options};
    }
    if (authClient) {
      authClient.request(options, function(err, body, response) {
        // Ugh. google-auth-library changes the argument order for the
        // callback. Fix that here.
        callback(err, response, body);
      });
    } else {
      getAuthClient(scopes, config, function(err, client) {
        if (err) {

          callback(err);
          return;
        }
        if (!authClient) {
          // google-auth-library changes the argument order for the
          // callback. Fix that here.
          authClient = client;
        }
        authClient.request(options, function(err, body, response) {
          callback(err, response, body);
        });
      });
    }
  }

  return function(options, callback) {
    requestWithRetry(makeRequest, options, callback);
  };
}

function getMetadataValue(url, headers, callback) {
  headers['Metadata-Flavor'] = 'Google';

  requestWithRetry(request, {
    url: url,
    headers: headers,
    method: 'GET'
  }, callback);
}

/**
 * Attempts to retrieve the project number for the current active project from
 * the metadata service (See https://cloud.google.com/compute/docs/metadata).
 *
 * @param {object=} headers optional headers to include in the http request.
 *     Note that the headers, if provided, may be extended with extra
 *     properties.
 * @param {function(?, number):?} callback an (err, result) style callback
 */
function getProjectNumber(headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  getMetadataValue(METADATA_URL + '/project/numeric-project-id',
      headers, function(err, response, project) {
    if (!err && response.statusCode === 200) {
      return callback(null, project);
    } else if (err && err.code === 'ENOTFOUND') {
      return callback(new Error('Could not auto-discover project-id. Please export ' +
        'GCLOUD_PROJECT with your project name'));
    } else {
      return callback(err || new Error('Error discovering project num'));
    }
  });
}

/**
 * Attempts to retreive the project id for the current active project from the
 * metadata service. The GCLOUD_PROJECT env variable or another identifying
 * project name/id must be set so that the underlying request library can
 * successfully query the metadata service.
 * {@link https://cloud.google.com/compute/docs/storing-retrieving-metadata}
 * @param {Object} [headers] - An optional set of headers to include in the http
 *  request. This function may mutate the given headers object.
 * @param {getProjectIdCallback} callback - A callback to receive the
 *  response body (project id) or error encountered during the request.
 */
function getProjectId(headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  getMetadataValue(METADATA_URL + '/project/project-id', headers,
    function (err, response, projectId) {
      if (!err && response.statusCode === 200) {
        return callback(null, projectId);
      } else if (err && err.code === 'ENOTFOUND') {
        return callback(new Error('Could not auto-discover project-id.' +
          'Please export GCLOUD_PROJECT with your project name'), null);
      }
      return callback(err || new Error('Error discovering project id'), null);
  });
}

/**
 * Callback for getProjectId function. This callback will be invoked once
 * negotiation with the project-id metadata endpoint either succeeds or fails.
 * Always calls back with two parameters, one of which will always be null.
 * @callback getProjectIdCallback
 * @param {Error|Null} - If an error is encountered during the request this
 *  param will be an instance of the Error class otherwise it will be null.
 * @param {String|Null} - If no error is encountered during the request then
 *  this param will be of type string and its value will be the related project
 *  id; otherwise it will be null.
 * @example
 * function myCallback (err, projectId) {
 *  if (err) {
 *    console.error('Encountered error fetching project id', err);
 *    return;
 *  }
 *  console.log('Got project id', projectId);
 * }
 * utils.getProjectId(myCallback);
 */

/**
 * Attempts to retrieve the GCE instance hostname for the current active project
 * from the metadata service (See https://cloud.google.com/compute/docs/metadata).
 *
 * @param {object=} headers optional headers to include in the http request.
 *     Note that the headers, if provided, may be extended with extra
 *     properties.
 * @param {function(?, number):?} callback an (err, result) style callback
 */
function getHostname(headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  getMetadataValue(METADATA_URL + '/instance/hostname',
      headers, function(err, response, hostname) {
    callback(err, hostname);
  });
}

/**
 * Attempts to retrieve the GCE instance id for the current active project
 * from the metadata service (See https://cloud.google.com/compute/docs/metadata).
 *
 * @param {object=} headers optional headers to include in the http request.
 *     Note that the headers, if provided, may be extended with extra
 *     properties.
 * @param {function(?, number):?} callback an (err, result) style callback
 */
function getInstanceId(headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  getMetadataValue(METADATA_URL + '/instance/id',
      headers, function(err, response, id) {
    callback(err, id);
  });
}

module.exports = {
  getProjectNumber: getProjectNumber,
  getProjectId: getProjectId,
  getHostname: getHostname,
  getInstanceId: getInstanceId,
  authorizedRequestFactory: authorizedRequestFactory,
  requestWithRetry: requestWithRetry,
  getAuthClient: getAuthClient
};
