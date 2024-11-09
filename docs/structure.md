# Project Structure

open-jungle/
├── .github/
│ └── workflows/
│ └── ci.yml # GitHub Actions workflow for CI/CD
├── dist/ # Both build artifacts and distribution-ready files
├── src/ # Source files
│ ├── assets/ # Images, icons, and other static assets
│ ├── background/ # Background scripts
│ │ ├── background.ts
│ │ └── utils.ts # Utility functions for background scripts
│ ├── content/ # Content scripts
│ │ ├── content.ts
│ │ └── utils.ts # Utility functions for content scripts
│ ├── ui/ # UI and related scripts
│ │ ├── window.html
│ │ ├── window.ts
│ │ └── styles.css
│ ├── options/ # Options page and related scripts
│ │ ├── options.html
│ │ ├── options.ts
│ │ └── styles.css
│ ├── components/ # Reusable UI components (if applicable)
│ ├── styles/ # Shared CSS or preprocessor files
│ │ ├── main.css
│ │ └── common.css
│ ├── utils/ # General utility functions
│ │ ├── helpers.ts
│ │ └── extractor.ts
│ ├── types/ # Global type declarations
│ │ └── global.d.ts
│ ├── manifest.json # Chrome extension manifest
│ └── index.ts # Entry point for your extension (if applicable)
├── tests/ # Tests for the project
│ ├── background/ # Tests for background scripts
│ │ └── background.test.ts
│ ├── content/ # Tests for content scripts
│ │ └── content.test.ts
│ ├── utils/ # Tests for utility functions
│ │ └── helpers.test.ts
│ ├── popup/ # Tests for popup UI
│ │ └── window.test.ts
│ └── ... # Additional test files as needed ...
├── docs/ # Documentation files
│ ├── refactor.md
│ ├── README.md
│ ├── store-listing.md
│ ├── REVIEW.md
│ ├── todo.md
│ ├── structure.md
│ └── devGuidelines.md
├── scripts/ # Build and utility scripts
│ ├── build.ts
│ ├── version.ts
│ └── ... # Other scripts
├── .babelrc # Babel configuration
├── .eslintrc.js # ESLint configuration
├── package.json # npm package configuration
├── webpack.config.js # Webpack configuration
├── webpack.config.ts # Webpack configuration
├── tsconfig.json # TypeScript configuration
├── .gitignore # Git ignore file
└── README.md # Project overview and instructions
