import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";

import { BRAND } from "@/app/brand";
import { BrandMark } from "@/components/layout/BrandMark";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { errorMessage } from "@/app/queryClient";
import { Button, Card, ErrorState, Input, Loader } from "@/components/ui";
import { GoogleButton } from "@/features/auth/GoogleButton";
import { useLogin, useLogout, useMe, useRegister } from "@/features/auth/hooks";
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  type LoginForm,
  type RegisterForm,
} from "@/features/auth/schemas";
import { useFieldError } from "@/hooks/useFieldError";
import { toast } from "@/stores/toastStore";
import { consumeAfterAuth, peekAfterAuth } from "@/utils/afterAuth";

import styles from "../Landing/Landing.module.css";

function applyServerErrors<T extends Record<string, unknown>>(
  error: unknown,
  setError: (name: keyof T & string, e: { message: string }) => void,
  fields: (keyof T & string)[],
) {
  if (error instanceof ApiError) {
    const fieldErrors = error.fieldErrors();
    let applied = false;
    for (const field of fields) {
      if (fieldErrors[field]) {
        setError(field, { message: fieldErrors[field] });
        applied = true;
      }
    }
    if (!applied) toast.error(errorMessage(error));
  } else {
    toast.error(errorMessage(error));
  }
}

/** New senders often land in spam/promotions: tell people where else to look. */
function SpamHint() {
  const { t } = useTranslation();
  return (
    <p className="muted" style={{ fontSize: 14 }}>
      📬 {t("auth.checkSpam")}
    </p>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? peekAfterAuth() ?? "/";
  const [params] = useSearchParams();
  const googleError = params.get("error");
  const login = useLogin();
  const { register, handleSubmit, setError, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => navigate(consumeAfterAuth(from), { replace: true }),
      onError: (error) => {
        if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
          setError("password", { message: t("auth.invalidCredentials") });
        } else applyServerErrors<LoginForm>(error, setError, ["email", "password"]);
      },
    }),
  );

  return (
    <main className={styles.authPage}>
      <Link to="/" aria-label={BRAND} style={{ textDecoration: "none" }}>
        <BrandMark />
      </Link>
      <h1>{t("auth.loginTitle")}</h1>
      {googleError && (
        <p role="alert" style={{ color: "var(--color-danger)" }}>
          {t(googleError === "inactive" ? "auth.googleInactive" : "auth.googleFailed")}
        </p>
      )}
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          {...register("email")}
          error={fe(formState.errors.email?.message)}
        />
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete="current-password"
          {...register("password")}
          error={fe(formState.errors.password?.message)}
        />
        <Button type="submit" size="lg" block loading={login.isPending}>
          {t("auth.login")}
        </Button>
      </form>
      <Link to="/auth/forgot-password" className="muted">
        {t("auth.forgot")}
      </Link>
      <div className={styles.divider}>{t("auth.or")}</div>
      <GoogleButton redirectTo={from} />
      <p>
        {t("auth.noAccount")} <Link to="/auth/register">{t("auth.register")}</Link>
      </p>
    </main>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const { register, handleSubmit, setError, formState } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = handleSubmit((values) =>
    registerMutation.mutate(values, {
      onSuccess: () => navigate("/auth/verify-pending", { replace: true }),
      onError: (error) => {
        if (error instanceof ApiError && error.code === "EMAIL_TAKEN")
          setError("email", { message: t("errors.EMAIL_TAKEN") });
        else applyServerErrors<RegisterForm>(error, setError, ["email", "password", "display_name"]);
      },
    }),
  );

  return (
    <main className={styles.authPage}>
      <Link to="/" aria-label={BRAND} style={{ textDecoration: "none" }}>
        <BrandMark />
      </Link>
      <h1>{t("auth.registerTitle")}</h1>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t("auth.displayName")}
          autoComplete="given-name"
          {...register("display_name")}
          error={fe(formState.errors.display_name?.message)}
        />
        <Input
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          {...register("email")}
          error={fe(formState.errors.email?.message)}
        />
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete="new-password"
          hint={t("auth.passwordHint")}
          {...register("password")}
          error={fe(formState.errors.password?.message)}
        />
        <Button type="submit" size="lg" block loading={registerMutation.isPending}>
          {t("auth.register")}
        </Button>
        <p className="muted" style={{ fontSize: 13 }}>
          {t("auth.terms")}{" "}
          <Trans
            i18nKey="legal.agree"
            components={{ terms: <Link to="/terms" />, privacy: <Link to="/privacy" /> }}
          />
        </p>
      </form>
      <div className={styles.divider}>{t("auth.or")}</div>
      <GoogleButton />
      <p>
        {t("auth.hasAccount")} <Link to="/auth/login">{t("auth.login")}</Link>
      </p>
    </main>
  );
}

