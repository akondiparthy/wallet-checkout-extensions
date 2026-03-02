# Wallet Checkout Extensions (WCE)

A safe extensibility model for consumer wallet checkout.

## Why Checkout Extensibility Breaks Wallets Today

Consumer wallets are optimized for speed, trust, and familiar UX. Merchants and platforms are optimized for growth, experimentation, and monetization. Today, that tension is usually resolved by moving checkout logic back into merchant apps or web flows, which weakens the wallet promise:

- Fragmented UX across merchants
- More attack surface from custom code and scripts
- Lower conversion due to extra steps and context switches
- Harder policy enforcement across regions and verticals

WCE proposes a wallet-native way to add limited extensibility without losing the core wallet guarantees.

## What “Extensions” Mean (and What They Don’t)

An extension in WCE is:

- Declarative (JSON and schema-based)
- Wallet-rendered (not merchant-rendered)
- Permission-scoped
- Server-driven
- Auditable

An extension in WCE is **not**:

- Arbitrary UI
- Custom JavaScript
- Full-page takeover
- Open-ended branding canvas

This boundary is intentional: extensibility must exist inside strict wallet guardrails.

## Design Principles

- Preserve trust first: if an extension can materially reduce user trust, it should not run.
- Wallet owns rendering: extension payloads describe intent, never final UI.
- Deterministic behavior: clear fallback and timeout behavior for every extension point.
- Minimal permissions: each extension asks for the least data and capabilities needed.
- Auditability: all extension registration, versioning, and execution is traceable.
- Performance budget: extension evaluation cannot degrade checkout speed.
- Regional compliance by default: policy checks are first-class, not optional.

If this model cannot preserve Apple Pay-level trust, it should not exist.

## Extension Types

WCE starts with five extension types:

1. `offer_extension`
Purpose: Loyalty, wallet rewards, merchant promos  
Scope: Read-only price context, limited copy, no layout control  
Timing: Pre-confirmation

2. `payment_logic_extension`
Purpose: BNPL previews, installment explanations, funding source hints  
Scope: Cannot change total, only explain options  
Timing: Funding selection

3. `identity_eligibility_extension`
Purpose: Age gating, address validation, regional compliance  
Scope: Boolean outcomes or constrained input  
Timing: Pre-authorization

4. `post_purchase_extension`
Purpose: Subscriptions, warranties, returns flows  
Scope: Deferred, async, optional  
Timing: After success

5. `analytics_hook` (non-UI)
Purpose: Funnel visibility and operational analytics  
Scope: Event-level only, no PII payloads  
Timing: All states

## Lifecycle & State Machine

Canonical flow:

```text
INIT
  -> WALLET_READY
  -> EXTENSION_EVALUATION
  -> EXTENSION_RENDER (0-N)
  -> USER_CONFIRM
  -> AUTHORIZATION
  -> SUCCESS | FAILURE
  -> POST_PURCHASE_EXTENSIONS
```

Hard rules:

- Extensions cannot block user confirmation.
- Wallet owns final rendering.
- All extension calls have hard timeouts.
- Timeout or runtime failure triggers deterministic fallback.

Reference sequence diagram: [`docs/sequence-diagram.md`](docs/sequence-diagram.md)

## Security & Abuse Prevention

- Permission manifests per extension and version
- Wallet approval workflow before activation
- Runtime constraints (CPU/time/memory/network policy)
- Kill switches at extension, merchant, and global levels
- Region-aware policy enforcement
- Anti-dark-pattern policy (copy controls, no deceptive defaults, no forced urgency patterns)
- Signed payloads and immutable audit logs
- Revocation model with instant disable and safe fallback behavior

## Comparison to Existing Models

| Model | What It Solves | Why It Doesn’t Scale |
| --- | --- | --- |
| Merchant-side checkout | Flexibility | Breaks wallet UX consistency and trust boundaries |
| Custom wallet features | Control | Wallet team bottleneck; low ecosystem velocity |
| App-store purchases | Extensibility | Primarily digital goods; limited ecommerce applicability |
| WCE (proposed) | Balance | Requires governance, policy operations, and ecosystem alignment |

## Open Questions

- Governance: who approves extensions (wallet, platform, shared committee)?
- Economics: what revenue-share or pricing model aligns incentives?
- Standardization: should schemas be wallet-specific or cross-wallet standard?
- Dispute handling: how are extension-caused failures attributed and resolved?
- Observability: what minimum event set enables debugging without privacy regression?
- Migration: how can merchants adopt incrementally from existing checkout stacks?

## Artifacts

- Sequence diagram: [`docs/sequence-diagram.md`](docs/sequence-diagram.md)
- Permissions model diagram: [`docs/permissions-diagram.md`](docs/permissions-diagram.md)
- Example extension JSON: [`examples/offer-extension.example.json`](examples/offer-extension.example.json)
- Interactive simulator: [`demo/index.html`](demo/index.html)

## Simulator

An interactive wallet checkout simulator is available in `demo/` to demonstrate:

- Wallet-owned extension rendering
- Policy denials and kill switches
- Extension timeout with deterministic fallback
- Non-blocking confirmation
- Post-purchase asynchronous extensions
- Event audit + analytics hook logging (no PII)

Open `demo/index.html` in a browser to run it.
