import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import { z } from "zod";

// Initialize Notion client
const notion = new Client({
	auth: process.env.NOTION_API_KEY,
});

// Validation schemas
const schemas = {
	notionTitle: z.object({
		type: z.literal("title"),
		title: z.array(
			z.object({
				plain_text: z.string(),
			}),
		),
	}),

	notionPage: z.object({
		id: z.string(),
		url: z.string(),
		properties: z.record(
			z.union([
				z.object({
					type: z.literal("title"),
					title: z.array(
						z.object({
							plain_text: z.string(),
						}),
					),
				}),
				z.any(),
			]),
		),
	}),

	toolInputs: {
		searchPages: z.object({
			query: z.string(),
		}),
		readPage: z.object({
			pageId: z.string(),
		}),
		createPage: z.object({
			title: z.string().optional(),
			content: z.string().optional(),
			parentPageId: z.string(),
			properties: z.record(z.any()).optional()
		}),
		updatePage: z.object({
			pageId: z.string(),
			content: z.string(),
			type: z.enum([
				"paragraph",
				"heading_1",
				"heading_2",
				"heading_3",
				"bulleted_list_item",
				"numbered_list_item",
				"to_do",
				"image"
			]).optional(),
			mode: z.enum(["replace", "append", "merge"]).default("replace"),  // Add this
			position: z.enum(["start", "end"]).default("end")                 // Add this
		}),
		retrieveDatabase: z.object({
			databaseId: z.string(),
		}),
		updateDatabase: z.object({
			databaseId: z.string(),
			title: z.string().optional(),
			description: z.string().optional(),
			properties: z.record(z.any()).optional(),
		}),
	},

	databaseProperties: z.record(z.union([
		z.object({ title: z.object({}) }),
		z.object({ rich_text: z.object({}) }),
		z.object({ number: z.object({ format: z.string().optional() }) }),
		z.object({
			select: z.object({
				options: z.array(
					z.object({
						name: z.string(),
						color: z.string().optional()
					})
				).optional()
			})
		}),
		z.object({
			multi_select: z.object({
				options: z.array(
					z.object({
						name: z.string(),
						color: z.string().optional()
					})
				).optional()
			})
		}),
		z.object({ date: z.object({}) }),
		z.object({ checkbox: z.object({}) })
	])),
};

