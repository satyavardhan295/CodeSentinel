"""In-memory limiter for failed sign-in attempts (per process; fine for a single server)."""

import time
from collections import defaultdict, deque

MAX_FAILURES = 5
WINDOW_SECONDS = 15 * 60

_failures: dict[str, deque[float]] = defaultdict(deque)


def _prune(key: str, now: float) -> deque[float]:
    q = _failures[key]
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()
    return q


def retry_after(key: str) -> int:
    """Seconds until another attempt is allowed (0 if allowed now)."""
    now = time.monotonic()
    q = _prune(key, now)
    if len(q) < MAX_FAILURES:
        return 0
    return int(WINDOW_SECONDS - (now - q[0])) + 1


def record_failure(key: str) -> None:
    _failures[key].append(time.monotonic())


def reset(key: str) -> None:
    _failures.pop(key, None)
