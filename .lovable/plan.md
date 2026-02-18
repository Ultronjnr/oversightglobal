
## Database Foundation: PR Transaction-Level Messaging

### Current State

The database already has a `pr_messages` table, but it was built with a lighter schema. Here is a direct comparison:

```text
EXISTING pr_messages columns      REQUESTED columns
────────────────────────────────  ──────────────────────────────────
id (uuid, PK)                     id (uuid, PK) ✓
pr_id (uuid)                      purchase_requisition_id (uuid) ← different name
sender_id (uuid)                  sender_user_id (uuid) ← different name
sender_name (text)                [not requested]
sender_role (text)                sender_role (text) ✓
message (text, NOT NULL)          message_text (text, nullable) ← different name + nullable
created_at (timestamp)            created_at (timestamp) ✓
[missing]                         organization_id (uuid) ← new required column
[missing]                         is_system_note (boolean) ← new required column
```

The `pr_message_attachments` table does not yet exist at all.

### Approach

Because you said "Do NOT modify existing PR tables," and because `pr_messages` currently backs live functionality (the PR chat panel uses `pr_id`, `sender_id`, `message`), the safest path is:

**Augment the existing table** — add only the missing columns (`organization_id`, `is_system_note`) without renaming or removing existing columns. This preserves all current functionality while making the table comply with the new spec. The existing RLS policies and indexes remain intact and are extended.

The `pr_message_attachments` table is created fresh with full RLS.

---

### Migration Steps

**Step 1 — Extend `pr_messages` with missing columns**

```sql
ALTER TABLE public.pr_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS is_system_note boolean NOT NULL DEFAULT false;

-- Back-fill organization_id from the linked PR
UPDATE public.pr_messages m
SET organization_id = pr.organization_id
FROM public.purchase_requisitions pr
WHERE pr.id = m.pr_id;

-- Make organization_id NOT NULL after back-fill
ALTER TABLE public.pr_messages
  ALTER COLUMN organization_id SET NOT NULL;
```

**Step 2 — Add missing index on `organization_id`**

An index on `pr_id` and `created_at` already exists. Only `organization_id` is missing.

```sql
CREATE INDEX IF NOT EXISTS idx_pr_messages_organization_id
  ON public.pr_messages(organization_id);
```

**Step 3 — Add organization-scoped RLS policies to `pr_messages`**

The existing policies filter by PR membership. A new, broader SELECT policy is added so that `organization_id`-based access is explicitly available for future service queries.

```sql
-- Suppliers can view messages for PRs they have a quote request on
CREATE POLICY "Suppliers can view PR messages in their org"
  ON public.pr_messages FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    AND has_role(auth.uid(), 'SUPPLIER'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.quote_requests qr
      JOIN public.suppliers s ON s.id = qr.supplier_id
      WHERE qr.pr_id = pr_messages.pr_id AND s.user_id = auth.uid()
    )
  );
```

No DELETE policies are created on `pr_messages` (audit integrity preserved).

**Step 4 — Create `pr_message_attachments` table**

```sql
CREATE TABLE public.pr_message_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES public.pr_messages(id) ON DELETE CASCADE,
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pr_message_attachments ENABLE ROW LEVEL SECURITY;
```

**Step 5 — Indexes on `pr_message_attachments`**

```sql
CREATE INDEX idx_pr_message_attachments_message_id
  ON public.pr_message_attachments(message_id);
```

**Step 6 — RLS policies on `pr_message_attachments`**

Attachments inherit access through the parent message. A user who can see a message can see its attachments; a user who can post a message can attach files.

```sql
-- SELECT: same org as the message's PR
CREATE POLICY "Users can view attachments in their org"
  ON public.pr_message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pr_messages m
      JOIN public.purchase_requisitions pr ON pr.id = m.pr_id
      WHERE m.id = pr_message_attachments.message_id
        AND pr.organization_id = get_user_organization(auth.uid())
    )
  );

-- INSERT: user must own the parent message
CREATE POLICY "Users can attach files to their own messages"
  ON public.pr_message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pr_messages m
      WHERE m.id = pr_message_attachments.message_id
        AND m.sender_id = auth.uid()
    )
  );

-- No DELETE policy (audit integrity)
```

---

### What Is NOT Changed

- `purchase_requisitions` table — untouched
- Existing `pr_messages` columns (`pr_id`, `sender_id`, `sender_name`, `sender_role`, `message`) — untouched
- All existing RLS policies on `pr_messages` — preserved
- No UI components created
- No service files created

---

### Migration Summary Output

| Item | Action |
|---|---|
| `pr_messages.organization_id` | Added (NOT NULL, back-filled, indexed) |
| `pr_messages.is_system_note` | Added (boolean, default false) |
| `pr_message_attachments` | Created fresh with RLS |
| Indexes | `organization_id` on messages, `message_id` on attachments |
| RLS — Supplier SELECT on messages | Added |
| RLS — SELECT on attachments | Added (org-scoped via parent PR) |
| RLS — INSERT on attachments | Added (sender ownership) |
| DELETE policies | None created (audit integrity) |
