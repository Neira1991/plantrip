"""baseline - schema created by init.sql

Revision ID: 001
Revises:
Create Date: 2026-02-23 00:00:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Schema is created by db/init.sql; this is a no-op baseline.
    pass


def downgrade() -> None:
    # Not supported - use docker volume rm to reset.
    pass
