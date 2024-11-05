const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/scripts/background.js',
    content: './src/scripts/content.js',
    // Add other entry points as needed
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      // Add loaders for other file types (e.g., CSS, images) as needed
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  // Add plugins and other configurations as needed
}; 