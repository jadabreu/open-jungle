const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  mode: 'production',
  entry: {
    content: './src/content/content.ts',
    background: './src/background/background.ts',
    sidepanel: './src/ui/sidepanel.ts',
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
    extensions: ['.tsx', '.ts', '.js', '.css']
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
        {
          from: 'src/ui/sidepanel.html',
          to: 'sidepanel.html',
          transform(content) {
            return content
              .toString()
              .replace(
                '<link rel="stylesheet" href="styles/sidepanel.css">',
                '<link rel="stylesheet" href="styles/sidepanel.css">\n    <link rel="stylesheet" href="styles/common.css">'
              );
          }
        }
      ]
    })
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        styles: {
          name: 'styles',
          type: 'css/mini-extract',
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  devtool: 'source-map'
};

module.exports = config; 