const path = require("path");
const rspack = require("@rspack/core");
const mode = process.env.NODE_ENV || "development";
const minimize = mode === "production";

module.exports = {
  mode,
  devtool: "source-map",
  entry: {
    index: [
      path.resolve(__dirname, "index.js"),
      path.resolve(__dirname, "index.scss"),
    ],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    library: "StandardTheme",
    libraryTarget: "umd",
  },
  externals: {
    osjs: "OSjs",
  },
  optimization: {
    minimize,
  },
  plugins: [
    new rspack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify(mode),
      },
    }),
    new rspack.CssExtractRspackPlugin({
      filename: "[name].css",
    }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: "metadata.json" }],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          "css-loader",
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                silenceDeprecations: ["legacy-js-api"],
              },
            },
          },
        ],
      },
      {
        test: /\.js$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "ecmascript",
              },
            },
          },
        },
      },
    ],
  },
};
