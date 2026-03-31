import { useMutation } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../../../convex/_generated/api";

const SURGERY_TYPES = [
  "",
  "Ileostomy reversal",
  "Colostomy reversal",
  "Other",
  "Prefer not to say",
] as const;

const RECOVERY_STAGES = ["", "Pre-surgery", "0-3 months", "3-12 months", "1+ year"] as const;

export function WaitlistForm() {
  const joinWaitlist = useMutation(api.waitlist.join);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [surgeryType, setSurgeryType] = useState("");
  const [recoveryStage, setRecoveryStage] = useState("");
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!consent) {
      toast.error("Please agree to receive email updates.");
      return;
    }

    setLoading(true);
    try {
      await joinWaitlist({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(surgeryType && { surgeryType }),
        ...(recoveryStage && { recoveryStage }),
        gdprConsent: true,
      });
      setSubmitted(true);
      toast.success("Thanks! We'll be in touch soon.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* Scope all shadcn/base-component CSS variables to sky blue within this form */
  const skyVars = {
    "--input": "rgba(56, 189, 248, 0.22)",
    "--ring": "#38bdf8",
    "--border": "rgba(56, 189, 248, 0.18)",
    "--primary": "#38bdf8",
    "--primary-foreground": "#04091b",
    "--color-accent-teal": "#38bdf8",
    "--color-border-strong": "rgba(56, 189, 248, 0.35)",
    background: "rgba(56, 189, 248, 0.03)",
  } as React.CSSProperties;

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#38bdf8]/10 p-5 md:p-6" style={skyVars}>
        <h3 className="mb-3 text-center font-display text-xl font-bold text-[#38bdf8]">
          Thanks for your interest
        </h3>
        <p className="mb-4 text-center text-sm text-[var(--text-muted)]">
          We'll reach out to you in the next few days. Here are a few things people wonder about:
        </p>

        <ul className="space-y-3">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-sm font-bold text-[#38bdf8]">Q:</span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Do I need any technical skills or coding knowledge?
              </p>
              <p className="text-sm text-[#38bdf8]">
                Not at all. If you can use an app on your phone, you can use Caca Traca.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-sm font-bold text-[#38bdf8]">Q:</span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Will it take up a lot of my time?
              </p>
              <p className="text-sm text-[#38bdf8]">
                Nope. Logging a meal takes seconds. Dr. Poo does the heavy lifting.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-sm font-bold text-[#38bdf8]">Q:</span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Is the product actually working or is it just an idea?
              </p>
              <p className="text-sm text-[#38bdf8]">
                Absolutely. The founder uses it daily for his own recovery.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-sm font-bold text-[#38bdf8]">Q:</span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                What if I find a bug or something breaks?
              </p>
              <p className="text-sm text-[#38bdf8]">
                That's the whole point. You get direct access to the developer to get it sorted.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-sm font-bold text-[#38bdf8]">Q:</span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Is my health data safe?</p>
              <p className="text-sm text-[#38bdf8]">
                Of course. Your data is stored securely in the cloud, encrypted in transit and at
                rest, and never shared with third parties.
              </p>
            </div>
          </li>
        </ul>
      </div>
    );
  }

  const inputCls =
    "border-[#38bdf8]/25 bg-white/5 focus-visible:border-[#38bdf8] focus-visible:ring-[#38bdf8]/50";

  const selectCls =
    "h-9 w-full appearance-none rounded-md border border-[#38bdf8]/25 bg-white/5 outline-none px-3 pr-8 text-sm text-[var(--text)] bg-[length:12px_12px] bg-[position:right_12px_center] bg-no-repeat focus-visible:border-[#38bdf8] focus-visible:ring-[3px] focus-visible:ring-[#38bdf8]/50";

  const chevronSvg =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2338bdf8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-[#38bdf8]/15 border-t-[3px] border-t-[#38bdf8] p-5 md:p-6"
      style={skyVars}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="wl-name" className="text-xs font-semibold text-[#38bdf8]/80">
            Your Name
          </Label>
          <Input
            id="wl-name"
            name="name"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="wl-email" className="text-xs font-semibold text-[#38bdf8]/80">
            Email Address
          </Label>
          <Input
            id="wl-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Surgery type */}
        <div className="space-y-1.5">
          <Label htmlFor="wl-surgery" className="text-xs font-semibold text-[#38bdf8]/80">
            Type of Surgery
          </Label>
          <select
            id="wl-surgery"
            value={surgeryType}
            onChange={(e) => setSurgeryType(e.target.value)}
            className={selectCls}
            style={{ backgroundImage: chevronSvg }}
          >
            {SURGERY_TYPES.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "Select (optional)"}
              </option>
            ))}
          </select>
        </div>

        {/* Recovery stage */}
        <div className="space-y-1.5">
          <Label htmlFor="wl-stage" className="text-xs font-semibold text-[#38bdf8]/80">
            Recovery Stage
          </Label>
          <select
            id="wl-stage"
            value={recoveryStage}
            onChange={(e) => setRecoveryStage(e.target.value)}
            className={selectCls}
            style={{ backgroundImage: chevronSvg }}
          >
            {RECOVERY_STAGES.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "Select (optional)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* GDPR consent */}
      <div className="flex cursor-pointer items-start gap-3">
        <Checkbox
          id="wl-consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5 border-[#38bdf8]/40 data-[checked]:border-[#38bdf8] data-[checked]:bg-[#38bdf8] data-[checked]:text-[#04091b] focus-visible:border-[#38bdf8] focus-visible:ring-[#38bdf8]/50"
        />
        <Label
          htmlFor="wl-consent"
          className="cursor-pointer text-xs font-normal leading-relaxed text-[var(--text-muted)]"
        >
          I agree to receive email updates about Caca Traca. Omnipotency AI will never sell or share
          your data with third parties. Unsubscribe at any time.
        </Label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#38bdf8] py-3 font-semibold text-[#04091b] transition-all hover:bg-[#7dd3fc] disabled:opacity-50"
      >
        {loading ? "Sending..." : "Submit"}
      </button>
    </form>
  );
}
