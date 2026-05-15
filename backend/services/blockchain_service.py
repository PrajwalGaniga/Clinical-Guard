"""
blockchain_service.py — ClinicalGuard

INTEGRITY CONTRACT:
  This module MUST NEVER silently return a fake success.

  Two modes exist:
  ─────────────────────────────────────────────────────────
  STUB MODE  (POLYGON_RPC_URL not set in .env)
    Returns an explicit STUB receipt. The receipt status is
    "STUB_PENDING" — the caller stores this and sets the
    record's blockchain.committed = False.
    Stub mode is acceptable in development/demo environments.
    It is VISIBLE and LABELLED — it never pretends to be real.

  LIVE MODE  (POLYGON_RPC_URL is set in .env)
    Submits to the real Polygon Amoy node.
    If the submission FAILS for ANY reason, this function raises
    BlockchainSubmissionError.  The caller must catch it, set the
    record status to PENDING_CHAIN_CONFIRMATION, and persist the
    failure in the blockchain_queue collection for retry.
    THERE IS NO FALLBACK TO STUB IN LIVE MODE.
  ─────────────────────────────────────────────────────────

Any deviation from this contract is a security defect.
"""
import os
from ..config import get_settings

settings = get_settings()


class BlockchainSubmissionError(Exception):
    """
    Raised when a live blockchain submission fails.
    Caller must handle this and set record status to
    PENDING_CHAIN_CONFIRMATION.  Do NOT silently continue.
    """


def is_stub_mode() -> bool:
    """Return True if running without a real blockchain node configured."""
    return not bool(settings.POLYGON_RPC_URL and settings.POLYGON_RPC_URL.strip())


def submit_to_blockchain(
    data_hash: str,
    label: int,
    confidence: float,
    risk: str,
    trial_id: str = "NCT04414150",
    site_id: str = "SITE_001",
) -> dict:
    """
    Submit a validation decision to the blockchain.

    Returns a receipt dict with the following keys:
        tx_hash       — transaction hash (prefixed STUB_ in stub mode)
        block_number  — block number (0 in stub mode)
        network       — network identifier
        status        — "STUB_PENDING" | "COMMITTED" | "REJECTED_ON_CHAIN"
        stub_mode     — True if running without a real node

    Raises:
        BlockchainSubmissionError  — ONLY in live mode, on any failure.
                                     Caller must handle this explicitly.
    """
    if is_stub_mode():
        return _stub_submit(data_hash, label, risk)
    else:
        # Live mode — failures raise, never fall back
        return _live_submit(data_hash, label, confidence, risk, trial_id, site_id)


def _stub_submit(data_hash: str, label: int, risk: str) -> dict:
    """
    Explicit stub receipt for development / demo environments.

    The status is STUB_PENDING — NOT 'SUCCESS'.
    Records with this status are NOT considered blockchain-committed.
    Admins and regulators must be shown the stub indicator in the UI.
    """
    print("[BLOCKCHAIN] ⚠  STUB MODE — no real node configured.")
    print(f"[BLOCKCHAIN]    Hash: {data_hash[:16]}... | Label: {label} | Risk: {risk}")
    print("[BLOCKCHAIN]    Set POLYGON_RPC_URL in .env to enable live anchoring.")
    return {
        "tx_hash":      "STUB_" + data_hash[:16],
        "block_number": 0,
        "network":      "STUB_NO_CHAIN",
        "status":       "STUB_PENDING",
        "stub_mode":    True,
    }


def _live_submit(
    data_hash: str,
    label: int,
    confidence: float,
    risk: str,
    trial_id: str,
    site_id: str,
) -> dict:
    """
    Real Web3.py submission to the deployed Solidity contract.

    On ANY failure this raises BlockchainSubmissionError.
    The caller must catch it and queue the record for retry.
    THERE IS NO FALLBACK TO STUB HERE.
    """
    rpc_url = settings.POLYGON_RPC_URL

    try:
        from web3 import Web3
        import json as _json

        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            raise BlockchainSubmissionError(
                f"Cannot connect to Polygon node at {rpc_url}. "
                "Record status set to PENDING_CHAIN_CONFIRMATION."
            )

        abi_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "smart-contract", "abi.json"
        )
        if not os.path.exists(abi_path):
            raise BlockchainSubmissionError(
                "smart-contract/abi.json not found. "
                "Deploy the contract and export the ABI before enabling live mode."
            )

        with open(abi_path) as f:
            abi = _json.load(f)

        contract_address = settings.CONTRACT_ADDRESS
        if not contract_address:
            raise BlockchainSubmissionError(
                "CONTRACT_ADDRESS is not set in .env. "
                "Cannot submit to blockchain without a deployed contract address."
            )

        contract = w3.eth.contract(address=contract_address, abi=abi)

        # data_hash must be exactly 32 bytes for bytes32 param
        if len(data_hash) != 64:
            raise BlockchainSubmissionError(
                f"data_hash must be a 64-char hex string (SHA-256). Got length {len(data_hash)}."
            )
        data_hash_bytes = bytes.fromhex(data_hash)

        validator_acct = w3.eth.accounts[0]
        tx = contract.functions.validateAndCommit(
            trial_id,
            site_id,
            data_hash_bytes,
            label,
            int(confidence * 100),   # contract stores as integer x100
            risk,
            "DT",
        ).transact({"from": validator_acct, "gas": 300_000})

        receipt = w3.eth.wait_for_transaction_receipt(tx, timeout=120)

        on_chain_status = "COMMITTED" if receipt["status"] == 1 else "REJECTED_ON_CHAIN"
        print(f"[BLOCKCHAIN] ✓ Live submission — tx: {tx.hex()[:20]}... | {on_chain_status}")

        return {
            "tx_hash":      tx.hex(),
            "block_number": receipt["blockNumber"],
            "network":      "polygon_amoy_testnet",
            "status":       on_chain_status,
            "stub_mode":    False,
        }

    except BlockchainSubmissionError:
        # Re-raise our own typed errors as-is
        raise

    except ImportError:
        raise BlockchainSubmissionError(
            "web3 package is not installed. "
            "Run: pip install web3  or set POLYGON_RPC_URL= to use stub mode."
        )

    except Exception as exc:
        # All unexpected exceptions become a typed error — no silent fallback
        raise BlockchainSubmissionError(
            f"Live blockchain submission failed: {exc}"
        ) from exc
