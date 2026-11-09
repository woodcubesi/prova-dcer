import "dotenv/config";
import assert from "node:assert/strict";
import { SMTPServer } from "smtp-server";
import { prisma } from "../src/lib/prisma";
import { decryptSmtpPassword, encryptSmtpPassword, getPublicMailConfig, mailSettingsSchema, saveMailConfig } from "../src/lib/system-mail-config";
import { getAppUrl, getSmtpTransportOptions, sendAdminMfaResetEmail, sendAdminPasswordResetEmail, sendSmtpTestEmail } from "../src/lib/mail";

async function main() {
  const original = await prisma.systemMailSettings.findUnique({where:{id:1}});
  const messages: string[] = [];
  const server = new SMTPServer({
    authOptional:true, disabledCommands:["AUTH", "STARTTLS"], logger:false,
    onData(stream, _session, callback) {
      let text = "";
      stream.on("data", chunk => {text += chunk.toString();});
      stream.on("end", () => {messages.push(text); callback();});
    },
  });
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  const address = server.server.address();
  assert.ok(address && typeof address !== "string");
  const input = mailSettingsSchema.parse({enabled:true, host:"127.0.0.1", port:address.port, security:"NONE", useAuth:false, username:"", password:"", fromName:"Teste DCER", fromEmail:"sender@example.test", appUrl:"https://provas.example.test"});
  try {
    await saveMailConfig(input);
    assert.equal(await getAppUrl(), input.appUrl);
    await sendSmtpTestEmail("recipient@example.test");
    await sendAdminPasswordResetEmail({to:"recipient@example.test",name:"Aluno Teste",resetUrl:`${await getAppUrl()}/admin/redefinir-senha?token=fixture`,expiresInMinutes:30});
    await sendAdminMfaResetEmail({to:"recipient@example.test",name:"Aluno Teste",resetUrl:`${await getAppUrl()}/admin/redefinir-mfa/confirmar?token=fixture`,expiresInMinutes:30});
    assert.equal(messages.length,3);
    assert.match(messages[1],/provas\.example\.test/);
    assert.match(messages[2],/redefinir-mfa/);
    console.log("SMTP_RELAY_PASSWORD_AND_MFA_OK");
    const password = "fixture-secret-\u00e9-with-spaces";
    const cipher = encryptSmtpPassword(password);
    assert.equal(decryptSmtpPassword(cipher),password);
    assert.equal(cipher.includes(password),false);
    assert.throws(() => decryptSmtpPassword(cipher.replace(/^v1:/,"v2:")));
    await saveMailConfig({...input,security:"STARTTLS",useAuth:true,username:"fixture",password});
    const row = await prisma.systemMailSettings.findUniqueOrThrow({where:{id:1}});
    assert.notEqual(row.passwordEncrypted,password);
    assert.equal(JSON.stringify(await getPublicMailConfig()).includes(password),false);
    await saveMailConfig({...input,security:"STARTTLS",useAuth:true,username:"fixture",password:""});
    assert.equal((await prisma.systemMailSettings.findUniqueOrThrow({where:{id:1}})).passwordEncrypted,row.passwordEncrypted);
    await assert.rejects(saveMailConfig({...input,host:"other.example.test",security:"STARTTLS",useAuth:true,username:"fixture",password:""}),/SMTP_NEW_PASSWORD_REQUIRED/);
    const options = getSmtpTransportOptions({...input,source:"database",security:"AUTO",useAuth:true,username:"fixture",password});
    assert.equal(options.requireTLS,true);
    assert.equal(options.tls?.rejectUnauthorized,true);
    assert.equal(mailSettingsSchema.safeParse({...input,useAuth:true,security:"NONE"}).success,false);
    assert.equal(mailSettingsSchema.safeParse({...input,appUrl:"https://user:secret@example.test"}).success,false);
    assert.equal(mailSettingsSchema.safeParse({...input,host:"smtp://example.test"}).success,false);
    assert.equal(mailSettingsSchema.safeParse({...input,port:70000}).success,false);
    await saveMailConfig({...input,enabled:false});
    await assert.rejects(sendSmtpTestEmail("recipient@example.test"),/SMTP_DISABLED/);
    await assert.rejects(sendAdminPasswordResetEmail({to:"recipient@example.test",name:"Teste",resetUrl:"https://example.test",expiresInMinutes:30}),/SMTP_DISABLED/);
    assert.equal((await prisma.systemMailSettings.findUniqueOrThrow({where:{id:1}})).passwordEncrypted,null);
    assert.equal(messages.length,3);
    console.log("SMTP_ENCRYPTION_VALIDATION_DISABLED_AND_PASSWORD_PRESERVATION_OK");
  } finally {
    if(original) await prisma.systemMailSettings.upsert({where:{id:1},create:original,update:original});
    else await prisma.systemMailSettings.deleteMany({where:{id:1}});
    await new Promise<void>(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
}
main().catch(error => {console.error(error);process.exitCode=1;});
