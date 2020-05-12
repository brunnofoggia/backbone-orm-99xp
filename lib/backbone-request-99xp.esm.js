import Backbone from 'backbone';
import _ from 'underscore-99xp';
import axios from 'axios';

// [backbone-request-99xp](https://github.com/brunnofoggia/backbone-request-99xp) is an integration that makes possible to use
/* templater settings */

_.templateSettings = {
  interpolate: /\{\{(.+?)\}\}/g,
  evaluate: /\{\%(.+?)\%\}/g,
  escape: /\{-([\s\S]+?)-\}/g
};

var BackboneRequest = _.clone(Backbone);

BackboneRequest.VERSION = '0.1.0'; // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
// will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
// set a `X-Http-Method-Override` header.

BackboneRequest.emulateHTTP = false; // Turn on `emulateJSON` to support legacy servers that can't deal with direct
// `application/json` requests ... this will encode the body as
// `application/x-www-form-urlencoded` instead and will send the model in a
// form param named `model`.

BackboneRequest.emulateJSON = false; // Sync engine modeled over default backbone.js ajax syncing engine
// It will make model rest methods to work for both, node and browser

BackboneRequest.sync = function (method, model, options) {
  var type = methodMap[method]; // Default options, unless specified.

  _.defaults(options || (options = {}), {
    emulateHTTP: BackboneRequest.emulateHTTP,
    emulateJSON: BackboneRequest.emulateJSON,
    headers: {}
  }); // Default JSON-request options.


  var params = _.extend({}, options, {
    type: type,
    dataType: 'json'
  }); // Ensure that we have a URL.


  if (!options.url) {
    params.url = _.result(model, 'url') || BackboneRequest.urlError();
  } // Ensure that we have the appropriate request data.


  if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
    params.contentType = 'application/json';
    params.data = JSON.stringify(options.attrs || model.toJSON(options));
  } // For older servers, emulate JSON by encoding the request into an HTML-form.


  if (options.emulateJSON) {
    params.contentType = 'application/x-www-form-urlencoded';
    params.data = params.data ? {
      model: params.data
    } : {};
  } // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
  // And an `X-HTTP-Method-Override` header.


  if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
    params.type = 'POST';

    if (options.emulateJSON) {
      params.data._method = type;
    }

    params.headers['X-HTTP-Method-Override'] = type;
  } // Don't process data on a non-GET request.


  if (params.type !== 'GET' && !options.emulateJSON) {
    params.processData = false;
  } // Request & Parse engine


  var reqOpts = _.extend({
    url: params.url,
    method: params.type,
    headers: params.headers
  }, _.pick(params, 'data'), _.omit(options, 'type', 'dataType', 'emulateHTTP', 'emulateJSON'));

  reqOpts.headers['content-type'] = params.contentType || 'application/json'; // Promise calls

  reqOpts.then = _.partial((m, o, response) => {
    typeof o.success === 'function' && o.success(response.data);
  }, this, options);
  reqOpts.catch = _.bind(_.partial((m, o, err) => {
    this._reqErr = err;
    typeof o.error === 'function' && o.error(err);
  }, this, options), this);
  return BackboneRequest.exec(reqOpts);
}; // Format data for request


BackboneRequest.exec = function (options, req = null, res = null) {
  if (typeof options.url !== 'string' || // Accept to execute http requests without receiving res object if callbacks are present in options
  !res && _.size(_.pick(options, 'then', 'catch')) < 2) {
    return false;
  }

  var reqOpts = _.defaults(_.pick(options, 'url', 'method', 'headers', 'data'), {
    method: 'GET',
    headers: {}
  }); // default promise calls


  typeof options.then !== 'function' && (options.then = (response, _req, _res) => {
    _res.status(response.status).send(response.data);
  });
  typeof options.finally !== 'function' && (options.finally = () => {});
  typeof options.catch !== 'function' && (options.catch = (error, _req, _res) => {
    try {
      var data = error.response.data;

      if (typeof data !== 'object') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          data = {
            message: data
          };
        }
      }

      _res.status(error.response.status).send(JSON.stringify(data));
    } catch (e) {
      _res.status(500).send(JSON.stringify({
        message: 'Internal Failure'
      }));
    }
  }); // Axios call

  return axios(reqOpts).then(_.partial((_req, _res, o, r) => options.then(r, _req, _res), req, res, options)).catch(_.partial((_req, _res, o, err) => options.catch(err, _req, _res), req, res, options)).finally(_.partial((_req, _res, o) => options.finally(_req, _res), req, res, options));
}; // Map from CRUD to HTTP for our default `Backbone.sync` implementation.


var methodMap = {
  'create': 'POST',
  'update': 'PUT',
  'patch': 'PATCH',
  'delete': 'DELETE',
  'read': 'GET'
}; // Throw an error when a URL is needed, and none is supplied.

BackboneRequest.urlError = function () {
  throw new Error('A "url" property or function must be specified');
};

_.map(['Events'], x => BackboneRequest[x] = _.clone(Backbone[x]));

_.map(['Model', 'Collection'], x => BackboneRequest[x] = Backbone[x].extend({
  // constructor
  initialize(data = {}, options = {}) {
    this.setRouterParameters(options.req, options.res);
  },

  // easier way to have express variables inside the object to use them in callbacks
  setRouterParameters(req = null, res = null) {
    this._req = req;
    this._res = res;
  },

  // Replacing prototype of sync to call custom sync method
  sync() {
    return BackboneRequest.sync.apply(this, arguments);
  },

  // Shortcuts for clearer promise use
  fetchp(fn, o = {}) {
    o.success = fn;
    return this.fetch(o);
  },

  savep(fn, o = {}) {
    o.success = fn;
    return this.save(null, o);
  },

  destroyp(fn, o = {}) {
    o.success = fn;
    return this.destroy(o);
  }

}));

export default BackboneRequest;
