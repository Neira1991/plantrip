"""add activity feedback and trip versions

Revision ID: 003
Revises: 002
Create Date: 2026-02-19 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create activity_feedback table
    op.create_table(
        'activity_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('share_token_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('viewer_session_id', sa.String(length=64), nullable=False),
        sa.Column('viewer_name', sa.String(length=100), server_default='Anonymous', nullable=False),
        sa.Column('sentiment', sa.String(length=10), nullable=False),
        sa.Column('message', sa.Text(), server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['share_token_id'], ['share_tokens.id'], name='fk_activity_feedback_share_token_id_share_tokens', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['activity_id'], ['activities.id'], name='fk_activity_feedback_activity_id_activities', ondelete='CASCADE'),
        sa.CheckConstraint("sentiment IN ('like', 'dislike')", name='ck_activity_feedback_sentiment'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_activity_feedback_share_token_id'), 'activity_feedback', ['share_token_id'], unique=False)
    op.create_index(op.f('ix_activity_feedback_activity_id'), 'activity_feedback', ['activity_id'], unique=False)

    # Create trip_versions table
    op.create_table(
        'trip_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trip_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=200), server_default='', nullable=False),
        sa.Column('snapshot_data', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name='fk_trip_versions_trip_id_trips', ondelete='CASCADE'),
        sa.UniqueConstraint('trip_id', 'version_number', name='uq_trip_versions_trip_version'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trip_versions_trip_id'), 'trip_versions', ['trip_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_trip_versions_trip_id'), table_name='trip_versions')
    op.drop_table('trip_versions')
    op.drop_index(op.f('ix_activity_feedback_activity_id'), table_name='activity_feedback')
    op.drop_index(op.f('ix_activity_feedback_share_token_id'), table_name='activity_feedback')
    op.drop_table('activity_feedback')
