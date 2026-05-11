"""create driver_kyc table

Revision ID: f6a1b3c8d204
Revises: e5b0c2d7f193
Create Date: 2026-05-12 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f6a1b3c8d204'
down_revision = 'e5b0c2d7f193'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'driver_kyc',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('dl_number', sa.String(50), nullable=False),
        sa.Column('rc_number', sa.String(50), nullable=False),
        sa.Column('dl_photo', sa.Text(), nullable=True),
        sa.Column('rc_photo', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='submitted'),
        sa.Column('rejection_reason', sa.String(200), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "status IN ('submitted', 'verified', 'rejected')",
            name='check_kyc_status'
        ),
    )


def downgrade():
    op.drop_table('driver_kyc')