export function VerifyPendingPage() {
  const { t } = useTranslation();
  const { data: me, refetch, isFetching } = useMe();
  const navigate = useNavigate();
  const logout = useLogout();
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (me?.email_verified) navigate("/", { replace: true });
  }, [me, navigate]);

  const resend = async () => {
    await authApi.resendVerification().catch((e) => toast.error(errorMessage(e)));
    setResent(true);
  };

  return (
    <main className={styles.authPage}>
      <h1>📧 {t("auth.verifyTitle")}</h1>
      <p>{t("auth.verifyText", { email: me?.email ?? "" })}</p>
      <SpamHint />
      <Button onClick={() => void refetch()} loading={isFetching} block>
        {t("auth.iVerified")}
      </Button>
      <Button variant="secondary" onClick={resend} disabled={resent} block>
        {resent ? t("auth.verifyResent") : t("auth.verifyResend")}
      </Button>
      <Button variant="ghost" onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/") })}>
        {t("auth.logout")}
      </Button>
    </main>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"checking" | "ok" | "failed">(token ? "checking" : "failed");
  const { refetch } = useMe();

  useEffect(() => {
    if (!token) return;
    authApi
      .verifyEmail(token)
      .then(() => {
        setState("ok");
        void refetch();
      })
      .catch(() => setState("failed"));
  }, [token, refetch]);

  return (
    <main className={styles.authPage}>
      {state === "checking" && (
        <>
          <Loader />
          <p>{t("auth.verifyChecking")}</p>
        </>
      )}
      {state === "ok" && (
        <Card className="stack">
          <h2>✅ {t("auth.verifySuccess")}</h2>
          <Link to={peekAfterAuth() ?? "/"}>
            <Button block>{t("auth.verifiedContinue")}</Button>
          </Link>
        </Card>
      )}
      {state === "failed" && <ErrorState message={t("auth.verifyFailed")} />}
    </main>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });
  return (
    <main className={styles.authPage}>
      <h1>{t("auth.resetTitle")}</h1>
      {sent ? (
        <Card className="stack-sm">
          <span>{t("auth.resetSent")}</span>
          <SpamHint />
        </Card>
      ) : (
        <form className="stack" onSubmit={onSubmit} noValidate>
          <p className="muted">{t("auth.resetText")}</p>
          <Input
            label={t("auth.email")}
            type="email"
            {...register("email")}
            error={fe(formState.errors.email?.message)}
          />
          <Button type="submit" block loading={formState.isSubmitting}>
            {t("auth.resetSend")}
          </Button>
        </form>
      )}
      <Link to="/auth/login">{t("auth.login")}</Link>
    </main>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { register, handleSubmit, formState, setError } = useForm<{ password: string }>({
    resolver: zodResolver(passwordSchema),
  });
  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await authApi.confirmPasswordReset(params.get("uid") ?? "", params.get("token") ?? "", password);
      toast.success(t("auth.passwordChanged"));
      navigate("/auth/login", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors().password)
        setError("password", { message: error.fieldErrors().password! });
      else toast.error(errorMessage(error));
    }
  });
  return (
    <main className={styles.authPage}>
      <h1>{t("auth.resetTitle")}</h1>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t("auth.newPassword")}
          type="password"
          autoComplete="new-password"
          {...register("password")}
          error={fe(formState.errors.password?.message)}
        />
        <Button type="submit" block loading={formState.isSubmitting}>
          {t("auth.setPassword")}
        </Button>
      </form>
    </main>
  );
}
