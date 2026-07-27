"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
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
          className="border rounded-lg w-full p-3 mb-4"
          placeholder="Username"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
        />

        <input
          type="password"
          className="border rounded-lg w-full p-3 mb-4"
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
