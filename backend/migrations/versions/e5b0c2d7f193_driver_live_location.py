"""add driver live location to rides

Revision ID: e5b0c2d7f193
Revises: d4e9f1a3b062
Create Date: 2026-05-12 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e5b0c2d7f193'
down_revision = 'd4e9f1a3b062'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('rides', sa.Column('driver_lat', sa.Float(), nullable=True))
    op.add_column('rides', sa.Column('driver_lng', sa.Float(), nullable=True))
    op.add_column('rides', sa.Column('driver_location_updated_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('rides', 'driver_location_updated_at')
    op.drop_column('rides', 'driver_lng')
    op.drop_column('rides', 'driver_lat')
