"use client";

import { useState } from "react";
import { Zap, Mail, Lock, User, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { signIn } from "next-auth/react";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState("player"); // "player" or "owner"

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      role: userType
    });
    
    setIsLoading(false);
    
    if (res?.ok) {
      router.push(userType === "player" ? "/player" : "/owner");
    } else {
      alert("Invalid credentials or authentication failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    // Google provider won't capture the selected role immediately without custom pages,
    // but for MVP we will just trigger the redirect.
    signIn("google", { callbackUrl: userType === "player" ? "/player" : "/owner" });
  };

  return (
    <main className="auth-container">
      <div className="hero-glow" style={{ top: "50%", left: "50%" }}></div>
      
      <div className="auth-card">
        <div className="auth-header">
          <div className="navbar-logo" style={{ justifyContent: "center", marginBottom: "1rem", fontSize: "2rem" }}>
            <Zap size={32} color="var(--primary)" />
            PLAYOS
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Select your account type to continue</p>
        </div>

        <div className="role-selector">
          <button 
            className={`role-btn ${userType === 'player' ? 'active' : ''}`}
            onClick={() => setUserType('player')}
          >
            <User size={20} />
            Player
          </button>
          <button 
            className={`role-btn ${userType === 'owner' ? 'active' : ''}`}
            onClick={() => setUserType('owner')}
          >
            <Building2 size={20} />
            Box Owner
          </button>
        </div>

        <form onSubmit={handleLogin} style={{ marginTop: "1.5rem" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                id="email" 
                type="email" 
                className="form-input" 
                style={{ paddingLeft: "2.75rem" }}
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                id="password" 
                type="password" 
                className="form-input" 
                style={{ paddingLeft: "2.75rem" }}
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? "Signing in..." : `Sign In as ${userType === 'player' ? 'Player' : 'Owner'}`}
          </button>
        </form>

        <div className="auth-divider">OR</div>

        <button type="button" onClick={handleGoogleSignIn} className="btn btn-google btn-block" disabled={isLoading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {isLoading ? "Connecting to Google..." : "Sign in with Google"}
        </button>

        <div className="auth-footer">
          Don't have an account? <a href="#">Sign Up</a>
        </div>
      </div>
    </main>
  );
}
