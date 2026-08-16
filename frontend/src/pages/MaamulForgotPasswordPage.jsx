import Card from "../components/ui/Card.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import ForgotPasswordForm from "../components/ForgotPasswordForm.jsx";

/** Same standalone shell as MaamulLoginPage - no public navbar/footer. */
export default function MaamulForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-5">
      <div className="absolute top-5 right-5"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6 font-extrabold text-xl">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="15" stroke="#4f46e5" strokeWidth="2" />
            <circle cx="16" cy="16" r="4.5" fill="#4f46e5" />
          </svg>
          <span>EventMedia</span>
        </div>
        <Card>
          <h1 className="text-lg font-bold mt-0 mb-1 text-center">Reset administrator password</h1>
          <p className="text-muted text-center mt-0 mb-5 text-sm">We'll email a 6-digit code to confirm it's you.</p>
          <ForgotPasswordForm loginPath="/maamul/login" />
        </Card>
      </div>
    </div>
  );
}