// Add this after your schemas
function formatError(error: any): string {
	console.error('Full error:', JSON.stringify(error, null, 2));

	if (error.status === 404) {
		return `Resource not found. Please check the provided ID. Details: ${error.body?.message || error.message}`;
	}
	if (error.status === 401) {
		return `Authentication error. Please check your API token. Details: ${error.body?.message || error.message}`;
	}
	if (error.status === 400) {
		return `Bad request. Details: ${error.body?.message || error.message}`;
	}
	if (error.code) {
		return `API Error (${error.code}): ${error.body?.message || error.message}`;
	}
	return error.body?.message || error.message || "An unknown error occurred";
}

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
		description: "Read a regular page's content (not for databases - use retrieve_database for databases). Shows block IDs with their types (needed for block operations)",
		inputSchema: {
			type: "object",
			properties: {
				pageId: {
					type: "string",
					description: "ID of the page to read",
				},
			},
			required: ["pageId"],
		},
	},
	{
		name: "create_page",
		description: "Create a new page or database item. For database items, include 'properties' matching database schema. For pages, use 'title' and 'content'",
		inputSchema: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Page title (optional)",
				},
				content: {
					type: "string",
					description: "Page content in markdown format (optional)",
				},
				parentPageId: {
					type: "string",
					description: "ID of the parent page where this page will be created",
				},
				properties: {
					type: "object",
					description: "Additional properties for database items (optional)",
				}
			},
			required: ["parentPageId"],
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
				},
				mode: {                                                    // Add this
					type: "string",
					enum: ["replace", "append", "merge"],
					description: "Update mode: replace all content, append to existing, or merge",
					optional: true,
				},
				position: {                                               // Add this
					type: "string",
					enum: ["start", "end"],
					description: "Position for merge mode: start or end",
					optional: true,
				}
			},
			required: ["pageId", "content"],
		},
	},
	{
		name: "retrieve_comments",
		description: "Get all comments from a page",
		inputSchema: {
			type: "object",
			properties: {
				pageId: {
					type: "string",
					description: "ID of the page",
				},
				startCursor: {
					type: "string",
					description: "Pagination cursor",
				},
				pageSize: {
					type: "number",
					description: "Number of comments to retrieve (max 100)",
				},
			},
			required: ["pageId"],
		},
	},
	{
		name: "add_comment",
		description: "Add a comment to a page",
		inputSchema: {
			type: "object",
			properties: {
				pageId: {
					type: "string",
					description: "ID of the page to comment on",
				},
				content: {
					type: "string",
					description: "Comment text",
				},
			},
			required: ["pageId", "content"],
		},
	},
	{
		name: "create_database",
		description: "Create a new database in a page",
		inputSchema: {
			type: "object",
			properties: {
				parentPageId: {
					type: "string",
					description: "ID of the parent page",
				},
				title: {
					type: "string",
					description: "Database title",
				},
				properties: {
					type: "object",
					description: "Database schema properties",
				},
			},
			required: ["parentPageId", "title", "properties"],
		},
	},
	{
		name: "query_database",
		description: "Query a database",
		inputSchema: {
			type: "object",
			properties: {
				databaseId: {
					type: "string",
					description: "ID of the database",
				},
				filter: {
					type: "object",
					description: "Filter conditions",
				},
				sort: {
					type: "object",
					description: "Sort conditions",
				},
			},
			required: ["databaseId"],
		},
	},
	{
		name: "update_block",
		description: "Update a block's content (must use same type as original block, use read_page first to get block IDs and types)",
		inputSchema: {
			type: "object",
			properties: {
				blockId: {
					type: "string",
					description: "ID of the block to update",
				},
				content: {
					type: "string",
					description: "New content for the block",
				},
				type: {
					type: "string",
					enum: [
						"paragraph",
						"heading_1",
						"heading_2",
						"heading_3",
						"bulleted_list_item",
						"numbered_list_item",
					],
					description: "Type of block",
				},
			},
			required: ["blockId", "content"],
		},
	},
	{
		name: "delete_block",
		description: "Delete a specific block from a page",
		inputSchema: {
			type: "object",
			properties: {
				blockId: {
					type: "string",
					description: "ID of the block to delete",
				},
			},
			required: ["blockId"],
		},
	},
	{
		name: "update_database_item",
		description: "Update a database item's properties (use query_database first to see required property structure)",
		inputSchema: {
			type: "object",
			properties: {
				pageId: {
					type: "string",
					description: "ID of the database item (page) to update",
				},
				properties: {
					type: "object",
					description: "Properties to update",
				},
			},
			required: ["pageId", "properties"],
		},
	},
	// Add these to TOOL_DEFINITIONS
	{
		name: "retrieve_database",
		description: "Retrieve a database's metadata",
		inputSchema: {
			type: "object",
			properties: {
				databaseId: {
					type: "string",
					description: "ID of the database to retrieve",
				},
			},
			required: ["databaseId"],
		},
	},
	{
		name: "update_database",
		description: "Update a database's properties",
		inputSchema: {
			type: "object",
			properties: {
				databaseId: {
					type: "string",
					description: "ID of the database to update",
				},
				title: {
					type: "string",
					description: "New title for the database",
				},
				description: {
					type: "string",
					description: "New description for the database",
				},
				properties: {
					type: "object",
					description: "Properties schema to update",
				},
			},
			required: ["databaseId"],
		},
	},
];

