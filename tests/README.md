# Garage regression checks

Run `npm run test:garage`. This applies the pending garage migration in an isolated
in-memory PostgreSQL engine (PGlite). It never connects to Supabase.

The fixture contains the market and vehicle-trigger definitions inspected in the
connected database on 2026-11-20, without player data. Minimal surrounding tables
and stubs isolate the garage behavior; this is not a full Supabase deployment.

Covered scenarios include legacy duplicate models, preserving wear and plates,
listed-car reservations, cancellation with/without an active car, insufficient
funds, repeated purchase, full garage, dealership stock returns, collateral guards,
house upgrades and resale, reset cleanup, parked-number allocation, season
snapshots, and access restrictions.

For the actual inventory component with fake data, run `npm run dev` and open
`/tests/garage-preview.html`. Add `?error` for failed-loading behavior. The fixture
uses the game's CSS and makes no game API calls. It is not a production entry point.

The browser fixture was checked at 320, 390 and 440 px for row overlap, selection,
upgrade actions, listed-car locking and loading failure. These checks do not cover
production Telegram authentication or concurrent database sessions. Before release,
apply the migration to a staging copy and check the complete authenticated flow.
