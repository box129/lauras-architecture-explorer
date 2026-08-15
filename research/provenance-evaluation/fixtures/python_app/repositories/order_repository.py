"""Order repository: persistence for Order entities.

This is the "Repository" layer of the toy fixture. It operates directly on
the Order entity (fixtures/python_app/models/order.py) and stores it in a
plain in-memory dict. It also declares an explicit base class,
InMemoryRepository (see ./base.py) -- unlike the storage mechanism, the
direct base-class list on a class statement is complete and AST-visible, so
it can ground a genuine CONTRADICTED ground-truth claim (see claim C10 in
fixtures/ground_truth/claims.json: "OrderRepository extends SqlRepository"
is positively refuted by the actual, complete base list).

By contrast, this fixture deliberately treats "OrderRepository persists
Order entities to a SQL database" (former claim C9) as insufficient_evidence
rather than contradicted: the absence of SQL/ORM code in this one file does
not positively establish that SQL is never used anywhere, so a correct
system must abstain rather than claim the behavior has been refuted. See
the note on claim C9 in fixtures/ground_truth/claims.json for the full
reasoning behind that correction.
"""

from ..models.order import Order
from .base import InMemoryRepository


class OrderRepository(InMemoryRepository):
    """In-memory persistence for Order entities."""

    def __init__(self) -> None:
        self._orders: dict[str, Order] = {}

    def save(self, order: Order) -> None:
        """Persist an Order entity, keyed by its order_id."""
        self._orders[order.order_id] = order

    def get(self, order_id: str) -> Order | None:
        """Retrieve a previously saved Order entity by id."""
        return self._orders.get(order_id)
