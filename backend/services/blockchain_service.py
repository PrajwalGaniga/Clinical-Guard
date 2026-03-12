import os
from ..config import get_settings

settings = get_settings()


def submit_to_blockchain(
    data_hash: str,
    label: int,
    confidence: float,
    risk: str,
    trial_id: str = "NCT04414150",
    site_id: str = "SITE_001",
) -> dict:
    """
    Submit a validation decision to the Polygon Amoy blockchain.

    STUB MODE (default): Returns a deterministic mock tx hash.
    LIVE MODE: Requires POLYGON_RPC_URL in .env to be set.
    """
    rpc_url = settings.POLYGON_RPC_URL

    if rpc_url:
        # ── LIVE MODE ──────────────────────────────────────────────
        return _live_submit(data_hash, label, confidence, risk, trial_id, site_id, rpc_url)
    else:
        # ── STUB MODE ──────────────────────────────────────────────
        return _stub_submit(data_hash, label, risk)


def _stub_submit(data_hash: str, label: int, risk: str) -> dict:
    print(f"[BLOCKCHAIN STUB] Transaction submitted to Polygon Amoy")
    print(f"[BLOCKCHAIN STUB] Hash: {data_hash} | Label: {label} | Risk: {risk}")
    return {
        "tx_hash":      "0xSTUB_" + data_hash[:16],
        "block_number": 0,
        "network":      "polygon_amoy_testnet_stub",
        "status":       "STUB_SUCCESS",
    }


def _live_submit(data_hash, label, confidence, risk, trial_id, site_id, rpc_url) -> dict:
    """
    Real Web3.py integration with the deployed Solidity contract.
    Requires: POLYGON_RPC_URL and CONTRACT_ADDRESS in .env
    """
    try:
        from web3 import Web3
        import json as _json

        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            raise ConnectionError("Cannot connect to Polygon node")

        abi_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "smart-contract", "abi.json"
        )
        with open(abi_path) as f:
            abi = _json.load(f)

        contract_address = settings.CONTRACT_ADDRESS
        contract = w3.eth.contract(address=contract_address, abi=abi)

        # Convert data_hash to bytes32
        data_hash_bytes = bytes.fromhex(data_hash)

        validator_acct = w3.eth.accounts[0]
        tx = contract.functions.validateAndCommit(
            trial_id,
            site_id,
            data_hash_bytes,
            label,
            int(confidence * 100),  # contract stores as integer x100
            risk,
            "DT",
        ).transact({"from": validator_acct, "gas": 300000})

        receipt = w3.eth.wait_for_transaction_receipt(tx)
        return {
            "tx_hash":      tx.hex(),
            "block_number": receipt["blockNumber"],
            "network":      "polygon_amoy_testnet",
            "status":       "SUCCESS" if receipt["status"] == 1 else "FAILED",
        }

    except Exception as e:
        print(f"[BLOCKCHAIN LIVE] Error: {e} — falling back to stub")
        return _stub_submit(data_hash, label, risk)
