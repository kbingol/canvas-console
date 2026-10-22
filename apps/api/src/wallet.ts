import type { LedgerEntry, Wallet } from "@canvas-console/contracts";
import { ApiError, digest } from "./domain.js";

export type WalletCommand =
  | { kind: "credit"; amountMicros: number; idempotencyKey: string }
  | {
      kind: "reserve";
      amountMicros: number;
      reservationId: string;
      idempotencyKey: string;
    }
  | {
      kind: "settle";
      amountMicros: number;
      reservationId: string;
      idempotencyKey: string;
    }
  | { kind: "release"; reservationId: string; idempotencyKey: string };
export interface Reservation {
  amountMicros: number;
  status: "reserved" | "settled" | "released";
}
export interface WalletReceipt {
  fingerprint: string;
  createdAt: string;
}
export interface WalletPlan {
  wallet: Wallet;
  receipt: WalletReceipt;
  reservation?: Reservation;
  ledger?: LedgerEntry;
  replay: boolean;
}
export const walletOperationId = (key: string): string => digest(key);

function amount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ApiError(
      400,
      "Money must be a non-negative integer in micro-USD.",
    );
}
/** Pure plan; repositories commit the wallet, receipt, reservation and ledger together. */
export function planWalletCommand(
  wallet: Wallet,
  previous: WalletReceipt | undefined,
  reservation: Reservation | undefined,
  command: WalletCommand,
  now = new Date().toISOString(),
): WalletPlan {
  amount(wallet.balanceMicros);
  amount(wallet.reservedMicros);
  if (wallet.currency !== "USD" || wallet.reservedMicros > wallet.balanceMicros)
    throw new ApiError(409, "Wallet invariant violated.");
  if (!command.idempotencyKey || command.idempotencyKey.length > 200)
    throw new ApiError(400, "Invalid idempotency key.");
  if ("amountMicros" in command) amount(command.amountMicros);
  const fingerprint = digest(
    JSON.stringify([
      command.kind,
      "amountMicros" in command ? command.amountMicros : null,
      "reservationId" in command ? command.reservationId : null,
    ]),
  );
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new ApiError(
        409,
        "Idempotency key was used for another operation.",
      );
    return { wallet, receipt: previous, replay: true };
  }
  const next = { ...wallet };
  let updatedReservation: Reservation | undefined;
  let ledger: LedgerEntry | undefined;
  const entry = (
    type: LedgerEntry["type"],
    value: number,
    description: string,
  ): LedgerEntry => ({
    id: walletOperationId(command.idempotencyKey),
    type,
    amountMicros: value,
    description,
    createdAt: now,
    status: "completed",
  });
  if (command.kind === "credit") {
    next.balanceMicros += command.amountMicros;
    amount(next.balanceMicros);
    ledger = entry(
      "credit",
      command.amountMicros,
      "Server-authorized account credit",
    );
  } else if (command.kind === "reserve") {
    if (reservation) throw new ApiError(409, "Reservation already exists.");
    if (
      command.amountMicros === 0 ||
      next.balanceMicros - next.reservedMicros < command.amountMicros
    )
      throw new ApiError(409, "Insufficient available balance.");
    next.reservedMicros += command.amountMicros;
    updatedReservation = {
      amountMicros: command.amountMicros,
      status: "reserved",
    };
  } else {
    if (!reservation || reservation.status !== "reserved")
      throw new ApiError(409, "An active reservation is required.");
    amount(reservation.amountMicros);
    if (reservation.amountMicros > next.reservedMicros)
      throw new ApiError(409, "Reservation invariant violated.");
    next.reservedMicros -= reservation.amountMicros;
    if (command.kind === "settle") {
      if (command.amountMicros > reservation.amountMicros)
        throw new ApiError(409, "Charge exceeds the reservation.");
      next.balanceMicros -= command.amountMicros;
      ledger = entry(
        "usage",
        -command.amountMicros,
        "Settled reserved model usage",
      );
      updatedReservation = { ...reservation, status: "settled" };
    } else updatedReservation = { ...reservation, status: "released" };
  }
  return {
    wallet: next,
    receipt: { fingerprint, createdAt: now },
    reservation: updatedReservation,
    ledger,
    replay: false,
  };
}
