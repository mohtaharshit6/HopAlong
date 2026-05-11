"""add payment_method to bookings and upi_vpa to users

Revision ID: d4e9f1a3b062
Revises: c7f2a9b4e018
Create Date: 2026-05-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e9f1a3b062'
down_revision = 'c7f2a9b4e018'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('upi_vpa', sa.String(100), nullable=True))

    op.add_column('bookings', sa.Column(
        'payment_method', sa.String(10), nullable=False, server_default='online'
    ))

    # Expand the payment_status check constraint to include UPI and cash statuses
    op.drop_constraint('check_payment_status', 'bookings', type_='check')
    op.create_check_constraint(
        'check_payment_status',
        'bookings',
        "payment_status IN ('pending','held','released','refunded','failed',"
        "'upi_pending','upi_received','cash_pending','cash_collected')",
    )

    op.create_check_constraint(
        'check_payment_method',
        'bookings',
        "payment_method IN ('online','upi','cash')",
    )


def downgrade():
    op.drop_constraint('check_payment_method', 'bookings', type_='check')
    op.drop_constraint('check_payment_status', 'bookings', type_='check')
    op.create_check_constraint(
        'check_payment_status',
        'bookings',
        "payment_status IN ('pending','held','released','refunded','failed')",
    )
    op.drop_column('bookings', 'payment_method')
    op.drop_column('users', 'upi_vpa')
