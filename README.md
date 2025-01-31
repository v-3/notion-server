# Notion MCP Server
[![smithery badge](https://smithery.ai/badge/notionmcp)](https://smithery.ai/server/notionmcp)

A Model Context Protocol (MCP) server that provides seamless integration with Notion. This server enables Language Models to interact with your Notion workspace through standardized tools for searching, reading, creating, and updating pages and databases.

## 🌟 Key Features

### Page Operations
- 🔍 Search through your Notion workspace
- 📝 Create new pages with rich markdown content
- 📖 Read page content with clean formatting
- 🔄 Update existing pages
- 💬 Add and retrieve comments
- 🧱 Block-level operations (update, delete)

### Enhanced Markdown Support
- Multiple heading levels (H1-H3)
- Code blocks with language support
- Interactive todo items with checkbox states
- Blockquotes with multi-line support
- Horizontal dividers
- Images with captions
- Nested bullet points

### Database Operations
- Create and manage databases
- Add and update database items
- Query with filters and sorting
- Support for various property types:
  - Title, Rich text, Number
  - Select, Multi-select
  - Date, Checkbox
  - And more!

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Notion API key
- MCP-compatible client (e.g., Claude Desktop)

### Installation

### Installing via Smithery

To install Notion MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/notionmcp):

```bash
npx -y @smithery/cli install notionmcp --client claude
```

### Manual Installation
1. Clone the repository:
```bash
git clone https://github.com/v-3/notion-server.git
cd notion-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment:
```bash
# Create .env file
echo "NOTION_API_KEY=your_notion_api_key_here" > .env

# Or export directly
export NOTION_API_KEY=your_notion_api_key_here
```

4. Build the server:
```bash
npm run build
```

## 🔧 Configuration

### Claude Desktop Setup

1. Update your Claude Desktop configuration (`claude_desktop_config.json`):
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

2. Restart Claude Desktop to apply changes

## 🛠️ Available Tools

### Page Operations
```typescript
// Search pages
{
    query: string // Search query
}

// Read page
{
    pageId: string // ID of the page to read
}

// Create page
{
    title?: string,      // Page title
    content?: string,    // Page content in markdown
    parentPageId: string // Parent page ID
    properties?: object  // For database items
}

// Update page
{
    pageId: string,   // Page ID to update
    content: string,  // New content
    type?: string    // Content type
}
```

### Database Operations
```typescript
// Create database
{
    parentPageId: string,
    title: string,
    properties: object
}

// Query database
{
    databaseId: string,
    filter?: object,
    sort?: object
}
```

## 🔐 Setting Up Notion Access

### Creating an Integration
1. Visit [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Configure permissions:
   - Content: Read, Update, Insert
   - Comments: Read, Create
   - User Information: Read

### Connecting Pages
1. Open your Notion page
2. Click "..." menu → "Connections"
3. Add your integration
4. Repeat for other pages as needed

## 📝 Usage Examples

### Creating a Page
```typescript
const result = await notion.create_page({
  parentPageId: "page_id",
  title: "My Page",
  content: "# Welcome\nThis is a test page."
});
```

### Querying a Database
```typescript
const result = await notion.query_database({
  databaseId: "db_id",
  filter: {
    property: "Status",
    select: {
      equals: "In Progress"
    }
  }
});
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This project has been significantly improved by [sweir1/notion-server](https://github.com/sweir1/notion-server), who has made following updates:
- Enhanced markdown support with more block types
- Comprehensive database operations
- Improved error handling and debugging
- Better property handling for database items
- Cleaner page output formatting

To use sweir1's version, you can clone their repository:
```bash
git clone https://github.com/sweir1/notion-server.git
```
