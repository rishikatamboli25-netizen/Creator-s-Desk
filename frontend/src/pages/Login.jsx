import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

  const handleSendCode = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // 1. Force the +91 format for the outgoing request
    const cleanPhone = phone.startsWith("+91") 
      ? phone 
      : `+91${phone.replace(/\D/g, "")}`;

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 2. Send the cleaned, formatted number
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await response.json();

      if (response.ok) {
        // 3. Update the state so Step 2 uses this EXACT string
        setPhone(cleanPhone); 
        setStep(2);
      } else {
        alert(data.error || "Failed to send code");
      }
    } catch (error) {
      console.error("Gateway connection error:", error);
      alert("Cannot connect to server.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/auth/verify-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The 'phone' state now perfectly matches what Twilio has on file
          body: JSON.stringify({ phone, code: otp }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        login(data.token, data.user);

        const destination = location.state?.returnTo || "/profile";
        navigate(destination);
      } else {
        alert(data.error || "Invalid code");
      }
    } catch (error) {
      console.error("Gateway connection error:", error);
      alert("Cannot connect to server.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-89px)] bg-creator-white flex items-center justify-center p-8">
      <div className="w-full max-w-md border border-creator-border p-10 md:p-14 bg-creator-surface">
        <div className="text-center mb-10">
          <Link
            to="/"
            className="text-2xl font-bold tracking-tighter text-creator-black inline-block mb-2"
          >
            CREATOR'S DESK.
          </Link>
          <p className="text-sm text-creator-muted">
            {step === 1 ? "Secure, passwordless access." : "Check your device."}
          </p>
        </div>

        {/* STEP 1: Enter Phone Number */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-6 flex flex-col">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-creator-black mb-3 font-medium">
                Phone Number
              </span>
              <input
                type="tel"
                required
                placeholder="+91 00000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-creator-white tracking-wide"
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full py-5 text-sm uppercase tracking-widest transition-colors ${
                isProcessing
                  ? "bg-creator-muted text-white cursor-not-allowed"
                  : "bg-creator-black text-creator-white hover:bg-gray-900"
              }`}
            >
              {isProcessing ? "Sending..." : "Send Login Code"}
            </button>
          </form>
        )}

        {/* STEP 2: Enter OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-6 flex flex-col">
            <label className="block text-center">
              <span className="block text-xs uppercase tracking-widest text-creator-black mb-4 font-medium">
                Enter 6-Digit Code
              </span>
              <input
                type="text"
                required
                maxLength="6"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-creator-border p-4 text-2xl text-center outline-none focus:border-creator-black transition-colors bg-creator-white tracking-[1em]"
                autoFocus
              />
              <span className="block text-xs text-creator-muted mt-4">
                Sent to {phone}
              </span>
            </label>

            <button
              type="submit"
              disabled={isProcessing || otp.length !== 6}
              className={`w-full py-5 text-sm uppercase tracking-widest transition-colors ${
                isProcessing || otp.length !== 6
                  ? "bg-creator-muted text-white cursor-not-allowed"
                  : "bg-creator-black text-creator-white hover:bg-gray-900"
              }`}
            >
              {isProcessing ? "Verifying..." : "Verify & Login"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs uppercase tracking-widest text-creator-muted hover:text-creator-black transition-colors w-full text-center mt-4 underline underline-offset-4"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

export default Login;