import hashlib


def hash_token(raw_token: str) -> str:
    """Return the hex-encoded SHA-256 hash of a raw token.

    Used to store password-reset and email-verification tokens so that
    a database leak does not expose usable tokens.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()
