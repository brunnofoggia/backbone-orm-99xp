import babel from 'rollup-plugin-babel';
import { eslint } from 'rollup-plugin-eslint';
import json from 'rollup-plugin-json';
import { terser } from 'rollup-plugin-terser';
import { version } from './package.json';

const globals = {
  'backbone': 'Backbone',
  'sequelize': 'Sequelize',
  'underscore-99xp': '_',
  'validate-99xp': 'v',
  'app-exception': 'AppException',
};

const externals = ['backbone', 'sequelize', 'v8n-99xp','validate-99xp','underscore-99xp', 'app-exception'];

const now = new Date();
const year = now.getFullYear();

const banner = `/**
* @license
* backbone-orm 99xp
* ----------------------------------
* v${version}
*
* Copyright (c)${year} Bruno Foggia, 99xp.
* Distributed under MIT license
*
* https://backbone-orm.99xp.org
*/\n\n`;

const footer = '';

export default [
  {
    input: 'src/backbone-orm-99xp.js',
    external: externals,
    output: [
      {
        file: 'lib/backbone-orm-99xp.js',
        format: 'umd',
        name: 'BackboneORM',
        exports: 'named',
        sourcemap: true,
        globals,
        banner,
        footer
      },
      {
        file: 'lib/backbone-orm-99xp.esm.js',
        format: 'es'
      }
    ],
    plugins: [
      eslint({ exclude: ['package.json'] }),
      json(),
      babel()
    ]
  },
  {
    input: 'src/backbone-orm-99xp.js',
    external: externals,
    output: [
      {
        file: 'lib/backbone-orm-99xp.min.js',
        format: 'umd',
        name: 'BackboneORM',
        exports: 'named',
        sourcemap: true,
        globals,
        banner,
        footer
      }
    ],
    plugins: [
      json(),
      babel(),
      terser({ output: { comments: /@license/ }})
    ]
  }
]
