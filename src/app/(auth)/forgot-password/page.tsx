import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/modules/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request password reset instructions for your account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
