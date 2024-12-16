# Notion MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with Notion. This server enables LLMs to interact with your Notion workspace through standardized tools for searching, reading, creating, and updating pages.

## Features

- 🔍 **Search Pages**: Search through your Notion workspace
- 📖 **Read Pages**: Retrieve content from any Notion page
- ✍️ **Create Pages**: Create new pages with titles and content
- 🔄 **Update Pages**: Append or modify content in existing pages

## Prerequisites

- Node.js (v16 or higher)
- A Notion account and API key
- MCP-compatible client (e.g., Claude Desktop)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/v-3/notion-server.git
cd notion-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
NOTION_API_KEY=your_notion_api_key_here
```

4. Build the server:
```bash
npm run build
```

## Usage with Claude Desktop

1. Add the server to your Claude Desktop configuration (`claude_desktop_config.json`):
```json
{
    "mcpServers": {
        "notion": {
            "command": "node",
            "args": ["/absolute/path/to/notion-server/build/index.js"],
            "env": {
                "NOTION_API_KEY": "your_notion_api_key_here"
            }
        }
    }
}
```

2. Restart Claude Desktop

3. The following tools will be available:
- `search_pages`: Search for Notion pages
- `read_page`: Read content from a specific page
- `create_page`: Create a new page
- `update_page`: Update an existing page

## Available Tools

### search_pages
Search through your Notion pages.
```typescript
{
    query: string // Search query
}
```

### read_page
Read the content of a specific Notion page.
```typescript
{
    pageId: string // ID of the page to read
}
```

### create_page
Create a new Notion page.
```typescript
{
    title: string,      // Page title
    content: string,    // Page content in markdown format
    parentPageId?: string // Optional parent page ID
}
```

### update_page
Update an existing Notion page.
```typescript
{
    pageId: string,   // ID of the page to update
    content: string,  // New content to append
    type?: "paragraph" | "task" | "todo" | "heading" | "image" // Optional content type
}
```

## Security Considerations

- Store your Notion API key securely
- The server has read and write access to your Notion workspace
- Consider implementing additional access controls based on your needs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.