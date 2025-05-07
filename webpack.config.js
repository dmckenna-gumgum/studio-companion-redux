/**************************************************************************
 *  ADOBE CONFIDENTIAL
 *
 *  Copyright 2022 Adobe
 *  All Rights Reserved.
 *
 *  NOTICE:  All information contained herein is, and remains
 *  the property of Adobe and its suppliers, if any. The intellectual
 *  and technical concepts contained herein are proprietary to Adobe
 *  and its suppliers and are protected by all applicable intellectual
 *  property laws, including trade secret and copyright laws.
 *  Dissemination of this information or reproduction of this material
 *  is strictly forbidden unless prior written permission is obtained
 *  from Adobe.
 ***************************************************************************/

"use strict";

import { join, resolve } from "path";

import CopyWebpackPlugin from "copy-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import path from "path";
import { fileURLToPath } from "url";
import { aliases } from "@swc-uxp-wrappers/utils";
console.log('aliases:', aliases); // Add logging to see the actual aliases content
// Import CSS processing plugins
import postcssImport from "postcss-import";
import postcssPresetEnv from "postcss-preset-env";
import cssnano from "cssnano";
import CopyPlugin from 'copy-webpack-plugin'; // Import CopyPlugin

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV = process.argv.find((arg) => arg.includes("NODE_ENV=production"))
  ? "production"
  : "development";
const IS_DEV = ENV === "development";

const IS_DEV_SERVER = process.argv.find((arg) =>
  arg.includes("webpack-dev-server")
);
const OUTPUT_PATH = IS_DEV_SERVER ? resolve("dist") : resolve("dist");

/**
 * === Copy static files configuration
 */
const copyStatics = {
  patterns: [
    {
      from: "index.html",
      context: resolve("./src"),
      to: OUTPUT_PATH,
    },

    {
      from: "manifest.json",
      context: resolve("./"),
      to: OUTPUT_PATH,
    },
  ],
};

/**
 * Plugin configuration
 */
const plugins = [
  new CleanWebpackPlugin(),
  new CopyWebpackPlugin(copyStatics),
  new MiniCssExtractPlugin({ 
    filename: "css/[name].css",
    chunkFilename: "css/[id].css"
  }),
  new CopyPlugin({ // Add CopyPlugin configuration
    patterns: [
      { from: 'src/html', to: 'html' }, // Copy src/html to dist/html
    ],
  }),
];

function srcPath(subdir) {
  return join(__dirname, "src", subdir);
}

const shared = (env) => {
  if (!IS_DEV_SERVER) {
    plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: "static",
        openAnalyzer: false,
        reportFilename: "../report/report.html",
        statsFilename: "../report/stats.json",
        generateStatsFile: true,
        statsOptions: {
          chunkModules: true,
          children: false,
          source: false,
        },
      })
    );
  }

  let cssLoaders = [
    {
      loader: "css-loader",
      options: { importLoaders: 1 },
    },
    {
      loader: "postcss-loader",
      options: {
        postcssOptions: {
          plugins: [
            postcssImport,
            postcssPresetEnv({
              browsers: "last 2 versions",
            }),
            ...(IS_DEV ? [] : [cssnano()]),
          ],
        },
      },
    },
  ];

  return {
    entry: {
      main: [
        path.resolve(__dirname, './polyfill-queueMicrotask.js'),
        './src/index.js',
        './src/css/styles.css'
      ]
    },
    devtool: "cheap-module-source-map",
    mode: ENV,
    externals: {
      photoshop: 'commonjs photoshop',
      uxp:       'commonjs uxp'
    },
    output: {
      path: OUTPUT_PATH,
      filename: "[name].bundle.js",
      publicPath: "",
    },   
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            ...cssLoaders
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name][ext]'
          }
        }
      ],
    },
    resolve: {
      extensions: ['.js', '.mjs', '.json', '...'],
      mainFields: ['browser','module','main'],
      alias: aliases,
    },
    plugins,
    devServer: {
      compress: true,
      port: 3000,
      host: "0.0.0.0",
    },
  };
};

export default (env = {}) => {
  return [shared(env)];
};
