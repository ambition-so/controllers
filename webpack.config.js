const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: ['./index.js'],
  devtool: 'inline-source-map',
  output: {
    path: path.join(__dirname, '/'),
    filename: 'index.js',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test: /\.ts$|\.tsx$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
        },
      },
      {
        test: /\.ejs$/,
        loader: 'ejs-loader',
      },
      {
        test: /\.(svg|gif|png|eot|woff|ttf)$/,
        use: 'url-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx'],
    fallback: {
      assert: false,
      buffer: require.resolve('buffer'),
    },
    alias: {
      config: `${__dirname}/src/config`,
      core: `${__dirname}/src/core`,
      ethereum: `${__dirname}/src/ethereum`,
      solana: `${__dirname}/src/solana`,
      controllers: `${__dirname}/src/controllers`,
      abis: `${__dirname}/src/abis`,
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
};
