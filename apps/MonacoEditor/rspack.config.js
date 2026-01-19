const path = require("path");
const rspack = require("@rspack/core");
const mode = process.env.NODE_ENV || "development";
const minimize = mode === "production";

module.exports = {
    mode,
    devtool: "source-map",
    entry: {
        main: [
            path.resolve(__dirname, "index.js"),
        ],
        "editor.worker": 'monaco-editor/esm/vs/editor/editor.worker.js',
        "json.worker": 'monaco-editor/esm/vs/language/json/json.worker',
        "css.worker": 'monaco-editor/esm/vs/language/css/css.worker',
        "html.worker": 'monaco-editor/esm/vs/language/html/html.worker',
        "ts.worker": 'monaco-editor/esm/vs/language/typescript/ts.worker',
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
        library: "MonacoEditor",
        libraryTarget: "umd",
    },
    externals: {
        osjs: "OSjs",
    },
    optimization: {
        minimize,
    },
    plugins: [
        new rspack.CssExtractRspackPlugin({
            filename: "[name].css",
        }),
        new rspack.CopyRspackPlugin({
            patterns: [
                { from: "icon.svg" }
            ]
        }),
    ],
    module: {
        rules: [
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
            {
                test: /\.css$/,
                use: [
                    rspack.CssExtractRspackPlugin.loader,
                    "css-loader"
                ]
            },
            {
                test: /\.ttf$/,
                type: 'asset/resource'
            }
        ],
    },
};
