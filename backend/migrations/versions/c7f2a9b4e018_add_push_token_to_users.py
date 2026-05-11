"""add push_token to users

Revision ID: c7f2a9b4e018
Revises: a3c1d8e2f045
Create Date: 2026-05-12 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c7f2a9b4e018'
down_revision = 'a3c1d8e2f045'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('push_token', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('users', 'push_token')
