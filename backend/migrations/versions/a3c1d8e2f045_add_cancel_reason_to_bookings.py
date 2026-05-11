"""add cancel_reason to bookings

Revision ID: a3c1d8e2f045
Revises: bf3cdcbb27eb
Create Date: 2026-05-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a3c1d8e2f045'
down_revision = 'bf3cdcbb27eb'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bookings', sa.Column('cancel_reason', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('bookings', 'cancel_reason')
