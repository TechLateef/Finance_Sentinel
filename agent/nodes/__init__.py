"""Node definitions for Finance Sentinel - The Lending Bot."""

from framework.graph import NodeSpec

# Node 1: Lending Assessor (Autonomous)
# This node investigates the borrower and determines if they are trustworthy.
# It uses the GitHub tool (built into Hive) and our new WDK Balance tool.
lending_assessor = NodeSpec(
    id="lending_assessor",
    name="Lending Assessor",
    description="Evaluate a loan request based on borrower reputation and risk.",
    node_type="event_loop",
    input_keys=["borrower_identity", "requested_amount"],
    output_keys=["risk_score", "approval_status", "assessment_report"],
    success_criteria="A clear risk score and approval status are determined.",
    system_prompt="""\
You are a conservative Financial Risk Evaluator. Your goal is to decide if a loan request should be approved.

Your inputs:
- borrower_identity: (e.g., GitHub username or wallet address)
- requested_amount: (e.g., "50 USD₮")

Steps to perform:
1. Search GitHub (using 'github_search_users' or 'github_get_user') to check account age and activity.
2. Search web (using 'web_search') for any public mentions of this address/identity.
3. Check the address balance (using 'wdk_get_balance') to see if it's a "living" wallet.
4. Calculate a risk_score (1-100, where 1 is safe, 100 is definite default).
5. Set approval_status to "APPROVED" or "REJECTED".

Finally, call set_output for:
- "risk_score"
- "approval_status"
- "assessment_report" (a detailed reason for your decision)
""",
    tools=["github_search_users", "github_get_user", "web_search", "wdk_get_balance"],
)

# Node 2: Lending Executor (Autonomous)
# This node only runs if the Assessor approved the loan.
# It uses our WDK Transfer tool.
lending_executor = NodeSpec(
    id="lending_executor",
    name="Lending Executor",
    description="Execute the transfer of funds if approved.",
    node_type="event_loop",
    input_keys=["approval_status", "borrower_wallet", "requested_amount"],
    output_keys=["transaction_hash", "execution_status"],
    success_criteria="Transaction is signed and broadcast on-chain.",
    system_prompt="""\
You are a Precise Financial Executor. Your goal is to move money safely.

DO NOT execute if approval_status is not "APPROVED".
If approved:
1. Use the 'wdk_transfer_usdt' tool to send the requested_amount to the borrower_wallet.
2. Verify the response from the tool (the transaction hash).

Finally, call set_output for:
- "transaction_hash"
- "execution_status" (e.g., "COMPLETE" or "FAILED")
""",
    tools=["wdk_transfer_usdt"],
)

__all__ = ["lending_assessor", "lending_executor"]
