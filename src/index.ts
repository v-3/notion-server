import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import { z } from "zod";

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Validation schemas
const schemas = {
  notionTitle: z.object({
    type: z.literal('title'),
    title: z.array(z.object({
      plain_text: z.string()
    }))
  }),

  notionPage: z.object({
    id: z.string(),
    url: z.string(),
    properties: z.record(z.union([
      z.object({
        type: z.literal('title'),
        title: z.array(z.object({
          plain_text: z.string()
        }))
      }),
      z.any()
    ]))
  }),

  toolInputs: {
    searchPages: z.object({
      query: z.string(),
    }),
    readPage: z.object({
      pageId: z.string()
    }),
    createPage: z.object({
      title: z.string(),
      content: z.string(),
      parentPageId: z.string().optional(),
    }),
    updatePage: z.object({
      pageId: z.string(),
      content: z.string(),
      type: z.enum(['paragraph', 'task', 'todo', 'heading', 'image']).optional(),
  })
  }
};

// Tool definitions
const TOOL_DEFINITIONS = [
  {
    name: "search_pages",
    description: "Search through Notion pages",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "read_page",
    description: "Read the content of a Notion page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "ID of the page to read",
        }
      },
      required: ["pageId"],
    }
  },
  {
    name: "create_page",
    description: "Create a new Notion page",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Page title",
        },
        content: {
          type: "string",
          description: "Page content in markdown format",
        },
        parentPageId: {
          type: "string",
          description: "Optional parent page ID",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_page",
    description: "Update an existing Notion page",
    inputSchema: {
        type: "object",
        properties: {
            pageId: {
                type: "string",
                description: "ID of the page to update",
            },
            content: {
                type: "string",
                description: "New content to append",
            },
            type: {
                type: "string",
                enum: ["paragraph", "task", "todo", "heading", "image"],
                description: "Type of content to append",
                optional: true,
            }
        },
        required: ["pageId", "content"],
    },
}
];

// Tool implementation handlers
const toolHandlers = {
  async search_pages(args: unknown) {
    const { query } = schemas.toolInputs.searchPages.parse(args);
    console.error(`Searching for: ${query}`);

    const response = await notion.search({
      query,
      filter: { property: "object", value: "page" },
      page_size: 10
    });

    if (!response.results || response.results.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No pages found matching "${query}"`
        }]
      };
    }

    const formattedResults = response.results.map((page: any) => {
      let title = 'Untitled';
      try {
        if (page.properties) {
          const titleProperty = page.properties.title || page.properties.Name;
          if (titleProperty?.title?.[0]?.plain_text) {
            title = titleProperty.title[0].plain_text;
          }
        }
      } catch (e) {
        console.error('Error extracting title:', e);
      }

      return `• ${title}\n  Link: ${page.url}`;
    }).join('\n\n');

    return {
      content: [{
        type: "text" as const,
        text: `Found ${response.results.length} pages matching "${query}":\n\n${formattedResults}`
      }]
    };
  },

  async read_page(args: unknown) {
    const { pageId } = schemas.toolInputs.readPage.parse(args);

    const [blocksResponse, pageResponse] = await Promise.all([
      notion.blocks.children.list({ block_id: pageId }),
      notion.pages.retrieve({ page_id: pageId })
    ]);

    const page = schemas.notionPage.parse(pageResponse);
    
    // Get title
    const titleProp = Object.values(page.properties).find(
      prop => prop.type === 'title'
    );
    const title = titleProp?.type === 'title' 
      ? titleProp.title[0]?.plain_text || 'Untitled'
      : 'Untitled';

    // Convert blocks to text content
    const content = blocksResponse.results.map((block: any) => {
      const type = block.type;
      const textContent = block[type]?.rich_text
        ?.map((text: any) => text.plain_text)
        .join('') || '';

      switch (type) {
        case 'paragraph':
        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
          return textContent + '\n';
        case 'bulleted_list_item':
        case 'numbered_list_item':
          return '• ' + textContent + '\n';
        case 'to_do':
          const checked = block.to_do?.checked ? '[x]' : '[ ]';
          return checked + ' ' + textContent + '\n';
        case 'code':
          return '```\n' + textContent + '\n```\n';
        default:
          return '';
      }
    }).join('\n');

    return {
      content: [{
        type: "text" as const,
        text: `# ${title}\n\n${content}`
      }]
    };
  },

  async update_page(args: unknown) {
    const { pageId, content: newContent, type = 'paragraph' } = schemas.toolInputs.updatePage.parse(args);
    
    // Verify page exists
    await notion.blocks.children.list({ block_id: pageId });

    // Helper to create blocks array based on content type and handle multiple lines
    const createBlocks = (content: string, type: string): any[] => {
        // Split content by newlines to handle multiple lines
        const contentLines = content.split('\n').filter(line => line.trim());
        
        return contentLines.map(line => {
            switch(type) {
                case 'task':
                case 'todo':
                    return {
                        object: 'block',
                        type: 'to_do',
                        to_do: {
                            rich_text: [{
                                type: 'text',
                                text: { content: line }
                            }],
                            checked: false
                        }
                    };
                case 'heading':
                    return {
                        object: 'block',
                        type: 'heading_1',
                        heading_1: {
                            rich_text: [{
                                type: 'text',
                                text: { content: line }
                            }]
                        }
                    };
                case 'image':
                    return {
                        object: 'block',
                        type: 'image',
                        image: {
                            type: 'external',
                            external: { url: line }
                        }
                    };
                default:
                    return {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{
                                type: 'text',
                                text: { content: line }
                            }]
                        }
                    };
            }
        });
    };

    // Append the new content with appropriate type
    await notion.blocks.children.append({
        block_id: pageId,
        children: createBlocks(newContent, type)
    });

    return {
        content: [{
            type: "text" as const,
            text: `Successfully updated page: ${pageId}`
        }]
    };
}
};

// Initialize MCP server
const server = new Server(
  {
    name: "notion-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("Tools requested by client");
  return { tools: TOOL_DEFINITIONS };
});

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;
  
  try {
    const handler = toolHandlers[name as keyof typeof toolHandlers];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    return await handler(args);
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    throw error;
  }
});

// Start the server
async function main() {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY environment variable is required");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Notion MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});