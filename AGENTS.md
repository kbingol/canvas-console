# Canvas Console

Independent public multi-provider model gateway console. This repository is separate from the Canvas desktop app and the existing Algomim Platform.

## Stack and interface

- React + TypeScript + Vite; official Fluent UI React **v9**, `@fluentui/react-components` and Fluent icons.
- Preserve the neutral white/gray/graphite theme and table/detail layout. No blue brand theme, generic dashboard card grid or imitation of Windows Settings.
- Turkish interface. Keep controls accessible, responsive and functional. Explicitly identify illustrative local data.
- Keep feature components in `apps/web/src/features`, common UI in `components`, auth/data access in `lib`. `App` composes screens.

## Data and access

- Firebase Auth authenticates panel users. External inference keys are separate, random, hash-only keys whose full value is returned once.
- API verifies Firebase tokens and authorizes workspace and admin access on the server. Browser roles and workspace identifiers never grant permission.
- Own Firestore namespace: `canvasConsole/v1`. Do not read or modify unrelated Platform collections or deploy replacement rules to the shared Firebase project.
- Never commit service accounts, provider keys, tokens or local environment files. Local credentials stay outside this repo; Cloud Run uses ADC.
- USD amounts use integer micro-USD. Update wallet, immutable ledger, reservation and idempotency receipts atomically. No provider/payment calls inside transaction callbacks.
- Demo mode is restricted to local development and loopback; never enable it in production.

## Provider contract

- Serve upstream models as-is. Preserve model/version identity, native parameters and outputs. Do not silently substitute models, drop parameters, retry paid work or introduce automatic fallbacks.
- This initial repository implements the management foundation. Inference transports, durable media jobs, provider secrets and real payment processing require implementation and verification; do not present them as active.

## Verification

- Run `npm run check` for type checks, meaningful API tests and production builds.
- Check user/admin flows in a browser at desktop and mobile widths after UI changes. Confirm key secrets disappear after the creation dialog closes.
- Do not deploy shared Firebase rules or live infrastructure as part of ordinary local verification.
