/**
* @license
* backbone-api 99xp
* ----------------------------------
* v0.1.0
*
* Copyright (c)2020 Bruno Foggia, 99xp.
* Distributed under MIT license
*
* https://backbone-api.99xp.org
*/


(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('underscore-99xp'), require('validate-99xp'), require('backbone-request-99xp')) :
    typeof define === 'function' && define.amd ? define(['exports', 'underscore-99xp', 'validate-99xp', 'backbone-request-99xp'], factory) :
    (global = global || self, factory(global.BackboneApi = {}, global._, global.v, global.BackboneRequest));
}(this, function (exports, _, v, BackboneRequest) { 'use strict';

    _ = _ && _.hasOwnProperty('default') ? _['default'] : _;
    v = v && v.hasOwnProperty('default') ? v['default'] : v;
    BackboneRequest = BackboneRequest && BackboneRequest.hasOwnProperty('default') ? BackboneRequest['default'] : BackboneRequest;

    // Micro Service integrator plus advanced validation, formatting and control over proccess possibilities
    var BackboneApi = {}; // Extended Functionallity for Models and Collections

    var extended = {
      // not meant to be used. will be used on setting api methods like POST or PUT
      idAttribute: '_id',
      auth: false,
      tokenField: 'accessToken',
      // list of methods available in the api and their configuration (paths, validations)
      methods: {//        auth: {
        //            public: true,
        //            path: '/a/b',
        //            validations: {},
        //            data: {
        //                user: '',
        //                pass: '',
        //            },
        ////            method: {}, if I dont set it, it will use a generic one
        //            
        //        },
        //        _sample: Sample
        //        _sample: {
        //            path: '/a/b',
        //            validations: {}
        //        }
      },

      //  default method applying JWT Auth
      //  might be necessary to overwrite it
      setAuthHeader(o) {
        if (!this.tokenField) {
          return BackboneApi.dataError('tokenField is not set');
        }

        o.headers.Authorization = 'Bearer ' + this.data[this.auth][this.tokenField];
        return o;
      },

      initialize(p, o = {}) {
        this.setRouterParameters(o.req, o.res);
        this.options = _.defaults(_.omit(o, 'req', 'res'), {
          autoexec: true
        });
        this.data = {};
        typeof this.options.method === 'string' && (this.options.method = [this.options.method]);
        this.options.autoexec && this.execAll();
      },

      execAll() {
        !this._methodsExecution && (this._methodsExecution = _.clone(this.options.method));

        if (_.size(this._methodsExecution) === 0) {
          this._methodsExecution = null;

          _.bind(this.options.success, this)();

          return;
        } //        


        var method = this._methodsExecution.shift();

        this.exec(method, () => this.execAll(), this.options.error);
      },

      exec(method, success, error) {
        //        !method && (method = this.options.method);
        var methodData = this.methodData(method);
        var vErr = this.validate(this.getMethodInput(methodData), {
          methodData: methodData
        });

        if (vErr !== null) {
          return this.validationErrors(vErr);
        }

        var fn = _.bind(this.callApi, this),
            calledFn = _.partial(fn, method, methodData, success, error); // if there's no authorization needed fn is called


        if (methodData.public) {
          return calledFn();
        } else if (!this.auth) {
          return BackboneApi.dataError(`method "${method}" is not set as public but auth is not set`);
        }

        return this.exec(this.auth, calledFn);
      },

      // used to call api and trigger callbacks accordingly
      callApi(method, methodData, success, error) {
        this.setApiCall(methodData);
        var o = {
          method: methodData.method,
          data: this.getMethodInput(methodData),
          headers: _.result2(methodData, 'headers', {}, [methodData], this)
        };

        if (!methodData.public) {
          o = this.setAuthHeader(o);
        }

        var before = _.bind(typeof methodData.before === 'function' ? methodData.before : (c, _o) => {
          c(_o);
        }, this),
            save = _.bind(_.partial((_method, _methodData, _success, _error, _o) => {
          this.listenToOnce(this, 'sync', _.bind(() => {
            this.data[_method] = this.attributes;
            this.attributes = {};

            try {
              typeof _methodData.success === 'function' && _.bind(_methodData.success, this)(_o, this._req.body, _methodData);
              typeof _success === 'function' && _.bind(_success, this)(_o, this._req.body, _methodData);
            } catch (e) {
              // console.error('Internal Failure');
              // console.error(e);
              this._res.status(500).send({
                message: 'Internal Failure'
              });
            }
          }, this));
          this.listenToOnce(this, 'error', _.bind(() => {
            // !this._reqErr.response && console.error('Internal Failure');
            try {
              typeof _methodData.error === 'function' && _.bind(_methodData.error, this)(this._reqErr.response, _o, this._req.body, _methodData);
              typeof _error === 'function' ? _.bind(_error, this)(this._reqErr.response || null, _o, this._req.body, _methodData) : !this._res._headerSent && this._res.status(this._reqErr.response ? this._reqErr.response.status : 500).send(this._reqErr.response ? this._reqErr.response.data : null);
            } catch (e) {
              // console.error('Internal Failure');
              // console.error(e);
              this._res.status(500).send({
                message: 'Internal Failure'
              });
            }
          }, this));
          this.save(null, _o);
        }, method, methodData, success, error), this);

        try {
          before(save, o);
        } catch (e) {
          // console.error('Internal Failure');
          // console.log(e);
          this._res.status(500).send({
            message: 'Internal Failure'
          });
        }
      },

      test: false,

      // getter for methods data. ensure data for method asked is set
      methodData(method) {
        if (!method || !_.result(this, 'methods')[method]) {
          return BackboneApi.dataError('Make sure you\'ve set your method and it\'s data');
        }

        var methodData = _.result(this, 'methods')[method] || {};

        if (!methodData.path) {
          BackboneApi.dataError('Make sure you\'ve set a path for method ' + method + '\'');
        }

        methodData = this.setHttpMethod(methodData);
        return methodData;
      },

      // get HTTP method from method configuration. if needed set a default HTTP method accordingly to method data input
      setHttpMethod(methodData) {
        var data = this.getMethodInput(methodData);
        methodData = _.defaults(methodData, {
          method: typeof data === 'object' && _.size(data) > 0 ? 'POST' : 'GET'
        });
        methodData.method = methodData.method.toUpperCase();
        return methodData;
      },

      // get "data" from method configuration (can be an object or function) or req.body instead
      getMethodInput(methodData) {
        return _.result2(methodData, 'data', this._req.body || {}, [_.clone(this._req.body), methodData], this);
      },

      // replaces common behavior of backbone to ensure no id nonwanted will be added in Api URLs
      url() {
        return _.result(this, 'urlRoot') || _.result(this.collection, 'url') || BackboneApi.urlError();
      },

      // set asked method data for the request to be executed
      setApiCall(methodData) {
        this.setApiUrl(methodData.path, methodData);
      },

      // merge urlHost with the correct path for method asked. also render path as a template to make possible having attributes on it
      setApiUrl(path, methodData) {
        var host = _.result(this, 'urlHost') || BackboneApi.urlError(1),
            data = _.extend({}, _.clone(this.data), {
          _model: this,
          _input: this.getMethodInput(methodData),
          _params: this._req.params
        }),
            pathfix = new RegExp('((?<!\:)\/{1,})', 'g');

        path = _.template(path)(data);
        return this.urlRoot = [host, path].join('/').replace(pathfix, '/');
      },

      sync(method, model, options) {
        method = methodMap[options.method];
        var args = [method, model, options];
        return BackboneRequest.sync.apply(this, args);
      },

      validations(a, o) {
        var vl = _.result2(o.methodData, 'validations', {}, [a, o], this);

        return vl;
      },

      _validate() {
        return true;
      },

      validationErrors(err) {
        this._res.status(400).send({
          title: 'Invalid Data',
          errors: err
        });
      },

      setRouterParameters(req, res) {
        if (!req || !res) {
          BackboneApi.dataError('Initialize requires an object with req and res (express route variables) within');
        }

        this._req = req;
        this._res = res;
      }

    };

    _.map(['Model', 'Collection'], x => {
      BackboneApi[x] = BackboneRequest[x].extend(_.extend(_.clone(v), extended));
    }); // Throw an error when a URL is needed, and none is supplied.


    BackboneApi.urlError = function (code) {
      if (code === 2) {
        BackboneApi.dataError('A "path" property must be specified in methods list for the current method');
      }

      BackboneApi.dataError('A "urlHost" property or function must be specified');
    }; // Throw an error when some DATA is needed, and none is supplied.


    BackboneApi.dataError = function (msg) {
      throw new Error(msg);
    }; // Map from CRUD to HTTP for our default `Backbone.sync` implementation.


    var methodMap = {
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'patch',
      'DELETE': 'delete',
      'GET': 'read'
    };

    exports.default = BackboneApi;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=backbone-api-99xp.js.map
