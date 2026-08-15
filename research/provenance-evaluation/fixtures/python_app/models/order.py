"""Order entity/model.

This is the "Entity" layer of the toy fixture: a plain data holder with no
behavior beyond its own construction. Only OrderRepository is expected to
operate on it directly.
"""

import uuid
from dataclasses import dataclass, field


@dataclass
class Order:
    """Represents an order placed by a customer."""

    customer_id: str
    item_id: str
    amount: float
    order_id: str = field(default_factory=lambda: str(uuid.uuid4()))
