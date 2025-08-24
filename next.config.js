// next.config.js
const webpack = require("webpack");

/** @type {import('next').NextConfig} */
module.exports = {
  webpack: (config) => {
    // Don’t polyfill Node core; explicitly ignore node: URIs
    config.resolve.alias = {
      ...config.resolve.alias,
      "node:fs": false,
      "node:https": false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      https: false,
    };
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^node:(fs|https)$/ })
    );
    return config;
    // If you still ever see UnhandledSchemeError on a different node: module,
    // add it to the regexp above.
  },
};
