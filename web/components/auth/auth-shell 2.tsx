import Link from "next/link";

import { Card } from "@/components/ui/card";

type AuthShellProps = {
  mode: "login" | "signup";
  heading: string;
  subheading: string;
  children: React.ReactNode;
};

const bulletPoints = [
  "Live balance updates with exact cents",
  "A clear summary of who owes whom",
  "Fast settle-up flow for trips and roommates"
];

const demoUsers = [
  "kai@example.com / password123",
  "ben@example.com / password123",
  "lina@example.com / password123"
];

export default function AuthShell({ mode, heading, subheading, children }: AuthShellProps) {
  const isLogin = mode === "login";

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
      <Card className="order-2 overflow-hidden border-slate-200/70 bg-gradient-to-br from-white via-sky-50/60 to-blue-50 p-6 backdrop-blur-sm lg:order-1 lg:p-8">
        <p className="inline-flex rounded-full border border-blue-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          Shared spending made simple
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Track every shared dollar with confidence.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          One workspace for roommates, travel buddies, and teams to add expenses, check balances, and settle up quickly.
        </p>

        <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
          {bulletPoints.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Demo users</p>
          <p className="mt-1 text-slate-600">Use any account below to explore the app:</p>
          <div className="mt-3 space-y-1 font-medium text-slate-700">
            {demoUsers.map((user) => (
              <p key={user}>{user}</p>
            ))}
          </div>
        </div>
      </Card>

      <Card className="order-1 border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-blue-100/60 lg:order-2 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {isLogin ? "Welcome back" : "New account"}
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{heading}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{subheading}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-5 text-sm text-slate-600">
          {isLogin ? "No account yet?" : "Already have an account?"}{" "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="font-semibold text-brand-700 underline-offset-4 hover:text-brand-600 hover:underline"
          >
            {isLogin ? "Create one" : "Sign in"}
          </Link>
        </p>
      </Card>
    </div>
  );
}
