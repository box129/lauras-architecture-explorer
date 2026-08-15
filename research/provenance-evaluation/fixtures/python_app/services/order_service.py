"""Order service: application logic for creating orders.

This is the "Service" layer of the toy fixture. It calls both PaymentService
(to charge the customer) and OrderRepository (to persist the resulting
Order entity), and is therefore the middle link in the transitive chain
OrderController -> OrderService -> OrderRepository -> Order, and also the
middle link in OrderController -> OrderService -> PaymentService.
"""

from ..models.order import Order
from ..repositories.order_repository import OrderRepository
from .payment_service import PaymentService


class OrderService:
    """Coordinates order creation: payment, then persistence."""

    def __init__(self, repository: OrderRepository, payment_service: PaymentService) -> None:
        self.repository = repository
        self.payment_service = payment_service

    def create_order(self, customer_id: str, item_id: str, amount: float) -> Order:
        """Create a new order: charge payment, then persist the order.

        Note: this method does not send any confirmation email and does
        not perform any authentication/authorization check -- callers are
        assumed to have already handled those concerns (or, in this
        fixture, simply do not implement them at all). That is what makes
        claims about email confirmation or OAuth2 enforcement
        INSUFFICIENT_EVIDENCE cases (see claims C6/C7 in
        fixtures/ground_truth/claims.json): nothing in this fixture
        confirms or denies them.
        """
        self.payment_service.charge(customer_id, amount)
        order = Order(customer_id=customer_id, item_id=item_id, amount=amount)
        self.repository.save(order)
        return order
