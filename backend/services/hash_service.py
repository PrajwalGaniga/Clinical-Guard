import hashlib
import json


def hash_record(record: dict) -> str:
    """
    Produce a SHA-256 hex fingerprint of a record dict.
    Sort keys for deterministic output.
    """
    raw = json.dumps(record, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
