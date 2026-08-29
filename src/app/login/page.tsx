"use client";

import { useState, useEffect } from "react";
import { provisionLocalSession, verifyLocalLogin, setCurrentLocalSession } from "@/lib/offline/localAuth";
import { installApiBridge } from "@/lib/offline/apiBridge";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    installApiBridge();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    await installApiBridge();

    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      // Could not reach the server at all — try the local, on-device
      // credential check instead (see the offline-auth architecture
      // report for what this does and does not verify while offline).
      const result = await verifyLocalLogin(username, password);
      setLoading(false);

      if (!result.ok) {
        setError(
          result.reason === "not_provisioned"
            ? "No offline login is available for this account on this device yet — log in online at least once first."
            : result.reason === "inactive"
            ? "This account was deactivated as of its last online login."
            : "Incorrect username or password."
        );
        return;
      }

      setCurrentLocalSession(result.user);
      window.location.href = "/";
      return;
    }

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }

    // Provision (or refresh) this device's offline login capability, and
    // remember this as the current session for a future offline cold
    // start. Never sends the password anywhere — only derives a local
    // hash in-browser.
    if (data.user) {
      provisionLocalSession(data.user, password).catch(() => {});
      setCurrentLocalSession(data.user);
    }

    window.location.href = "/";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-5">
      <form
        onSubmit={login}
        className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm"
      >
        <h1 className="text-3xl font-bold text-center mb-2">
          God's Empire POS
        </h1>

        <p className="text-center text-gray-500 mb-6">
          Sign in to continue
        </p>

        <input
          className="border rounded-lg w-full p-3 mb-4 text-black placeholder:text-gray-500 bg-white"
          placeholder="Username"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
        />

        <input
          type="password"
          className="border rounded-lg w-full p-3 mb-4 text-black placeholder:text-gray-500 bg-white"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        {error && (
          <p className="text-red-600 mb-4">{error}</p>
        )}

        <button
          disabled={loading}
          className="bg-black text-white rounded-lg w-full p-3"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
