from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ConfigurationIssue, DependencyIssue, Finding, Scan, SecretFinding


async def delete_scans(session: AsyncSession, scan_ids: list[str]) -> None:
    """Delete scans and all their results. SQLite doesn't enforce ON DELETE CASCADE
    by default, so children are removed explicitly. The caller commits."""
    if not scan_ids:
        return
    for model in (Finding, DependencyIssue, SecretFinding, ConfigurationIssue):
        await session.execute(delete(model).where(model.scan_id.in_(scan_ids)))
    await session.execute(delete(Scan).where(Scan.id.in_(scan_ids)))
