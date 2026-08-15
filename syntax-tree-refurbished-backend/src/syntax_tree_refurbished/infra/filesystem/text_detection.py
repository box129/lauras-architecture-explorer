"""Readable text detection helpers."""

from __future__ import annotations


def looks_binary(sample: bytes) -> bool:
    if b"\x00" in sample:
        return True
    if not sample:
        return False
    control = sum(1 for byte in sample if byte < 9 or (13 < byte < 32))
    return (control / len(sample)) > 0.30

