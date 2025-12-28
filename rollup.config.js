const babel = require("@rollup/plugin-babel").default;
const resolve = require("@rollup/plugin-node-resolve").default;
const commonjs = require("@rollup/plugin-commonjs");

const extensions = [".js"];

module.exports = {
  input: "script.js",
  output: {
    file: "dist/script.legacy.js",
    format: "iife",
    name: "SpeedtestAppLegacy",
    sourcemap: true
  },
  plugins: [
    resolve({ extensions }),
    commonjs(),
    babel({
      babelHelpers: "bundled",
      extensions,
      presets: [
        [
          "@babel/preset-env",
          {
            targets: "defaults, not supports es6-module",
            bugfixes: true,
            useBuiltIns: false
          }
        ]
      ]
    })
  ]
};
