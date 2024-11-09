const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  mode: 'production',
  entry: {
    content: './src/content/content.ts',
    background: './src/background/background.ts',
    window: './src/ui/window.ts',
    helpers: './src/utils/helpers.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
    environment: {
      arrowFunction: true,
      const: true,
      destructuring: true,
      module: true
    }
  },
  resolve: {
    extensions: ['.ts', '.js', '.css']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'ES2015'
              }
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'styles/[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/assets', to: 'assets' },
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/ui/window.html', to: 'window.html' }
      ]
    })
  ],
  optimization: {
    splitChunks: false
  },
  devtool: 'source-map'
};

module.exports = config; 