import React, { useState } from "react";
import "./Onboarding.css";

interface LandingPageProps {
    onNewUser: () => void;
    onExistingUser: (email: string) => Promise<void>;
    loading: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNewUser, onExistingUser, loading }) => {
    const [email, setEmail] = useState("");
    const [showEmailInput, setShowEmailInput] = useState(false);

    const handleVerify = async () => {
        if (!email || !email.includes("@")) {
            alert("Please enter a valid email address");
            return;
        }
        await onExistingUser(email);
    };

    return (
        <div className="landing-page">
            <div className="landing-header">
                <img src="/assets/icon128.png" alt="Logo" className="landing-logo" />
                <h1>Welcome to Autofill Assistant</h1>
                <p>The smartest way to fill job applications</p>
            </div>

            {!showEmailInput ? (
                <div className="landing-options">
                    <button className="landing-btn primary" onClick={onNewUser}>
                        <span className="btn-icon">✨</span>
                        <div className="btn-text">
                            <strong>New User</strong>
                            <span>Start fresh and build your profile</span>
                        </div>
                    </button>

                    <button className="landing-btn secondary" onClick={() => setShowEmailInput(true)}>
                        <span className="btn-icon">🔄</span>
                        <div className="btn-text">
                            <strong>Existing User</strong>
                            <span>Restore your data using email</span>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="email-verify-section">
                    <h3>Enter your registered email</h3>
                    <div className="email-input-group">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="landing-email-input"
                            disabled={loading}
                        />
                        <button
                            className="verify-btn"
                            onClick={handleVerify}
                            disabled={loading || !email}
                        >
                            {loading ? "Verifying..." : "Verify & Restore"}
                        </button>
                    </div>
                    <button className="back-link" onClick={() => setShowEmailInput(false)}>
                        ← Back to options
                    </button>
                </div>
            )}

            <div className="landing-footer">
                <p>Your data is securely stored and encrypted.</p>
            </div>
        </div>
    );
};

export default LandingPage;
