import _ from 'underscore';
import Backbone from 'backbone';
import v from 'validate-99xp';

// Backbone ORM is result of fusion between backbone and sequelize to provide a set of functionalities for business model integrated to ORM
var BackboneSequelize = {}; // Extended Functionallity for Models and Collections

var extendedModel = {
  preinitialize() {
    this.setEntity();
  },

  setEntity() {
    var o = _.result(this, 'entityDefinition') || BackboneSequelize.error('Entity Definition not found'),
        conn = this.getConnection();
    return this.entity = conn.isDefined(o[0]) ? conn.model(o[0]) : conn.define(o[0], o[1] || {}, o[2] || {});
  },

  getConnection() {
    return _.result(this, 'conn') || _.result(BackboneSequelize, 'conn') || BackboneSequelize.error('Database connection not set');
  },

  sync(method, model, o) {
    model.trigger('request', method, model, o);
    return this['sync' + _.ucFirst(method)](method, model, o);
  },

  syncRead(method, model, o) {
    if (!this.id) {
      return;
    }

    var success = r => {
      o.success(r.dataValues);
    };

    var error = err => {
      o.error(err);
    };

    return this.entity.findByPk(this.id).then(r => success(r)).catch(err => error(err));
  },

  syncCreate(method, model, o) {
    var success = r => {
      var a = {}; //            var a = r.dataValues;

      a[model.idAttribute] = r['null'];
      o.success(a);
    };

    var error = e => {
      var errors = [];

      for (let x in e.errors) {
        errors.push(e.errors[x].message);
      }

      o.error([errors, e]);
    };

    var attrs = _.omit(this.attributes, this.idAttribute);

    return this.entity.create(attrs).then(r => success(r)).catch(e => error(e));
  },

  syncUpdate(method, model, o) {
    var success = r => {
      o.success(r[0]);
    };

    var error = e => {
      var errors = [];

      for (let x in e.errors) {
        errors.push(e.errors[x].message);
      }

      o.error([errors, e]);
    };

    var attrs = _.omit(this.attributes, this.idAttribute);

    var _o = {
      where: _.pick(this.attributes, this.idAttribute)
    };
    return this.entity.update(attrs, _o).then(r => success(r)).catch(e => error(e));
  },

  validations(a, o) {
    return {};
  },

  validationErrors(err) {
    this._res.status(400).send({
      title: 'Dados inválidos',
      errors: err
    });
  }

};
BackboneSequelize.Model = Backbone.Model.extend(_.extend(_.clone(v), extendedModel));

BackboneSequelize.error = function (msg) {
  throw new Error(msg);
};

export default BackboneSequelize;
