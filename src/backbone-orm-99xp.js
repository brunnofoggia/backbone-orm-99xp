//Backbone ORM is result of fusion between [backbone](https://backbonejs.org) and 
//[sequelize](https://sequelize.org/) to provide a set of functionalities for business models integrated to ORM.
// It includes an integration to provide full featured validations with [validate-99xp](https://github.com/brunnofoggia/validate-99xp)


// Instructions
// --------------

// The array entityDefinition may have 2 or 3 items. Same options would've been passed to sequelize.define
//  1. model name
//  2. model definition
//  3. model options

// Before using models it's mandatory that BackboneORM receives Sequelize connection.
// A good option would be openning a connection before your router were triggered

//     BackboneORM.conn = connection

// Example
// --------------

//     const EntityDefinition = ['test', {
//         /* table columns */
//         id: {
//             type: Sequelize.INTEGER,
//             primaryKey: true
//         },
//         name: Sequelize.STRING,
//         age: Sequelize.INTEGER
//     }, {
//         freezeTableName: true, timestamps: false,
//     }];
//
//     export default bborm.Model.extend({
//         entityDefinition: EntityDefinition,
//         validations: {
//             "age": [[v8n().minLength(1).maxLength(3), 'Invalid Age']]
//         },
//     });

// CODE DOCUMENTED BELOW
// --------------

// --------------

// Baseline setup
// --------------
import _ from 'underscore-99xp';
import Backbone from 'backbone';
import v from 'validate-99xp';

var BackboneORM = {};

// Extended Functionallity for Models and Collections
var extendedModel = {
    // Pré set entity into model instance
    preinitialize() {
        this.setEntity();
    },
    // Load an instance of given class
    setEntity() {
        var o = _.result(this, 'entityDefinition') || (BackboneORM.error('Entity Definition not found')),
            conn = this.getConnection();

        return this.entity = conn.isDefined(o[0]) ?
            conn.model(o[0]) :
            conn.define(o[0], o[1] || {}, o[2] || {});
    },
    // Retrives connection object from this.conn or BackboneORM.conn
    getConnection() {
        return _.result(this, 'conn') || _.result(BackboneORM, 'conn') || (BackboneORM.error('Database connection not set'));
    },
    // Customization that redirect calls accordingly to the method asked (read, create, update, patch, delete)
    sync(method, model, o) {
        model.trigger('request', method, model, o);
        return this['sync' + _.capitalize(method)](method, model, o);
    },
    // Get row
    syncRead(method, model, o) {
        // callbacks for success or error. They trigger Backbone default ones
        var success = r => {
            o.success(r.dataValues);
        };
        var error = err => {
            o.error(err);
        };

        // build where
        var data = {};
        if (this.id) {
            data[this.idAttribute] = this.id;
        } else {
            data = this.attributes;
        }

        // no where no select because this is a model not a collection
        if (!data) {
            return;
        }

        // run select
        return this.entity.findOne({
            where: data
        }).then(r => success(r)).catch(err => error(err));
    },
    // Insert row
    syncCreate(method, model, o) {
        // callbacks for success or error. They trigger Backbone default ones
        var success = (r) => {
            var a = {};
            /*var a = r.dataValues;*/
            a[model.idAttribute] = r['null'];
            o.success(a);
        };
        var error = (e) => {
            var errors = [];
            for (let x in e.errors) {
                errors.push(e.errors[x].message);
            }

            o.error([errors, e]);
        };

        // remove pk from attributes that will be updated
        var attrs = _.omit(this.attributes, this.idAttribute);
        // run insert
        return this.entity.create(attrs)
            .then(r => success(r))
            .catch(e => error(e));
    },
    // Update row
    syncUpdate(method, model, o) {
        // callbacks for success or error. They trigger Backbone default ones
        var success = (r) => {
            o.success(r[0]);
        };
        var error = (e) => {
            var errors = [];
            for (let x in e.errors) {
                errors.push(e.errors[x].message);
            }

            o.error([errors, e]);
        };

        // remove pk from attributes that will be updated
        var attrs = _.omit(this.attributes, this.idAttribute);
        // build where
        var _o = {
            where: _.pick(this.attributes, this.idAttribute)
        };
        // run update
        return this.entity.update(attrs, _o)
            .then(r => success(r))
            .catch(e => error(e));
    },
    // Patch row
    syncPatch(method, model, o) {
        return this.syncUpdate(method, model, o);
    },
    // Validations list. See [validate-99xp](https://github.com/brunnofoggia/validate-99xp)
    validations(attrs, options) {
        return {};
    },
    // Dispatcher of validation errors
    validationErrors(err) {
        this._res.status(400).send({
            title: 'Invalid Data',
            errors: err
        });
    },
    // Allows to set a pair of listeners where one turns the other off after being executed.
    // Both parameters are arrays composed like [event, callback]
    once(c1, c2) {
        if (_.isArray(c1) && _.isArray(c2)) {
            this.once(c1[0], _.partial(function (c1, c2) {
                this.off(c2[0], c2[1]);
                var args = _.clone(arguments);
                delete args['0'];
                delete args['1'];
                c1[1].apply(null, args);
            }, c1, c2));

            this.once(c2[0], _.partial(function (c1, c2) {
                this.off(c1[0], c1[1]);
                var args = arguments;
                delete args['0'];
                delete args['1'];
                c2[1].apply(null, args);
            }, c1, c2));
        }

        return _.bind(Backbone.Model.prototype.once, this)(c1, c2);
    }
};

// Extension of Backbone.Model added to custom behaviors
BackboneORM.Model = Backbone.Model.extend(_.extend(_.clone(v), extendedModel));

var extendedCollection = {
    // Pré set entity into collection instance
    preinitialize() {
        this.setModelBase();
        this.setEntity();
    },
    setModelBase() {
        var ModelBase = (this.model ? this.model : BackboneORM.Model.extend());
        this.modelBase = new ModelBase;
    },
    // Load an instance of given class
    setEntity() {
        var o = _.result(this, 'entityDefinition') || _.result(this.modelBase, 'entityDefinition') || BackboneORM.error('Entity Definition not found'),
            conn = this.getConnection();
        return this.entity = conn.isDefined(o[0]) ? conn.model(o[0]) : conn.define(o[0], o[1] || {}, o[2] || {});
    },
    // Retrives connection object from this.conn or BackboneORM.conn
    getConnection() {
        return _.result(this, 'conn') || _.result(this.modelBase, 'conn') || _.result(BackboneORM, 'conn') || BackboneORM.error('Database connection not set');
    },
    // Transform sequelize rows into models
    parse(r, sc, ec) {
        if (_.isArray(r) && _.size(r) > 0) {
            this.add(_.map(r, (row) => {
                return (row.dataValues);
            }));
        }

        sc(this);
    },
    // find all records accordingly to the conditions
    findAll(where = {}, sc, ec) {
        typeof ec !== 'function' && (ec = () => {});

        return this.entity.findAll({
            where: where
        }).then(r => this.parse(r, sc, ec)).catch(err => ec(err));
    },
    // Save all models
    saveAll(sc, ec) {
        var size = this.models.length,
            c = () => {
                if (--size > 0) { return; }
                typeof sc === 'function' && sc(this);
            };
        
        typeof ec !== 'function' && (ec = () => {});
        
        for (var x in this.models) {
            var m = this.models[x];
            m.once(['sync', c], ['error', ec]);
            m.save();
        }
    }
};

BackboneORM.Collection = Backbone.Collection.extend(extendedCollection);


BackboneORM.error = function (msg) {
    throw new Error(msg);
};

export default BackboneORM;
