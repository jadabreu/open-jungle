# Coding Guidelines

## Naming Conventions

- **Variables & Functions:** Use `camelCase` (e.g., `extractData`, `validatePage`).
- **Classes & Components:** Use `PascalCase` (e.g., `WindowManager`, `ForecastUIHandler`).
- **Constants:** Use `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `API_ENDPOINT`).

## Language

- **TypeScript:** Prefer TypeScript over JavaScript for type safety and better developer experience.
- **Type Annotations:** Ensure all variables, function parameters, and return types are appropriately typed.
- **Interfaces & Types:** Utilize interfaces and type aliases to define clear data structures.

## Code Style

- **Indentation:** Use 2 spaces for indentation.
- **Line Length:** Limit lines to 100 characters for readability.
- **Semicolons:** Omit semicolons; rely on ASI (Automatic Semicolon Insertion).
- **Quotes:** Use single quotes for strings unless double quotes are necessary.

## Best Practices

- **Single Responsibility Principle:** Each module or class should have one responsibility.
- **DRY (Don't Repeat Yourself):** Avoid code duplication by abstracting reusable logic.
- **Error Handling:** Implement comprehensive error handling and logging.
- **Comments:** Write descriptive comments for complex logic and public APIs using JSDoc.

## General Design Principles

- **Modularity:** Structure your code into well-defined, independent modules to enhance maintainability and scalability.
- **Separation of Concerns:** Isolate different functionalities (e.g., UI, data processing, utility functions) to reduce interdependencies and improve clarity.
- **Clear Interface Definitions:** Define clear and consistent interfaces between modules to facilitate easier integration and testing.
- **Consistent Architecture:** Adhere to a consistent architectural pattern (e.g., MVC, MVVM) throughout the project to streamline development and collaboration.

## Centralized Script Injection

- **Unified Injection Mechanism:** Handle all script injections through a centralized module to ensure consistency and reduce redundancy across the codebase.

## Centralized Error Handling

- **Standardized Error Management:** Use a centralized error handling service or utility to standardize how errors are caught, logged, and reported across different parts of the application.

## Event Listener Management

- **Efficient Listener Setup:** Consolidate event listeners into centralized modules and utilize event delegation where applicable to minimize the number of active listeners, enhancing performance and reducing potential conflicts.

## Build and Deployment Process

- **Automated Build Tools:** Utilize tools like Webpack to automate the build process, including bundling, transpiling, minification, and asset management. This ensures scalability and efficient handling of complex dependencies.

## Configurable Constants

- **Avoid Magic Numbers:** Replace hard-coded values with configurable constants defined in configuration files or environment variables to improve flexibility and readability.

## CSS Structure and Naming

- **BEM Methodology:** Implement BEM (Block Element Modifier) naming conventions for CSS classes to create predictable and maintainable stylesheets.
- **Preprocessors:** Consider using SCSS or similar preprocessors to leverage variables, nesting, and mixins for more organized and reusable CSS.

## Automated Testing

- **Testing Frameworks:** Integrate testing frameworks such as Jest for unit and integration testing to ensure functionality remains consistent and to facilitate safer refactoring.
- **Test Coverage:** Aim for comprehensive test coverage to catch potential issues early in the development process.

## Modern JavaScript Practices

- **ES6+ Features:** Utilize modern JavaScript features like `const`, `let`, arrow functions, destructuring, and async/await to write more efficient and readable code.
- **Immutable Data Structures:** Prefer immutable data patterns to prevent unintended side-effects and enhance predictability.

## Documentation and Code Comments

- **Comprehensive Documentation:** Expand inline comments to explain complex logic and workflows. Maintain detailed documentation in the `docs/` directory covering code structure, workflows, and component interactions.
- **API Documentation:** Use tools like JSDoc to generate and maintain up-to-date API documentation for all public interfaces.

## Git Practices

- **Commit Messages:** Use clear and descriptive commit messages. Follow the [Conventional Commits](https://www.conventionalcommits.org/) standard.
- **Branching Workflow:** Follow the Gitflow workflow:
  - `main` branch for production-ready code.
  - `develop` branch for integration.
  - Feature branches off `develop` for individual features.
- **Pull Requests:** Include a descriptive title and summary. Link to relevant issues.

## Code Reviews

- **Peer Reviews:** All code must be reviewed by at least one other team member before merging.
- **Constructive Feedback:** Provide actionable feedback focusing on code quality, readability, and performance during reviews.
