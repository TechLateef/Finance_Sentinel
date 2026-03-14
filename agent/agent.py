"""Finance Sentinel - Lending Bot Graph."""

from pathlib import Path
from framework.graph import EdgeSpec, EdgeCondition, Goal, SuccessCriterion, Constraint
from framework.graph.edge import GraphSpec
from framework.graph.executor import ExecutionResult
from framework.llm import LiteLLMProvider
from framework.runner.tool_registry import ToolRegistry
from framework.runtime.agent_runtime import AgentRuntime, create_agent_runtime
from framework.runtime.execution_stream import EntryPointSpec

# Import our custom nodes
from .nodes import lending_assessor, lending_executor

# Define the Hackathon Goal
goal = Goal(
    id="lending-bot-goal",
    name="Autonomous On-chain Lending",
    description="Evaluate developer reputation and issue USD₮ loans autonomously using WDK.",
    success_criteria=[
        SuccessCriterion(id="sc-1", description="Validates borrower's GitHub activity", metric="Reputation Search", target="Completed", weight=0.4),
        SuccessCriterion(id="sc-2", description="Checks on-chain balances with WDK", metric="On-chain Check", target="Completed", weight=0.3),
        SuccessCriterion(id="sc-3", description="Signs and executes transfer with WDK", metric="Transaction Execution", target="Success", weight=0.3),
    ],
    constraints=[
        Constraint(id="c-1", description="Only lend to accounts older than 6 months on GitHub", constraint_type="hard", category="safety"),
        Constraint(id="c-2", description="Maximum loan per transaction: 100 USD₮", constraint_type="hard", category="budget"),
    ],
)

# Nodes for the graph
nodes = [lending_assessor, lending_executor]

# Edges (The Flow)
edges = [
    # 1. Flow from Assessor to Executor
    EdgeSpec(
        id="assessor-to-executor",
        source="lending_assessor",
        target="lending_executor",
        condition=EdgeCondition.CONDITIONAL,
        condition_expr='str(approval_status).upper() == "APPROVED"',
        priority=1
    ),
]

# Basic identity for the agent's LLM
identity_prompt = "You are an autonomous Finance Sentinel, an AI agent capable of managing real-world on-chain assets."

class FinanceSentinel:
    """The main entry point for our Hackathon Lending Bot."""
    def __init__(self, config=None):
        self.goal = goal
        self.nodes = nodes
        self.edges = edges
        self.entry_node = "lending_assessor"
        self.entry_points = {"start": "lending_assessor"}

    def _build_graph(self):
        return GraphSpec(
            id="finance-sentinel-graph",
            goal_id=self.goal.id,
            version="1.0.0",
            entry_node=self.entry_node,
            entry_points=self.entry_points,
            nodes=self.nodes,
            edges=self.edges,
            identity_prompt=identity_prompt,
        )

default_agent = FinanceSentinel()
