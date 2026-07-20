"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

export type SimulatedPaymentMethod = "card" | "bank_transfer" | "wallet";

export interface SimulatedPaymentResult {
  reference: string;
  cardLast4?: string;
  provider?: string;
}

export interface PaymentTerminalProps {
  method: SimulatedPaymentMethod;
  amountMinor: number;
  currency: string;
  onApproved: (result: SimulatedPaymentResult) => void | Promise<void>;
  onCancel: () => void;
}

type Phase = "details" | "processing" | "approved" | "failed";
type FieldName =
  | "cardholder"
  | "cardNumber"
  | "expiry"
  | "cvv"
  | "bankName"
  | "transferReference"
  | "walletProvider"
  | "walletReference"
  | "form";
type FormErrors = Partial<Record<FieldName, string>>;

const METHOD_CONTENT: Record<
  SimulatedPaymentMethod,
  {
    title: string;
    processingTitle: string;
    processingHint: string;
    approvedHint: string;
  }
> = {
  card: {
    title: "Card payment",
    processingTitle: "Authorising card",
    processingHint: "Contacting the demo card network…",
    approvedHint: "The demo card payment was approved.",
  },
  bank_transfer: {
    title: "Bank transfer",
    processingTitle: "Verifying transfer",
    processingHint: "Checking the demo transfer reference…",
    approvedHint: "The demo bank transfer was confirmed.",
  },
  wallet: {
    title: "Mobile wallet",
    processingTitle: "Waiting for confirmation",
    processingHint: "Confirming payment with the demo wallet…",
    approvedHint: "The demo wallet payment was received.",
  },
};

const WALLET_PROVIDERS = ["Genie", "FriMi", "eZ Cash", "mCash", "Other wallet"];

function digitsOnly(value: string, maximumLength: number): string {
  return value.replace(/\D/g, "").slice(0, maximumLength);
}

