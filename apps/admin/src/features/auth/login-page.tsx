import { useState } from "react";
import { adminLogin } from "../../lib/admin-api";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          await adminLogin(email, password);
          onSuccess();
        } catch {
          setError("Invalid credentials");
        }
      }}
      style={{ display: "grid", gap: 8, maxWidth: 360 }}
    >
      <h1>Admin login</h1>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
      />
      <button type="submit">Login</button>
      {error ? <p>{error}</p> : null}
    </form>
  );
}
