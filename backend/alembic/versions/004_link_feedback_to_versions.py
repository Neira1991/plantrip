"""link feedback to versions

Revision ID: 004
Revises: 003
Create Date: 2026-02-19 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add version_id column with FK to trip_versions
    op.add_column(
        'activity_feedback',
        sa.Column('version_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_activity_feedback_version_id_trip_versions',
        'activity_feedback',
        'trip_versions',
        ['version_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_activity_feedback_version_id'),
        'activity_feedback',
        ['version_id'],
        unique=False,
    )

    # 2. Add activity_title denormalized column
    op.add_column(
        'activity_feedback',
        sa.Column('activity_title', sa.String(length=200), server_default='', nullable=False),
    )

    # 3. Make activity_id nullable
    op.alter_column(
        'activity_feedback',
        'activity_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )

    # 4. Change activity_id FK from CASCADE to SET NULL
    op.drop_constraint(
        'activity_feedback_activity_id_fkey',
        'activity_feedback',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'activity_feedback_activity_id_fkey',
        'activity_feedback',
        'activities',
        ['activity_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    # 4. Restore activity_id FK to CASCADE
    op.drop_constraint(
        'activity_feedback_activity_id_fkey',
        'activity_feedback',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'activity_feedback_activity_id_fkey',
        'activity_feedback',
        'activities',
        ['activity_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # 3. Make activity_id NOT NULL again (set any NULLs first)
    op.execute("DELETE FROM activity_feedback WHERE activity_id IS NULL")
    op.alter_column(
        'activity_feedback',
        'activity_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

    # 2. Drop activity_title column
    op.drop_column('activity_feedback', 'activity_title')

    # 1. Drop version_id column and index
    op.drop_index(op.f('ix_activity_feedback_version_id'), table_name='activity_feedback')
    op.drop_constraint(
        'fk_activity_feedback_version_id_trip_versions',
        'activity_feedback',
        type_='foreignkey',
    )
    op.drop_column('activity_feedback', 'version_id')
