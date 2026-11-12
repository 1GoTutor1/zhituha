# Database migrations

`migrations/` is the ordered migration history for the hosted Supabase project. Add new schema changes there as timestamped migrations and deploy them through the Supabase CLI after review.

`../sql/` contains older manual migrations, repair scripts, and operational SQL. Do not apply that directory as a sequence. When an older SQL script was already recorded as a migration in the hosted project, its matching contents are kept under `migrations/` so local and hosted histories stay aligned.

Before deploying database changes, compare `supabase migration list` with the hosted project and review the migration SQL. Do not use `db reset` on the linked hosted project.
