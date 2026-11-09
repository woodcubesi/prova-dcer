"use client";

import { useActionState, useState } from "react";
import { saveSystemMailAction, testSystemMailAction, type SystemMailFormState } from "@/app/actions/system";
import type { PublicMailConfig, MailSecurity } from "@/lib/system-mail-config";

const field = "mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";
const button = "rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold disabled:opacity-50";
function Result({state}: {state:SystemMailFormState}) {
  return state.error ? <p role="alert" className="text-sm text-[var(--danger-text)]">{state.error}</p> : state.success ? <p role="status" className="text-sm text-[var(--success-text)]">{state.success}</p> : null;
}
export function SystemMailForm({initial, recipient}: {initial:PublicMailConfig; recipient:string}) {
  const [values, setValues] = useState({...initial, password:""});
  const [destination, setDestination] = useState(recipient);
  const [hasSavedPassword, setHasSavedPassword] = useState(initial.hasPassword);
  const [dirty, setDirty] = useState(false);
  const [savedConfig, setSavedConfig] = useState({enabled:initial.enabled, source:initial.source});
  const [state, action, pending] = useActionState(async (previous: SystemMailFormState, data: FormData) => {
    const result = await saveSystemMailAction(previous, data);
    if (result.saved) {
      setHasSavedPassword(data.get("useAuth") === "on" && (Boolean(data.get("password")) || hasSavedPassword));
      setValues(current => ({...current,password:""}));
      setDirty(false);
      setSavedConfig({enabled:data.get("enabled") === "on", source:"database"});
    }
    return result;
  }, {});
  const [test, testAction, testing] = useActionState(testSystemMailAction, {});
  const change = (name: keyof typeof values, value: string | boolean) => {
    setValues(current => ({...current,[name]:value})); setDirty(true);
  };
  return <div className="max-w-4xl">
    <section className="border-b border-[var(--border)] pb-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">E-mail / SMTP</h2>
        <span className="text-sm text-[var(--muted)]">{savedConfig.source === "environment" ? "Configuracao do ambiente" : savedConfig.source === "unconfigured" ? "Nao configurado" : savedConfig.enabled ? "Ativo" : "Desativado"}</span>
      </div>
      <form action={action} data-form-draft="off" className="grid gap-4">
        <fieldset disabled={pending} className="contents">
        <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" checked={values.enabled} onChange={e => change("enabled",e.target.checked)} />Ativar envio de e-mails</label>
        <label className="text-sm">Endereco publico do sistema<input name="appUrl" type="url" required value={values.appUrl} onChange={e => change("appUrl",e.target.value)} className={field} /></label>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <label className="text-sm">Servidor SMTP<input name="host" value={values.host} onChange={e => change("host",e.target.value)} required={values.enabled} className={field} autoComplete="off" /></label>
          <label className="text-sm">Porta<input name="port" type="number" min="1" max="65535" required value={values.port} onChange={e => change("port",e.target.value)} className={field} /></label>
        </div>
        <label className="text-sm">Seguranca da conexao<select name="security" value={values.security} onChange={e => change("security",e.target.value as MailSecurity)} className={field}>
          <option value="STARTTLS">STARTTLS obrigatorio</option><option value="TLS">TLS direto</option><option value="AUTO">STARTTLS automatico</option><option value="NONE">Sem TLS (relay sem autenticacao)</option>
        </select></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Nome do remetente<input name="fromName" required value={values.fromName} onChange={e => change("fromName",e.target.value)} className={field} /></label>
          <label className="text-sm">E-mail do remetente<input name="fromEmail" type="email" required={values.enabled} value={values.fromEmail} onChange={e => change("fromEmail",e.target.value)} className={field} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input name="useAuth" type="checkbox" checked={values.useAuth} onChange={e => change("useAuth",e.target.checked)} />Autenticacao com usuario e senha</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Usuario SMTP<input name="username" disabled={!values.useAuth} required={values.enabled && values.useAuth} value={values.username} onChange={e => change("username",e.target.value)} className={field} autoComplete="off" /></label>
          <label className="text-sm">Senha SMTP{hasSavedPassword && values.useAuth ? <span className="ml-2 text-xs text-[var(--muted)]">Senha salva</span> : null}<input name="password" type="password" disabled={!values.useAuth} value={values.password} onChange={e => change("password",e.target.value)} className={field} autoComplete="new-password" /></label>
        </div>
        <Result state={state} />
        <div><button disabled={pending} className={button}>{pending ? "Salvando..." : "Salvar configuracao"}</button></div>
        </fieldset>
      </form>
    </section>
    <section className="pt-6">
      <h2 className="mb-4 text-lg font-semibold">E-mail de teste</h2>
      <form action={testAction} data-form-draft="off" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm">Destinatario<input name="recipient" type="email" required value={destination} onChange={e => setDestination(e.target.value)} className={field} /></label>
        <button disabled={testing || pending || dirty || !savedConfig.enabled} className={button}>{testing ? "Enviando..." : "Enviar teste"}</button>
        <div className="sm:col-span-2"><Result state={test} /></div>
      </form>
    </section>
  </div>;
}
