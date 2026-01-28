const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const webpack = require('webpack');
const dotenv = require('dotenv');

// Load env vars from .env file AND process.env
const localEnv = dotenv.config().parsed || {};
const mergedEnv = { ...process.env, ...localEnv };

// Extract all REACT_APP_ variables and stringify them for DefinePlugin
const envKeys = Object.keys(mergedEnv)
    .filter(key => key.startsWith('REACT_APP_') || key === 'NODE_ENV')
    .reduce((prev, next) => {
        prev[`process.env.${next}`] = JSON.stringify(mergedEnv[next]);
        return prev;
    }, {});

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    mode: isProduction ? 'production' : 'development',
    entry: {
        background: './src/background/index.ts',
        content: './src/content/index.ts',
        onboarding: './src/pages/onboarding/index.tsx',
        settings: './src/pages/settings/index.tsx',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true,
        publicPath: '', // Fix: Chrome extensions don't support automatic publicPath
    },
    // Disable source maps to prevent CSP violations (no eval allowed in Chrome extensions)
    devtool: false,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    optimization: {
        minimize: isProduction,
        minimizer: isProduction ? [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: true,  // Remove console.log in production
                        drop_debugger: true,
                    },
                    format: {
                        comments: false,  // Remove comments
                    },
                },
                extractComments: false,
            })
        ] : [],
    },
    performance: {
        hints: false,  // Disable bundle size warnings
    },
    stats: {
        warnings: !isProduction,  // Hide warnings in production
        errors: true,
        errorDetails: true,
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
            ],
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/onboarding/onboarding.html',
            filename: 'onboarding.html',
            chunks: ['onboarding'],
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/settings/settings.html',
            filename: 'settings.html',
            chunks: ['settings'],
        }),
        new webpack.DefinePlugin(envKeys)
    ],
};
