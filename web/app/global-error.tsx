"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 560, margin: "15vh auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
          <h1>OIPay could not load</h1>
          <p>Please try again. No financial change was submitted from this error screen.</p>
          <button onClick={reset} style={{ padding: "10px 16px" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
