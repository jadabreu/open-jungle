import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { Configuration } from 'webpack';

const config: Configuration = {
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    window: './src/ui/window.ts',
    sidepanel: './src/ui/sidepanel.ts',
    helpers: './src/utils/helpers.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'styles/[name].css'
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: 'src/manifest.json',
          to: 'manifest.json'
        },
        {
          from: 'src/ui/window.html',
          to: 'window.html'
        },
        {
          from: 'src/ui/sidepanel.html',
          to: 'sidepanel.html'
        },
        {
          from: 'src/assets',
          to: 'assets'
        }
      ]
    })
  ],
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  }
};

export default config; 