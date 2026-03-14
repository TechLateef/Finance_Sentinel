"""CLI Entry point for Finance Sentinel."""

import asyncio
from framework.runner.runner import AgentRunner
from pathlib import Path

async def main():
    agent_path = Path(__file__).parent
    runner = AgentRunner.load(agent_path)
    
    # Example input for testing
    result = await runner.run({
        "borrower_identity": "a-renowned-developer",
        "requested_amount": "10",
        "borrower_wallet": "0x1234..."
    })
    
    print(f"Agent Finished: {result}")
    runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
