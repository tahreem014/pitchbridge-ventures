# Demo login (development only)

A ready-to-use **investor** account in the PitchBridge Supabase project, for testing investor features
such as Discover, Saved and "Send proposal".

| | |
|---|---|
| Email | `priya.nair@demo.pitchbridge.test` |
| Password | `Demo-70d64cc546f8!` |
| Role | investor |
| Name | Priya Nair (Partner at Horizon Angels) |

Sign in at http://localhost:8080/auth with the email and password form (not "Continue with Google").

This is a throwaway account on sample data. **Delete it before the project goes live:**

```sql
DELETE FROM auth.users WHERE email LIKE '%@demo.pitchbridge.test';
```

The other demo users from `demo-data.sql` cannot sign in.

## Trying the investment agreements

- Priya already has one **signed** agreement: the Lumora Health deal with Amara (Agreements page, then Download PDF).
- To see the whole flow, sign in as the main (real) account in Founder mode, open **Proposals** and accept Priya's pending SkillSwap offer.
  An agreement is drafted. Sign in as Priya, open **Agreements**, edit the terms (this makes version 2) and confirm. Then confirm again as the
  founder. Only when both have confirmed the same version does the money count as raised.
- The main account also has two drafts waiting for its confirmation (a loan it is giving to LedgerLeaf as investor, and a revenue share Sofia
  proposed for SkillSwap as founder), a cancelled one, and signed ones for Lumora Health and SkillSwap.
