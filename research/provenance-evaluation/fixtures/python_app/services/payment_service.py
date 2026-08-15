"""Payment service: handles charging customers for orders.

This is a minimal mock payment gateway integration. It does not perform
any fraud detection, risk scoring, velocity checks, device fingerprinting,
or anomaly analysis of any kind -- it only records a charge amount in a
local list. This file exists in the fixture so that a claim asserting
fraud-detection behavior (see claim C8 in
fixtures/ground_truth/claims.json) can be tested as an INSUFFICIENT_EVIDENCE
case: the entire method body is small enough to read in full, and reading
it in full shows no fraud-detection code -- but that absence does not
positively rule out fraud detection happening elsewhere (e.g. in a real
gateway this mock stands in for), so a correct system must abstain rather
than claim the behavior has been refuted. See the note on claim C8 for the
full reasoning, and claim C10 for a worked CONTRADICTED example built on a
closed structural fact (explicit class inheritance) instead.
"""


class PaymentService:
    """Charges customers via a mock payment gateway."""

    def __init__(self) -> None:
        self.charged_amounts: list[float] = []

    def charge(self, customer_id: str, amount: float) -> None:
        """Record a mock charge for the given customer and amount.

        This method performs no fraud detection: it does not inspect
        transaction velocity, IP/geolocation, device fingerprints, or any
        other risk signal. It simply appends the amount to a local list.
        """
        self.charged_amounts.append(amount)
