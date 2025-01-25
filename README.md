# Notion MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with Notion, featuring enhanced markdown support, comprehensive database operations, and improved error handling.

## Features

### Enhanced Markdown Support
- Headings (h1, h2, h3)
- Code blocks with language support
- Todo items with checkbox states (- [ ] and - [x])
- Blockquotes with multi-line support
- Dividers
- Images with captions
- Nested bullet points

### Comprehensive Database Support
- Create and manage databases
- Create database items with proper property handling
- Query databases with filters and sorting
- Update database items and properties
- Support for various property types:
  - Title
  - Rich text
  - Number
  - Select
  - Multi-select
  - Date
  - Checkbox

### Page Operations
- Search through your Notion workspace
- Create pages with markdown content
- Read page content with clean formatting
- Update existing pages
- Add and retrieve comments
- Block-level operations (update, delete)

### Error Handling
- Detailed error messages with API response details
- Proper validation of input parameters
- Enhanced debugging information

## Prerequisites

- Node.js (v16 or higher)
- A Notion API key
- MCP-compatible client (e.g., Claude Desktop)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/sweir1/notion-server.git
cd notion-server
```

2. Install dependencies:
```bash
npm install
```

3. Set your Notion API key:
```bash
export NOTION_API_KEY=your_notion_api_key_here
```

4. Build the server:
```bash
npm run build
```

## Usage Examples

### Creating a Page
```typescript
const result = await notion.create_page({
  parentPageId: "your_parent_page_id",
  title: "My Page",
  content: "# Welcome\nThis is a test page with markdown support.\n\n## Code Example\n```javascript\nconsole.log('Hello World');\n```"
});
```

### Creating a Database Item
```typescript
const result = await notion.create_page({
  parentPageId: "your_database_id",
  properties: {
    Name: {
      title: [{ text: { content: "My Item" } }]
    },
    Status: {
      select: { name: "In Progress" }
    },
    Priority: {
      number: 1
    }
  },
  content: "# Details\nThis is a database item with properties."
});
```

### Querying a Database
```typescript
const result = await notion.query_database({
  databaseId: "your_database_id",
  filter: {
    property: "Status",
    select: {
      equals: "In Progress"
    }
  },
  sort: {
    property: "Priority",
    direction: "descending"
  }
});
```

## Credits

This is a significantly enhanced fork of [v-3/notion-server](https://github.com/v-3/notion-server) with the following improvements:
- Enhanced markdown support with more block types
- Comprehensive database operations
- Better error handling and debugging
- Improved property handling for database items
- Cleaner page output formatting