// Tool implementation handlers
const toolHandlers = {
	async search_pages(args: unknown) {
		const { query } = schemas.toolInputs.searchPages.parse(args);
		console.error(`Searching for: ${query}`);

		const response = await notion.search({
			query,
			filter: { property: "object", value: "page" },
			page_size: 10,
		});

		if (!response.results || response.results.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: `No pages found matching "${query}"`,
					},
				],
			};
		}

		const formattedResults = response.results
			.map((page: any) => {
				let title = "Untitled";
				try {
					// Extract title from URL
					const urlMatch = page.url.match(/\/([^/]+)-[^/]+$/);
					if (urlMatch) {
						title = decodeURIComponent(urlMatch[1].replace(/-/g, ' '));
					}
					// If no title from URL or it's still "Untitled", try properties
					if (title === "Untitled" && page.properties) {
						const titleProperty = page.properties.title || page.properties.Name;
						if (titleProperty?.title?.[0]?.plain_text) {
							title = titleProperty.title[0].plain_text;
						}
					}
				} catch (e) {
					console.error("Error extracting title:", e);
				}

				return `• ${title}\n  Link: ${page.url}`;
			})
			.join("\n\n");

		return {
			content: [
				{
					type: "text" as const,
					text: `Found ${response.results.length} pages matching "${query}":\n\n${formattedResults}`,
				},
			],
		};
	},

	async read_page(args: unknown) {
		const { pageId } = schemas.toolInputs.readPage.parse(args);

		try {
			const [blocksResponse, pageResponse] = await Promise.all([
				notion.blocks.children.list({ block_id: pageId }),
				notion.pages.retrieve({ page_id: pageId }),
			]);

			const page = schemas.notionPage.parse(pageResponse);

			// Get title
			const titleProp = Object.values(page.properties).find((prop) => prop.type === "title");
			const title = titleProp?.type === "title" ? titleProp.title[0]?.plain_text || "Untitled" : "Untitled";

			// Process blocks and collect child pages/databases
			const childPages: string[] = [];
			const childDatabases: string[] = [];
			const contentBlocks: string[] = [];

			for (const block of blocksResponse.results as Array<{ type: string; id: string;[key: string]: any }>) {
				const type = block.type;

				if (type === "child_page") {
					childPages.push(`📄 ${block.child_page.title || "Untitled Page"} (ID: ${block.id.replace(/-/g, "")})`);
					continue;
				}

				if (type === "child_database") {
					childDatabases.push(`📊 ${block.child_database.title || "Untitled Database"} (ID: ${block.id.replace(/-/g, "")})`);
					continue;
				}

				const textContent = block[type]?.rich_text?.map((text: any) => text.plain_text).join("") || "";
				let formattedContent = "";

				switch (type) {
					case "paragraph":
					case "heading_1":
					case "heading_2":
					case "heading_3":
						formattedContent = textContent;
						break;
					case "bulleted_list_item":
					case "numbered_list_item":
						formattedContent = "• " + textContent;
						break;
					case "to_do":
						const checked = block.to_do?.checked ? "[x]" : "[ ]";
						formattedContent = checked + " " + textContent;
						break;
					case "code":
						formattedContent = "```\n" + textContent + "\n```";
						break;
					default:
						formattedContent = textContent;
				}

				if (formattedContent) {
					contentBlocks.push(formattedContent);
				}
			}

			// Combine all content
			let output = `# ${title}\n\n`;

			if (contentBlocks.length > 0) {
				output += contentBlocks.join("\n") + "\n\n";
			}

			if (childPages.length > 0) {
				output += "## Child Pages\n" + childPages.join("\n") + "\n\n";
			}

			if (childDatabases.length > 0) {
				output += "## Child Databases\n" + childDatabases.join("\n") + "\n";
			}

			return {
				content: [
					{
						type: "text" as const,
						text: output.trim(),
					},
				],
			};
		} catch (error) {
			console.error("Error reading page:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},

	async create_page(args: unknown) {
		const { title, content, parentPageId, properties } = args as any;

		try {
			// First try to retrieve as database to check if it's a database parent
			let isDatabase = false;
			try {
				await notion.databases.retrieve({ database_id: parentPageId });
				isDatabase = true;
			} catch {
				// If not a database, verify it's a valid page
				await notion.pages.retrieve({ page_id: parentPageId });
			}

			// Set up properties based on whether it's a database or page
			const pageProperties = isDatabase ? properties : {
				title: {
					type: "title",
					title: [
						{
							type: "text",
							text: {
								content: title || "",
							},
						},
					],
				}
			};

			// Parse content into blocks
			const parseBlocks = (content: string) => {
				const lines = content.split('\n');
				const blocks: any[] = [];
				let currentCodeBlock: any = null;

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const trimmedLine = line.trim();

					// Handle code blocks
					if (trimmedLine.startsWith('```')) {
						if (currentCodeBlock) {
							// End code block
							blocks.push(currentCodeBlock);
							currentCodeBlock = null;
						} else {
							// Start code block
							const language = trimmedLine.slice(3).trim();
							currentCodeBlock = {
								object: "block",
								type: "code",
								code: {
									rich_text: [],
									language: language || "plain text"
								}
							};
						}
						continue;
					}

					if (currentCodeBlock) {
						// Add line to current code block
						currentCodeBlock.code.rich_text.push({
							type: "text",
							text: { content: line }
						});
						continue;
					}

					// Handle other block types
					let block: any = null;

					if (trimmedLine === '') {
						block = {
							object: "block",
							type: "paragraph",
							paragraph: { rich_text: [] }
						};
					} else if (trimmedLine.startsWith('# ')) {
						block = {
							object: "block",
							type: "heading_1",
							heading_1: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(2) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('## ')) {
						block = {
							object: "block",
							type: "heading_2",
							heading_2: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(3) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('### ')) {
						block = {
							object: "block",
							type: "heading_3",
							heading_3: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(4) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('- [ ] ')) {
						block = {
							object: "block",
							type: "to_do",
							to_do: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(6) }
								}],
								checked: false
							}
						};
					} else if (trimmedLine.startsWith('- [x] ')) {
						block = {
							object: "block",
							type: "to_do",
							to_do: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(6) }
								}],
								checked: true
							}
						};
					} else if (trimmedLine.startsWith('- ')) {
						block = {
							object: "block",
							type: "bulleted_list_item",
							bulleted_list_item: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(2) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('> ')) {
						block = {
							object: "block",
							type: "quote",
							quote: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(2) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('---')) {
						block = {
							object: "block",
							type: "divider",
							divider: {}
						};
					} else if (trimmedLine.match(/^!\[.*\]\(.*\)$/)) {
						// Image in markdown format: ![alt](url)
						const match = trimmedLine.match(/^!\[(.*)\]\((.*)\)$/);
						if (match) {
							block = {
								object: "block",
								type: "image",
								image: {
									type: "external",
									external: { url: match[2] },
									caption: match[1] ? [{
										type: "text",
										text: { content: match[1] }
									}] : []
								}
							};
						}
					} else {
						block = {
							object: "block",
							type: "paragraph",
							paragraph: {
								rich_text: [{
									type: "text",
									text: { content: line }
								}]
							}
						};
					}

					if (block) {
						blocks.push(block);
					}
				}

				// Add any remaining code block
				if (currentCodeBlock) {
					blocks.push(currentCodeBlock);
				}

				return blocks;
			};

			const newPage = await notion.pages.create({
				parent: isDatabase ? {
					type: "database_id",
					database_id: parentPageId
				} : {
					type: "page_id",
					page_id: parentPageId
				},
				properties: pageProperties,
				children: content ? parseBlocks(content) : []
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully created page with ID: ${newPage.id}`,
					},
				],
			};
		} catch (error) {
			console.error("Error creating page:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},

	async update_page(args: unknown) {
		const { pageId, content: newContent, type = "paragraph", mode = "replace", position = "end" } = schemas.toolInputs.updatePage.parse(args);
		try {
			// Get existing blocks and delete them
			const blocks = await notion.blocks.children.list({ block_id: pageId });
			const backup = blocks.results;

			// Helper to create blocks array based on content type and handle multiple lines
			const createBlocks = (content: string, _type: string): any[] => {
				const lines = content.split('\n');
				const blocks: any[] = [];
				let currentCodeBlock: any = null;

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const trimmedLine = line.trim();

					// Handle code blocks
					if (trimmedLine.startsWith('```')) {
						if (currentCodeBlock) {
							// End code block
							blocks.push(currentCodeBlock);
							currentCodeBlock = null;
						} else {
							// Start code block
							const language = trimmedLine.slice(3).trim();
							currentCodeBlock = {
								object: "block",
								type: "code",
								code: {
									rich_text: [],
									language: language || "plain text"
								}
							};
						}
						continue;
					}

					if (currentCodeBlock) {
						// Add line to current code block
						currentCodeBlock.code.rich_text.push({
							type: "text",
							text: { content: line }
						});
						continue;
					}

					// Handle other block types
					let block: any = null;

					if (trimmedLine === '') {
						block = {
							object: "block",
							type: "paragraph",
							paragraph: { rich_text: [] }
						};
					} else if (trimmedLine.startsWith('# ')) {
						block = {
							object: "block",
							type: "heading_1",
							heading_1: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(2) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('## ')) {
						block = {
							object: "block",
							type: "heading_2",
							heading_2: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(3) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('### ')) {
						block = {
							object: "block",
							type: "heading_3",
							heading_3: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(4) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('- [ ] ')) {
						block = {
							object: "block",
							type: "to_do",
							to_do: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(6) }
								}],
								checked: false
							}
						};
					} else if (trimmedLine.startsWith('- [x] ')) {
						block = {
							object: "block",
							type: "to_do",
							to_do: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(6) }
								}],
								checked: true
							}
						};
					} else if (trimmedLine.startsWith('- ')) {
						block = {
							object: "block",
							type: "bulleted_list_item",
							bulleted_list_item: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(2) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('> ')) {
						block = {
							object: "block",
							type: "quote",
							quote: {
								rich_text: [{
									type: "text",
									text: { content: trimmedLine.substring(2) }
								}]
							}
						};
					} else if (trimmedLine.startsWith('---')) {
						block = {
							object: "block",
							type: "divider",
							divider: {}
						};
					} else if (trimmedLine.match(/^!\[.*\]\(.*\)$/)) {
						// Image in markdown format: ![alt](url)
						const match = trimmedLine.match(/^!\[(.*)\]\((.*)\)$/);
						if (match) {
							block = {
								object: "block",
								type: "image",
								image: {
									type: "external",
									external: { url: match[2] },
									caption: match[1] ? [{
										type: "text",
										text: { content: match[1] }
									}] : []
								}
							};
						}
					} else {
						block = {
							object: "block",
							type: "paragraph",
							paragraph: {
								rich_text: [{
									type: "text",
									text: { content: line }
								}]
							}
						};
					}

					if (block) {
						blocks.push(block);
					}
				}

				// Add any remaining code block
				if (currentCodeBlock) {
					blocks.push(currentCodeBlock);
				}

				return blocks;
			};
			if (mode === "replace" || mode === "merge") {
				if (backup.length > 0) {
					console.warn(`Deleting ${backup.length} existing blocks`);
				}
				for (const block of backup) {
					await notion.blocks.delete({ block_id: block.id });
				}
			} try {
				const newBlocks = createBlocks(newContent, type);

				if (mode === "merge") {
					const mergedBlocks = position === "start"
						? [...newBlocks, ...backup]
						: [...backup, ...newBlocks];

					await notion.blocks.children.append({
						block_id: pageId,
						children: mergedBlocks,
					});
				} else {
					await notion.blocks.children.append({
						block_id: pageId,
						children: newBlocks,
					});
				}

				return {
					content: [
						{
							type: "text" as const,
							text: `Successfully updated page: ${pageId}`,
						},
					],
				};
			}catch(error){
				throw error;
			}}catch (error) {
			console.error("Error updating page:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},
	async add_comment(args: unknown) {
		const { pageId, content } = args as any;

		try {
			const response = await notion.comments.create({
				parent: { page_id: pageId },
				rich_text: [
					{
						type: "text",
						text: { content },
					},
				],
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully added comment`,
					},
				],
			};
		} catch (error) {
			console.error("Error adding comment:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: `Error adding comment: ${formatError(error)}`,
					},
				],
			};
		}
	},

	async retrieve_comments(args: unknown) {
		const { pageId, startCursor, pageSize } = args as any;

		try {
			const response = await notion.comments.list({
				block_id: pageId,
				start_cursor: startCursor,
				page_size: pageSize,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response.results, null, 2),
					},
				],
			};
		} catch (error) {
			console.error("Error retrieving comments:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: `Error retrieving comments: ${formatError(error)}`,
					},
				],
			};
		}
	},

	async create_database(args: unknown) {
		const { parentPageId, title, properties } = args as any;

		try {
			const response = await notion.databases.create({
				parent: {
					type: "page_id",
					page_id: parentPageId,
				},
				title: [
					{
						type: "text",
						text: {
							content: title,
						},
					},
				],
				properties,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully created database with ID: ${response.id}`,
					},
				],
			};
		} catch (error) {
			console.error("Error creating database:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: `Error creating database: ${formatError(error)}`,
					},
				],
			};
		}
	},

	async query_database(args: unknown) {
		const { databaseId, filter, sort } = args as any;

		try {
			const response = await notion.databases.query({
				database_id: databaseId,
				filter,
				sorts: sort ? [sort] : undefined,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response.results, null, 2),
					},
				],
			};
		} catch (error) {
			console.error("Error querying database:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: `Error querying database: ${formatError(error)}`,
					},
				],
			};
		}
	},
	async update_block(args: unknown) {
		const { blockId, content, type = "paragraph" } = args as any;

		try {
			const response = await notion.blocks.update({
				block_id: blockId,
				[type]: {
					rich_text: [
						{
							type: "text",
							text: {
								content: content,
							},
						},
					],
				},
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully updated block`,
					},
				],
			};
		} catch (error) {
			console.error("Error updating block:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},

	async delete_block(args: unknown) {
		const { blockId } = args as any;

		try {
			await notion.blocks.delete({
				block_id: blockId,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: "Successfully deleted block",
					},
				],
			};
		} catch (error) {
			console.error("Error deleting block:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},
	async update_database_item(args: unknown) {
		const { pageId, properties } = args as any;

		try {
			const response = await notion.pages.update({
				page_id: pageId,
				properties,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully updated database item`,
					},
				],
			};
		} catch (error) {
			console.error("Error updating database item:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},
	async retrieve_database(args: unknown) {
		const { databaseId } = args as any;

		try {
			const response = await notion.databases.retrieve({
				database_id: databaseId,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		} catch (error) {
			console.error("Error retrieving database:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},

	async update_database(args: unknown) {
		const { databaseId, title, description, properties } = args as any;

		try {
			const response = await notion.databases.update({
				database_id: databaseId,
				title: title
					? [
						{
							type: "text",
							text: { content: title },
						},
					]
					: undefined,
				description: description
					? [
						{
							type: "text",
							text: { content: description },
						},
					]
					: undefined,
				properties,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully updated database with ID: ${response.id}`,
					},
				],
			};
		} catch (error) {
			console.error("Error updating database:", error);
			return {
				content: [
					{
						type: "text" as const,
						text: formatError(error),
					},
				],
			};
		}
	},
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
	},
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
