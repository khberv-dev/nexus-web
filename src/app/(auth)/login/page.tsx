"use client"

import { LoginRoleBoard } from "./login-role-board"
import { AuthEmailModal } from "./modals/auth-email-modal"
import { RegisterClientModal } from "./modals/register-client-modal"
import { RegisterSpecialistModal } from "./modals/register-specialist-modal"
import { loginShellStyle } from "./styles"
import { useLoginPage } from "./use-login-page"

export default function LoginPage() {
  const {
    selected,
    setSelected,
    mobile,
    authOpen,
    regOpen,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    sent,
    regForm,
    setRegForm,
    regLoading,
    regError,
    regSent,
    closeAuth,
    closeReg,
    openAuth,
    openReg,
    sendMagicLinkAuth,
    signInWithPassword,
    submitClientRegister,
    submitSpecialistRegister,
    specialistDataConsent,
    setSpecialistDataConsent,
    clientDataConsent,
    setClientDataConsent,
    zitadelEnabled,
  } = useLoginPage()

  return (
    <div style={loginShellStyle(mobile)}>
      <div style={{ marginBottom: mobile ? "1.35rem" : "2rem" }}>
        <h1
          style={{
            color: "#f4f4f4",
            fontSize: mobile ? "clamp(1.65rem,6vw,2.25rem)" : "clamp(2rem,5vw,3rem)",
            fontWeight: 500,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Войти
        </h1>
      </div>

      <LoginRoleBoard
        selected={selected}
        setSelected={setSelected}
        mobile={mobile}
        openAuth={openAuth}
        openReg={openReg}
        zitadelEnabled={zitadelEnabled}
      />

      <AuthEmailModal
        open={authOpen}
        onClose={closeAuth}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        loading={loading}
        error={error}
        sent={sent}
        onSubmit={sendMagicLinkAuth}
        onSubmitPassword={signInWithPassword}
      />

      <RegisterClientModal
        open={regOpen && selected === "CLIENT"}
        onClose={closeReg}
        regForm={regForm}
        setRegForm={setRegForm}
        regLoading={regLoading}
        regError={regError}
        regSent={regSent}
        dataConsent={clientDataConsent}
        setDataConsent={setClientDataConsent}
        onSubmit={submitClientRegister}
        onSwitchToLogin={openAuth}
      />

      <RegisterSpecialistModal
        open={regOpen && selected === "SPECIALIST"}
        onClose={closeReg}
        regForm={regForm}
        setRegForm={setRegForm}
        regLoading={regLoading}
        regError={regError}
        regSent={regSent}
        dataConsent={specialistDataConsent}
        setDataConsent={setSpecialistDataConsent}
        onSubmit={submitSpecialistRegister}
        onSwitchToLogin={openAuth}
      />
    </div>
  )
}
