import { t } from "@/i18n";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <main className="page">
      <div className="card">
        <h1>{t("resetPassword.title")}</h1>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
