# Contributing to Notion MCP Server

First off, thank you for considering contributing to the Notion MCP Server! This is an open-source project that helps integrate Notion with Large Language Models through the Model Context Protocol.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct of treating all contributors with respect and maintaining a harassment-free experience for everyone.

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report:
- Check the existing issues to avoid duplicates
- Collect relevant information about the bug
- Use the bug report template below

**Bug Report Template:**
```markdown
**Description**
A clear description of the bug.

**To Reproduce**
Steps to reproduce the behavior:
1. Configure server with '...'
2. Call tool '...'
3. See error

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Environment**
- Node.js version:
- Operating System:
- Notion MCP Server version:
```

### Suggesting Enhancements

When suggesting enhancements:
- Use a clear and descriptive title
- Provide a detailed description of the proposed functionality
- Include examples of how the enhancement would be used

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests if available
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

#### Pull Request Guidelines

- Follow the existing code style
- Update documentation as needed
- Add tests if applicable
- Keep pull requests focused on a single feature or fix

## Development Setup

1. Clone your fork:
```bash
git clone https://github.com/your-username/notion-server.git
cd notion-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
NOTION_API_KEY=your_notion_api_key_here
```

4. Build the project:
```bash
npm run build
```

## Style Guidelines

### TypeScript Style Guide

- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable and function names
- Add appropriate type annotations
- Document complex logic with comments

### Commit Messages

- Use clear and meaningful commit messages
- Start with a verb in the present tense
- Keep the first line under 50 characters
- Add detailed description if needed

Examples:
```
Add page deletion tool
Fix error handling in search_pages
Update documentation for create_page
```

## Adding New Tools

When adding new tools:

1. Define the tool in `TOOL_DEFINITIONS`:
```typescript
{
    name: "tool_name",
    description: "Clear description of what the tool does",
    inputSchema: {
        type: "object",
        properties: {
            // Define input parameters
        },
        required: []
    }
}
```

2. Implement the handler in `toolHandlers`
3. Add appropriate error handling
4. Update documentation
5. Add examples in README.md

## Testing

- Test your changes with different inputs
- Verify error handling
- Test integration with Claude Desktop or other MCP clients
- Document any new test cases added

## Documentation

- Update README.md for new features
- Add JSDoc comments for new functions
- Update type definitions as needed
- Include examples for new functionality

## Questions?

Feel free to open an issue for:
- Help with development
- Questions about contributing
- Clarification on project direction

## License

By contributing, you agree that your contributions will be licensed under the MIT License.