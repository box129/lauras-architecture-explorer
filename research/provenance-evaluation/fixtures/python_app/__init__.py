"""Toy layered-architecture fixture used for provenance-evaluation ground truth.

This package is NOT part of the Laura's product. It is a small, hand-crafted
Python codebase with an unambiguous, by-inspection-verifiable set of
relationships between classes:

    OrderController -> OrderService -> OrderRepository -> Order (entity)
    OrderService -> PaymentService

It exists so that ground-truth claims (see
``research/provenance-evaluation/fixtures/ground_truth/claims.json``) about
the relationships in this code can be checked against candidate
claim/evidence sets by the evaluator in
``research/provenance-evaluation/evaluator/``.
"""
