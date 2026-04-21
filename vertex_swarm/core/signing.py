"""Signed envelopes: Ed25519 when ``cryptography`` is installed, else HMAC fallback."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict, Tuple

try:  # pragma: no cover - optional
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    _HAS_CRYPTO = True
except Exception:  # pragma: no cover
    InvalidSignature = Exception  # type: ignore[misc, assignment]
    Ed25519PrivateKey = None  # type: ignore[misc, assignment]
    _HAS_CRYPTO = False


def canonical_bytes(obj: Dict[str, Any]) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


class SwarmSigner:
    """Sign state updates and bids; verify peer payloads."""

    def __init__(self, node_id: str, secret: bytes) -> None:
        self.node_id = node_id
        self._secret = bytes(secret)
        if _HAS_CRYPTO and len(self._secret) == 32:
            self._ed_priv = Ed25519PrivateKey.from_private_bytes(self._secret)
            self._ed_pub = self._ed_priv.public_key()
        else:
            self._ed_priv = None
            self._ed_pub = None

    def sign(self, payload: Dict[str, Any]) -> bytes:
        body = canonical_bytes(payload)
        if self._ed_priv is not None:
            return self._ed_priv.sign(body)
        return hmac.new(self._secret, body, hashlib.sha256).digest()

    def verify(self, payload: Dict[str, Any], signature: bytes, peer_id: str) -> bool:
        _ = peer_id  # reserved for multi-key trust stores
        body = canonical_bytes(payload)
        if self._ed_pub is not None and len(signature) == 64:
            try:
                self._ed_pub.verify(signature, body)
                return True
            except InvalidSignature:
                return False
        expect = hmac.new(self._secret, body, hashlib.sha256).digest()
        return hmac.compare_digest(expect, signature)

    @staticmethod
    def random_keypair() -> Tuple[bytes, bytes]:
        if _HAS_CRYPTO and Ed25519PrivateKey is not None:
            priv = Ed25519PrivateKey.generate()
            pub = priv.public_key()
            sk = priv.private_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PrivateFormat.Raw,
                encryption_algorithm=serialization.NoEncryption(),
            )
            pk = pub.public_bytes(encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw)
            return sk, pk
        sk = hashlib.sha256(b"dev-swarm-key").digest()
        return sk, sk
