const { google } = require("googleapis");

function crearClienteGmail() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oAuth2Client });
}

function construirMensajeBase64(destinatario, asunto, textoPlano) {
  const remitente = process.env.GMAIL_SENDER_EMAIL;
  const mensaje = [
    `From: SPEAL Project Control <${remitente}>`,
    `To: ${destinatario}`,
    `Subject: ${asunto}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    textoPlano,
  ].join("\n");

  return Buffer.from(mensaje)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function enviarCorreo({ destinatario, asunto, textoPlano }) {
  const gmail = crearClienteGmail();
  const raw = construirMensajeBase64(destinatario, asunto, textoPlano);
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

module.exports = { enviarCorreo };
