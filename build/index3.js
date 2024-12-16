import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import { z } from "zod"; // For input validation;
// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});
// Initialize MCP server
const server = new Server({
    name: "notion-server",
    version: "1.0.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Define schemas for Notion responses
const NotionTitleSchema = z.object({
    type: z.literal('title'),
    title: z.array(z.object({
        plain_text: z.string()
    }))
});
const NotionPageSchema = z.object({
    id: z.string(),
    url: z.string(),
    properties: z.record(z.union([NotionTitleSchema, z.any()]))
});
const NotionBlockTextSchema = z.object({
    plain_text: z.string()
});
const NotionBlockSchema = z.object({
    type: z.string(),
    paragraph: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    })),
    heading_1: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    })),
    heading_2: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    })),
    heading_3: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    })),
    bulleted_list_item: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    })),
    numbered_list_item: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    })),
    to_do: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema),
        checked: z.boolean()
    })),
    code: z.optional(z.object({
        rich_text: z.array(NotionBlockTextSchema)
    }))
});
// Define validation schemas for tool inputs
const SearchPagesSchema = z.object({
    query: z.string(),
});
const CreatePageSchema = z.object({
    title: z.string(),
    content: z.string(),
    parentPageId: z.string().optional(),
});
const UpdatePageSchema = z.object({
    pageId: z.string(),
    content: z.string(),
});
const ReadPageInputSchema = z.object({
    pageId: z.string()
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Tools requested by client");
    const tools = [
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
                        description: "New page content in markdown format",
                    },
                },
                required: ["pageId", "content"],
            },
        },
    ];
    console.error(`Returning ${tools.length} tools`);
    return { tools };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "search_pages": {
                try {
                    const { query } = SearchPagesSchema.parse(args);
                    console.error(`Searching for: ${query}`);
                    const response = await notion.search({
                        query,
                        filter: { property: "object", value: "page" },
                        page_size: 10 // Limit results for better manageability
                    });
                    // Log the raw response for debugging
                    console.error('Response structure:', JSON.stringify(response, null, 2));
                    if (!response.results || response.results.length === 0) {
                        return {
                            content: [{
                                    type: "text",
                                    text: `No pages found matching "${query}"`
                                }]
                        };
                    }
                    const formattedResults = response.results.map((page) => {
                        let title = 'Untitled';
                        // Try to extract title, handling different possible structures
                        try {
                            if (page.properties) {
                                const titleProperty = page.properties.title || page.properties.Name;
                                if (titleProperty?.title?.[0]?.plain_text) {
                                    title = titleProperty.title[0].plain_text;
                                }
                            }
                        }
                        catch (e) {
                            console.error('Error extracting title:', e);
                        }
                        return `• ${title}\n  Link: ${page.url}`;
                    }).join('\n\n');
                    return {
                        content: [{
                                type: "text",
                                text: `Found ${response.results.length} pages matching "${query}":\n\n${formattedResults}`
                            }]
                    };
                }
                catch (error) {
                    console.error('Search error:', error);
                    return {
                        content: [{
                                type: "text",
                                text: `Error searching Notion: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                    };
                }
            }
            case "read_page": {
                try {
                    const { pageId } = ReadPageInputSchema.parse(args);
                    const blocksResponse = await notion.blocks.children.list({
                        block_id: pageId
                    });
                    const pageResponse = await notion.pages.retrieve({
                        page_id: pageId
                    });
                    const page = NotionPageSchema.parse(pageResponse);
                    const blocks = z.array(NotionBlockSchema).parse(blocksResponse.results);
                    // Get title
                    const titleProp = Object.values(page.properties).find(prop => prop.type === 'title');
                    const title = titleProp?.type === 'title'
                        ? titleProp.title[0]?.plain_text || 'Untitled'
                        : 'Untitled';
                    // Process blocks
                    const content = blocks.map(block => {
                        const type = block.type;
                        switch (type) {
                            case 'paragraph':
                            case 'heading_1':
                            case 'heading_2':
                            case 'heading_3':
                                return block[type]?.rich_text
                                    .map(text => text.plain_text)
                                    .join('') + '\n';
                            case 'bulleted_list_item':
                            case 'numbered_list_item':
                                return '• ' + block[type]?.rich_text
                                    .map(text => text.plain_text)
                                    .join('') + '\n';
                            case 'to_do':
                                if (block.to_do) {
                                    const checked = block.to_do.checked ? '[x]' : '[ ]';
                                    return checked + ' ' + block.to_do.rich_text
                                        .map(text => text.plain_text)
                                        .join('') + '\n';
                                }
                                return '';
                            case 'code':
                                if (block.code) {
                                    return '```\n' + block.code.rich_text
                                        .map(text => text.plain_text)
                                        .join('') + '\n```\n';
                                }
                                return '';
                            default:
                                return '';
                        }
                    }).join('\n');
                    return {
                        content: [{
                                type: "text",
                                text: `# ${title}\n\n${content}`
                            }]
                    };
                }
                catch (error) {
                    console.error('Read error:', error);
                    return {
                        content: [{
                                type: "text",
                                text: `Error reading page: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                    };
                }
            }
            case "update_page": {
                const { pageId, content: newContent } = UpdatePageSchema.parse(args);
                try {
                    // First, get existing blocks to check if page exists
                    const existingBlocks = await notion.blocks.children.list({
                        block_id: pageId
                    });
                    // Verify the page exists by trying to access the blocks
                    if (!existingBlocks) {
                        return {
                            content: [{
                                    type: "text",
                                    text: `Error: Page with ID ${pageId} not found`
                                }]
                        };
                    }
                    // Define blocks with proper typing for Notion API
                    // Append the new content blocks
                    await notion.blocks.children.append({
                        block_id: pageId,
                        children: [
                            {
                                object: 'block',
                                type: 'divider',
                                divider: {}
                            },
                            {
                                object: 'block',
                                type: 'paragraph',
                                paragraph: {
                                    rich_text: [{
                                            type: 'text',
                                            text: {
                                                content: `Updated on ${new Date().toLocaleString()}`
                                            },
                                            annotations: {
                                                italic: true,
                                                color: 'gray'
                                            }
                                        }]
                                }
                            },
                            {
                                object: 'block',
                                type: 'paragraph',
                                paragraph: {
                                    rich_text: [{
                                            type: 'text',
                                            text: {
                                                content: newContent
                                            }
                                        }]
                                }
                            }
                        ]
                    });
                    return {
                        content: [{
                                type: "text",
                                text: `Successfully appended new content to page: ${pageId}`
                            }]
                    };
                }
                catch (error) {
                    console.error("Error updating page:", error);
                    return {
                        content: [{
                                type: "text",
                                text: `Error updating page: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                    };
                }
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        console.error("Tool execution error:", error);
        throw error;
    }
});
// List available resources (Notion pages)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const response = await notion.search({
        filter: { property: "object", value: "page" },
    });
    return {
        resources: response.results.map((page) => ({
            uri: `notion://page/${page.id}`,
            name: page.properties?.title?.title[0]?.text?.content || "Untitled",
            description: `Notion page: ${page.url}`,
            mimeType: "text/plain",
        })),
    };
});
// Read resource content (page content)
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const pageId = request.params.uri.split("/").pop();
    if (!pageId) {
        throw new Error("Invalid resource URI");
    }
    // Get page content
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    // Convert blocks to text
    const content = blocks.results
        .map((block) => {
        if (block.type === "paragraph") {
            return block.paragraph.rich_text?.[0]?.text?.content || "";
        }
        return "";
    })
        .join("\n");
    return {
        contents: [
            {
                uri: request.params.uri,
                mimeType: "text/plain",
                text: content,
            },
        ],
    };
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
