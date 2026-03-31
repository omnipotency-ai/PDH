# V1 Release-Lock Migration Checklist

Use this order to safely remove legacy profile/log allowances (`unitSystem: "imperial"`, top-level `sleep`/`wellness` logs, and other v0 profile keys) before the strict validator deploy.

## 1. Deploy order

1. Deploy the **bridge** backend first (contains migration functions and still tolerates legacy persisted values).
2. Run migrations on **dev** and verify zero leftovers.
3. Run migrations on **prod** and verify zero leftovers.
4. Deploy the **strict release-lock** backend (this branch) that removes legacy validator allowances.

## 2. Dev migration commands

```bash
bun x convex run migrations:normalizeProfileDomainV1 '{}'
bun x convex run migrations:normalizeLegacyTopLevelLogTypesV1 '{}'
```

Re-run both commands once more; expected result is `fixed: 0` on the second pass.

## 3. Prod migration commands

```bash
bun x convex run --prod migrations:normalizeProfileDomainV1 '{}'
bun x convex run --prod migrations:normalizeLegacyTopLevelLogTypesV1 '{}'
```

Re-run both commands once more; expected result is `fixed: 0` on the second pass.
