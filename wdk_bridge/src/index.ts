import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

/**
 * Tether WDK MCP Server
 * This server acts as a bridge between Hive (Python) and Tether WDK (TypeScript).
 */
class WdkServer {
    private server: Server;
    private walletManager: WalletManagerEvm | null = null;
    private rpcUrl: string;
    private seedPhrase: string;

    // Default USD₮ contract on Ethereum Mainnet
    private DEFAULT_USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

    constructor() {
        this.rpcUrl = process.env.WDK_RPC_URL || "";
        this.seedPhrase = process.env.WDK_SEED_PHRASE || "";

        this.server = new Server(
            {
                name: "wdk-tether-bridge",
                version: "0.1.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        if (this.seedPhrase && this.rpcUrl) {
            try {
                console.error("Initializing WDK Wallet Manager...");
                this.walletManager = new WalletManagerEvm(this.seedPhrase, {
                    provider: this.rpcUrl,
                });
            } catch (err) {
                console.error("Failed to initialize WDK Wallet Manager:", err);
            }
        } else {
            console.error("Warning: WDK_SEED_PHRASE or WDK_RPC_URL not provided. Server will run in read-only/demo mode.");
        }

        this.setupHandlers();
        this.server.onerror = (error) => console.error("[MCP Error]", error);
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "wdk_get_address",
                    description: "Get the EVM address of the agent's wallet",
                    inputSchema: {
                        type: "object",
                        properties: {
                            index: {
                                type: "number",
                                description: "Account index (default 0)",
                                default: 0
                            }
                        }
                    },
                },
                {
                    name: "wdk_get_balance",
                    description: "Get the balance (Native and USD₮) of a specific wallet address",
                    inputSchema: {
                        type: "object",
                        properties: {
                            address: {
                                type: "string",
                                description: "The wallet address to check (optional, defaults to agent's first account)",
                            },
                            token_address: {
                                type: "string",
                                description: "The USD₮/Token contract address (optional)",
                            }
                        }
                    },
                },
                {
                    name: "wdk_transfer_usdt",
                    description: "Send USD₮ from the agent's wallet to another address",
                    inputSchema: {
                        type: "object",
                        properties: {
                            to: {
                                type: "string",
                                description: "Recipient wallet address",
                            },
                            amount: {
                                type: "string",
                                description: "Amount of USD₮ to send (in base units / wei-equivalent)",
                            },
                            token_address: {
                                type: "string",
                                description: "The USD₮ contract address (optional)",
                            }
                        },
                        required: ["to", "amount"],
                    },
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case "wdk_get_address": {
                        if (!this.walletManager) throw new Error("Wallet not initialized. Check WDK_SEED_PHRASE.");
                        const index = (args?.index as number) || 0;
                        const account = await this.walletManager.getAccount(index);
                        const address = await account.getAddress();
                        return {
                            content: [{ type: "text", text: address }],
                        };
                    }

                    case "wdk_get_balance": {
                        if (!this.walletManager) throw new Error("Wallet not initialized. Check WDK_RPC_URL.");

                        let targetAddress = (args?.address as string);
                        if (!targetAddress) {
                            const account = await this.walletManager.getAccount(0);
                            targetAddress = await account.getAddress();
                        }

                        const tokenAddress = (args?.token_address as string) || this.DEFAULT_USDT_CONTRACT;

                        const account = await this.walletManager.getAccount(0);
                        const nativeBalance = await account.getBalance();
                        const tokenBalance = await account.getTokenBalance(tokenAddress);

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Address: ${targetAddress}\nNative Balance: ${nativeBalance.toString()} wei\nUSD₮/Token Balance: ${tokenBalance.toString()}`,
                                },
                            ],
                        };
                    }

                    case "wdk_transfer_usdt": {
                        if (!this.walletManager) throw new Error("Wallet not initialized.");

                        const to = args?.to as string;
                        const amount = BigInt(args?.amount as string);
                        const tokenAddress = (args?.token_address as string) || this.DEFAULT_USDT_CONTRACT;

                        const account = await this.walletManager.getAccount(0);
                        const result = await account.transfer({
                            token: tokenAddress,
                            recipient: to,
                            amount: amount
                        });

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Transfer successful!\nHash: ${result.hash}\nFee: ${result.fee.toString()} wei`,
                                },
                            ],
                        };
                    }

                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            } catch (error: any) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                };
            }
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("WDK MCP Server running on stdio");
    }
}

const server = new WdkServer();
server.run().catch(console.error);
