"""Order controller: HTTP-facing layer for order placement.

This is the "Controller" layer of the toy fixture. It calls OrderService
directly and, transitively, everything OrderService calls.

Note: this file does not implement or reference any authentication or
authorization mechanism (no OAuth2, no session/token check, nothing). See
claim C6 in fixtures/ground_truth/claims.json.
"""

from ..services.order_service import OrderService


class OrderController:
    """Handles incoming requests related to orders."""

    def __init__(self, order_service: OrderService) -> None:
        self.order_service = order_service

    def place_order(self, customer_id: str, item_id: str, amount: float) -> dict:
        """Handle a request to place a new order."""
        order = self.order_service.create_order(customer_id, item_id, amount)
        return {"order_id": order.order_id, "status": "placed"}
