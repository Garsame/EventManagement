import Card from "../components/ui/Card.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import ForgotPasswordForm from "../components/ForgotPasswordForm.jsx";

export default function ForgotPasswordPage() {
  return (
    <PublicLayout>
      <div className="shell-wrap page" style={{ maxWidth: 460 }}>
        <PageHeader title="Reset your password" subtitle="We'll email a 6-digit code to confirm it's you" />
        <Card>
          <ForgotPasswordForm loginPath="/login" />
        </Card>
      </div>
    </PublicLayout>
  );
}