function formatCardNumber(value: string): string {
  return digitsOnly(value, 19).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = digitsOnly(value, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function passesLuhn(cardNumber: string): boolean {
  let total = 0;
  let shouldDouble = false;

  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = Number(cardNumber[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    shouldDouble = !shouldDouble;
  }

  return total % 10 === 0;
}

function expiryIsCurrentOrFuture(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

function makeDemoReference(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEMO-CARD-${timePart}-${randomPart}`;
}

function isMockQrCellDark(row: number, column: number): boolean {
  const finderStarts = [
    [0, 0],
    [0, 10],
    [10, 0],
  ];

  for (const [startRow, startColumn] of finderStarts) {
    const localRow = row - startRow;
    const localColumn = column - startColumn;
    if (
      localRow >= 0 &&
      localRow < 7 &&
      localColumn >= 0 &&
      localColumn < 7
    ) {
      const isOuterEdge =
        localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6;
      const isCentre =
        localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4;
      return isOuterEdge || isCentre;
    }
  }

  return (row * 5 + column * 3 + row * column) % 7 < 3;
}

function MethodIcon({ method, size = 22 }: { method: SimulatedPaymentMethod; size?: number }) {
  if (method === "card") return <CreditCard size={size} />;
  if (method === "bank_transfer") return <Building2 size={size} />;
  return <Smartphone size={size} />;
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label-luxe">
        {label} <span className="text-rosegold-500">*</span>
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 font-sans text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 font-sans text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function MockQrCode() {
  return (
    <div
      className="grid h-28 w-28 grid-cols-[repeat(17,minmax(0,1fr))] overflow-hidden rounded-lg border-4 border-white bg-white shadow-luxe"
      aria-hidden="true"
    >
      {Array.from({ length: 17 * 17 }, (_, index) => {
        const row = Math.floor(index / 17);
        const column = index % 17;
        return (
          <span
            key={index}
            className={isMockQrCellDark(row, column) ? "bg-ink" : "bg-white"}
          />
        );
      })}
    </div>
  );
}

export function PaymentTerminal({
  method,
  amountMinor,
  currency,
  onApproved,
  onCancel,
}: PaymentTerminalProps) {
  const fieldPrefix = useId();
  const [phase, setPhase] = useState<Phase>("details");
  const [errors, setErrors] = useState<FormErrors>({});

  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const [bankName, setBankName] = useState("");
  const [transferReference, setTransferReference] = useState("");

  const [walletProvider, setWalletProvider] = useState(WALLET_PROVIDERS[0]);
  const [walletReference, setWalletReference] = useState("");

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const mountedRef = useRef(true);
  const submissionStartedRef = useRef(false);
  const callbackFiredRef = useRef(false);
  const pendingResultRef = useRef<SimulatedPaymentResult | null>(null);
  const submittedMethodRef = useRef<SimulatedPaymentMethod | null>(null);
  const approvedHandlerRef = useRef(onApproved);

  useEffect(() => {
    approvedHandlerRef.current = onApproved;
  }, [onApproved]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  function schedule(action: () => void, delay: number) {
    const timer = setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== timer);
      if (mountedRef.current) action();
    }, delay);
    timersRef.current.push(timer);
  }

  function clearError(name: FieldName) {
    setErrors((current) => {
      if (!current[name] && !current.form) return current;
      const next = { ...current };
      delete next[name];
      delete next.form;
      return next;
    });
  }

  function validate(): SimulatedPaymentResult | null {
    const nextErrors: FormErrors = {};

    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      nextErrors.form = "Enter a valid payment amount before continuing.";
    }

    if (method === "card") {
      const numberDigits = digitsOnly(cardNumber, 19);
      if (cardholder.trim().length < 2) {
        nextErrors.cardholder = "Enter the demo cardholder name.";
      }
      if (numberDigits.length < 13 || numberDigits.length > 19 || !passesLuhn(numberDigits)) {
        nextErrors.cardNumber = "Enter a valid demo card number.";
      }
      if (!expiryIsCurrentOrFuture(expiry)) {
        nextErrors.expiry = "Use a valid MM/YY date that has not expired.";
      }
      if (!/^\d{3,4}$/.test(cvv)) {
        nextErrors.cvv = "Enter a 3 or 4 digit demo security code.";
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return null;

      return {
        reference: makeDemoReference(),
        cardLast4: numberDigits.slice(-4),
      };
    }

    if (method === "bank_transfer") {
      if (bankName.trim().length < 2) {
        nextErrors.bankName = "Enter the bank name.";
      }
      if (transferReference.trim().length < 4) {
        nextErrors.transferReference = "Enter a transfer reference of at least 4 characters.";
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return null;

      return {
        reference: transferReference.trim(),
        provider: bankName.trim(),
      };
    }

    if (!walletProvider) {
      nextErrors.walletProvider = "Select a wallet provider.";
    }
    if (walletReference.trim().length < 4) {
      nextErrors.walletReference = "Enter a wallet reference of at least 4 characters.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      reference: walletReference.trim(),
      provider: walletProvider,
    };
  }

  async function finishApproval() {
    if (callbackFiredRef.current || !pendingResultRef.current) return;
    callbackFiredRef.current = true;
    try {
      await approvedHandlerRef.current(pendingResultRef.current);
    } catch {
      if (mountedRef.current) setPhase("failed");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionStartedRef.current || phase !== "details") return;

    const result = validate();
    if (!result) return;

    submissionStartedRef.current = true;
    submittedMethodRef.current = method;
    pendingResultRef.current = result;

    // Card details are needed only for local demo validation. Clear them before
    // leaving the form so the callback can never receive a card number or CVV.
    if (method === "card") {
      setCardholder("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    }

    setPhase("processing");
    schedule(() => {
      setPhase("approved");
      schedule(() => void finishApproval(), 900);
    }, method === "wallet" ? 1900 : 1500);
  }

  const displayMethod = phase === "details" ? method : submittedMethodRef.current ?? method;
  const content = METHOD_CONTENT[displayMethod];
  const approvedResult = pendingResultRef.current;
  const fieldId = (name: string) => `${fieldPrefix}-${name}`;
  const inputClass = (error?: string) =>
    `input-luxe ${error ? "!border-rose-400 focus:!ring-rose-50" : ""}`;

  const submitLabel =
    method === "card"
      ? "Authorise demo card"
      : method === "bank_transfer"
        ? "Verify demo transfer"
        : "I have completed the demo payment";

  return (
    <div className="space-y-5 font-sans">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted/70 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-700">
            <MethodIcon method={displayMethod} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              {content.title}
            </p>
            <p className="truncate text-xl font-semibold text-ink">
              {formatMoney(amountMinor, currency)}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-burgundy-200 bg-burgundy-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-burgundy-700">
          Simulation
        </span>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Demo payment only — no real money will be charged.</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
            Use test details only. This prototype is not connected to a bank or payment gateway.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "details" && (
          <motion.form
            key={`details-${method}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onSubmit={submit}
            noValidate
            className="space-y-5"
          >
            {method === "card" && (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl bg-burgundy-deep p-5 text-white shadow-luxe">
                  <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/10" />
                  <div className="absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-rosegold-400/20" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                        BELT-KIT demo
                      </span>
                      <CreditCard size={24} className="text-rosegold-200" />
                    </div>
                    <p className="mt-7 font-mono text-lg tracking-[0.16em]">
                      {cardNumber || "4242 4242 4242 4242"}
                    </p>
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-white/50">Cardholder</p>
                        <p className="truncate text-xs font-medium uppercase">
                          {cardholder || "Demo customer"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] uppercase tracking-widest text-white/50">Expires</p>
                        <p className="text-xs font-medium">{expiry || "MM/YY"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <FormField
                  id={fieldId("cardholder")}
                  label="Cardholder name"
                  error={errors.cardholder}
                >
                  <input
                    id={fieldId("cardholder")}
                    className={inputClass(errors.cardholder)}
                    value={cardholder}
                    onChange={(event) => {
                      setCardholder(event.target.value.slice(0, 80));
                      clearError("cardholder");
                    }}
                    placeholder="Demo Customer"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.cardholder)}
                    aria-describedby={errors.cardholder ? `${fieldId("cardholder")}-error` : undefined}
                  />
                </FormField>

                <FormField
                  id={fieldId("card-number")}
                  label="Card number"
                  error={errors.cardNumber}
                  hint="Try the test number 4242 4242 4242 4242."
                >
                  <div className="relative">
                    <CreditCard
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                    />
                    <input
                      id={fieldId("card-number")}
                      className={`${inputClass(errors.cardNumber)} pl-10 font-mono tracking-wide`}
                      value={cardNumber}
                      onChange={(event) => {
                        setCardNumber(formatCardNumber(event.target.value));
                        clearError("cardNumber");
                      }}
                      placeholder="4242 4242 4242 4242"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={23}
                      aria-invalid={Boolean(errors.cardNumber)}
                      aria-describedby={errors.cardNumber ? `${fieldId("card-number")}-error` : undefined}
                    />
                  </div>
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField id={fieldId("expiry")} label="Expiry (MM/YY)" error={errors.expiry}>
                    <input
                      id={fieldId("expiry")}
                      className={inputClass(errors.expiry)}
                      value={expiry}
                      onChange={(event) => {
                        setExpiry(formatExpiry(event.target.value));
                        clearError("expiry");
                      }}
                      placeholder="12/30"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={5}
                      aria-invalid={Boolean(errors.expiry)}
                      aria-describedby={errors.expiry ? `${fieldId("expiry")}-error` : undefined}
                    />
                  </FormField>
                  <FormField id={fieldId("cvv")} label="CVV" error={errors.cvv}>
                    <div className="relative">
                      <LockKeyhole
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                      />
                      <input
                        id={fieldId("cvv")}
                        type="password"
                        className={`${inputClass(errors.cvv)} pl-10`}
                        value={cvv}
                        onChange={(event) => {
                          setCvv(digitsOnly(event.target.value, 4));
                          clearError("cvv");
                        }}
                        placeholder="123"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        aria-invalid={Boolean(errors.cvv)}
                        aria-describedby={errors.cvv ? `${fieldId("cvv")}-error` : undefined}
                      />
                    </div>
                  </FormField>
                </div>
              </div>
            )}

            {method === "bank_transfer" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-burgundy-100 bg-burgundy-50/70 p-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-burgundy-600 shadow-soft">
                    <Building2 size={25} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Enter the transfer receipt details</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                      Verification is simulated and completes automatically.
                    </p>
                  </div>
                </div>

                <FormField id={fieldId("bank-name")} label="Bank name" error={errors.bankName}>
                  <input
                    id={fieldId("bank-name")}
                    className={inputClass(errors.bankName)}
                    value={bankName}
                    onChange={(event) => {
                      setBankName(event.target.value.slice(0, 80));
                      clearError("bankName");
                    }}
                    placeholder="e.g. Commercial Bank"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.bankName)}
                    aria-describedby={errors.bankName ? `${fieldId("bank-name")}-error` : undefined}
                  />
                </FormField>

                <FormField
                  id={fieldId("transfer-reference")}
                  label="Transfer reference"
                  error={errors.transferReference}
                  hint="Use the transaction ID shown on the demo transfer receipt."
                >
                  <input
                    id={fieldId("transfer-reference")}
                    className={`${inputClass(errors.transferReference)} font-mono uppercase`}
                    value={transferReference}
                    onChange={(event) => {
                      setTransferReference(event.target.value.slice(0, 64));
                      clearError("transferReference");
                    }}
                    placeholder="TRX-DEMO-1042"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.transferReference)}
                    aria-describedby={
                      errors.transferReference ? `${fieldId("transfer-reference")}-error` : undefined
                    }
                  />
                </FormField>
              </div>
            )}

            {method === "wallet" && (
              <div className="space-y-4">
                <div className="grid gap-4 rounded-2xl border border-burgundy-100 bg-burgundy-50/70 p-4 sm:grid-cols-[128px_1fr] sm:items-center">
                  <div className="mx-auto">
                    <MockQrCode />
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="mb-2 flex items-center justify-center gap-2 text-burgundy-700 sm:justify-start">
                      <QrCode size={18} />
                      <span className="text-sm font-semibold">Demo QR code</span>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-soft">
                      Pretend to scan this code in the selected wallet, then enter a demo transaction reference below.
                    </p>
                  </div>
                </div>

                <FormField
                  id={fieldId("wallet-provider")}
                  label="Wallet provider"
                  error={errors.walletProvider}
                >
                  <select
                    id={fieldId("wallet-provider")}
                    className={inputClass(errors.walletProvider)}
                    value={walletProvider}
                    onChange={(event) => {
                      setWalletProvider(event.target.value);
                      clearError("walletProvider");
                    }}
                    aria-invalid={Boolean(errors.walletProvider)}
                    aria-describedby={
                      errors.walletProvider ? `${fieldId("wallet-provider")}-error` : undefined
                    }
                  >
                    {WALLET_PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  id={fieldId("wallet-reference")}
                  label="Wallet transaction reference"
                  error={errors.walletReference}
                >
                  <input
                    id={fieldId("wallet-reference")}
                    className={`${inputClass(errors.walletReference)} font-mono uppercase`}
                    value={walletReference}
                    onChange={(event) => {
                      setWalletReference(event.target.value.slice(0, 64));
                      clearError("walletReference");
                    }}
                    placeholder="WALLET-DEMO-1042"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.walletReference)}
                    aria-describedby={
                      errors.walletReference ? `${fieldId("wallet-reference")}-error` : undefined
                    }
                  />
                </FormField>
              </div>
            )}

            {errors.form && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700" role="alert">
                {errors.form}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onCancel} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <MethodIcon method={method} size={17} />
                {submitLabel}
              </button>
            </div>
          </motion.form>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-line bg-surface-muted/60 px-6 py-10 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-burgundy-100 text-burgundy-700">
              <span className="absolute inset-0 animate-ping rounded-full bg-burgundy-200/50" />
              <Loader2 size={36} className="relative animate-spin" />
            </div>
            <h3 className="mt-6 text-lg font-semibold text-ink">{content.processingTitle}</h3>
            <p className="mt-1.5 text-sm text-ink-soft">{content.processingHint}</p>
            <div className="mt-6 flex items-center gap-2" aria-hidden="true">
              <span className="h-1.5 w-8 rounded-full bg-burgundy-500" />
              <span className="h-1.5 w-8 animate-pulse rounded-full bg-burgundy-300" />
              <span className="h-1.5 w-8 rounded-full bg-line" />
            </div>
            <p className="mt-5 text-xs text-ink-faint">Please keep this window open.</p>
          </motion.div>
        )}

        {phase === "approved" && (
          <motion.div
            key="approved"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/70 px-6 py-10 text-center"
            role="status"
            aria-live="polite"
          >
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.05 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-luxe"
            >
              <CheckCircle2 size={46} />
            </motion.span>
            <h3 className="mt-6 text-xl font-semibold text-emerald-900">Payment approved</h3>
            <p className="mt-1.5 text-sm text-emerald-800">{content.approvedHint}</p>
            {approvedResult && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-white/80 px-4 py-2.5 text-xs text-emerald-900">
                {approvedResult.provider && <span>{approvedResult.provider} · </span>}
                {approvedResult.cardLast4 ? (
                  <span>Card ending {approvedResult.cardLast4}</span>
                ) : (
                  <span className="font-mono">{approvedResult.reference}</span>
                )}
              </div>
            )}
            <p className="mt-5 flex items-center gap-1.5 text-xs text-emerald-700">
              <ShieldCheck size={14} /> Recording the payment…
            </p>
          </motion.div>
        )}

        {phase === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center"
            role="alert"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle size={34} />
            </span>
            <h3 className="mt-5 text-lg font-semibold text-rose-900">
              Payment could not be recorded
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-rose-800">
              The simulation finished, but saving the payment failed. Check the
              invoice before trying again.
            </p>
            <button type="button" onClick={onCancel} className="btn-ghost mt-6">
              Back to payment methods
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
